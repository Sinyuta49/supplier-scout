import {spawn} from 'node:child_process';
import {readFile,mkdir,writeFile,unlink} from 'node:fs/promises';
import {resolve} from 'node:path';
import assert from 'node:assert/strict';
const root=process.cwd(), profile=resolve(root,'.qa-profile',String(Date.now())), out=resolve(root,'qa-output');
await mkdir(profile,{recursive:true});await mkdir(out,{recursive:true});
const chrome=process.env.CHROME_PATH||'C:/Program Files/Google/Chrome/Application/chrome.exe';
const child=spawn(chrome,['--headless','--disable-gpu','--no-first-run','--no-default-browser-check','--disable-background-networking','--remote-debugging-port=0',`--user-data-dir=${profile}`,'about:blank'],{stdio:'ignore',windowsHide:true});
let port;for(let i=0;i<50;i++){try{port=(await readFile(resolve(profile,'DevToolsActivePort'),'utf8')).split('\n')[0];if(port)break}catch{}await new Promise(r=>setTimeout(r,200));}
assert.ok(port,'Headless Chrome did not start');
const list=await (await fetch(`http://127.0.0.1:${port}/json/list`)).json();
const ws=new WebSocket(list.find(x=>x.type==='page').webSocketDebuggerUrl);await new Promise((r,j)=>{ws.onopen=r;ws.onerror=j});
let seq=0;const pending=new Map(),errors=[],requests=[];
ws.onmessage=e=>{const d=JSON.parse(e.data);if(d.id){const p=pending.get(d.id);if(p){pending.delete(d.id);d.error?p.reject(new Error(d.error.message)):p.resolve(d.result);}}else if(d.method==='Runtime.exceptionThrown')errors.push(d.params.exceptionDetails.text);else if(d.method==='Network.requestWillBeSent')requests.push(d.params.request.url);};
const call=(method,params={})=>new Promise((resolve,reject)=>{const id=++seq;pending.set(id,{resolve,reject});ws.send(JSON.stringify({id,method,params}));});
const evaluate=async expression=>{const r=await call('Runtime.evaluate',{expression,awaitPromise:true,returnByValue:true});if(r.exceptionDetails)throw new Error(JSON.stringify(r.exceptionDetails));return r.result?.value;};
async function waitFor(expression){for(let i=0;i<80;i++){if(await evaluate(expression))return;await new Promise(r=>setTimeout(r,100));}throw new Error('Timeout: '+expression);}
try{
 await call('Runtime.enable');await call('Page.enable');await call('Network.enable');await call('Emulation.setDeviceMetricsOverride',{width:1440,height:1080,deviceScaleFactor:1,mobile:false});
 await call('Page.navigate',{url:process.env.QA_URL||'http://127.0.0.1:8931/'});await waitFor('document.querySelectorAll(".supplier-card").length > 0');
 const initial=await evaluate('document.querySelectorAll(".supplier-card").length');assert.ok(initial>=6);
 await evaluate('document.querySelector("#query").value="сырники";document.querySelector("#city").value="spb";document.querySelector("#search-form").requestSubmit()');
 assert.equal(await evaluate('document.querySelector(".category-tab.active").textContent'),'Готовая продукция');
 assert.ok(await evaluate('[...document.querySelectorAll("#results .company-name")].some(e=>e.textContent.includes("Гуд Фуд"))'));
 await evaluate('document.querySelector("#clear-filters").click();document.querySelector("#query").value="упаковка для доставки";document.querySelector("#search-form").requestSubmit()');
 assert.equal(await evaluate('document.querySelectorAll("#results .supplier-card").length'),4);
 await evaluate('document.querySelector("#clear-filters").click()');
 // Verify the actual generated download, not only a success toast.
 const csvPath=resolve(out,'postavka-suppliers.csv');try{await unlink(csvPath)}catch{}
 await call('Browser.setDownloadBehavior',{behavior:'allow',downloadPath:out});
 await evaluate('document.querySelector("#export").click()');
 let exported;for(let i=0;i<50;i++){try{exported=await readFile(csvPath,'utf8');break}catch{}await new Promise(r=>setTimeout(r,100));}
 assert.ok(exported?.includes('Поставщик'),'CSV file was not downloaded');assert.ok(exported.includes('Восток-Запад'));assert.ok(exported.includes('https://www.ews.ru/'));
 await evaluate('document.querySelector("[data-example=Упаковка]").click()');
 assert.equal(await evaluate('document.querySelectorAll(".supplier-card").length'),4);
 await evaluate('document.querySelectorAll("[data-compare]").forEach((e,i)=>{if(i<2){e.checked=true;e.dispatchEvent(new Event("change",{bubbles:true}))}})');
 // Renders replace nodes after every selection: select the second current checkbox explicitly.
 await evaluate('if(document.querySelector("#compare-count").textContent!=="2"){const e=[...document.querySelectorAll("[data-compare]")].find(x=>!x.checked);e.checked=true;e.dispatchEvent(new Event("change",{bubbles:true}))}');
 assert.equal(await evaluate('document.querySelector("#compare-count").textContent'),'2');
 await evaluate('document.querySelector("#compare-open").click()');assert.equal(await evaluate('document.querySelector("#compare-dialog").open'),true);
 let shot=await call('Page.captureScreenshot',{format:'png'});await writeFile(resolve(out,'compare-desktop.png'),Buffer.from(shot.data,'base64'));
 await evaluate('document.querySelector("#compare-dialog").close(); document.querySelector("[data-detail]").click()');
 assert.ok(await evaluate('document.querySelector("#detail-content").textContent.includes("Источники данных")'));
 const inspectedId=await evaluate('document.querySelector("#detail [data-rfq]").dataset.rfq');
 const staticMode=await evaluate('window.POSTAVKA_STATIC_MODE === true');
 if(staticMode){assert.equal(await evaluate('document.querySelectorAll("[data-refresh]").length'),0);assert.equal(await evaluate('document.querySelectorAll("[data-static-source]").length'),1);}
 await evaluate('document.querySelector("[data-save]").click(); const n=document.querySelector("#supplier-note");n.value="Проверить объём и доставку";n.dispatchEvent(new Event("input",{bubbles:true}))');
 await evaluate('document.querySelector("#detail").close();document.querySelector("#nav-saved").click()');
 assert.ok((await evaluate('document.querySelectorAll(".supplier-card").length'))>=1);
 await call('Page.reload');await waitFor('document.querySelectorAll(".supplier-card").length > 0');
 assert.ok(Number(await evaluate('document.querySelector("#saved-count").textContent'))>=1);
 await evaluate(`document.querySelector('#results [data-detail="${inspectedId}"]').click()`);
 assert.equal(await evaluate('document.querySelector("#supplier-note").value'),'Проверить объём и доставку');
 await evaluate('document.querySelector("#detail").close()');
 await evaluate('document.querySelector("#query").value="неттакоготовара123";document.querySelector("#search-form").requestSubmit()');
 assert.equal(await evaluate('document.querySelectorAll(".supplier-card").length'),0);assert.ok(await evaluate('!!document.querySelector(".empty")'));
 await evaluate('document.querySelector("#clear-filters").click();document.querySelector("#compare-clear").click()');
 await evaluate('document.querySelector("#query").value="<img src=x onerror=alert(1)>";document.querySelector("#search-form").requestSubmit()');
 assert.equal(await evaluate('document.querySelectorAll("img").length'),0);
 await evaluate('document.querySelector("#clear-filters").click()');
 shot=await call('Page.captureScreenshot',{format:'png'});await writeFile(resolve(out,'desktop.png'),Buffer.from(shot.data,'base64'));
 await call('Emulation.setDeviceMetricsOverride',{width:390,height:844,deviceScaleFactor:1,mobile:true});
 await new Promise(r=>setTimeout(r,250));
 assert.ok(await evaluate('document.documentElement.scrollWidth <= window.innerWidth + 1'),'Mobile layout overflows horizontally');
 shot=await call('Page.captureScreenshot',{format:'png',captureBeyondViewport:false});await writeFile(resolve(out,'mobile.png'),Buffer.from(shot.data,'base64'));
 assert.deepEqual(errors,[]);
 if(staticMode)assert.ok(!requests.some(url=>url.includes('chatgpt.site')),'Static mode made a request to chatgpt.site');
 console.log(JSON.stringify({ok:true,initialSuppliers:initial,checks:['search','category','comparison','supplier-details','saved-list','notes','notes-after-reload','CSV-download','persistence','empty-state','XSS-escaping','mobile-overflow','no-runtime-errors'],screenshots:out}));
}finally{try{const version=await(await fetch(`http://127.0.0.1:${port}/json/version`)).json();const b=new WebSocket(version.webSocketDebuggerUrl);await new Promise(r=>b.onopen=r);b.send(JSON.stringify({id:1,method:'Browser.close'}));b.close()}catch{}ws.close();child.unref();}
