'use strict';
const fs=require('node:fs'),path=require('node:path');
const labels={ensure_browser:'连接商品浏览器',validate:'检查搜索参数',navigate:'打开搜索页',wait_results:'等待搜索结果',open_filters:'打开筛选',discover_filters:'读取筛选选项',validate_filters:'核对筛选条件',apply_price:'设置价格区间',apply_filters:'选择筛选条件',verify_filters:'核对条件生效',extract_results:'读取商品结果'};
function createTracker({directory=path.join(__dirname,'..','state','taobao-search-active'),now=Date.now,pid=process.pid,isAlive=id=>{try{process.kill(id,0);return true;}catch(e){return e.code==='EPERM';}}}={}){
 const file=id=>{if(typeof id!=='string'||!/^[a-f0-9-]{36}$/.test(id))throw Error('Invalid search request identity');return path.join(directory,id+'.json');};
 function save(id,data){fs.mkdirSync(directory,{recursive:true});const target=file(id),temp=target+'.'+process.pid+'.tmp';fs.writeFileSync(temp,JSON.stringify(data),{mode:0o600});fs.renameSync(temp,target);}
 function begin(id){const row={task_id:id,tool:'taobao_search',pid,started_at:now(),updated_at:now(),stage:'ensure_browser'};save(id,row);return id;}
 function update(id,data){let row;try{row=JSON.parse(fs.readFileSync(file(id),'utf8'));}catch(e){if(e.code==='ENOENT')return;throw e;}
  const next={...row,updated_at:now()};for(const k of ['stage','group_count','option_count','current_group'])if(data[k]!==undefined)next[k]=data[k];save(id,next);
 }
 function finish(id){if(!id)return;try{const target=file(id),row=JSON.parse(fs.readFileSync(target,'utf8'));if(row.pid===pid)fs.unlinkSync(target);}catch(e){if(e.code!=='ENOENT')throw e;}}
 function list(){let names;try{names=fs.readdirSync(directory).filter(n=>/^[a-f0-9-]{36}\.json$/.test(n));}catch(e){if(e.code==='ENOENT')return [];throw e;}
  const rows=[];for(const name of names){let row;try{row=JSON.parse(fs.readFileSync(path.join(directory,name),'utf8'));}catch(e){if(e.code==='ENOENT')continue;throw e;}
   if(!Number.isInteger(row.pid)||!Number.isFinite(row.started_at))throw Error('搜索运行记录无法核实');
   if(!isAlive(row.pid))continue;
   rows.push({task_id:row.task_id,tool:'taobao_search',stage:row.stage,label:labels[row.stage]||'执行搜索',started_at:new Date(row.started_at).toISOString(),elapsed_seconds:Math.max(0,Math.floor((now()-row.started_at)/1000)),...(Number.isInteger(row.group_count)?{groups_read:row.group_count}:{}),...(Number.isInteger(row.option_count)?{options_read:row.option_count}:{})});
  }return rows;
 }
 return {begin,update,finish,list};
}
module.exports={...createTracker(),createTracker};
