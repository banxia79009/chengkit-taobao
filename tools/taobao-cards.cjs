'use strict';
const fs=require('node:fs'),path=require('node:path'),{cache}=require('./taobao-selection-cache.cjs'),{safeImage,embed}=require('./taobao-media.cjs');
const uri='ui://cheng-taobao/product-cards/v2.html';
const tool={name:'taobao_product_cards',title:'展示已读商品与规格卡片',description:'把已读取、已保存的真实商品和指定规格整理成图文卡片，返回真实图片与商品链接；不访问淘宝、不加购、不提交订单。AI可按image_ids选择已经看过的主图、详情图或规格图。只有目录明确关联SKU时才标规格图已确认，普通详情图不会自动冒充某规格图。缺少记录时先按需搜索/读取，不能编造商品、图片或价格。支持卡片的客户端显示卡片，不支持卡片的客户端可使用fallback_markdown展示文字与链接；图片是否可见取决于客户端对原生图片块的支持。',inputSchema:{type:'object',properties:{items:{type:'array',minItems:1,maxItems:8,items:{type:'object',properties:{item_id:{type:'string',pattern:'^[0-9]{5,24}$'},sku_id:{type:'string',pattern:'^[0-9]{1,30}$'},image_ids:{type:'array',maxItems:3,items:{type:'string',pattern:'^[a-f0-9]{24}$'}}},required:['item_id'],additionalProperties:false}}},required:['items'],additionalProperties:false},annotations:{readOnlyHint:true,destructiveHint:false,idempotentHint:true,openWorldHint:false},_meta:{ui:{resourceUri:uri,visibility:['model']},'openai/outputTemplate':uri}};
function cardFromRecords(request,records){
 const rows=records.filter(x=>x.item_id===request.item_id),catalog=rows.find(x=>x.kind==='catalog')?.data;
 const skuRecord=request.sku_id?rows.find(x=>x.kind==='sku'&&x.variant===request.sku_id):null;
 const itemRecord=rows.find(x=>x.kind==='item'),search=rows.find(x=>x.kind==='search');
 const base=itemRecord?.data||catalog||search?.data;if(!base)throw Error('该商品尚未读取，请先搜索或读取真实详情。');
 const variant=request.sku_id?(skuRecord?.data.sku||catalog?.skus.find(x=>x.sku_id===request.sku_id)):null;
 if(request.sku_id&&!variant)throw Error('尚未读取到这个真实规格，不能生成对应规格卡片。');
 const sameSelected=itemRecord?.data.selected_sku?.sku_id===request.sku_id;
 const pricing=variant?.pricing||(sameSelected?itemRecord?.data.pricing:null)||(!request.sku_id?(itemRecord?.data.pricing||search?.data.pricing):null);
 const imageList=catalog?.images||[];let picked;
 if(request.image_ids?.length){picked=request.image_ids.map(id=>{const image=imageList.find(x=>x.image_id===id);if(!image)throw Error('图片不属于当前商品的已读目录。');if(request.sku_id&&image.kind==='sku'&&!image.sku_ids?.includes(request.sku_id))throw Error('该规格图属于其他SKU，不能错配。');return image;});}
 else {const skuImages=request.sku_id?imageList.filter(x=>x.kind==='sku'&&x.sku_ids?.includes(request.sku_id)):[];picked=(skuImages.length?skuImages:imageList.filter(x=>x.kind==='main')).slice(0,1);}
 if(!picked.length&&search?.data.thumbnail_url)picked=[{image_id:search.data.thumbnail_id,url:search.data.thumbnail_url,kind:'search_thumbnail',sku_binding:'unconfirmed'}];
 const images=picked.filter(x=>safeImage(x.url));
 const skuImageConfirmed=!!request.sku_id&&images.length>0&&images.every(x=>x.kind==='sku'&&x.sku_ids?.includes(request.sku_id));
 const record=skuRecord||itemRecord||search||rows[0];
 const price=pricing?.display_price??variant?.price??null;
 return {item_id:request.item_id,sku_id:request.sku_id||null,title:base.title,specs:variant?.specs||null,price,price_label:pricing?.price_label||(variant?.price!=null?'规格内嵌数据价，优惠未核对':null),price_source:pricing?.source||(variant?.price!=null?'sku_embedded_price':null),final_payable_confirmed:false,promotions:pricing?.promotions||[],images,sku_image_confirmed:skuImageConfirmed,image_note:request.sku_id&&!skuImageConfirmed?'图片与此商品对应，尚未确认属于这个具体规格。':null,url:'https://item.taobao.com/item.htm?id='+request.item_id+(request.sku_id?'&skuId='+request.sku_id:''),sku_link_selection_verified:false,fetched_at:record.data.fetched_at||new Date(record.saved_at).toISOString(),stale:record.stale||false};
}
const escape=s=>String(s||'').replace(/[\\`*_{}[\]()<>#!|]/g,'\\$&');
function markdown(cards){return cards.map(c=>{return '**'+escape(c.title)+'**\n\n'+(c.specs?Object.entries(c.specs).map(([k,v])=>escape(k)+'：'+escape(v)).join('；')+'\n\n':'')+(c.price!==null?'¥'+c.price.toFixed(2)+' · '+escape(c.price_label||'展示价')+'（最终金额未确认）\n\n':'')+(c.image_note?escape(c.image_note)+'\n\n':'')+'[查看商品]('+c.url+')';}).join('\n\n---\n\n');}
async function render(input={}){
 if(!input||Object.keys(input).some(k=>k!=='items')||!Array.isArray(input.items)||input.items.length<1||input.items.length>8||input.items.some(x=>!x||Object.keys(x).some(k=>!['item_id','sku_id','image_ids'].includes(k))||!/^\d{5,24}$/.test(x.item_id)||x.sku_id!==undefined&&!/^\d{1,30}$/.test(x.sku_id)||x.image_ids!==undefined&&(!Array.isArray(x.image_ids)||x.image_ids.length>3||x.image_ids.some(id=>!/^[a-f0-9]{24}$/.test(id)))))throw Error('商品卡片参数无效。');
 const records=cache.list(input.items.map(x=>x.item_id),100),cards=input.items.map(x=>cardFromRecords(x,records));
 const selectedImages=cards.flatMap(card=>card.images.map(image=>({...image,item_id:card.item_id})));
 const attached=await embed(selectedImages);
 const data={cards,fallback_markdown:markdown(cards),image_delivery:attached.statuses,browser_accessed:false,note:'图片以实际图片块交付。只有 image_delivery 中 embedded=true 的图片已随结果附上。卡片价格保留来源与时间；链接打开时请核对规格。'};
 return attachUiImages({content:[{type:'text',text:JSON.stringify(data)},...attached.content],structuredContent:data,isError:false});
}
function attachUiImages(result){
 const assets={};let identity=null;
 for(const block of result.content||[]){
  if(block.type==='text'){try{const row=JSON.parse(block.text);identity=row.item_id&&row.image_id?row:null;}catch{identity=null;}}
  else if(block.type==='image'&&identity&&['image/png','image/jpeg','image/webp'].includes(block.mimeType)){
   assets[identity.item_id+':'+identity.image_id]={mimeType:block.mimeType,data:block.data};identity=null;
  }
 }
 return {...result,_meta:{...result._meta,'cheng/imageAssets':assets}};
}
function resource(){return {contents:[{uri,mimeType:'text/html;profile=mcp-app',text:fs.readFileSync(path.join(__dirname,'taobao-cards.html'),'utf8'),_meta:{ui:{prefersBorder:false,csp:{connectDomains:[],resourceDomains:[]}}}}]};}
module.exports={uri,tool,render,resource,cardFromRecords,markdown,attachUiImages};
