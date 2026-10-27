# 来源与第三方许可

核对日期：2026-10-27。本仓库与淘宝、OpenCLI、OpenAI没有官方隶属关系。

## OpenCLI

- 官方仓库：https://github.com/jackwener/OpenCLI
- 安装依赖：`@jackwener/opencli@2.0.2`。
- 该版本的官方许可证为Apache License 2.0，保留的许可副本见`third-party/OpenCLI-LICENSE-2.0.txt`。
- OpenCLI程序、Chrome扩展和运行依赖不预置在本仓库中，由安装流程从官方来源获取。运行时及各项依赖保留各自许可证。
- 适配器使用OpenCLI注册接口和浏览器会话。本仓库不替代或重新发布官方Chrome扩展。

## SKU和购物车参考资料

- [OpenCLI购物车适配器](https://github.com/jackwener/OpenCLI/blob/main/clis/taobao/cart.js)：用于了解网页读取路线；本仓库按商品行DOM、游标和本项目会话规则实现购物车读取，没有打包该上游文件。
- [SKU数据结构参考](https://github.com/randunun-eng/taobao-sourcing-mcp/blob/main/src/extract/product.py)：参考`skuBase`、`propPath`与`skuCore.sku2info`的数据关联方式；本项目使用JavaScript，按本项目会话、严格价格解析和实际选中核验要求编写。
- 本次查看SKU参考仓库根目录，未发现LICENSE文件。这里保留参考说明，不替参考项目授予许可，也不分发其Python源码。该项目中的价格推断、默认SKU合成和宽松选项匹配规则不代表本项目行为。

## 可选软件与服务

Node.js、Google Chrome、OpenCLI Chrome扩展和OpenAI tunnel-client从各自官方来源安装，并遵守各自许可和服务条款。本仓库不包含其二进制分发包。云端连接是可选项，使用接收者自己的账号与凭证。

第三方项目的许可证不自动决定本仓库自行编写部分的使用许可。所有者已确认本项目自行编写且有权授权部分采用PolyForm Noncommercial License 1.0.0，见根目录LICENSE与LICENSING.md。这不改变第三方自身许可证已授予的权利。
