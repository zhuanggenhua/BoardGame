# Open Design 工具接入

本文只记录 BoardGame 仓库内 Open Design 的安装、启动和验证入口。设计稿交付、素材门禁、AI 图面核验和用户展示规则不在本文维护，统一看：

- [boardgame-ui-imagegen](../../.spec/skills/boardgame-ui-imagegen/SKILL.md)
- [ui-design-pipeline](../../.spec/skills/ui-design-pipeline/SKILL.md)
- [game-ui-design](../../.spec/skills/game-ui-design/SKILL.md)
- [ui-audit-loop](../../.spec/skills/ui-audit-loop/SKILL.md)

## 工具定位

- Open Design artifact 是可编辑设计源；导出截图只是验收证据。
- `.tools/open-design` 是本项目本地工具副本，不进 Git。
- 旧系统侧路径不作为本项目默认执行入口；查找顺序是项目 `.tools/open-design`，再到本机 `od` 命令。

## 安装

```bash
npm run setup:open-design
```

显式安装入口：

```bash
npm run setup:open-design:install
```

通用设计工具入口同样指向 Open Design：

```bash
npm run setup:design:mcp
```

cmd 包装器：

```cmd
scripts\infra\setup-open-design.cmd -InstallSource
```

## 启动

```bash
npm run start:open-design
```

后台 daemon 默认监听 `http://127.0.0.1:7456`，日志写入 `logs/open-design-daemon.*.log`。

## 安装脚本事实

- 默认使用 `D:\codex-home` 作为 `CODEX_HOME`，只用于写当前 Codex MCP 配置。
- 源码安装会浅克隆 `nexu-io/open-design` 到 `.tools/open-design`。
- 源码安装要求 Node 24.x，并补齐 pnpm `10.33.2`。
- 安装范围只覆盖 daemon / MCP 依赖；桌面 Electron 依赖不作为 Codex 接入前置。
- 缺少 SQLite 原生绑定时会重建 `better-sqlite3`；daemon 已运行且绑定存在时跳过。
- MCP 安装执行 `od mcp install codex`。
- 当前会话不会热加载新 MCP 工具，安装后需要重启 Codex。

## 验证

全局 CLI：

```powershell
where.exe od
```

项目源码入口：

```powershell
node .\.tools\open-design\apps\daemon\bin\od.mjs --help
```

Codex MCP：

```bash
codex mcp list
```

daemon 健康：

```powershell
Invoke-WebRequest -UseBasicParsing http://127.0.0.1:7456/api/health
```
