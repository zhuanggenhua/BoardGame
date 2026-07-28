# Open Design 协作者接入

## 定位

本项目默认把 Open Design 作为设计工具入口，用来生成可落地设计产物、设计系统和前端稿。Open Design 只定义“用哪个工具接入设计链”，不定义“设计稿已经合格”。

- **默认范围**：设计稿探索、`DESIGN.md` 设计系统、HTML / PDF / PPTX / 图片类产物、Codex / OpenClaw 通过 MCP 调用 Open Design。
- **交付边界**：用户要“设计稿 / 视觉稿 / 效果图”时，默认交付物仍是 PNG / JPG / WebP 位图稿；Open Design artifact、HTML 预览、运行页截图或 reference sheet 只能是工具产物 / 内部校准物，不能直接冒充设计稿。
- **规则与素材门禁**：涉及游戏主 UI、桌游版面、卡牌、token、骰子、角色板、棋盘、状态板等领域对象时，Open Design 运行前必须先按 `docs/ai-rules/doc-index.md` 的“新游戏位图设计稿 / 设计批准门禁”完成本轮规则重读、规则到画面映射、正式素材输入包和出图前硬回执。没有这些证据时，只能产出 blocked brief / 缺口清单，不得生成或打开完成态设计稿。
- **素材不是 prompt 文案**：正式素材必须实际进入 Open Design 项目目录、reference sheet、图像输入、拼接基底、atlas crop 或运行时渲染链；只在 prompt 里写工作树路径、素材名或规则对象名，不算使用素材。
- **人工验收顺序**：候选图必须先经过 AI 图面核验，确认规则、素材、少边框和可复刻门禁均为 PASS 后，才允许打开给用户人工验收。

## 何时使用

- 用户要求接入本地设计工具或设计 MCP。
- 当前任务需要先出设计稿、效果稿、页面原型、设计系统或前端可复刻视觉方案。
- Codex / OpenClaw 需要一个本地设计 MCP。

## 仓库内正式入口

如果本机已经安装了 Open Design 桌面版或已有 `od` 命令：

```bash
npm run setup:open-design
```

如果本机没有 `od`，走源码安装到 `D:\codex-home\tools\open-design`，构建 daemon / MCP CLI，并安装 Codex / OpenClaw MCP：

```bash
npm run setup:open-design:install
```

通用设计工具入口也指向 Open Design：

```bash
npm run setup:design:mcp
```

启动本地 Open Design daemon：

```bash
npm run start:open-design
```

也可以直接用仓库内 cmd 包装器：

```cmd
scripts\infra\setup-open-design.cmd -InstallSource
```

## 脚本会做什么

- 默认使用 `D:\codex-home` 作为 `CODEX_HOME`。
- 优先寻找本机 `od` 命令。
- 如果加 `-InstallSource` 且本机没有 `od`，则把 `nexu-io/open-design` 浅克隆到 `D:\codex-home\tools\open-design`。
- 源码安装时要求 Node 24.x，并把 pnpm 补到官方要求的 `10.33.2`。
- 源码安装只安装 daemon / MCP 依赖范围，避免因为桌面 Electron 依赖阻塞 Codex / OpenClaw 接入。
- 源码安装会在缺少 SQLite 原生绑定时单独重建 `better-sqlite3`；若 daemon 已经运行且绑定文件存在，会跳过重建以避免文件占用。
- 执行 Open Design 的 MCP 安装：`od mcp install codex`，并尝试 `od mcp install openclaw`。
- Codex 当前没有可执行文件在 PATH 时，脚本直接写当前生效的 `D:\codex-home\config.toml`。
- 安装后提示重启 Codex / OpenClaw，因为当前会话不会热加载新 MCP 工具。
- `start-open-design.ps1` 会在后台启动 `http://127.0.0.1:7456`，日志写入 `logs/open-design-daemon.*.log`。

## 验证

如果是桌面版 / 全局 CLI，先看 `od` 是否可用：

```powershell
where.exe od
```

如果是本项目源码安装，直接验证源码入口：

```powershell
node D:\codex-home\tools\open-design\apps\daemon\bin\od.mjs --help
```

再看 Codex MCP 列表：

```bash
codex mcp list
```

至少要看到 Open Design 相关 MCP 入口。之后重启 Codex / OpenClaw，再在新会话里使用 Open Design 工具。

daemon 验证：

```powershell
Invoke-WebRequest -UseBasicParsing http://127.0.0.1:7456/api/health
```
