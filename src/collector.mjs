export function htmlToText(html){return String(html).replace(/<(script|style|noscript|svg)\b[^>]*>[\s\S]*?<\/\1>/gi,' ').replace(/<[^>]+>/g,' ').replace(/&nbsp;|&#160;/g,' ').replace(/&amp;/g,'&').replace(/&quot;/g,'"').replace(/&#39;/g,"'").replace(/&lt;/g,'<').replace(/&gt;/g,'>').replace(/\s+/g,' ').trim();}
export function extractPublicFacts(html){
 const text=htmlToText(html);
 const publicHtml=String(html).replace(/<(script|style|noscript|svg)\b[^>]*>[\s\S]*?<\/\1>/gi,' ');
 const emails=[...new Set((publicHtml.match(/[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/gi)||[]).filter(e=>!e.match(/\.(png|jpg|webp|svg)$/i)))].slice(0,5);
 const phones=[...new Set((text.match(/(?:\+7|8)[\s(.-]*\d{3}[\s).\-]*\d{3}[\s.\-]*\d{2}[\s.\-]*\d{2}/g)||[]))].slice(0,5);
 const snippet=(regex)=>{const m=regex.exec(text);if(!m)return null;return text.slice(Math.max(0,m.index-60),Math.min(text.length,m.index+230));};
 return {emails,phones,deliveryExcerpt:snippet(/доставк[аиуеой]/i),minimumExcerpt:snippet(/минимальн.{0,35}(заказ|парти)|заказ\s+от\s+\d/i),documentsExcerpt:snippet(/сертификат|декларац|меркури|FSSC\s*22000/i)};
}
export async function collectSupplier(supplier,fetcher=fetch){
 const source=supplier.sources.find(s=>!s.url.endsWith('.pdf'));
 const url=source.url;
 const controller=new AbortController();const timeout=setTimeout(()=>controller.abort(),10000);
 try{
  // Only pre-reviewed catalog hosts. No caller-provided URL or open proxy.
  let current=new URL(url);let response;
  const allowed=new Set([new URL(supplier.website).hostname,...supplier.sources.map(s=>new URL(s.url).hostname)].flatMap(h=>[h,h.startsWith('www.')?h.slice(4):'www.'+h]));
  for(let i=0;i<3;i++){
    response=await fetcher(current.href,{signal:controller.signal,redirect:'manual',headers:{'User-Agent':'SupplierScoutPrototype/1.0 (public supplier directory)','Accept':'text/html'}});
    if(response.status>=300&&response.status<400){const location=response.headers.get('location');if(!location)throw new Error('redirect');const next=new URL(location,current);if(next.protocol!=='https:'||!allowed.has(next.hostname)||next.port)throw new Error('redirect');current=next;continue;}break;
  }
  if(!response?.ok)throw new Error('http');
  if(!/text\/html/i.test(response.headers.get('content-type')||''))throw new Error('content');
  if(Number(response.headers.get('content-length')||0)>1500000)throw new Error('size');
  const reader=response.body.getReader();let size=0;const chunks=[];
  while(true){const {done,value}=await reader.read();if(done)break;size+=value.byteLength;if(size>1500000){await reader.cancel();throw new Error('size');}chunks.push(value);}
  const merged=new Uint8Array(size);let offset=0;for(const c of chunks){merged.set(c,offset);offset+=c.length;}
  const html=new TextDecoder().decode(merged);const title=html.match(/<title[^>]*>([\s\S]*?)<\/title>/i)?.[1]||'';
  if(/captcha|access denied|just a moment|robot check|доступ ограничен/i.test(title)||htmlToText(html).length<150)throw new Error('blocked');
  return {ok:true,checkedAt:new Date().toISOString(),sourceUrl:current.href,sourceTitle:source.title,...extractPublicFacts(html),notice:'Автоматически извлечённые фрагменты. Могут относиться к другому филиалу или контексту; проверьте источник. Данные каталога не заменены.'};
 }catch{return {ok:false,checkedAt:new Date().toISOString(),sourceUrl:url,message:'Не удалось прочитать сайт: возможны защита, тайм-аут или неподдерживаемый формат. Сохранённые сведения доступны; откройте источник вручную.'};}finally{clearTimeout(timeout);}
}
