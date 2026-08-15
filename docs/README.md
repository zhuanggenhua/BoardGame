# BoardGame 文档入口

[`docs/`](README.md) 承载事实资料、规则来源、工具参考、历史记录和证据说明。AI 执行规范、验收门槛和 workflow 正文归 [`.spec/`](../.spec/AGENTS.md)。

## 入口

| 目标 | 入口 |
| --- | --- |
| AI 协作规则 | [`AGENTS.md`](../AGENTS.md) -> [`.spec/AGENTS.md`](../.spec/AGENTS.md) |
| AI 标准、workflow、宿主结构 | [`.spec/knowledge/README.md`](../.spec/knowledge/README.md) |
| 产品规格、提案、任务 | [`openspec/AGENTS.md`](../openspec/AGENTS.md) |
| 技术事实资料 | [`docs/framework/`](framework/) 、[`docs/api/README.md`](api/README.md)、[`docs/architecture/`](architecture/) |
| 单游戏事实资料 | `docs/games/<gameId>/` |
| 游戏规则真相源 | `src/games/<gameId>/rule/` 或 `docs/games/<gameId>/sources/` |
| 审计和截图证据 | [`evidence/README.md`](../evidence/README.md) |
| 临时输出 | [`temp/`](../temp/)、[`tmp/`](../tmp/)、[`test-results/`](../test-results/) |

## 目录职责

| 目录 | 职责 |
| --- | --- |
| [`.spec/`](../.spec/AGENTS.md) | AI 规范唯一真相源 |
| [`openspec/`](../openspec/AGENTS.md) | 产品能力规格和变更编排 |
| [`docs/`](README.md) | 项目事实资料和历史说明 |
| `docs/games/` | 单游戏规则来源、设计资料、记录 |
| `docs/games/<gameId>/records/` | 单游戏历史记录；不是 workflow 入口 |
| `docs/bugs/`、`docs/reviews/`、`docs/audit/` | 问题分析、审查报告、审计材料 |
| [`docs/archive/`](archive/README.md) | 历史会话、旧记录和迁移保留内容；不是当前任务入口 |
| [`evidence/`](../evidence/README.md) | 可复查证据和截图账本 |

## 整理规则

1. 先确定唯一职责落点，再迁移、归并或删除。
2. [`docs/`](README.md) 不承载 AI 执行规范；发现这类正文，迁入 [`.spec/knowledge/standards/`](../.spec/knowledge/standards/) 或 [`.spec/skills/`](../.spec/skills/)。
3. `docs/**/workflows` 不保留；workflow 进 [`.spec/skills/`](../.spec/skills/)，历史记录进 `records/`。
4. 临时日志、探针输出、Wiki 对比和测试输出不放根目录，按 [`temp-files-management`](temp-files-management.md) 收口。
5. 项目文档里的文件链接按 [`documentation-style`](../.spec/knowledge/standards/documentation-style.md) 写：指向仓内真实文件或目录时使用相对 Markdown 链接。
