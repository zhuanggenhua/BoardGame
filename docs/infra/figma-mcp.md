# Figma MCP 协作者接入

## 定位

这份文档和仓库内的 `scripts/infra/setup-figma-mcp.ps1` 是本项目 Figma MCP 接入的唯一真相源。

- **项目内负责的内容**：接入脚本、命令入口、协作者说明、默认授权策略。
- **每位协作者本机负责的内容**：自己的 `CODEX_HOME` / `config.toml` / OAuth 凭据文件。

换句话说，**实现和接入方式在仓库里，个人登录态在各自机器上**。这符合 Codex / OpenClaw 的运行方式，也避免把仓库 SOP 藏进某个人本机的 `D:\codex-home`。

## 何时使用

- 当前会话里缺少 `use_figma`、`get_metadata`、`get_screenshot`、`get_design_context`
- 新协作者第一次给这个仓库接 Figma MCP
- 之前接过，但浏览器授权过期或凭据损坏
- 需要确认“是不是仓库入口有问题，而不是某个人本机配置有问题”

## 仓库内正式入口

默认只补配置，不触发网页登录：

```bash
npm run setup:figma:mcp
```

```powershell
powershell -NoProfile -ExecutionPolicy Bypass -File scripts/infra/setup-figma-mcp.ps1
```

需要打开独立窗口但仍然不登录：

```bash
npm run setup:figma:mcp:window
```

首次授权、凭据失效、或明确要求重授权时：

```bash
npm run setup:figma:mcp:login
```

```bash
npm run setup:figma:mcp:window:login
```

也可以直接用仓库内 cmd 包装器：

```cmd
scripts\infra\setup-figma-mcp.cmd -Login
```

## 脚本会做什么

- 自动定位当前协作者自己的 `CODEX_HOME`
- 确保 `mcp_oauth_credentials_store = "file"`
- 确保 `[features]` 下 `rmcp_client = true`
- 确保 `[mcp_servers.figma]` 下存在 `url = "https://mcp.figma.com/mcp"`
- 默认不重新触发 OAuth 浏览器登录
- 只有显式 `-Login` 时才执行 `codex mcp login figma`

## 验证

运行：

```bash
codex mcp list
```

至少要看到：

- `figma`
- `Status` 为 `enabled`
- `Auth` 为 `OAuth`

然后**重启 Codex / OpenClaw 会话**。MCP 工具不会在当前旧会话里热加载。

新会话里再确认有没有这些工具：

- `use_figma`
- `get_metadata`
- `get_screenshot`
- `get_design_context`

## 边界

- Figma MCP 的**接入流程**在仓库里。
- Figma MCP 的**个人登录态**不可能进仓库，只能存在每位协作者自己的 `CODEX_HOME`。
- 如果你看到 `D:\codex-home\tools\setup-figma-mcp.ps1`，它只能算兼容入口；项目内脚本才是正式真相源。

## 常见问题

**为什么默认不登录？**

因为 OAuth 凭据已经走文件态存储，正常情况下应当复用，不该每次补配置都打断协作者去浏览器重新授权。

**为什么脚本改的是 `CODEX_HOME`，还说“都在项目里”？**

因为 Codex / OpenClaw 的 MCP 配置和凭据本来就属于每个协作者自己的本机状态，仓库只能提供“怎样写进去”和“何时重授权”的统一实现。项目里放的是流程与脚本，不是把私人凭据塞进 Git。

**为什么我已经跑过脚本，当前会话还是没有 Figma 工具？**

因为当前会话不会热加载 MCP 工具列表，必须重启 Codex / OpenClaw。
