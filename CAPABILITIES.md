# 淘宝 MCP 增量能力与真实验证

更新日期：2026-10-27。保留既有搜索、右侧动态筛选、首页、详情、评论、加购、商家客服和人工恢复工具。没有加入支付、下单、结算或删除购物车工具。本轮按需筛选已在正式服务部署并经用户验收；GitHub材料尚未上传，其他设备安装仍需重新验收。

## 1. taobao_read_cart：真实购物车只读读取

参数：

| 参数 | 说明 |
|---|---|
| action | `read` 开始一次读取；`next` 继续。默认 read |
| cursor | next 必须使用上次返回的游标 |
| limit | 每次返回 1～50 行，默认 20 |
| screens | next 向当前加载列表末端推进的最多次数，1～3，默认 1 |

返回：`status`、`items`、`count`、`loaded_count`、`reported_total`、`cursor`、`has_more`、`end_confirmed`、`read_scope`、`permissions`、`fetched_at`、`note`。

每行：`line_id`、`item_id`、`sku_id`、`title`、`url`、`selected_spec`、`price`、`currency`、`price_label`、`price_type`、`quantity`、`shop`、`selected`、`status_flags`、`status_text`、`field_evidence`。

价格取该行主价格节点，不把划线价、降价金额或其他行价格混入。读取复选框 checked 属性，不点击；只读数量输入框，不改值。缺失字段返回 null。`status_flags` 记录页面实际出现的无货、失效、降价等文字。

当前已加载不代表整个购物车。next 继续返回尚未交付的行，并按需滚动。原页面切换或重新加载后，旧游标会明确失效，要求重新 read；不偷偷切回其他标签或把旧数据当当前购物车。

早期真实验证：初次已加载30行，分别读取5行和25行，重复行0，未把未加载的商品声称为已读取。后续两批实际读完页面报告的61行，分页去重通过。公开材料不提供真实账号购物车单行记录。异常行缺少可读数量时返回null，不补成1。

## 2. taobao_read_sku：真实 SKU 规格、价格与库存

参数：

| 参数 | 说明 |
|---|---|
| url | 真实淘宝／天猫商品链接，或受支持的官方分享文案 |
| sku_id | 可选，精确查询一个实际存在的 SKU |
| specs | 可选，使用页面完整维度名到完整选项名的对象，必须指定所有维度 |
| offset | 从第几个有效 SKU 开始，默认 0 |
| limit | 返回 1～100 个 SKU，默认 20 |
| live_limit | 本批逐个选择并核对动态价格的数量，0～10，默认 0；指定 sku_id/specs 时自动核对该组合 |

返回：`status`、`item_id`、`title`、`url`、`dimensions`、`skus`、`total_skus`、`returned`、`next_offset`、`live_verified_count`、`price_scope`、`permissions`、`fetched_at`、`note`。

每个维度返回真实 id、name、values（选项 id/name）。每个 SKU 返回 `sku_id`、`specs`、`specs_complete`、`price`、`price_type`、`price_confirmed`、`currency`、`stock`。stock 包含 `status`、`quantity`、`text`、`warning`、`source`。动态核验还返回 `embedded_price`、`selected_specs`、`live_status`、`live_price_text`。

组合来自商品真实 SKU 矩阵，不按维度做笛卡尔积制造不存在的组合。库存数量来自对应 SKU 的页面数据；“即将售罄”且数量为正时保留有货和低库存提示，不误判成已售罄。没有可靠数量则为 null，库存未知。

价格规则：

- 默认列表中的 `price_type=sku_embedded_price` 是该 SKU 的明确内嵌数据价。拒绝把“起”、价格范围、0 元占位或其他 SKU 的数据当作该 SKU 价格。
- 指定组合或启用 live_limit 后，实际点击对应规格，核对所有选中维度，再读取可见 SKU 面板价。无法核对时 price 为 null，live_status 为 unconfirmed；不会用 embedded_price 冒充动态核验价。
- `price_confirmed` 只表示对应来源的价格已核对。优惠资格、券后价和最终结算仍未核对，不能称为付款金额。
- 默认批量结果不代表逐个点击过全部 SKU；根据 next_offset 分页，按需用 live_limit 或指定 SKU 核对。库存是页面报告的数据，不承诺仓库实时盘点结果。

真实验证：商品 655182299082 共 28 个 SKU。颜色、容量被网页合并在“颜色分类”维度内，工具没有自行拆造维度。逐个选择 6 个 SKU，6 个选中组合与可见价格均核对成功。

| 实际规格 | SKU ID | 已选规格面板价 | 页面库存数据 |
|---|---|---:|---:|
| 经典320ml花生家族 | 4725203357810 | 56 元 | 122 |
| 经典320ml网球系列 | 4725203357811 | 56 元 | 138 |
| 提手款白色320ml | 5066774482852 | 50 元 | 127 |
| 提手款粉色320ml | 6148466381419 | 50 元 | 10，提示即将售罄 |
| 提手款蓝色320ml | 6148466381420 | 50 元 | 10，提示即将售罄 |
| 提手款白色420ml | 4912138882778 | 51 元 | 12 |

上述值是本次访问时的真实页面数据，会随时间变化。未声称适配所有淘宝／天猫模板；页面缺少 SKU 矩阵时返回 unconfirmed。

## 兼容性与当前验证范围

- 通过真实 MCP initialize/tools/list 验证，新旧 8 个淘宝工具均保留；动态筛选 groups 上限仍为 64；未暴露支付、结算或立即购买工具。
- 新工具共用既有 browserGuard、浏览器会话与 assistance 状态机。只有当前页证据确认登录／验证码才 waiting_for_user，用户处理后使用 taobao_resume；旧任务记录不阻止新的授权请求。
- 原有保温杯搜索和白色＋316不锈钢＋481-501ml 原生筛选已真实回归，返回 3 件商品和 16 组、147 个选项，三个条件同时生效。
- 详情回归遇到真实登录页后，用户完成登录；调用 taobao_resume 得到 ready_to_resume，再恢复一次原任务成功，返回正确商品和1张原图。该页中差评／追评入口未提供，工具明确返回 filter_not_available。
- 本文只记录真实页面或真实本地 MCP 结果；未用模拟商品数据替代实测。
- 新增模块：taobao-page、taobao-cart-read、taobao-sku-page、taobao-sku、taobao-extras；修改工具注册、权限白名单、状态分类和工作台工具开关。浏览器会话新增识别购物车域名；详情适配器仅补同商品页复用和加载等待。

## 官方资料与参考实现

- [OpenCLI 官方只读购物车源码](https://github.com/jackwener/OpenCLI/blob/main/clis/taobao/cart.js)
- [SKU 数据关联与动态选价参考](https://github.com/randunun-eng/taobao-sourcing-mcp/blob/main/src/extract/product.py)：借鉴数据结构与思路，当前实现按本项目会话与安全规则编写。

相关判断以官方资料、参考源码和本机实际页面结果为依据；第三方许可说明见THIRD-PARTY-NOTICES.md。


## 加购与后续批次验证

按明确授权进行过一次真实加购回归，随后从实际购物车核对商品、SKU、规格、数量与勾选状态。规格面板价与购物车展示价分别保留各自来源，不混为最终支付金额。公开材料仅记录验证范围，不提供账号购物车内具体商品、规格、价格或商家信息。没有下单或付款，也没有自动删除商品。

加购后购物车显示61件。首批加载30行，next加载另外31行；两批无重复，实际读取共61行。对比加购前后共同出现的29行，数量和勾选状态变化0。后续批次真实读取到缺货、失效及降价状态；异常行数量不可见时返回null。

独立目录安装源已验证MCP协议、隔离适配器和浏览器连接；目前保留原7项与新增2项，共9个工具。正式服务器为原6项与新增2项，共8个淘宝工具，系统与邮箱工具另外保留。

本版按用户要求移除了淘口令功能及官方API路径，不需要为这两项新功能提供淘宝开放平台或淘宝联盟凭证。

首页兼容回归：首屏没有可见商品时返回no-visible-items；按原工具action=next继续两屏后返回success、10件真实商品，page_restored=false，复用原首页。没有修改首页工具。

最终注册检查：原6个淘宝工具与新增2个工具合计8个；taobao_create_tpwd不再列出，支付／结算／立即购买工具均未开放。淘宝动态筛选groups上限仍为64，真实16组147选项的三条件回归通过。
