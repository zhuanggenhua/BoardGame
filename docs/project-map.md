# 项目地图

本文只保留稳定导航；不再维护完整目录树快照。需要精确文件位置时用 `rg --files` 或项目脚本查当前仓库。

## 根入口

| 目标 | 位置 |
| --- | --- |
| AI 规范和 workflow | [`.spec/`](../.spec/AGENTS.md) |
| 普通项目文档 | [`docs/`](README.md) |
| 游戏规则与实现 | `src/games/<gameId>/` |
| 游戏事实资料 | `docs/games/<gameId>/` |
| 可复查证据 | [`evidence/`](../evidence/README.md) |
| E2E 测试 | [`e2e/`](../e2e/) |
| 项目脚本 | [`scripts/`](../scripts/) |

产品规格和任务编排属于 `openspec/`，本项目地图不展开其目录。

## 代码模块

| 模块 | 职责 |
| --- | --- |
| `src/engine/` | 规则引擎、系统管线、共享原语 |
| `src/games/` | 各游戏领域模型、UI、AI、manifest 和测试 |
| `src/components/` | 跨游戏 UI、框架组件和公共交互 |
| `src/contexts/` | 全局上下文和运行时服务注入 |
| `src/services/` | 前端服务、socket、API 客户端 |
| `server/`、`apps/api/` | 服务端运行、API、存储和外部接口 |

## 文档模块

| 目录 | 用途 |
| --- | --- |
| `docs/bugs/` | 问题分析和修复记录 |
| `docs/audit/`、`docs/reviews/` | 审计和代码审查材料 |
| `docs/refactor/` | 重构记录、迁移索引和技术吸收材料 |
| `docs/archive/` | 历史会话、旧提案、旧报告和退役工具 |
| `docs/audio/`、`docs/api/`、`docs/framework/` | 专项事实资料 |

## 常用查询

```bash
rg --files src/games/<gameId>
rg -n "关键词" src docs .spec
Get-ChildItem docs -Recurse -Filter *.md
```

若文档和实际目录冲突，以当前文件系统、源码和 `.spec` 主源为准。
