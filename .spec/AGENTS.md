# BoardGame — 中心文档

BoardGame 是多桌游 Web / 移动平台。`.spec/` 是 AI 规范唯一真相源；产品规格、提案和产品任务归 `openspec/`。

知识导航（`knowledge/README.md`）与硬红线（`rules/system.md`）是本规范核心：Claude Code 由 `CLAUDE.md` 强制载入；其它宿主读完本文件后继续读取这两份。沉淀或同步能力用 [`spec-steward`](skills/spec-steward/SKILL.md)。

## 项目是什么

- 前端：React / TypeScript / Vite，多游戏运行时。
- 后端：Node 服务、在线房间、反馈与资源发布链路。
- 业务边界：游戏规则、素材、测试证据和 AI workflow 必须在仓内可回查；外部系统只作为事实来源或发布目标。

## 调度核心

**子 Agent 名册**（权威是各 `.agent.md`）：

| 名称 | 职责 | 何时调度 |
| --- | --- | --- |
| `reviewer` | 对照本轮目标、规范和证据审查交付，给出放行或退回 | 高风险、多文件或收口前需要独立审查时 |

- 主 loop 负责理解目标、选择 skill、执行或调度、验证和收口；子 Agent 只执行被派发的审查职责。
- 改代码、配置、规则数据、测试、正式文档或交付前，用 [`before-you-code`](skills/before-you-code/SKILL.md) 判断读取深度。
- 规则 bug、UI、资源录入、发布、反馈、合并、看图等专项工作，从 `knowledge/README.md` 找标准，再读对应 `skills/<name>/SKILL.md`。
- 用户要求接入或排查操作日志、撤回、音效等游戏支撑能力时，用 [`support-capability-integration`](skills/support-capability-integration/SKILL.md) 作为项目 workflow，再回到底层标准执行。
- 任务路由只由本文件和 `knowledge/README.md` 承担中心职责；workflow / skill 不维护平行规范清单。新增或迁移标准时，默认只登记到 `knowledge/README.md`；只有具体执行分卷直接消费该标准时，才保留一条指向主源的链接。
- 修改 `.spec/` 结构、规则落点、skill、知识文档或文档去噪时，用 [`spec-steward`](skills/spec-steward/SKILL.md)。

## 编码约定

- 先锁定本轮问题对象、真相来源、目标入口 / 环境和验收口径；缺证据时继续定位，不直接改。
- 只做当前目标要求的改动，不顺手重构、不新增平行真相源。
- 新功能、修 bug 或改关键逻辑时按项目测试标准留验证证据；纯文档结构调整至少跑 `npm run spec:lint`。
- 交付说明包含改动清单、验证命令与关键结果、剩余风险，以及是否需要知识沉淀。

## 宿主差异

| 能力 | Claude Code | Codex |
| --- | --- | --- |
| 核心加载 | `CLAUDE.md` 用 `@import` 强制加载 `.spec/AGENTS.md`、`knowledge/README.md`、`rules/system.md` | 读根 `AGENTS.md` 后进入 `.spec/AGENTS.md`，再按本文件读取 knowledge / rules |
| 子 Agent 发现 | `.claude/agents -> .spec/agents` | 主 loop 手动读 `.spec/agents/` |
| Skill 发现 | `.claude/skills -> .spec/skills` | `.agents/skills -> .spec/skills`；`.codex/skill -> .spec/skills` |
| 任务持久化 | 宿主任务工具可作草稿 | 跨宿主任务真值放 `.spec/tasks/<slug>.md` |

## 框架自身的决策与校验

- 结构决策记录在 [`decisions/`](decisions/README.md)；功能设计记录放 `knowledge/features/`。
- 结构一致性由 `npm run spec:lint` 校验；宿主链接必须指向 `.spec/agents` 或 `.spec/skills`。
- `.spec/tools/spec-lint.mjs` 的头部注释是 lint 校验项清单的单一权威。
