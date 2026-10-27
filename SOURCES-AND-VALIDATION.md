# 来源与验证范围

整理日期：2026-10-27。状态：本轮搜索与按需筛选已部署到开发者工作台，并经用户真实验收通过；独立安装包与其他电脑的安装验收分别看待。

## 组成

- OpenCLI 电脑端从官方 npm 注册表安装 `@jackwener/opencli@2.0.2`；包内不预置 Node.js、Chrome、OpenCLI 二进制或 Tunnel 客户端。
- 淘宝 MCP 包装层、原生筛选、结果封装兼容、人工协助状态和单次操作记录来自本次已维护的实现，按本包目录改为相对路径。
- 淘宝加购适配逻辑保留单件、唯一按钮、商品编号核对、未知结果不自动重试。同一个操作编号重复提交不会再次点击。
- 独立适配器放在本包自己的 `state/opencli-home/`，不覆盖使用者原来的全局适配器。
- 不包含作者的浏览器用户数据、账号、Cookie、密钥、Tunnel 编号、连接标识、购物车记录、工作台背景或其他项目。

OpenCLI 与 tunnel-client 上游按其官方仓库所示许可证使用；实际安装的第三方软件和依赖保留其各自许可证。本包不表示 OpenCLI、淘宝或 OpenAI 官方出品，也不代表对第三方服务可用性的保证。

## 本次验证

| 项目 | 证据与范围 |
|---|---|
| 原生筛选 | 在已登录淘宝网页实测 14～89 元、物流／包邮、品牌／舍里组合；三个条件均经网页确认，返回 3 件对应商品 |
| 筛选自动测试 | 12 项通过：筛选与展开、超过 10 组、慢加载等待、加载超时不点击、带包装的阶段错误解析等 |
| 右侧全筛选读取 | “连衣裙”实页展开后读到 16 组、379 个选项；包含颜色、材质成分、面料、尺码等动态属性 |
| 属性组合筛选 | 实页确认颜色／黑色、材质成分／棉、尺码／M 同时选中，返回 2 件商品；并未逐个点击验证全部 379 个选项 |
| 保温杯搜索复测 | 用户反馈搜索阶段失败后，改为单次导航后最多 40 次观察商品与入口就绪状态，并保留分阶段失败代码。用户完成现场安全验证后，实测搜索成功返回 3 件商品，读取到 16 组、147 个选项；不代表用户最终验收 |
| 保温杯组合实测 | 用户选择 481-501ml 容量区间后，实页确认颜色／白色、内胆材质／316不锈钢、容量／481-501ml 最终同时选中，返回 3 件商品。证据来自 applied_filters 和面板各组选中状态；没有读取这些商品的已选 SKU，也没有验证其最终成交价 |
| 保温杯真实选项 | 颜色提供白色；内胆材质提供 316不锈钢；容量没有独立 500mL，只提供 481-501ml 等区间。不能把区间筛选说成精确 500mL |
| 新版兼容 | 1.x/2.x 成功结果解码、2.x stdout 登录/验证码识别等 7 项测试通过 |
| 商品与真实图片 | 通过聊天内真实 MCP 调用读取商品 950169002682，返回正确标题和商品原图 |
| 独立目录 | 从包复制到新目录，使用已有官方运行时配置，验证隔离适配器、绑定和 MCP 协议；实际协议检查保留9个独立工具，搜索工具提供完整filters参数和默认关闭的include_filters开关 |
| 包内真实筛选 | 独立目录中的包再次执行上述价格、物流和品牌组合，搜索诊断为 success，返回 2 件商品；仍使用本机已登录 Chrome |
| 未验证 | 尚未在另一台 Windows 电脑和另一套账号上安装；此包的 Tunnel 初始化脚本未在他人账号上运行 |
| 写操作范围 | 按用户明确要求真实回归加购一次，数量1，随后读取购物车核对同商品、SKU、规格、数量；没有下单、付款或给商家发送测试消息，未自动删除测试商品 |
| 网页限制 | 某些页面无中差评／追评筛选；当前原生搜索筛选接口不覆盖独立发货地弹层等未开放控件 |

独立目录测试仍使用同一台电脑的 Node.js、Chrome 和已登录会话，不能描述成“所有电脑一键必定成功”。接收方 AI 必须在目标电脑上重新完成验收。

本轮新增两项的完整参数、实际数据和限制见 CAPABILITIES.md。SKU 实测一个商品28个组合，逐个选择核对6个动态价；购物车实际读取30＋31行，共61行，无重复；首页继续浏览读到10个商品，详情返回正确商品和1张原图，登录恢复返回 ready_to_resume。工作台与MCP已移除淘口令功能，没有开放支付、下单或结算工具。

云服务器章节是按官方连接方案整理的部署指引，尚未在真实云主机验证；没有宣称本包可在无桌面的Linux上直接一键安装。给人的使用说明不包含在本ZIP内。

## 官方资料

- [OpenCLI 官方仓库](https://github.com/jackwener/OpenCLI)
- [OpenCLI 安装与更新](https://opencli.info/docs/guide/installation.html)
- [Browser Bridge 安装方式](https://opencli.info/docs/guide/browser-bridge.html)
- [OpenCLI 官方 Chrome 商店页](https://chromewebstore.google.com/detail/opencli/ildkmabpimmkaediidaifkhjpohdnifk)
- [OpenCLI 官方发布页](https://github.com/jackwener/OpenCLI/releases)
- [OpenAI Secure MCP Tunnel](https://developers.openai.com/api/docs/guides/secure-mcp-tunnels)
- [OpenAI 官方 tunnel-client](https://github.com/openai/tunnel-client)
- [ChatGPT 连接与刷新 MCP 信息](https://developers.openai.com/plugins/deploy/connect-chatgpt)
- [Node.js 官方下载](https://nodejs.org/)

安装、协议与连接说明以以上官方资料、当前代码和分阶段实测为依据。来源与第三方许可见THIRD-PARTY-NOTICES.md。

## 2026-10-27 按需筛选最终验收

用户在更新后的正式服务测试：普通搜索返回3件商品，available_filters=null、applied_filters=[]；include_filters=true读取16组146项且discovery.complete=true；颜色／白色与内胆材质／316不锈钢最终同时选中，返回3件商品。实际使用taobao_search及状态查询，没有购物车写入。

这一轮仅验证搜索和筛选，不证明返回商品的每个SKU都满足要求；没有遇到登录／验证码，因此人工恢复没有重新实测。恢复逻辑变更通过程序检查。25项程序检查含隔离模拟页面和错误输入，不能冒充真实淘宝验收。
