'use strict';
const fs=require('node:fs'),path=require('node:path'),crypto=require('node:crypto');
function createCache({directory=path.join(__dirname,'..','state','taobao-selection-cache'),now=Date.now}={}){
 const key=(kind,id,variant='')=>crypto.createHash('sha256').update([kind,id,variant].join(':')).digest('hex');
 function put(kind,data,variant=''){
  const id=String(data.item_id||'');if(!/^\d{5,24}$/.test(id))return null;
  const entry={kind,item_id:id,variant,saved_at:now(),data:JSON.parse(JSON.stringify(data))};
  fs.mkdirSync(directory,{recursive:true});const file=path.join(directory,key(kind,id,variant)+'.json'),tmp=file+'.'+crypto.randomUUID()+'.tmp';
  fs.writeFileSync(tmp,JSON.stringify(entry),{mode:0o600});fs.renameSync(tmp,file);return entry;
 }
 function entries(){try{return fs.readdirSync(directory).filter(n=>/^[a-f0-9]{64}\.json$/.test(n)).map(n=>{try{return JSON.parse(fs.readFileSync(path.join(directory,n),'utf8'))}catch{return null;}}).filter(x=>x&&/^\d{5,24}$/.test(x.item_id)&&now()-x.saved_at<24*60*60*1000).sort((a,b)=>b.saved_at-a.saved_at);}catch(e){if(e.code==='ENOENT')return [];throw e;}}
 function get(kind,id,{variant,maxAgeSeconds=300}={}){const row=entries().find(x=>x.kind===kind&&x.item_id===String(id)&&(variant===undefined||x.variant===variant)&&now()-x.saved_at<=maxAgeSeconds*1000);return row?{...row.data,cache:{hit:true,saved_at:new Date(row.saved_at).toISOString(),age_seconds:Math.floor((now()-row.saved_at)/1000),requires_revalidation_for_final_price:true}}:null;}
 function list(ids=[],limit=30){const wanted=new Set(ids);return entries().filter(x=>!wanted.size||wanted.has(x.item_id)).slice(0,limit).map(x=>({...x,age_seconds:Math.floor((now()-x.saved_at)/1000),stale:now()-x.saved_at>300000}));}
 return {put,get,list,directory};
}
module.exports={createCache,cache:createCache()};
