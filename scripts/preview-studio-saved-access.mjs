import {build} from 'esbuild';
import {createServer} from 'node:http';
import {mkdir,readFile} from 'node:fs/promises';
import {resolve,join} from 'node:path';
import {pathToFileURL} from 'node:url';
import {fixturePort} from './preview-catalogue-interactions.mjs';
export async function startSavedAccessPreview(root,port){
 const output=resolve(root,'.artifacts/studio-saved-access');await mkdir(output,{recursive:true});
 await build({entryPoints:[join(root,'tests/fixtures/studio-saved-access.jsx')],outfile:join(output,'bundle.js'),bundle:true,format:'esm',platform:'browser'});
 const files=new Map([['/bundle.js',[join(output,'bundle.js'),'text/javascript']],...['globals.css','workspace-design.css','casevant.css','demo-catalogue.css'].map(name=>['/'+name,[join(root,'app',name),'text/css']])]);
 const server=createServer(async(req,res)=>{
  if(![`127.0.0.1:${port}`,`localhost:${port}`].includes(req.headers.host)){res.writeHead(403);res.end();return;}
  if(req.method!=='GET'){res.writeHead(405);res.end();return;}
  res.setHeader('Cache-Control','no-store');res.setHeader('X-Content-Type-Options','nosniff');
  const path=new URL(req.url,`http://127.0.0.1:${port}`).pathname;
  if(path==='/'){res.setHeader('Content-Type','text/html;charset=utf-8');res.end('<!doctype html><html lang="en"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Local synthetic saved access fixture</title>'+[...files.keys()].filter(x=>x.endsWith('.css')).map(x=>`<link rel="stylesheet" href="${x}">`).join('')+'<body><div id="root"></div><script type="module" src="/bundle.js"></script></body></html>');return;}
  const file=files.get(path);if(!file){res.writeHead(404);res.end();return;}
  try{res.setHeader('Content-Type',file[1]);res.end(await readFile(file[0]));}catch{res.writeHead(404);res.end();}
 });
 await new Promise((yes,no)=>{server.once('error',no);server.listen(port,'127.0.0.1',yes)});
 console.log(`Local synthetic access component: http://127.0.0.1:${port}/?lang=ru ; no case/API authority.`);return server;
}
if(process.argv[1]&&import.meta.url===pathToFileURL(process.argv[1]).href)await startSavedAccessPreview(resolve(import.meta.dirname,'..'),fixturePort(process.argv.slice(2)));
