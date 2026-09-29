import assert from 'node:assert/strict';
import { readFileSync, writeFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
const [logPath, outputPath, exitText, startedAt, head] = process.argv.slice(2);
assert.ok(logPath && outputPath && startedAt && /^[a-f0-9]{40}$/.test(head));
const exitCode = Number(exitText);
assert.ok(Number.isInteger(exitCode));
const raw = readFileSync(logPath);
const log = raw.toString('utf8').replace(/\u001b\[[0-9;]*m/g, '');
const section = (start, end) => log.split(start)[1]?.split(end)[0] ?? '';
const suite = text => Object.fromEntries(['tests','pass','fail','cancelled','skipped','todo'].map(key => {
  const matches = [...text.matchAll(new RegExp('^# '+key+' (\\d+)$','gm'))];
  return [key, matches.length ? Number(matches.at(-1)[1]) : null];
}));
const rustText = section('[mobile 9/9]', '[native 1/3]');
const rustGroups = [...rustText.matchAll(/test result: ok\. (\d+) passed; (\d+) failed; (\d+) ignored;/g)];
const flutterCount = text => {
  const matches = [...text.matchAll(/\+(\d+): All tests passed!/g)];
  return matches.length ? Number(matches.at(-1)[1]) : null;
};
const stages = [...log.matchAll(/^\[(web|mobile|native) (\d+)\/(\d+)\] (.+)$/gm)].map(m => ({group:m[1],number:Number(m[2]),total:Number(m[3]),label:m[4]}));
const terminalPass = log.includes('PASS v62 Decision-Centric Dossier Workspace release verification on exact web and mobile heads.');
const receipt = {
  schema:'genesis.aggregate-observation.v1', recordedAt:new Date().toISOString(), startedAt,
  testedWebHead:head, observedExecExitCode:exitCode,
  result:exitCode===0 && terminalPass ? 'PASS' : 'FAIL_OR_INCOMPLETE',
  log:{path:logPath,bytes:raw.length,sha256:createHash('sha256').update(raw).digest('hex')},
  stages, terminalPass,
  webTests:suite(section('[web 4/10]','[web 5/10]')),
  dossierE2E:suite(section('[web 5/10]','[web 6/10]')),
  pdf:{files:47,pages:758,renderedPngs:758,goldenPngs:55,receiptFound:log.includes('PASS 47 PDFs, 758 pages and 758 rendered PNGs') && log.includes('(55 PNGs,')},
  productionAuditZeroVulnerabilities:section('[web 7/10]','[web 8/10]').includes('found 0 vulnerabilities'),
  flutterTests:flutterCount(section('[mobile 6/9]','[mobile 7/9]')),
  rust:{resultGroups:rustGroups.length,passed:rustGroups.reduce((n,m)=>n+Number(m[1]),0),failed:rustGroups.reduce((n,m)=>n+Number(m[2]),0),ignored:rustGroups.reduce((n,m)=>n+Number(m[3]),0)},
  androidIntegrationTests:flutterCount(section('[native 1/3]','[native 2/3]')),
  explicitSkippedTests:[...log.matchAll(/^ok \d+ - (.+) # SKIP$/gm)].map(m=>m[1]),
  limits:['Exec exit code is supplied from the observed completed tool invocation; this parser does not execute the gate.', 'Stored hosted workflow lock validation is not new hosted or iOS execution.', 'Android coverage is local x86_64 debug emulator integration, not physical hardware or a release APK.', 'PDF counts are automated structural/text/render/baseline checks, not a claim of fresh human inspection of all pages.', 'A passing existing gate does not close a separately reproduced P1 or incomplete browser, hosted, accessibility or human acceptance.'],
};
writeFileSync(outputPath, JSON.stringify(receipt,null,2)+'\n', {flag:'wx'});
console.log(JSON.stringify(receipt));
