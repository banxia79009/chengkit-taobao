'use strict';
const crypto=require('node:crypto');
function safeImage(value){try{const u=new URL(value);return u.protocol==='https:'&&!u.username&&!u.password&&!u.port&&(u.hostname==='alicdn.com'||u.hostname.endsWith('.alicdn.com'))?u.href:null;}catch{return null;}}
const imageId=image=>crypto.createHash('sha256').update([image.kind,image.url,JSON.stringify(image.specs||{})].join('|')).digest('hex').slice(0,24);
function catalog(images){return images.filter(x=>safeImage(x.url)).map(x=>({...x,image_id:imageId(x)}));}
async function imageContent(url){
 if(!safeImage(url))throw Error('INVALID_IMAGE');
 const response=await fetch(url,{redirect:'error',credentials:'omit',signal:AbortSignal.timeout(12000)});
 const mime=(response.headers.get('content-type')||'').split(';')[0];
 if(!response.ok||!['image/jpeg','image/png','image/webp'].includes(mime)||Number(response.headers.get('content-length'))>2500000)throw Error('IMAGE_UNAVAILABLE');
 let size=0;const chunks=[];for await(const part of response.body){size+=part.length;if(size>2500000)throw Error('IMAGE_TOO_LARGE');chunks.push(part);}
 return {type:'image',mimeType:mime,data:Buffer.concat(chunks).toString('base64')};
}
async function embed(images,{load=imageContent,maxBytes=8000000}={}){
 const content=[],statuses=[];let used=0;
 // Bound response size, not the catalog: every image remains addressable in later batches.
 for(const entry of images){
  try{const block=await load(entry.url),bytes=Buffer.byteLength(block.data,'base64');if(used+bytes>maxBytes){statuses.push({...entry,embedded:false,reason:'RESPONSE_IMAGE_BUDGET'});continue;}used+=bytes;
   content.push({type:'text',text:JSON.stringify({image_id:entry.image_id,item_id:entry.item_id,sku_ids:entry.sku_ids||[],kind:entry.kind,specs:entry.specs||null,url:entry.url,sku_binding:entry.sku_binding||'unconfirmed'})},block);statuses.push({...entry,embedded:true});
  }catch{statuses.push({...entry,embedded:false,reason:'IMAGE_DOWNLOAD_FAILED'});}
 }
 return {content,statuses};
}
async function searchResult(data,options={}){
 const images=data.results.filter(r=>r.thumbnail_url).map(r=>({image_id:r.thumbnail_id,item_id:r.item_id,kind:'search_thumbnail',url:r.thumbnail_url,sku_binding:'unconfirmed'}));
 const attached=await embed(images,options);const status=new Map(attached.statuses.map(x=>[x.item_id,x]));
 const structuredContent={...data,results:data.results.map(r=>({...r,thumbnail_embedded:status.get(r.item_id)?.embedded||false,thumbnail_error:status.get(r.item_id)?.reason||null})),image_note:'缩略图按商品编号绑定；未成功内嵌的图片不能声称已视觉读取。搜索图不证明某个具体SKU外观。'};
 return {content:[{type:'text',text:JSON.stringify(structuredContent)},...attached.content],structuredContent,isError:false};
}
module.exports={safeImage,imageId,catalog,imageContent,embed,searchResult};
