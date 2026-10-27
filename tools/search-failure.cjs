'use strict';
const stages={validate:'检查搜索参数',navigate:'打开搜索页面',wait_results:'等待搜索结果加载',open_filters:'打开右侧全部筛选',discover_filters:'展开并读取右侧筛选',validate_filters:'核对筛选选项',apply_price:'设置价格区间',apply_filters:'选择筛选条件',verify_filters:'确认条件生效',extract_results:'读取商品数据'};
function inspect(error){
 let wire='';try{const value=JSON.parse(error?.stdout||'{}');const e=value.error;wire=typeof e==='string'?e:String(e?.message||'');}catch{}
 const text=[wire,error?.stderr,error?.message].filter(Boolean).join('\n');
 const stage=text.match(/\[TAOBAO_SEARCH_STAGE:([a-z_]+)\]/)?.[1];
 const code=text.match(/\b(SEARCH_PAGE_BLANK|SEARCH_RESULTS_NOT_READY|SEARCH_FILTER_ENTRY_MISSING|SEARCH_PAGE_MISMATCH|FILTER_DISCOVERY_INCOMPLETE|FILTER_UNAVAILABLE|FILTER_NOT_APPLIED|LOGIN_REQUIRED|VERIFICATION_REQUIRED)\b/)?.[1];
 return {stage:stages[stage]?stage:null,failure_code:code||null,label:stages[stage]||'未确定',wire};
}
function describe(error){
 const info=inspect(error);if(!info.stage&&!info.failure_code)return null;
 // Login and security challenges keep the existing evidence/resume handler.
 if(/^(LOGIN_REQUIRED|VERIFICATION_REQUIRED)$/.test(info.failure_code||''))return null;
 const reasons={SEARCH_PAGE_BLANK:'淘宝搜索页仍为空白',SEARCH_RESULTS_NOT_READY:'淘宝页面已打开，但商品数据仍未加载完成',SEARCH_FILTER_ENTRY_MISSING:'商品已出现，但右侧筛选入口尚未就绪',SEARCH_PAGE_MISMATCH:'当前页面不是允许的淘宝搜索页',FILTER_DISCOVERY_INCOMPLETE:'右侧筛选未能完整展开',FILTER_UNAVAILABLE:'当前页面未提供所请求的筛选控件或选项',FILTER_NOT_APPLIED:'网页未确认筛选条件生效'};
 let message='淘宝搜索未完成。失败步骤：'+info.label+'；代码：'+(info.failure_code||'SEARCH_STAGE_FAILED')+'。'+(reasons[info.failure_code]||'此步骤执行失败')+'；未自动刷新或重试，未执行加购。';
 if(info.failure_code==='FILTER_UNAVAILABLE'){const start=info.wire.indexOf('{"groups":');if(start>=0){try{const available=JSON.parse(info.wire.slice(start));message+=' 当前可用筛选：'+JSON.stringify(available);}catch{}}}
 return message;
}
module.exports={inspect,describe};
