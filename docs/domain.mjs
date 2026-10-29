export const normalize = s => String(s??'').toLowerCase().replaceAll('ё','е').replace(/[.,!?;:()«»]/g,' ').replace(/\s+/g,' ').trim();
export function parseIntent(query,categories,regions){
  const q=normalize(query);
  const city=regions.find(r=>r.id!=='all'&&r.terms.some(t=>q.includes(t)))?.id;
  const category=categories.find(c=>c.terms.some(t=>q.includes(t)))?.id;
  return {city,category};
}
export function completeness(s){return ['phone','email','minimum','price','delivery','documents'].filter(k=>Boolean(s[k])).length;}
export function selectSuppliers(catalog,criteria,categories,regions){
  const {query='',city='all',category='all',localOnly=false,contactOnly=false,docsOnly=false,sort='relevance',shortlist=null}=criteria;
  const intent=parseIntent(query,categories,regions);
  const terms=normalize(query).split(' ').filter(t=>t.length>1&&!['для','нужен','нужна','нужно','ищу','найти','поставщик','поставщики','поставщиков','оптом','купить','кафе','ресторана','кофейни','поставка','продукты','питания','по','на','из','заказ'].includes(t));
  return catalog.map(s=>{
    const local=city!=='all'&&s.cities.includes(city);
    const geo=city==='all'||local||(!localOnly&&s.nationwide);
    const cat=category==='all'||s.categories.includes(category);
    const hay=normalize([s.name,s.description,...s.tags,...s.categories.map(c=>categories.find(x=>x.id===c)?.name||'')].join(' '));
    const matches=terms.map(t=>hay.includes(t)||categories.some(c=>s.categories.includes(c.id)&&c.terms.some(x=>t.startsWith(x)||x.startsWith(t)))||regions.some(r=>r.terms.some(x=>t.startsWith(x)||x.startsWith(t))&&(r.id===city||s.cities.includes(r.id)||s.nationwide)));
    const text=terms.length===0||matches.every(Boolean);
    return {supplier:s,local,rank:(local?100:0)+(category!=='all'?25:0)+completeness(s),matches:geo&&cat&&text&&(!contactOnly||!!(s.phone||s.email))&&(!docsOnly||s.docsClaim)&&(!shortlist||shortlist.includes(s.id))};
  }).filter(x=>x.matches).sort((a,b)=>sort==='name'?a.supplier.name.localeCompare(b.supplier.name,'ru'):sort==='completeness'?completeness(b.supplier)-completeness(a.supplier)||b.rank-a.rank:b.rank-a.rank).map(x=>x.supplier);
}
export function csvCell(value){let s=String(value??'');if(/^[\s]*[=+@-]/.test(s))s="'"+s;return '"'+s.replaceAll('"','""')+'"';}
export function toCSV(rows,categories,notes={}){
 const table=[['Поставщик','Категории','Телефон','Email','Минимальный заказ','Цена / прайс','Доставка','Документы (по заявлению)','Сайт','Источники','Заметка'],...rows.map(s=>[s.name,s.categories.map(id=>categories.find(c=>c.id===id)?.name).join('; '),s.phone,s.email,s.minimum||'Не найдено',s.price||'Не найдено',s.delivery||'Не найдено',s.documents||'Не найдено',s.website,s.sources.map(x=>x.url).join(' | '),notes[s.id]||''])];
 return '\uFEFF'+table.map(r=>r.map(csvCell).join(';')).join('\r\n');
}
