import assert from 'node:assert/strict';
import {test} from 'node:test';
import {build} from 'esbuild';
import {mkdirSync,writeFileSync} from 'node:fs';
import {resolve} from 'node:path';
import {pathToFileURL} from 'node:url';
import {createElement} from 'react';
import {renderToStaticMarkup} from 'react-dom/server';
import {normalizeMatterDetail} from '../app/matters/matter-view-model';

test('decision map workflow offers named selection and keeps raw reference linking collapsed',async()=>{
 const result=await build({stdin:{contents:'export {DecisionPackagesSection} from "./app/matters/MattersClient"; export {publishedMaps} from "./app/matters/PublishedMapPicker";',resolveDir:process.cwd(),loader:'tsx'},bundle:true,write:false,format:'esm',platform:'node',packages:'external',loader:{'.css':'empty','.module.css':'empty'},jsx:'automatic',plugins:[{name:'router',setup(b){b.onResolve({filter:/^next\/navigation$/},()=>({path:'router',namespace:'test'}));b.onLoad({filter:/.*/,namespace:'test'},()=>({contents:'export const useRouter=()=>({});'}));}}]});
 mkdirSync('.artifacts/decision-map-test',{recursive:true});const file=resolve('.artifacts/decision-map-test/component.mjs');writeFileSync(file,result.outputFiles[0].text);
 const {DecisionPackagesSection,publishedMaps}=await import(pathToFileURL(file).href);
 const tuple={id:'synthetic_map',title:'A readable map',currentVersion:'2.1',fingerprint:'sha256-'+'a'.repeat(64)};
 assert.deepEqual(publishedMaps([tuple,{...tuple,fingerprint:'626'},{...tuple,currentVersion:null}]),[tuple]);
 assert.throws(()=>publishedMaps(null));
 const matter=normalizeMatterDetail({dossier:{dossier_id:'synthetic-case',title:'Synthetic case',revision:2,permissions:{can_write:true,can_generate_output:true}}});
 assert.ok(matter); const props={matter,packages:[],snapshots:[],view:'professional',mutationKey:null,onLink:()=>assert.fail('No render writes'),onSnapshot:()=>assert.fail('No render writes')};
 const html=renderToStaticMarkup(createElement(DecisionPackagesSection,props));
 assert.match(html,/Choose a published decision map/);assert.match(html,/Open AI Case Studio/);
 assert.match(html,/<details[^>]*><summary>Advanced: link by technical reference/);
 assert.doesNotMatch(html,/<details[^>]*\bopen[=> ]/);
 assert.match(html,/it does not create a decision map/);
 assert.match(html,/Save evidence for a report/);
 const denied=renderToStaticMarkup(createElement(DecisionPackagesSection,{...props,matter:{...matter,permissions:{...matter.permissions,canWrite:false,canGenerateOutput:false}}}));
 assert.doesNotMatch(denied,/name="packageId"|Choose a published decision map|Link selected map/);
});

