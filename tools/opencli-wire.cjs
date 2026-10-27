'use strict';
// OpenCLI 1.x emits raw JSON; 2.x wraps successful JSON in {ok:true,data}.
function parse(text){
 const value=JSON.parse(text);
 if(value&&typeof value==='object'&&!Array.isArray(value)&&typeof value.ok==='boolean'){
  if(value.ok!==true)throw Error('OpenCLI返回失败结果，未认定操作成功。');
  if(!Object.hasOwn(value,'data'))throw Error('OpenCLI返回缺少数据。');
  return value.data;
 }
 return value;
}
module.exports={parse};
