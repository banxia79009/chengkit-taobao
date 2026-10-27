# 给安装 AI 的执行教程

## 目标和边界

在接收者自己的 Windows 电脑上部署独立淘宝 MCP。不要复制发送者的账号、Chrome 数据、Tunnel、密钥或历史记录；本包没有这些内容。不要假定对方的磁盘、用户名、安装目录或扩展连接标识与发送者相同。

如果 AI 在云服务器上，先读 CLOUD-SETUP.md，区分云端 AI、Windows MCP 与 Chrome 所在位置；本包没有经过真实 Linux 云主机部署验收。给人的使用说明单独交付，不放入本 ZIP。

本包是本地 stdio MCP 服务。云端 ChatGPT 需要另配对方自己的 Secure MCP Tunnel；本地支持 stdio 的 MCP 客户端可直接接入，不需要 Tunnel。先完成本地验收，再处理云端接入。

保留用户现有 Chrome、其他扩展、MCP 配置和 OpenCLI 安装。安装目录要是稳定的普通文件夹，不放临时目录。本包安装自己的运行时和自己的适配器目录，不改用户全局 `.opencli/clis`。

## 1. 先检查，再安装

1. 向用户确认安装目录和用于淘宝的日常 Chrome。检查 `node --version`、`npm --version`、Chrome 是否存在。没有 Node.js 时从 [nodejs.org](https://nodejs.org/) 安装官方 Windows 版本；不要自己创建一个替代浏览器或清空原配置。
2. 使用 Node.js 22 或更高版本。本包在 Node.js 24.20.0 上验证。
3. 解压完整安装包。检查 `MANIFEST.sha256`，核对收到的文件没有被意外改动。安装脚本只从官方 npm 注册表下载 `@jackwener/opencli@2.0.2`，跳过安装生命周期脚本。
4. 在 PowerShell 中进入安装目录后运行：

```powershell
powershell.exe -NoProfile -ExecutionPolicy Bypass -File .\Install.ps1
```

这个 `Bypass` 只用于本次脚本进程，不修改系统的永久执行策略。脚本没有要求管理员权限；需要系统权限时由用户确认。网络下载失败时保留文件并报告，不重复安装或重置环境。

生成的目录：

| 路径 | 用途 |
|---|---|
| `runtime/managed/2.0.2/` | 本包独立安装的官方程序和依赖 |
| `state/opencli-runtime.json` | 当前运行版本选择 |
| `state/opencli-home/.opencli/clis/taobao/` | 仅供本包使用的适配器 |
| `state/browser-profile.json` | 绑定后的浏览器连接标识 |
| `mcp-config.generated.json` | 根据当前安装目录生成的 stdio 配置 |

## 2. 浏览器扩展：两种方式任选一种

### 方式 A：官方 Chrome 商店版，推荐日常使用

1. 在用户日常 Chrome 中打开 [OpenCLI 官方商店页](https://chromewebstore.google.com/detail/opencli/ildkmabpimmkaediidaifkhjpohdnifk)。核对发布者网站为 `opencli.info`，扩展编号为 `ildkmabpimmkaediidaifkhjpohdnifk`。
2. 由用户确认安装及浏览器权限提示。无需为了安装本包另建 Google 账号或开启浏览器同步。
3. 商店版无需保持开发者模式，由 Chrome 管理更新。电脑端 OpenCLI 仍然是另一项独立安装，不会因此自动更新。
4. 如果原来有本地加载版，把旧版停用、保留备用。保持一个工作桥连接，避免把同一 Chrome 当成两个配置。

### 方式 B：官方 GitHub 发布的本地解压版

1. 打开 [作者官方发布页](https://github.com/jackwener/OpenCLI/releases)，下载官方预构建扩展 ZIP；不要把第三方转载包当官方包。优先使用本包已验证的扩展版本，换版本需要重新检查。
2. 解压到固定文件夹。在 Chrome 打开 `chrome://extensions/`，开启“开发者模式”，选择“加载已解压的扩展程序”，选包含 `manifest.json` 的目录。
3. 本地加载方式需要开发者模式保持开启。关掉它可能令扩展停用；不要把这种连接丢失说成淘宝账号掉线。
4. 更新时保留旧目录，下载新版、按 Chrome 的流程重新加载或更新，再做连接和读取验证。移动或删除扩展文件夹会影响加载。

商店版与本地版都是官方可用安装方式。商店版省去开发者模式的维护，本地版方便固定版本。不要同时启用两份后随意选择连接。

## 3. 连接和绑定 Chrome

1. 打开选定的 Chrome，启用所选 OpenCLI 扩展，确认没有另一份桥抢占连接。
2. 在安装目录运行：

```powershell
node .\tools\opencli-launch.cjs doctor
node .\scripts\bind-browser.cjs
```

3. 只有检测到唯一连接时，绑定脚本才自动保存。多个 Chrome 配置同时连接时，先向用户确认目标，再将对应 `contextId` 作为脚本参数传入；不要猜选账号。换装扩展后连接标识可能变化，需要重新绑定。
4. 在 Chrome 中手动登录淘宝。浏览器账号登录、Google 同步和淘宝网页登录是不同的事；不要把它们混在一起。
5. 诊断发现扩展离线时，先核对它是否启用、是否属于日常 Chrome；没有证据不要清 Cookie、重新安装 Chrome 或要求用户反复登录。

## 4. 本地 MCP 接入

打开生成的 `mcp-config.generated.json`，把其中的 `taobao` 条目合并到目标客户端的 MCP 配置中。不要覆盖现有配置，也不要把整份文件写成其他客户端不支持的格式。`command` 是检测到的 Node.exe 绝对路径，`args` 是本包 `server.cjs` 的绝对路径。

通过目标客户端检查 `initialize`、`tools/list` 和 `taobao_status`。服务使用标准输入输出传 JSON-RPC，不把普通日志混入 stdout。直接运行 `Start-MCP.cmd` 后窗口安静等待输入不等于卡死。

工具清单：

| 工具 | 用途 |
|---|---|
| `taobao_status` | 连接、冷却与历史记录状态 |
| `taobao_search` | 搜索和网页原生筛选 |
| `taobao_read_item` | 打开指定商品、返回真实图片与已加载信息 |
| `taobao_browse_home` | 浏览首页、下一批和停止 |
| `taobao_add_cart` | 用户授权后的单件加购 |
| `taobao_contact_seller` | 客服读取、准备消息、确认后发送 |
| `taobao_resume` | 人工验证完成后的单次恢复检查 |
| `taobao_read_cart` | 只读真实购物车、规格、数量与勾选状态，支持游标继续读取 |
| `taobao_read_sku` | 读取真实 SKU 矩阵、价格与库存，可指定组合核对动态价 |

新增两项工具的完整参数、字段与真实验证限制见 `CAPABILITIES.md`。安全起见，没有给 AI 支付权限：本服务不暴露支付、下单或结算工具。工具中的加购能力只加入购物车，不产生支付授权。

## 5. 搜索与原生筛选

筛选由助手按任务需要自主决定。普通 `taobao_search` 默认只返回商品，不展开筛选面板，`available_filters=null`。需要了解可用条件时，传 `include_filters=true` 搜索并读取完整 `available_filters`；再按当前页面的真实组名与完整选项填写 `filters`。传入实际筛选条件时会自动读取并核验，不必另设开关。不要预设每个搜索类目都有同样的品牌或条件。

以**右侧“全部筛选”面板**为准：程序通过网页控件展开各组、滚动读取选项。颜色、材质成分、面料、尺码、风格、功能等不使用固定白名单；网页提供哪些组就返回哪些组。`available_filters.discovery.complete` 表示本次面板遍历已完成，`group_count` 和 `option_count` 给出读到的数量。它不表示用户已经验收，也不保证另一个搜索类目提供同样的筛选。

例如“连衣裙”页面实际提供相应选项时，可使用：

```json
{"query":"连衣裙","limit":2,"filters":{"groups":[{"name":"颜色","values":["黑色"]},{"name":"材质成分","values":["棉"]},{"name":"尺码","values":["M"]}]}}
```

一次允许最多 64 个组、每组 64 个选项。淘宝同组互斥的选项不能同时生效，遇到互斥或失效必须报告，不能把未生效条件写成已筛选。

```json
{"query":"马克杯","limit":5}
```

如果页面实际提供“物流 / 包邮”和“品牌 / 舍里”，可请求：

```json
{
  "query":"马克杯",
  "limit":5,
  "filters":{
    "price_min":14,
    "price_max":89,
    "groups":[
      {"name":"物流","values":["包邮"]},
      {"name":"品牌","values":["舍里"]}
    ]
  }
}
```

检查 `applied_filters`。没有提供的选项、不能确认生效的条件或互斥条件应报错；不能静默忽略。当前接口支持原生价格区间和展开式筛选组；发货地等未通过当前接口提供的控件不应冒充支持。搜索展示价可能是优惠价，不能当已选 SKU 的最终成交价。容量等要求只有网页真实提供对应筛选组时才作为原生筛选，不能靠标题硬凑。

打开搜索结果时，把返回的 `url` 原样交给 `taobao_read_item`，不要再次搜索标题。展示图片只用这次商品工具实际返回的图片，不能用关键词搜图代替。评论未加载或中差评筛选未提供时，如实说明。

## 6. 可选：通过自己的 Secure MCP Tunnel 接到云端 ChatGPT

这一阶段使用对方自己的 OpenAI Platform/ChatGPT 权限。参考 [OpenAI 官方 Secure MCP Tunnel 文档](https://developers.openai.com/api/docs/guides/secure-mcp-tunnels) 和 [官方客户端发布页](https://github.com/openai/tunnel-client/releases/latest)，确认当前平台支持、账号权限和官方客户端下载方式，不复用发送者的 Tunnel。

1. 由用户在自己的 Platform 中创建或选择 Tunnel，确认它关联目标 ChatGPT 工作区，并取得运行权限。
2. 安装适合该 Windows 电脑的官方 `tunnel-client.exe`，先运行 `tunnel-client help quickstart` 核对当前参数；若官方参数有变化，按官方帮助调整，不靠猜。
3. 在安装目录运行：

```powershell
powershell.exe -NoProfile -ExecutionPolicy Bypass -File .\Setup-Tunnel.ps1 -TunnelId "用户自己的Tunnel编号"
```

4. 用户在本机隐藏输入框输入自己的运行密钥。脚本用当前 Windows 用户的加密机制保存在 `private/`；原始密钥不应出现在聊天、命令参数、截图或教程里。不要上传或分享 `private/`。
5. 脚本配置 stdio 转发并运行 `doctor`、启动客户端。保持窗口运行。查看客户端本机 readiness 与 polling，再进入 ChatGPT 添加自定义 MCP 连接，选择同一个 Tunnel。
6. 在 ChatGPT 中完成连接添加/刷新，实际调用 `taobao_status`，然后做一次用户同意的商品读取。只有这一步成功，才可以写“云端已接通”。

如果账号没有相应入口或权限，停在“本地 MCP 已验证”的真实阶段，记录缺少的条件；不要绕过权限或改成公开暴露用户电脑。无需开放入站路由端口。

## 7. 验收与交接

逐项记录实际证据：程序版本、扩展版本、连接状态、MCP 工具清单、一次真实搜索、一次真实筛选、一次指定商品读取和它的真实图片。云端与本地测试分开报告。没有得到用户明确授权，不为了验收而加购或给商家发测试消息。

登录/验证码必须来自当前页面的明确证据；处理后再继续。用户换商品时结束旧等待，新的授权任务可继续。历史未知写入记录保留供核对，不全局阻拦后面的任务。同一个 `operation_id` 重发不再次点击；用户明确提出新的逻辑请求才使用新编号。客服发送需要展示商家与完整正文，消费过的确认凭证不能重用。

默认两次淘宝任务之间保留约 90 秒间隔。查询当前状态即可看到剩余时间，不连续试错。对方页面布局变化时，记录具体缺失控件，不伪造结果。

淘宝搜索会在一次导航后等待商品卡片就绪；仅请求筛选时额外等待筛选入口，最多观察 40 次，不通过自动刷新重新请求来掩盖加载失败。搜索失败应报告“打开搜索页面／等待商品加载／打开面板／展开读取／应用条件／确认生效／提取商品”等具体步骤和代码。`SEARCH_PAGE_BLANK`、`SEARCH_RESULTS_NOT_READY`、`SEARCH_FILTER_ENTRY_MISSING` 不表示淘宝需要重新登录；安全验证仍须以当前页证据为准。诊断写入本包 `state/search-last-diagnostic.json`，不记录密钥或完整网页内容。

交接时给人类一句简单结论，说明哪些已实测、哪些仍缺条件；留下本包路径和启动方式。不得把发送者电脑上的实测当成接收者电脑上已安装成功。

## 8. 更新与回退

浏览器扩展和电脑端分别更新。本包安装脚本明确固定电脑端 2.0.2；没有后台自动更新，也没有工作台更新按钮。更换电脑端版本时，在另一个版本目录安装，保留原目录，核对接口和结果封装，再修改 `state/opencli-runtime.json` 的 `active`。验证失败就改回原目录，重启对应 MCP 服务和连接桥；不要删除旧版或重做未知写入。

本包已兼容 1.x 原始 JSON 与 2.x `{ok:true,data}` 成功结果，以及 2.x stdout 错误。将来升级仍需要实测，不能只看 `--version` 就宣称所有功能兼容。
