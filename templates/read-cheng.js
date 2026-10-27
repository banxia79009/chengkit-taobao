import {cli,Strategy} from '{{TOOLS_URL}}/opencli-api.mjs';
import {readDetail} from '{{TOOLS_URL}}/taobao-detail-adapter.mjs';
cli({site:'taobao',name:'read-cheng',access:'read',description:'读取指定淘宝商品，复用统一淘宝标签',domain:'item.taobao.com',strategy:Strategy.COOKIE,navigateBefore:false,args:[{name:'url',positional:true,required:true}],columns:['payload'],func:readDetail});
