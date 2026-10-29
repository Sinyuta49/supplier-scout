import {CATALOG} from '../src/catalog.mjs';
import {collectSupplier} from '../src/collector.mjs';
// Replaced at build time with embedded, self-contained assets.
const ASSETS = __ASSETS__;
const cache=new Map();
const headers={'X-Content-Type-Options':'nosniff','Referrer-Policy':'strict-origin-when-cross-origin','Permissions-Policy':'camera=(), microphone=(), geolocation=()','Content-Security-Policy':"default-src 'self'; script-src 'self'; style-src 'self'; connect-src 'self' https://supplier-scout-artem.artem-goweb.chatgpt.site; img-src 'self' data:; font-src 'self'; base-uri 'self'; form-action 'self'; frame-ancestors 'self' https://*.chatgpt.com https://*.chatgpt.site",'Access-Control-Allow-Origin':'*','Access-Control-Allow-Methods':'GET, OPTIONS','Access-Control-Allow-Headers':'Content-Type'};
function json(data,status=200){return new Response(JSON.stringify(data),{status,headers:{...headers,'Content-Type':'application/json; charset=utf-8','Cache-Control':'no-store'}})}
export default {async fetch(request,env={},ctx={}){
 const url=new URL(request.url);
 if(request.method==='OPTIONS')return new Response(null,{status:204,headers});
 if(!['GET','HEAD'].includes(request.method))return json({error:'method_not_allowed'},405);
 if(url.pathname==='/api/health')return json({ok:true,version:'1.0.0',catalogSize:CATALOG.length});
 if(url.pathname.startsWith('/api/collect/')){
  const id=url.pathname.slice('/api/collect/'.length);const s=CATALOG.find(x=>x.id===id);if(!s)return json({error:'supplier_not_found'},404);
  const old=cache.get(id);if(old&&Date.now()-old.at<600000)return json({...old.result,cached:true});
  try{let promise;if(old?.promise)promise=old.promise;else{promise=collectSupplier(s);cache.set(id,{promise,at:0});}const result=await promise;cache.set(id,{result,at:Date.now()});return json(result);}catch{cache.delete(id);return json({error:'collection_failed'},502)}
 }
 const path=url.pathname==='/'?'/index.html':url.pathname;
 const asset=ASSETS[path];if(!asset)return new Response('Страница не найдена',{status:404,headers:{...headers,'Content-Type':'text/plain; charset=utf-8'}});
 return new Response(request.method==='HEAD'?null:asset.body,{headers:{...headers,'Content-Type':asset.type,'Cache-Control':'no-cache'}});
}};
