# Open Design 协作者接入

## 定位

本项目默认把 Open Design 作为设计工具入口，用来生成可落地设计产物、设计系统和前端稿。Open Design 可以是用户明确指定的设计稿交付工具，但不自动证明“设计稿已经合格”。

- **默认范围**：设计稿探索、`DESIGN.md` 设计系统、HTML / PDF / PPTX / 图片类产物，以及 Codex 通过 MCP 调用 Open Design。
- **交付边界**：用户要“设计稿 / 视觉稿 / 效果图”时，默认交付物仍是 PNG / JPG / WebP 图片证据；imagegen 可用时走位图生图，imagegen 不可用且 Open Design 可用时自动转 Open Design artifact 候选稿。本项目固定采用“Open Design artifact + 固定视口浏览器渲染截图 + AI 图面核验 + 用户验收展示”的交付模式；未审计的 Open Design artifact、HTML 预览、产品运行页截图或 reference sheet 只能是工具产物 / 内部校准物，不能直接冒充设计稿。
- **规则与素材门禁**：涉及游戏主 UI、桌游版面、卡牌、token、骰子、角色板、棋盘、状态板等领域对象时，Open Design 运行前必须先按 [`.spec/knowledge/README.md`](../../.spec/knowledge/README.md) 和项目 `boardgame-ui-imagegen` workflow 的设计稿入口，完成本轮规则重读、规则到画面映射、正式素材输入包和出图前硬回执。没有这些证据时，只能产出 blocked brief / 缺口清单，不得生成或进入用户验收展示。
- **素材不是 prompt 文案**：正式素材必须实际进入 Open Design 项目目录、reference sheet、图像输入、拼接基底、atlas crop 或运行时渲染链；只在 prompt 里写工作树路径、素材名或规则对象名，不算使用素材。
- **人工验收顺序**：候选图必须先经过 AI 图面核验，确认规则、素材、少边框和可复刻门禁均为 PASS 后，才允许进入用户验收展示。

## 固定交付模式

本项目默认不把 `od export --format image` 当作设计稿收口门槛。固定模式如下：

1. Open Design artifact 是可编辑设计源。
2. 用户验收图使用当前 artifact 在固定视口（PC 默认 `1920×1080`）下的浏览器渲染 PNG。
3. 所有用户可见设计改动必须先走 AI 图面核验；核验通过后再完成用户可见展示。
4. 测试格线、区域高亮、编号说明等只能通过显式调试参数或标注副本出现，不进入正式 UI 截图。
5. `od export --format image` 只作为可选的桌面版官方导出链路；只有用户明确要求“官方 Open Design 导出 PNG / desktop export / 打包运行时导出”时才追它。若它因缺少桌面运行时失败，不得阻塞已经通过 AI 图面核验的浏览器渲染验收图。

桌面 / 打包运行时的意义只限于使用 Open Design 桌面版 Electron bundled Chromium 生成官方导出文件，适合归档、外部分发或需要复现 Download 菜单产物的场景。它不改变设计语义，也不比同一 artifact 的固定视口浏览器截图更能证明布局、素材、规则对象或格子归属正确。

## 何时使用

- 用户要求接入本地设计工具或设计 MCP。
- 当前任务需要先出设计稿、效果稿、页面原型、设计系统或前端可复刻视觉方案。
- 当前任务已经完成规则 / 素材前置包，但 imagegen 入口不可用、CLI 缺 API key 或不能接入正式素材；此时自动转 Open Design，而不是停成最终阻塞。
- Codex 需要一个本地设计 MCP。

## 仓库内正式入口

默认项目内安装 / 接入入口：

```bash
npm run setup:open-design
```

它会把 Open Design 源码安装到当前仓库的 `.tools/open-design`，构建 daemon / MCP CLI，并安装 Codex MCP。这个目录是本地工具副本，不进 Git。

显式安装入口等价保留：

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

- 默认使用 `D:\codex-home` 作为 `CODEX_HOME`，只用于写当前 Codex MCP 配置。
- 默认工具落点是当前项目 `.tools/open-design`，避免协作者找不到工具来源。
- `npm run setup:open-design` / `npm run setup:design:mcp` 默认会加 `-InstallSource`，把 `nexu-io/open-design` 浅克隆到 `.tools/open-design`。
- 查找顺序是：项目内 `.tools/open-design` → 本机 `od` 命令。旧系统侧路径不作为本项目执行入口。
- 源码安装时要求 Node 24.x，并把 pnpm 补到官方要求的 `10.33.2`。
- 源码安装只安装 daemon / MCP 依赖范围，避免因为桌面 Electron 依赖阻塞 Codex 接入。
- 源码安装会在缺少 SQLite 原生绑定时单独重建 `better-sqlite3`；若 daemon 已经运行且绑定文件存在，会跳过重建以避免文件占用。
- 执行 Open Design 的 MCP 安装：`od mcp install codex`。
- Codex 当前没有可执行文件在 PATH 时，脚本直接写当前生效的 `D:\codex-home\config.toml`。
- 安装后提示重启 Codex，因为当前会话不会热加载新 MCP 工具。
- `start-open-design.ps1` 会在后台启动 `http://127.0.0.1:7456`，日志写入 `logs/open-design-daemon.*.log`。

## 验证

如果是桌面版 / 全局 CLI，先看 `od` 是否可用：

```powershell
where.exe od
```

如果是本项目源码安装，直接验证项目内源码入口：

```powershell
node .\.tools\open-design\apps\daemon\bin\od.mjs --help
```

再看 Codex MCP 列表：

```bash
codex mcp list
```

至少要看到 Open Design 相关 MCP 入口。之后重启 Codex，再在新会话里使用 Open Design 工具。

daemon 验证：

```powershell
Invoke-WebRequest -UseBasicParsing http://127.0.0.1:7456/api/health
```
