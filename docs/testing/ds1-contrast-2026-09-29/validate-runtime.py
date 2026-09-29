"""Validate the recorded DS-1 ordinary viewport captures; no browser or app writes."""
import json, hashlib
from pathlib import Path
ROOT = Path(__file__).resolve().parent
before = json.loads((ROOT / 'before-runtime.json').read_text(encoding='utf-8'))
after = json.loads((ROOT / 'after-runtime.json').read_text(encoding='utf-8'))
receipt = json.loads((ROOT / 'source-receipt.json').read_text(encoding='utf-8'))
assert before.get('completedAt') and not before.get('failure')
assert after.get('completedAt') and not after.get('failure')
assert before['cssSha256'] == receipt['beforeCssSha256']
assert after['cssSha256'] == receipt['afterCssSha256']
css = ROOT.parents[2] / 'app/globals.css'
assert hashlib.sha256(css.read_bytes()).hexdigest() == receipt['afterCssSha256']
expected = {(h,t,w) for h in ['generic','falcon'] for t in ['office','after-hours'] for w in [1366,1024,390]}
actual = {(s['host'],s['theme'],s['viewport']['w']) for s in after['scenarios']}
assert actual == expected and len(after['scenarios']) == 12
assert len(before['scenarios']) == 4
rows=[]; measures=0; focus_outlines=[]; preserved=0
for s in after['scenarios']:
    host, theme, width = s['host'], s['theme'], s['viewport']['w']
    assert 'theme-'+theme in s['shell'].split()
    assert ('studio-host-falcon' in s['shell'].split()) == (host == 'falcon')
    assert s['viewport']['h'] == (844 if width == 390 else 768)
    assert s['viewport']['cssZoom'] == '1' and s['viewport']['dpr'] == 1
    assert s['layout']['documentWidth'] <= width and s['layout']['bodyWidth'] <= width
    assert len(s['guide']) == 3 and len(s['nodeIdle']) == 10
    assert len({x['nodeColor'] for x in s['nodeIdle']}) == 10
    assert s['guideFocus'][0]['focus']
    focus_outlines.append(s['guideFocus'][0]['outline'])
    for x in s['nodeIdle']: assert not x['selected'] and not x['focus'] and not x['hover']
    groups = {k:s[k] for k in ['guide','nodeIdle','nodeSelected','nodeFocus','nodeHover']}
    for kind,field in [('nodeSelected','selected'),('nodeFocus','focus'),('nodeHover','hover')]:
        assert len(s[kind]) == (10 if width == 1366 else 2)
        for x in s[kind]:
            assert x[field] and x['color'] == 'rgb(6, 16, 25)'
            if field == 'focus': focus_outlines.append(x['outline'])
    for direction,states in s['relations'].items():
        for state,x in states.items():
            groups[direction+'_'+state] = [x]
            if state == 'normal': assert not x['selected'] and not x['focus'] and not x['hover']
            else: assert x[{'active':'selected','focus':'focus','hover':'hover'}[state]]
            if state == 'focus': focus_outlines.append(x['outline'])
    for xs in groups.values():
        measures += len(xs)
        for x in xs: assert x['contrast'] >= 4.5 and x['visible'] and x['opacity'] == '1', (host,theme,width,x)
    rows.append({'host':host,'theme':theme,'width':width,'height':s['viewport']['h'],'ranges':{k:{'min':min(x['contrast'] for x in xs),'max':max(x['contrast'] for x in xs),'count':len(xs)} for k,xs in groups.items()}})
    if width == 1366:
        old = next(x for x in before['scenarios'] if x['host']==host and x['theme']==theme)
        for kind in ['nodeSelected','nodeFocus','nodeHover']:
            for a,b in zip(old[kind],s[kind]):
                assert a['text']==b['text']
                for field in ['color','background','contrast','outline','shadow']: assert a[field]==b[field], (host,theme,kind,field)
                preserved += 1
        for direction in ['source','destination']:
            assert old['relations'][direction]['focus']['outline'] == s['relations'][direction]['focus']['outline']
for o in focus_outlines:
    assert o == {'color':'rgb(41, 88, 184)','offset':'3px','style':'solid','width':'3px'}, o
result={'result':'PASS for recorded DS-1 text contrast and state checks only','sourceBase':after['sourceBase'],'cssSha256':after['cssSha256'],'ordinaryViewportScenarios':len(rows),'scopedTextMeasurements':measures,'unchangedDesktopFilledNodeMeasurements':preserved,'focusOutlineMeasurements':len(focus_outlines),'focusOutline':focus_outlines[0],'minimumContrast':min(v['min'] for s in rows for v in s['ranges'].values()),'scenarios':rows,'limits':['Synthetic local fixture; not governed source-v2 upload acceptance.','Ordinary viewport sizes are emulation, not native zoom; native-zoom has separate receipts.','Focus modality checks are not a whole-product sequential keyboard/screen-reader audit.','Before ordinary matrix covers desktop only; after covers all three viewports.','Visibility means nonzero box and CSS visibility, not every sample simultaneously inside the viewport.']}
(ROOT / 'runtime-summary.json').write_text(json.dumps(result,indent=2)+'\n',encoding='utf-8')
print(json.dumps({k:v for k,v in result.items() if k != 'scenarios'}))
