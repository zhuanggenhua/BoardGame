---
name: testing-audit-dimensions
description: 历史归档：旧 D 维度编号对照，不再作为机械审计清单——旧 evidence 对账时查
metadata:
  type: doc
  status: 历史归档
---

# 旧 D 维度编号对照

## 当前状态

本文件不再是新审计的执行清单。项目级审计基准是 [`description-to-implementation-audit.md`](description-to-implementation-audit.md)。

旧 D 编号只用于阅读历史 evidence、旧测试名或旧复盘时的对照；不要新增 D 编号，也不要把审计任务写成“逐项填 D 表”。

## 对照表

| 旧 D 主题 | 当前抽象问题 | 主源 |
| --- | --- | --- |
| 语义保真、边界完整、目标归属、可选 / 强制 | 权威描述拆出的原子断言是否被完整实现 | [`description-to-implementation-audit.md`](description-to-implementation-audit.md) |
| 数据流闭环、旁路消费、同类路径分叉 | 定义、注册、合法性、执行、状态、UI、AI、测试是否消费同一真相 | [`description-to-implementation-audit.md`](description-to-implementation-audit.md) |
| 资源、代价、次数、状态清理 | 消耗、限制、生命周期和最终权威状态是否正确 | [`description-to-implementation-audit.md`](description-to-implementation-audit.md) |
| 时序、延迟、finalize、恢复态 | 交互或系统收口后是否继续正确流程，没有残留或吞链 | [`description-to-implementation-audit.md`](description-to-implementation-audit.md) |
| UI 同步、真实入口、截图 | 玩家看到和点击的入口是否对应同一业务合同 | [`e2e-verification.md`](e2e-verification.md)、[`rule-driven-interaction-design.md`](rule-driven-interaction-design.md) |
| 共享 helper、pipeline、AI / 自动推进 | 缺口是否影响共享消费者，最小受影响对象集是什么 | [`description-to-implementation-audit.md`](description-to-implementation-audit.md)、[`regression-closeout.md`](regression-closeout.md) |
| 旧结论失效、证据分层、自检 | 当前证据能否支撑对外口径，旧 evidence 是否需要降级 | [`audit-evidence-template.md`](audit-evidence-template.md) |

## 旧分卷

以下文件仅保留为历史兼容入口，不能单独作为审计完成定义：

- [`testing-audit-dimensions-semantics-interaction.md`](testing-audit-dimensions-semantics-interaction.md)
- [`testing-audit-dimensions-resource-timing.md`](testing-audit-dimensions-resource-timing.md)
- [`testing-audit-dimensions-state-pipeline.md`](testing-audit-dimensions-state-pipeline.md)
- [`testing-audit-dimensions-deferred-interaction.md`](testing-audit-dimensions-deferred-interaction.md)
- [`testing-audit-d1-power-modifier-subject.md`](testing-audit-d1-power-modifier-subject.md)
- [`testing-audit-d48-ui-rendering.md`](testing-audit-d48-ui-rendering.md)

如果旧分卷里有仍需长期保留的方法，必须先抽象成跨游戏问题，再迁入上方主源；具体游戏案例应下沉到 `evidence/` 或 `docs/games/<gameId>/...`。
