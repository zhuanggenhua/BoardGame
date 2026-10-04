# 0003 · 吸收外部卡牌脚本工作流为 BoardGame 效果 Authoring 适配层

- 日期：2026-10-03
- 状态：生效

## 背景

外部 `ygopro-scripting-workflow` 把“查参考、拆效果、写脚本、跑单卡测试、检查覆盖率”组织成一条工作流。它对 YGOPro/Lua/OCGCore 很贴合，但不能直接成为 BoardGame 的规则、数据或测试真相源。

BoardGame 已经有更严格的 `locked` 录入合同、描述到实现审计、semantic runtime、AI 合法动作和 evidence 边界。本次吸收的目标是迁移可复用的 authoring 纪律，不复制外部引擎模型。

## 决策

将可迁移内容落到项目 skill [`card-effect-authoring`](../skills/card-effect-authoring/SKILL.md)，由它编排现有 canonical 文档；不新增第二套规则语义或证据总账。

| 外部做法 | 是否吸收 | 吸收后的 BoardGame 形态 | 理由 |
| --- | --- | --- | --- |
| 先查相似官方实现再写卡 | 是 | 先查 sharedFlow、Effect DSL、semantic selector/gateway 和允许配置差异 | 降低重复实现和语义漂移，符合现有共享流程审计 |
| 把效果拆成条件、费用、对象、处理 | 是，转译 | 用时机、主体、条件、成本、target/material/reference、选择、结果、清理拆原子语义 | 保留拆解价值，同时避免把 YGOPro `target/operation` 当成项目模型 |
| 每张卡绑定测试 | 是，改为共享绑定 | 先抽取 `sharedFlowId` 与共享配置 schema；共享流程绑定主领域测试和负向路径，卡牌只补配置差异边界及新增职责的验证 | 避免重复实现和重复测试，同时保留卡牌差异、AI 合法动作、真实交互和 evidence 的审计边界 |
| 红字/静态检查 | 是，转译 | 写前检查合同状态、消费映射、semantic bypass、validate/execute/AI 对齐和测试落点 | 把外部静态门禁升级为项目语义门禁 |
| 参考仓库准备脚本 | 部分吸收 | 只允许作为可回查辅助来源和可重复准备动作 | 外部参考不能成为 BoardGame 规则真相源 |
| 单卡工作区与可恢复运行 | 是 | 复用现有 WorkflowRun、DecisionRequest、ArtifactBundle | 不新增第二套工作流状态 |
| `.cdb` / Lua / OCGCore / MSG | 否 | 保持 BoardGame 自己的数据、事件、交互和测试模型 | 这些是 YGOPro 引擎专属，不存在一对一迁移 |
| “脚本通过即完成” | 否 | 必须追到最终权威状态、AI 和证据边界 | 会越权覆盖现有审计标准 |
| 把效果实现等同于 AI 策略 | 否 | 策略继续走 `game-ai-strategy-design` | 合法动作和收益策略是不同层级 |

## 后果

- 新增卡牌或能力时有统一的项目级 authoring 入口。
- 相似卡先归入共享流程和配置 schema，卡牌只维护差异字段与必要边界验证。
- 外部工作流的有价值部分变成可执行步骤，而不是停留在参考结论。
- YGOPro 特有 API 不会污染 BoardGame 的 semantic runtime、AI 或 evidence 模型。
- `ai-repo-workbench` 后续可以增加 `card-effect-authoring` 固定模板，但当前不会伪造尚未接线的运行时能力。
