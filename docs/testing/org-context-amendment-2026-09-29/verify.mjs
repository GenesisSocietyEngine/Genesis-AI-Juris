import fs from 'node:fs';
import cp from 'node:child_process';
import path from 'node:path';
import crypto from 'node:crypto';
import assert from 'node:assert/strict';
const root=process.cwd(),out='docs/testing/org-context-amendment-2026-09-29/evidence',raw='.artifacts/org-context-amendment-2026-09-29/raw';
const base='bd8b0e07fe4b9c0eded527e1825f0fa3eb66956c',imported='781a62b69aa6784760d346754a84ef3218d66095';
const owned=['app/organizations/OrganizationsClient.tsx','tests/organization-context-continuity.test.ts'];
const nodeDir=path.dirname(process.execPath),npm=path.join(nodeDir,'node_modules/npm/bin/npm-cli.js');
process.env.PATH=nodeDir+';C:/Program Files/Git/bin;'+process.env.PATH;
const git=(...args)=>cp.execFileSync('git',args,{encoding:'utf8',windowsHide:true}).trim();
const hash=p=>crypto.createHash('sha256').update(fs.readFileSync(p)).digest('hex');
assert.equal(process.version,'v22.23.2');
assert.equal(cp.execFileSync(process.execPath,[npm,'--version'],{encoding:'utf8',windowsHide:true}).trim(),'10.9.8');
assert.equal(git('rev-parse','HEAD'),base);
const reviewedBlobs={'app/organizations/OrganizationsClient.tsx':'7b28ffffdd17615f99e33e3bc716cc7bfd63a607','tests/organization-context-continuity.test.ts':'1caa4300098dd7e3662dfc662a27c41b1186fec5'};
for(const file of owned)assert.equal(git('hash-object','--path='+file,file),reviewedBlobs[file],'Imported paths must equal reviewed blobs.');
assert.equal(fs.existsSync('node_modules'),false,'Fresh installation requires this isolated checkout to have no node_modules.');
fs.mkdirSync(out,{recursive:true});fs.mkdirSync(raw,{recursive:true});
const tracked=git('ls-files','-z').split('\0').filter(Boolean),before=Object.fromEntries(tracked.map(p=>[p,hash(p)]));
const receipt={baseCommit:base,importedCommit:imported,branch:git('branch','--show-current'),startedAt:new Date().toISOString(),nodeVersion:process.version,npmVersion:'10.9.8',ownedFiles:owned,sourceHashes:Object.fromEntries(owned.map(p=>[p,hash(p)])),manifestSha256:hash('package.json'),lockSha256:hash('package-lock.json'),pdfBaselineSha256:hash('parity/report-pdf-visual-baseline.v1.json'),workingInputs:'Base commit plus the two exact reviewed organization blobs; evidence is qualified by these hashes.',results:[],browserJourneys:'NOT_RUN',releaseAcceptance:'NOT_RUN'};
const save=()=>fs.writeFileSync(out+'/result.json',JSON.stringify(receipt,null,2)+'\n');
const run=(label,args,file)=>{
 console.log('START '+label);
 const rawPath=raw+'/'+file,fd=fs.openSync(rawPath,'w'),startedAt=new Date().toISOString();
 const result=cp.spawnSync(process.execPath,args,{stdio:['ignore',fd,fd],windowsHide:true,timeout:1200000});
 fs.closeSync(fd);
 const rawBytes=fs.readFileSync(rawPath),rawSha256=crypto.createHash('sha256').update(rawBytes).digest('hex');
 let text=rawBytes.toString('utf8').split(root).join('<worktree>').split(root.replaceAll('\\','/')).join('<worktree>').replace(/\r\n/g,'\n').split('\n').map(line=>line.replace(/[ \t]+$/,'')).join('\n').replace(/\n*$/,'\n');
 fs.writeFileSync(out+'/'+file,text);
 receipt.results.push({label,command:['node',...args.map(a=>a===npm?'npm-cli.js':a)],exit:result.status,error:result.error?.message,startedAt,finishedAt:new Date().toISOString(),log:file,rawSha256,readableSha256:hash(out+'/'+file)});
 save();assert.ifError(result.error);assert.equal(result.status,0,'Inspect '+file);console.log('PASS '+label);
};
save();
try {
 run('Fresh lock-enforcing installation',[npm,'ci','--no-fund'],'install.log');
 assert.equal(hash('package-lock.json'),receipt.lockSha256,'npm ci must preserve the lock');
 assert.equal(hash('package.json'),receipt.manifestSha256,'npm ci must preserve the manifest');
 run('Organization continuity regression',['--experimental-sqlite','--import','tsx','--test','tests/organization-context-continuity.test.ts'],'continuity.log');
 run('Existing organization, invitation and navigation regression',['--experimental-sqlite','--import','tsx','--test','tests/organization-admin-model.test.ts','tests/organization-client.test.ts','tests/organization-onboarding.test.ts','tests/p1-organization-erp.test.ts','tests/navigation-shell.test.ts','tests/sidebar-navigation.test.ts','tests/email-invitations.test.ts'],'regression.log');
 run('Strict nonincremental TypeScript',[npm,'run','typecheck'],'typecheck.log');
 run('Focused source and regression lint',['node_modules/eslint/bin/eslint.js',...owned],'lint.log');
 receipt.changedTrackedPaths=tracked.filter(p=>hash(p)!==before[p]);
 assert.deepEqual(receipt.changedTrackedPaths,[],'Verification must not alter tracked input');
 receipt.trackedInputsUnchanged=true;receipt.status='PASS';receipt.finishedAt=new Date().toISOString();save();
 console.log('PASS complete bounded verification');
} catch(error) {
 receipt.status='FAIL';receipt.failure=error.message;receipt.finishedAt=new Date().toISOString();save();console.error(error);process.exitCode=1;
}
