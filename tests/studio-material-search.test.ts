import test from 'node:test';
import assert from 'node:assert/strict';
import { unzipSync, strFromU8 } from 'fflate';
import { buildCanopyPackage } from '../app/canopy-fixture';
import { buildConvertedExample } from '../app/converted-examples';
import { indexStudioMaterials, searchStudioMaterials, MATERIAL_SEARCH_LIMITS } from '../app/studio-material-search';
import { studioMaterials, studioMaterialsArchive, materialHash, type StudioMaterial } from '../app/studio-materials';

function item(text: string | null, overrides: Partial<StudioMaterial> = {}): StudioMaterial {
  return { id:'working:synthetic', title:'Synthetic record', kind:'working', text, note:'Unreviewed', selected:true, nodeIds:['synthetic'], ...overrides };
}

test('body-only search exposes exact retained Canopy section and preserves source/archive bytes', async () => {
  const draft=buildCanopyPackage('base').draft, before=JSON.stringify(draft);
  const materials=await studioMaterials(draft,'en'), index=indexStudioMaterials(materials);
  const result=searchStudioMaterials(index,'450 packs').find(row=>row.item.id==='canopy:D01:v1');
  assert.ok(result?.passage);
  assert.equal(result.passage.section,'Thresholds');
  assert.equal(result.passage.exact,'450 packs');
  assert.equal(result.item.text!.slice(result.passage.from,result.passage.to),'450 packs');
  assert.equal(index.limitedMaterials,0);
  const zip=await studioMaterialsArchive(draft,materials,()=>true); assert.ok(zip);
  const files=unzipSync(zip), manifest=JSON.parse(strFromU8(files['manifest.json']));
  const entry=manifest.entries.find((row:{id:string})=>row.id===result.item.id);
  assert.equal(entry.contentSha256,await materialHash(result.item.text!));
  assert.equal(strFromU8(files[entry.filename]),result.item.text);
  assert.equal(Object.hasOwn(entry,'sections'),false,'search metadata does not amend archive schema');
  assert.equal(manifest.entries.length,materials.length,'ZIP retains all versions, not current search results');
  assert.equal(JSON.stringify(draft),before);
});

test('folded matching retains exact accented/Cyrillic/combining text and UTF-16 offsets', () => {
  for (const [text,query,exact] of [
    ['😀 Café résumé — preserved','CAFE','Café'],
    ['Начало Ёлка и доказательства','елка','Ёлка'],
    ['a\u0301b remains literal','b','b'],
    ['Prefix Cafe\u0301 suffix','café','Cafe\u0301'],
  ]) {
    const source=item(text), result=searchStudioMaterials(indexStudioMaterials([source]),query)[0];
    assert.equal(result.passage?.exact,exact);
    assert.equal(text.slice(result.passage!.from,result.passage!.to),exact);
    assert.equal(source.text,text);
  }
});

test('metadata-only, missing and URL matches never invent a passage or fetch a body', () => {
  const missing=item(null,{id:'missing:original',kind:'missing',title:'Original unavailable'});
  const url=item(null,{id:'url:0',kind:'url',title:'https://example.test/record'});
  const index=indexStudioMaterials([missing,url,item('Actual text')]);
  assert.equal(searchStudioMaterials(index,'unavailable')[0].passage,undefined);
  assert.equal(searchStudioMaterials(index,'example.test')[0].passage,undefined);
  assert.equal(searchStudioMaterials(index,'nothing-matches').length,0);
  assert.equal(searchStudioMaterials(index,'   ').length,3);
  assert.equal(searchStudioMaterials(index,'\u0301').length,0);
  assert.equal(searchStudioMaterials(index,'x'.repeat(MATERIAL_SEARCH_LIMITS.query+1)).length,0);
});

test('retained versions have distinct source identities and unchanged exact text', async () => {
  const materials=await studioMaterials(buildCanopyPackage('base').draft,'en');
  const matches=searchStudioMaterials(indexStudioMaterials(materials),'fictional');
  assert.ok(matches.some(row=>row.item.id==='canopy:D03:v1'));
  assert.ok(matches.some(row=>row.item.id==='canopy:D03:v2'));
  assert.equal(new Set(matches.map(row=>row.item.id)).size,matches.length);
  const converted=await studioMaterials(buildConvertedExample('greenfire_first_72_hours','ru'),'ru');
  assert.equal(converted.filter(row=>row.kind==='missing').length,7);
  assert.ok(converted.filter(row=>row.kind==='missing').every(row=>row.text===null));
});

test('search ceilings are explicit and do not silently search beyond the bounded projection', t => {
  const started=performance.now();
  const large=item('a'.repeat(MATERIAL_SEARCH_LIMITS.body)+'outside-cap');
  const index=indexStudioMaterials([large]);
  assert.equal(index.limitedMaterials,1);
  assert.equal(searchStudioMaterials(index,'outside-cap').length,0);
  const total=indexStudioMaterials(Array.from({length:11},(_,i)=>item('a'.repeat(MATERIAL_SEARCH_LIMITS.body),{id:String(i)})));
  assert.equal(total.entries.reduce((n,row)=>n+row.body.length,0),MATERIAL_SEARCH_LIMITS.totalBody);
  assert.equal(total.limitedMaterials,1);
  const count=indexStudioMaterials(Array.from({length:1001},(_,i)=>item(null,{id:String(i)})));
  assert.equal(count.entries.length,1000); assert.equal(count.limitedMaterials,1);
  t.diagnostic(`Bounded synthetic index checks completed in ${Math.round(performance.now()-started)}ms; this is not a browser latency or user retrieval result.`);
});
