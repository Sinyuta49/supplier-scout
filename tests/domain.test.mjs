import test from 'node:test';
import assert from 'node:assert/strict';
import {CATALOG,CATEGORIES,REGIONS} from '../src/catalog.mjs';
import {selectSuppliers,parseIntent,toCSV,completeness} from '../src/domain.mjs';
import {extractPublicFacts,collectSupplier} from '../src/collector.mjs';
const search=c=>selectSuppliers(CATALOG,c,CATEGORIES,REGIONS);
test('Packaging in Ekaterinburg includes real packaging suppliers, not meat distributors',()=>{
 const rows=search({category:'packaging',city:'ekb',localOnly:true});
 assert.ok(rows.some(s=>s.id==='foodface'));assert.ok(rows.some(s=>s.id==='u2b'));assert.ok(!rows.some(s=>s.id==='marr'));
});
test('Natural query detects city and dairy, searches Cyrillic and aliases',()=>{
 assert.deepEqual(parseIntent('Нужно молоко в СПб',CATEGORIES,REGIONS),{city:'spb',category:'dairy'});
 const rows=search({query:'молоко для кофейни',city:'ekb'});
 assert.ok(rows.some(s=>s.id==='ews'));assert.ok(!rows.some(s=>s.id==='foodface'));
});
test('A local office and nationwide delivery have different eligibility',()=>{
 assert.ok(search({city:'ekb'}).some(s=>s.id==='zavitok'));
 assert.ok(!search({city:'ekb',localOnly:true}).some(s=>s.id==='zavitok'));
});
test('Specific product names outrank overlapping short stems',()=>{
 assert.equal(parseIntent('сырники',CATEGORIES,REGIONS).category,'ready');
 assert.equal(parseIntent('сыр',CATEGORIES,REGIONS).category,'dairy');
 const rows=search({query:'сырники',city:'spb',category:'ready'});
 assert.ok(rows.some(s=>s.id==='goodfood'));
 assert.ok(!rows.some(s=>s.id==='zavitok'));
});
test('Packaging for delivery is not reduced to suppliers with the exact word in their description',()=>{
 const rows=search({query:'упаковка для доставки',city:'ekb',category:'packaging'});
 assert.ok(rows.some(s=>s.id==='foodface'));assert.ok(rows.some(s=>s.id==='korrex'));assert.equal(rows.length,4);
});
test('Unknown documents do not pass the documents-information filter',()=>{
 assert.ok(search({city:'all',docsOnly:true}).every(s=>s.docsClaim));
 assert.ok(!search({city:'all',docsOnly:true}).some(s=>s.id==='foodface'));
});
test('Empty search does not silently return unrelated suppliers; saved view is bounded',()=>{
 assert.equal(search({query:'несуществующийтоварфыва',city:'all'}).length,0);
 assert.deepEqual(search({city:'all',shortlist:['foodface']}).map(s=>s.id),['foodface']);
 assert.equal(search({city:'all',shortlist:[]}).length,0);
});
test('CSV preserves quotes and neutralizes spreadsheet formulas, including notes',()=>{
 const s={...CATALOG[0],name:'=HYPERLINK("bad")'};
 const csv=toCSV([s],CATEGORIES,{[s.id]:'+cmd'});
 assert.ok(csv.startsWith('\uFEFF'));assert.ok(csv.includes("\"'=HYPERLINK"));assert.ok(csv.includes("\"'+cmd\""));
});
test('Every fact has a reviewed source, unique ID and no invented numeric price',()=>{
 assert.equal(new Set(CATALOG.map(s=>s.id)).size,CATALOG.length);
 for(const s of CATALOG){assert.ok(s.sources.length);assert.ok(completeness(s)>=0);for(const i of Object.values(s.fieldSource))assert.ok(s.sources[i]);for(const x of s.sources)assert.equal(new URL(x.url).protocol,'https:');assert.ok(s.categories.every(id=>CATEGORIES.some(c=>c.id===id)));}
 assert.equal(CATALOG.find(s=>s.id==='alians').minimumRub,undefined);
});
test('Collector extracts public contacts, ignores script text and does not hallucinate missing facts',()=>{
 const d=extractPublicFacts('<script>fake@example.com</script><div>Доставка по городу. +7 (343) 123-45-67 <a href="mailto:sales@test.ru">sales@test.ru</a></div>');
 assert.ok(d.phones.includes('+7 (343) 123-45-67'));assert.ok(d.emails.includes('sales@test.ru'));assert.ok(!d.emails.includes('fake@example.com'));assert.equal(d.minimumExcerpt,null);assert.equal(d.documentsExcerpt,null);
});
test('Collector refuses redirects to unreviewed/internal hosts',async()=>{
 const d=await collectSupplier(CATALOG[0],async()=>new Response(null,{status:302,headers:{Location:'http://127.0.0.1/private'}}));
 assert.equal(d.ok,false);
});
test('Collector returns explicit failure on blocked pages',async()=>{
 const d=await collectSupplier(CATALOG[0],async()=>new Response('<title>Access denied</title>',{headers:{'content-type':'text/html'}}));assert.equal(d.ok,false);
});
test('Collector retains source and actual retrieval time on success',async()=>{
 const d=await collectSupplier(CATALOG[0],async()=>new Response('<title>Supplier</title><p>'+('Поставка продуктов. '.repeat(15))+' +7 (343) 123-45-67</p>',{headers:{'content-type':'text/html; charset=utf-8'}}));
 assert.equal(d.ok,true);assert.equal(d.sourceUrl,CATALOG[0].sources[0].url);assert.ok(!Number.isNaN(Date.parse(d.checkedAt)));assert.ok(d.phones.length);
});
