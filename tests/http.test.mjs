import test from 'node:test';import assert from 'node:assert/strict';import worker from '../worker/index.js';
test('Homepage and all imported assets are served with correct types',async()=>{
 for(const [path,type] of [['/','text/html'],['/app.js','text/javascript'],['/catalog.mjs','text/javascript'],['/domain.mjs','text/javascript'],['/style.css','text/css'],['/favicon.svg','image/svg+xml'],['/config.js','text/javascript']]){
 const r=await worker.fetch(new Request('https://demo.test'+path));assert.equal(r.status,200,path);assert.ok(r.headers.get('content-type').includes(type));assert.ok((await r.text()).length);
 }
});
test('API is read-only, bounded to catalog supplier IDs, supports CORS',async()=>{
 assert.equal((await worker.fetch(new Request('https://demo.test/api/collect/unknown'))).status,404);
 assert.equal((await worker.fetch(new Request('https://demo.test/api/collect/ews',{method:'POST'}))).status,405);
 const r=await worker.fetch(new Request('https://demo.test/api/health'));const d=await r.json();assert.equal(d.catalogSize,13);assert.equal(r.headers.get('access-control-allow-origin'),'*');
});
test('Unknown routes are explicit 404, HEAD contains no body',async()=>{
 assert.equal((await worker.fetch(new Request('https://demo.test/unknown'))).status,404);
 assert.equal(await (await worker.fetch(new Request('https://demo.test/',{method:'HEAD'}))).text(),'');
});
