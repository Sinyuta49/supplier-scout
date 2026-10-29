import {CATALOG,CATEGORIES,REGIONS} from './catalog.mjs?v=25790af9034c';
import {normalize,parseIntent,selectSuppliers,completeness,toCSV} from './domain.mjs?v=25790af9034c';

const $=s=>document.querySelector(s);
const staticMode=window.POSTAVKA_STATIC_MODE===true;
const escape=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const icons={search:'<circle cx="11" cy="11" r="7"/><path d="m16 16 4 4"/>',bookmark:'<path d="M6 3h12v18l-6-4-6 4Z"/>',columns:'<rect x="3" y="4" width="18" height="16" rx="2"/><path d="M9 4v16m6-16v16"/>',pin:'<path d="M19 10c0 5-7 11-7 11S5 15 5 10a7 7 0 1 1 14 0Z"/><circle cx="12" cy="10" r="2"/>',shield:'<path d="m12 3 8 3v6c0 4-8 9-8 9s-8-5-8-9V6Z"/><path d="m8 11 3 3 5-5"/>',link:'<path d="m10 13 4-4m-6 6-1 1a4 4 0 0 1-6-6l4-4a4 4 0 0 1 6 0m2 3 1-1a4 4 0 0 1 6 6l-4 4a4 4 0 0 1-6 0"/>',download:'<path d="M12 3v12m-5-5 5 5 5-5M4 16v5h16v-5"/>',code:'<path d="m8 6-6 6 6 6m8-12 6 6-6 6m-3-15-2 18"/>',info:'<circle cx="12" cy="12" r="9"/><path d="M12 11v6m0-10v1"/>',sort:'<path d="M4 6h16M7 12h10m-7 6h4"/>',phone:'<path d="m5 3 4 1 1 5-3 2a16 16 0 0 0 6 6l2-3 5 1 1 4c-1 5-9 2-14-3S0 4 5 3Z"/>',mail:'<rect x="3" y="5" width="18" height="14" rx="2"/><path d="m3 6 9 7 9-7"/>',check:'<path d="m5 12 4 4L20 5"/>'};
const icon=name=>`<svg class="icon" viewBox="0 0 24 24" aria-hidden="true">${icons[name]||icons.info}</svg>`;
function iconize(root=document){root.querySelectorAll('[data-icon]').forEach(e=>e.outerHTML=icon(e.dataset.icon));}
iconize();
if(staticMode){
 const aboutIntro=$('#about .about-body p');
 aboutIntro.textContent='Поиск по категориям, товарным словам и регионам, сравнение до четырёх компаний, список для связи, личные заметки, запрос коммерческого предложения и экспорт CSV. Эта версия размещена на GitHub Pages и работает без внешнего сервера. Актуальные условия можно проверить по ссылкам на официальные сайты. Код серверного сбора также есть в репозитории для отдельного запуска.';
}

const validIds=new Set(CATALOG.map(s=>s.id));
function readStorage(){try{return JSON.parse(localStorage.getItem('postavka-v1')||'{}')}catch{return {}}}
const saved=readStorage();
let shortlist=Array.isArray(saved.shortlist)?saved.shortlist.filter(x=>validIds.has(x)):[];
let compared=Array.isArray(saved.compared)?saved.compared.filter(x=>validIds.has(x)).slice(0,4):[];
let notes=saved.notes&&typeof saved.notes==='object'&&!Array.isArray(saved.notes)?Object.fromEntries(Object.entries(saved.notes).filter(([k,v])=>validIds.has(k)&&typeof v==='string').map(([k,v])=>[k,v.slice(0,2000)])):{};
let category='all',view='search',results=[],detailId=null,toastTimer;
function persist(){try{localStorage.setItem('postavka-v1',JSON.stringify({shortlist,compared,notes}));}catch{toast('Браузер не разрешил сохранение. Список доступен до закрытия страницы.');}}
function toast(text){clearTimeout(toastTimer);$('#toast').textContent=text;$('#toast').hidden=false;toastTimer=setTimeout(()=>$('#toast').hidden=true,4000);}
function sourceRef(s,field){const i=s.fieldSource[field];return Number.isInteger(i)&&s.sources[i]?` <a class="source-ref" href="${escape(s.sources[i].url)}" target="_blank" rel="noopener noreferrer" aria-label="Источник: ${escape(s.sources[i].title)}">[${i+1}] ↗</a>`:'';}
const categoryName=id=>CATEGORIES.find(c=>c.id===id)?.name||id;
const regionName=id=>REGIONS.find(c=>c.id===id)?.name||id;
function geoText(s){const city=$('#city').value;if(city==='all')return s.cities.map(regionName).join(' · ')+(s.nationwide?' · заявлена доставка по РФ':'');if(s.cities.includes(city))return `${regionName(city)} · указан в географии работы`;return 'Заявлена доставка по РФ · условия в вашем городе уточнить';}
function compact(s,max=75){if(!s)return 'Не найдено в источнике';return s.length>max?s.slice(0,max).replace(/\s+\S*$/,'')+'…':s;}
function reason(s){const city=$('#city').value;return city!=='all'&&s.cities.includes(city)?'Регион совпадает':'Региональную доставку уточнить';}
function criteria(){return {query:$('#query').value,city:$('#city').value,category,localOnly:$('#local-only').checked,contactOnly:$('#contact-only').checked,docsOnly:$('#docs-only').checked,sort:$('#sort').value,shortlist:view==='saved'?shortlist:null};}
function renderTabs(){ $('#category-tabs').innerHTML=[{id:'all',name:'Все категории'},...CATEGORIES].map(c=>`<button type="button" class="category-tab ${category===c.id?'active':''}" data-category="${c.id}" aria-pressed="${category===c.id}">${escape(c.name)}</button>`).join(''); }
function renderCard(s){return `<article class="supplier-card ${compared.includes(s.id)?'selected':''}" data-supplier="${s.id}">
<div class="card-top"><div class="supplier-logo ${s.color}" aria-hidden="true">${escape(s.short)}</div><div><h3 class="company-name"><button data-detail="${s.id}">${escape(s.name)}</button></h3><div class="company-type">${escape(s.kind)}</div></div><button class="save ${shortlist.includes(s.id)?'active':''}" data-save="${s.id}" aria-label="${shortlist.includes(s.id)?'Убрать из списка':'Сохранить в список'}: ${escape(s.name)}" aria-pressed="${shortlist.includes(s.id)}">${icon('bookmark')}</button></div>
<p class="card-description">${escape(s.description)}</p><div class="tags">${s.tags.map(t=>`<span class="tag">${escape(t)}</span>`).join('')}<span class="tag neutral" title="Данные взяты с сайта, деловая надёжность не проверялась">${s.sources.length} ${s.sources.length===1?'источник':'источника'}</span></div>
<div class="geo">${icon('pin')}<span>${escape(geoText(s))}</span></div>
<div class="facts"><div><div class="fact-label">Минимальный заказ</div><div class="fact-value ${s.minimum?'':'unknown'}">${escape(compact(s.minimum))}</div></div><div><div class="fact-label">Цена / прайс</div><div class="fact-value ${s.price?'':'unknown'}">${escape(compact(s.price,65))}</div></div></div>
<div class="card-contact">${s.phone?`${icon('phone')}<a href="tel:${s.phone.replace(/[^+\d]/g,'')}" title="${escape(s.phoneNote||'')}">${escape(s.phone)}</a>`:s.email?`${icon('mail')}<a href="mailto:${escape(s.email)}">${escape(s.email)}</a>`:`${icon('link')}<a href="${escape(s.website)}" target="_blank" rel="noopener noreferrer">Связаться через сайт ↗</a>`}</div>
<div class="card-bottom"><label class="compare-check"><input type="checkbox" data-compare="${s.id}" ${compared.includes(s.id)?'checked':''} aria-label="Сравнить: ${escape(s.name)}">В сравнение</label><button class="card-detail" data-detail="${s.id}">Данные и источники ↗</button></div></article>`;}
function render(){
 results=selectSuppliers(CATALOG,criteria(),CATEGORIES,REGIONS);renderTabs();
 $('#saved-count').textContent=shortlist.length;$('#compare-count').textContent=compared.length;
 $('#nav-search').classList.toggle('active',view==='search');$('#nav-saved').classList.toggle('active',view==='saved');
 $('#page-title').innerHTML=view==='saved'?'Ваш короткий список.<br><span>Следующий шаг — связаться.</span>':'Хорошие поставщики.<br><span>Понятный выбор.</span>';
 $('#breadcrumb').textContent=view==='saved'?'Мой список':'Поиск поставщиков';
 $('#page-subtitle').innerHTML=view==='saved'?'Сохранённые компании и ваши заметки.<br>Сравните условия и подготовьте запрос поставщику.':'Продукты, ингредиенты и упаковка для вашего бизнеса.<br>Найдите подходящих, сравните условия и сохраните контакты.';
 $('#result-count').textContent=results.length;
 $('#result-context').textContent=`${regionName($('#city').value)} · ${category==='all'?'Все категории':categoryName(category)} · ${view==='saved'?'ваш список':'открытый каталог'}`;
 $('#results').innerHTML=results.length?results.map(renderCard).join(''):`<div class="empty">${icon(view==='saved'?'bookmark':'search')}<h3>${view==='saved'?'Пока никого не сохранили':'В каталоге нет совпадений'}</h3><p>${view==='saved'?'Отмечайте компании закладкой — они появятся здесь.':'Попробуйте более общую категорию или другой регион. В каталоге только 13 компаний: отсутствие результата не означает отсутствие поставщиков на рынке.'}</p><button class="secondary" data-reset>${view==='saved'?'Перейти к поиску':'Сбросить фильтры'}</button></div>`;
 $('#active-filters').innerHTML=[$('#local-only').checked?'Только выбранный город':null,$('#contact-only').checked?'С прямым контактом':null,$('#docs-only').checked?'Есть сведения о документах':null].filter(Boolean).map(x=>`<span class="filter-chip">${escape(x)}</span>`).join('');
 $('#compare-bar').hidden=!compared.length;
 $('#compare-bar-title').textContent=`В сравнении: ${compared.length} из 4`;
 $('#compare-names').textContent=compared.map(id=>CATALOG.find(s=>s.id===id).name).join(', ');
}
function toggleSaved(id){shortlist=shortlist.includes(id)?shortlist.filter(x=>x!==id):[...shortlist,id];persist();render();if($('#detail').open&&detailId===id)renderDetail(id);toast(shortlist.includes(id)?'Поставщик сохранён в ваш список':'Поставщик убран из списка');}
function toggleCompare(id){if(compared.includes(id))compared=compared.filter(x=>x!==id);else if(compared.length<4)compared.push(id);else{toast('Можно сравнить до 4 поставщиков. Уберите одного из выбранных.');render();return;}persist();render();}
function unknownQuestions(s){return [!s.minimum?'Каковы минимальная партия и сумма заказа?':null,!s.price?'Пришлите актуальный прайс и условия для юридического лица.':null,'Подтвердите наличие нужных позиций и доставку по нашему адресу.','Какие документы предоставляются на конкретные товары?'].filter(Boolean);}
function rfq(s){const item=$('#query').value.trim()||categoryName(category==='all'?s.categories[0]:category);const city=$('#city').value==='all'?'наш регион':regionName($('#city').value);return `Здравствуйте! Рассматриваем ${s.name} как поставщика.\nИнтересуют: ${item}. Регион: ${city}.\nПожалуйста, сообщите:\n— актуальный ассортимент и прайс;\n— минимальную партию и сумму заказа;\n— наличие, сроки, стоимость и график доставки;\n— условия оплаты и документы на продукцию.\nОбъёмы и адрес готовы уточнить при обсуждении.\nСпасибо!`;}
function renderDetail(id){
 detailId=id;const s=CATALOG.find(x=>x.id===id);if(!s)return;
 const facts=[['Категории',s.categories.map(categoryName).join(', '),'categories'],['Регионы',s.cities.map(regionName).join(', ')+(s.nationwide?'; на сайте заявлена доставка по России':''),'delivery'],['Минимальный заказ',s.minimum,'minimum'],['Цена / прайс',s.price,'price'],['Доставка',s.delivery,'delivery'],['Документы',s.documents,'documents'],['Телефон',s.phone?`${s.phone}${s.phoneNote?' · '+s.phoneNote:''}`:null,'phone'],['Почта',s.email,'email']];
 $('#detail-content').innerHTML=`<div class="dialog-head"><div><div class="eyebrow">КАРТОЧКА ПОСТАВЩИКА</div><p>${escape(reason(s))} · собрано 29.10.2026</p></div><button class="icon-button" data-close="detail" aria-label="Закрыть">×</button></div><div class="detail-intro"><div class="card-top"><div class="supplier-logo ${s.color}">${escape(s.short)}</div><div><h2 class="company-name" id="detail-title">${escape(s.name)}</h2><div class="company-type">${escape(s.kind)}</div></div></div><p>${escape(s.description)}</p><div class="detail-actions"><a class="primary" href="${escape(s.website)}" target="_blank" rel="noopener noreferrer">Сайт поставщика ↗</a><button class="secondary" data-save="${s.id}">${icon('bookmark')}${shortlist.includes(s.id)?'В вашем списке':'Сохранить'}</button><button class="secondary" data-rfq="${s.id}">Скопировать запрос КП</button></div></div><div class="detail-body"><div class="notice">Сведения опубликованы поставщиком. Это не независимая проверка компании, сертификатов или текущих условий сделки.</div><div class="detail-section">${facts.map(([label,value,key])=>`<div class="detail-fact"><span>${label}</span><span class="${value?'':'missing'}">${escape(value||'Не найдено в просмотренных источниках')}${value?sourceRef(s,key):''}</span></div>`).join('')}</div><div class="detail-section"><h3>Источники данных</h3>${s.sources.map((x,i)=>`<div class="source-item"><span class="source-number">${i+1}</span><div><a href="${escape(x.url)}" target="_blank" rel="noopener noreferrer">${escape(x.title)} ↗</a><small>${escape(new URL(x.url).hostname)}</small></div></div>`).join('')}</div><div class="detail-section"><h3>Проверить сайт сейчас</h3><p class="small">Заново прочитаем публичную страницу. Найденные фрагменты покажем отдельно, не подменяя условия заказа.</p><button class="secondary" data-refresh="${s.id}">${icon('link')}Собрать свежие данные</button><div id="live-result" aria-live="polite"></div></div><div class="detail-section"><h3>Что уточнить перед заказом</h3><ul class="questions-list">${unknownQuestions(s).map(q=>`<li>${escape(q)}</li>`).join('')}</ul></div><div class="detail-section"><h3>Моя заметка</h3><textarea class="note-area" id="supplier-note" maxlength="2000" placeholder="Объём заказа, контакт менеджера, итоги разговора…" aria-label="Личная заметка по поставщику">${escape(notes[id]||'')}</textarea><p class="small">Сохраняется автоматически только в этом браузере. Поставщику не отправляется.</p></div></div>`;
 $('#supplier-note').addEventListener('input',e=>{notes[id]=e.target.value;persist()});
 if(staticMode){
  const section=$('[data-refresh]').closest('.detail-section');
  section.innerHTML=`<h3>Проверить актуальные условия</h3><p class="small">Эта версия работает на GitHub Pages без сервера сбора данных. Проверьте текущие контакты и условия в первоисточнике. Сохранённые данные каталога не обновляются автоматически.</p><a class="secondary" data-static-source href="${escape(s.sources[0].url)}" target="_blank" rel="noopener noreferrer">${icon('link')}Открыть официальный источник ↗</a>`;
 }
}
function openDetail(id){renderDetail(id);if(!$('#detail').open)$('#detail').showModal();}
function openCompare(){
 if(compared.length<2){toast('Выберите хотя бы двух поставщиков для сравнения');return;}
 const list=compared.map(id=>CATALOG.find(s=>s.id===id));
 const rows=[['Категории',s=>s.categories.map(categoryName).join(', ')],['Регион',s=>geoText(s)],['Минимальный заказ',s=>s.minimum],['Цена / прайс',s=>s.price],['Доставка',s=>s.delivery],['Документы',s=>s.documents],['Прямой контакт',s=>[s.phone,s.email].filter(Boolean).join('\n')],['Моя заметка',s=>notes[s.id]],['Что уточнить',s=>unknownQuestions(s).join(' ')]];
 $('#compare-content').innerHTML=`<div class="dialog-head"><div><div class="eyebrow">РЕШЕНИЕ НА ОСНОВЕ ФАКТОВ</div><h2 id="compare-title">Сравнение поставщиков</h2><p>Условия на одном экране. Неизвестные данные не превращаются в оценки.</p></div><button class="icon-button" data-close="compare-dialog" aria-label="Закрыть">×</button></div><div class="compare-scroll"><table class="compare-table"><thead><tr><th scope="col">Критерий</th>${list.map(s=>`<th scope="col">${escape(s.name)}<a class="small source-link" href="${escape(s.website)}" target="_blank" rel="noopener noreferrer">Открыть сайт ↗</a></th>`).join('')}</tr></thead><tbody>${rows.map(([label,get],i)=>`<tr class="${i===2||i===4?'highlight':''}"><th scope="row">${label}</th>${list.map(s=>`<td class="${get(s)?'':'missing'}">${escape(get(s)||'Не найдено / уточнить')}${['Минимальный заказ','Цена / прайс','Доставка','Документы'].includes(label)&&get(s)?sourceRef(s,{'Минимальный заказ':'minimum','Цена / прайс':'price','Доставка':'delivery','Документы':'documents'}[label]):''}</td>`).join('')}</tr>`).join('')}<tr><th>Следующий шаг</th>${list.map(s=>`<td><button class="secondary" data-rfq="${s.id}">Запросить условия</button></td>`).join('')}</tr></tbody></table></div><div class="compare-footer">Сначала уточните доставку, партию и наличие нужного товара. Полнота карточки не равна надёжности поставщика.<div class="detail-actions"><button class="secondary" id="export-compared">${icon('download')}Скачать сравнение CSV</button></div></div>`;
 if(!$('#compare-dialog').open)$('#compare-dialog').showModal();
}
function exportRows(rows){if(!rows.length){toast('В текущем списке нет поставщиков для выгрузки');return;}const blob=new Blob([toCSV(rows,CATEGORIES,notes)],{type:'text/csv;charset=utf-8'});const url=URL.createObjectURL(blob);const a=document.createElement('a');a.href=url;a.download='postavka-suppliers.csv';a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);toast(`Выгружено поставщиков: ${rows.length}`);}
async function copyRFQ(id){const s=CATALOG.find(x=>x.id===id);try{await navigator.clipboard.writeText(rfq(s));toast('Запрос КП скопирован. Проверьте объёмы и адрес перед отправкой.')}catch{const t=document.createElement('textarea');t.value=rfq(s);t.style.position='fixed';t.style.opacity='0';document.body.append(t);t.select();const ok=document.execCommand('copy');t.remove();toast(ok?'Запрос КП скопирован':'Браузер не разрешил копирование. Попробуйте другой браузер.');}}
async function refresh(id,button){
 if(staticMode)return;
 button.disabled=true;button.textContent='Читаем сайт…';const target=$('#live-result');target.innerHTML='';
 try{const base=window.POSTAVKA_API_BASE||location.origin;const res=await fetch(`${base.replace(/\/$/,'')}/api/collect/${encodeURIComponent(id)}`,{signal:AbortSignal.timeout(16000)});if(!res.ok)throw new Error();const d=await res.json();if(detailId!==id)return;
 const when=new Date(d.checkedAt).toLocaleString('ru-RU');
 target.innerHTML=`<div class="live-result"><h4>${d.ok?'Страница прочитана':'Источник сейчас недоступен'}</h4><p>${escape(when)}</p>${d.ok?`<p>${escape(d.notice)}</p><p><strong>Телефоны на странице:</strong> ${escape(d.phones.join(', ')||'Не найдены')}</p><p><strong>Email на странице:</strong> ${escape(d.emails.join(', ')||'Не найдены')}</p>${[['Доставка',d.deliveryExcerpt],['Партия / заказ',d.minimumExcerpt],['Документы',d.documentsExcerpt]].map(([k,v])=>`<p><strong>${k}:</strong> ${escape(v||'Релевантный фрагмент не найден')}</p>`).join('')}`:`<p>${escape(d.message)}</p>`}<a href="${escape(d.sourceUrl)}" target="_blank" rel="noopener noreferrer">Открыть прочитанный источник ↗</a></div>`;
 }catch{if(detailId===id)target.innerHTML='<div class="live-result"><h4>Не удалось связаться с сервисом проверки</h4><p>Сохранённые сведения остаются доступны. Откройте первоисточник вручную.</p></div>';}
 finally{if(button.isConnected){button.disabled=false;button.innerHTML=`${icon('link')}Повторить проверку`;}}
}
function reset(){category='all';$('#query').value='';$('#city').value='ekb';$('#sort').value='relevance';['local-only','contact-only','docs-only'].forEach(id=>$('#'+id).checked=false);view='search';render();}
$('#city').innerHTML=REGIONS.map(r=>`<option value="${r.id}">${escape(r.name)}</option>`).join('');$('#city').value='ekb';$('#catalog-size').textContent=CATALOG.length;
$('#search-form').addEventListener('submit',e=>{e.preventDefault();const intent=parseIntent($('#query').value,CATEGORIES,REGIONS);if(intent.city)$('#city').value=intent.city;if(intent.category)category=intent.category;render();});
let inputTimer;$('#query').addEventListener('input',()=>{clearTimeout(inputTimer);inputTimer=setTimeout(render,180)});
['city','sort','local-only','contact-only','docs-only'].forEach(id=>$('#'+id).addEventListener('change',render));
$('#clear-filters').onclick=reset;$('#nav-search').onclick=()=>{view='search';render()};$('#nav-saved').onclick=()=>{view='saved';category='all';$('#city').value='all';$('#query').value='';['local-only','contact-only','docs-only'].forEach(id=>$('#'+id).checked=false);render()};
$('#nav-compare').onclick=openCompare;$('#compare-open').onclick=openCompare;$('#compare-clear').onclick=()=>{compared=[];persist();render()};$('#export').onclick=()=>exportRows(results);$('#about-button').onclick=()=>$('#about').showModal();$('#method-link').onclick=()=>$('#about').showModal();
document.addEventListener('click',e=>{
 const b=e.target.closest('button');if(!b)return;
 if(b.dataset.category){category=b.dataset.category;$('#query').value='';render();}
 if(b.dataset.example){$('#query').value=b.dataset.example;$('#city').value=b.dataset.city;const intent=parseIntent(b.dataset.example,CATEGORIES,REGIONS);category=intent.category||'all';view='search';render();}
 if(b.dataset.detail)openDetail(b.dataset.detail);
 if(b.dataset.save)toggleSaved(b.dataset.save);
 if(b.dataset.close)$('#'+b.dataset.close).close();
 if(b.dataset.rfq)copyRFQ(b.dataset.rfq);
 if(b.dataset.refresh)refresh(b.dataset.refresh,b);
 if(b.hasAttribute('data-reset'))reset();
 if(b.id==='export-compared')exportRows(compared.map(id=>CATALOG.find(s=>s.id===id)));
});
document.addEventListener('change',e=>{if(e.target.dataset.compare)toggleCompare(e.target.dataset.compare)});
document.addEventListener('keydown',e=>{const typing=['INPUT','TEXTAREA','SELECT'].includes(document.activeElement.tagName);if(e.key==='/'&&!typing&&!document.querySelector('dialog[open]')){e.preventDefault();$('#query').focus()}});
document.querySelectorAll('dialog').forEach(d=>d.addEventListener('click',e=>{if(e.target===d){const r=d.getBoundingClientRect();if(e.clientX<r.left||e.clientX>r.right||e.clientY<r.top||e.clientY>r.bottom)d.close();}}));
render();
