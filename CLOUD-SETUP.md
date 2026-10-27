# 给安装 AI：云服务器接入简明说明

先区分 AI 在哪里运行、MCP 在哪里运行、已登录的 Chrome 在哪里运行。本包已验证的是 Windows 上的 MCP 与 Chrome；没有在真实云服务器上完成部署验收。

## 选择路线

| 情况 | 路线 |
|---|---|
| 使用云端 ChatGPT | MCP 与 Chrome 留在 Windows，按 AI-INSTALL.md 配对用户自己的 Secure MCP Tunnel，不必另租服务器 |
| 自己的 AI 在 Linux 云服务器，支持启动 stdio MCP 子进程 | 优先让云端通过已认证的私人 SSH 通道启动 Windows 上的 MCP；浏览器仍在 Windows |
| Windows 云主机有可交互桌面 | 可尝试 Windows 安装流程，先验证 Chrome、扩展、可见窗口和人工登录；此路线未实测 |
| 只有无桌面的 Linux 服务器，准备把整套程序直接搬上去 | 本包不提供已验证的一键流程；不要运行 Windows Install.ps1，也不要把依赖安装成功说成淘宝浏览器已接通 |

## Linux 云端 AI 连接 Windows MCP

1. 先在 Windows 按 AI-INSTALL.md 完成本地安装与搜索／详情验收，保留已有配置。不要把 Chrome 数据或 Cookie 上传到服务器。
2. 使用用户已经授权并可验证身份的私人网络与 SSH 连接。Windows 端 SSH 的安装和权限要求以 [Microsoft 官方文档](https://learn.microsoft.com/en-us/windows-server/administration/openssh/openssh_install_firstuse)为准。新增系统服务或网络访问配置前，应向用户说明实际改动；不要擅自改变整机访问范围。
3. 先在服务器终端确认可以连到正确 Windows 主机，核对主机身份。仅 SSH 已连通还不代表 MCP 已可用。
4. 如果云端 AI 的 MCP 客户端支持 stdio 子进程，可把启动命令设为 ssh：SSH 不分配交互终端，通过标准输入输出转发 MCP 的 JSON-RPC；远端执行 Windows 本地生成配置中的 Node.exe 和 server.cjs 路径。按目标 Windows 的远端 Shell 正确引用含空格路径，不把 JSON 字符串当 Shell 转义。
5. 下面只是路径示意，不能原样套在不同电脑上；前提是 taobao-home 已配置为可用的 SSH 主机别名、远端 node 在 PATH 且安装目录没有空格：

```json
{
  "mcpServers": {
    "taobao": {
      "command": "ssh",
      "args": ["-T", "taobao-home", "node", "C:/TaobaoMCP/server.cjs"]
    }
  }
}
```

6. 不在 args 里放密码、私钥正文或 API 密钥。远端 Shell 配置不得向 stdout 输出欢迎语或普通日志，避免混入 MCP 协议。由云端客户端真正完成 initialize、tools/list、一次搜索和商品读取后，才报告云端已接通。
7. Windows 电脑、Chrome 和连接需要在使用期间保持可用。重连后先检查状态，不自动重做未知结果的加购或发信。

如果客户端只支持 HTTP MCP，不能把上述 stdio 配置硬塞进去。先查客户端官方文档支持的、具有身份验证的接入方式；Secure MCP Tunnel 的账号／平台接入按 OpenAI 官方说明处理，不把它当成所有第三方客户端的通用入口。

## 进阶参考：远程 OpenCLI，浏览器仍在本机

[OpenCLI 官方远程编排文档](https://opencli.info/docs/guide/remote-orchestration.html)提供了用 SSH 反向转发本地浏览器桥的方案。示意从 Windows 本机连接自己的服务器：

```text
ssh -N -o ExitOnForwardFailure=yes -R 127.0.0.1:19825:127.0.0.1:19825 user@your-server
```

该方案使服务器通过自己的回环端口访问本机桥。它只是 OpenCLI 的远程浏览器连接方法，不代表本包已在 Linux 上适配好全部安装、适配器目录、浏览器启动和服务管理。只有明确需要把 OpenCLI 执行端迁移到服务器时再研究，不与前面的 SSH stdio 路线混为一谈。

桥端口仅留在可信回环／私人通道内，不直接开放公网端口 19825。登录、验证码由本人处理，不提供绕过流程。服务器上也不新增支付、下单或结算工具。
