import assert from 'node:assert/strict';
import { readFileSync, writeFileSync } from 'node:fs';
import { buildReleaseIdentity } from '../../../build/release-identity';

const current=buildReleaseIdentity(process.cwd());
const packaged=JSON.parse(readFileSync('dist/.openai/release-provenance.json','utf8'));
assert.notEqual(current.sourceCommit,'unknown');
// Evidence-only commits may advance HEAD while retaining identical release inputs.
assert.match(packaged.sourceCommit,/^[a-f0-9]{40}$/);
assert.equal(packaged.applicationInputsSha256,current.applicationInputsSha256);
assert.equal(packaged.hostingConfigSha256,current.hostingConfigSha256);
assert.deepEqual(packaged.files,current.files);
const {files,...binding}=current;
const receipt={observedAt:new Date().toISOString(),...binding,sourceCommit:packaged.sourceCommit,verifiedAtHead:current.sourceCommit,inputFileCount:files.length,buildMatchesCurrentSource:true,deployed:false};
writeFileSync('docs/testing/inv01-2026-09-28/final-committed-source.json',JSON.stringify(receipt,null,2)+'\n');
console.log(JSON.stringify(receipt));
