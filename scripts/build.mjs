import {readFile,writeFile,mkdir,rm,cp} from 'node:fs/promises';
import {resolve,dirname} from 'node:path';
import {fileURLToPath} from 'node:url';
const root=resolve(dirname(fileURLToPath(import.meta.url)),'..');
const read=p=>readFile(resolve(root,p),'utf8');
const output=resolve(root,'dist');const docs=resolve(root,'docs');
// Both fixed directories belong to this project; never use caller-supplied delete paths.
await rm(output,{recursive:true,force:true});await rm(docs,{recursive:true,force:true});
await mkdir(resolve(output,'server'),{recursive:true});await mkdir(resolve(output,'.openai'),{recursive:true});await mkdir(docs,{recursive:true});
const catalog=await read('src/catalog.mjs');const collector=await read('src/collector.mjs');
const api='https://supplier-scout-artem.artem-goweb.chatgpt.site';
const sources={'index.html':['web/index.html','text/html; charset=utf-8'],'style.css':['web/style.css','text/css; charset=utf-8'],'readability.css':['web/readability.css','text/css; charset=utf-8'],'app.js':['web/app.js','text/javascript; charset=utf-8'],'favicon.svg':['web/favicon.svg','image/svg+xml'],'domain.mjs':['src/domain.mjs','text/javascript; charset=utf-8'],'catalog.mjs':['src/catalog.mjs','text/javascript; charset=utf-8']};
const assets={};
for(const [name,[path,type]] of Object.entries(sources)){const body=await read(path);assets['/'+name]={body,type};await writeFile(resolve(docs,name),body);}
assets['/config.js']={body:'window.POSTAVKA_API_BASE = "";\n',type:'text/javascript; charset=utf-8'};
await writeFile(resolve(docs,'config.js'),`window.POSTAVKA_API_BASE = ${JSON.stringify(api)};\n`);
await writeFile(resolve(docs,'.nojekyll'),'');
let handler=await read('worker/handler.mjs');handler=handler.replace(/^import .*;\r?\n/gm,'').replace('__ASSETS__',JSON.stringify(assets));
const worker=catalog+'\n'+collector+'\n'+handler;
await writeFile(resolve(root,'worker/index.js'),worker);
await writeFile(resolve(output,'server/index.js'),worker);await cp(resolve(root,'.openai/hosting.json'),resolve(output,'.openai/hosting.json'));
console.log(`Built Worker + GitHub Pages (${Object.keys(assets).length} assets, ${Buffer.byteLength(worker)} bytes).`);
