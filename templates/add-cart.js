import { cli, Strategy } from '{{TOOLS_URL}}/opencli-api.mjs';
import core from '{{CART_CORE_URL}}';
// User-owned override; the packaged adapter is not edited.
cli({
  site: 'taobao', name: 'add-cart', access: 'write',
  description: '淘宝加入购物车（本地修复：文字/图标按钮，数量1，不下单）',
  domain: 'item.taobao.com', strategy: Strategy.COOKIE, navigateBefore: false, siteSession: 'persistent',
  args: [
    {name:'id', positional:true, required:true, help:'商品 ID'},
    {name:'spec', help:'规格关键词；不填时选择可用默认规格'},
    {name:'max-price', help:'实际规格最高价格，超过即停止'},
    {name:'dry-run', type:'bool', default:false, help:'选规格并检测加购按钮，不执行加购'},
  ],
  columns: ['status','title','price','selected_spec','quantity','item_id','button_kind','evidence'],
  func: core.runAdapter,
});
