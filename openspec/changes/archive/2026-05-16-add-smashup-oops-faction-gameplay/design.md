## Context

Oops 四派系当前只完成了 intake：

- 资源可见
- 数据可选
- 棋盘能显示图像

但 gameplay 仍未落地。现有代码中已经存在：

- `buriedCards` 状态模型
- `domain/bury.ts` 翻开/打出链路
- `vampires_pod` 中的埋葬触发与交互先例

缺失的是：

- Oops 四派系自己的 ability / trigger / ongoing 注册
- 埋葬的正式 UI 展示
- 决斗、混合来源选择、替代去向等交互的 E2E 证据

## Goals / Non-Goals

- Goals:
  - 按派系分波次实施，阶段性可验证
  - 先把埋葬体系做成正式玩家可用能力，再扩展到其他交互
  - 新交互类型必须落到 UI 与 E2E
  - 每个派系完成后立即审计并留证，不把规则核对全部压到最后
- Non-Goals:
  - 一次性同时实现四派系全部逻辑再统一排错
  - 为本轮硬造新的通用大框架
  - 顺手补无关派系

## Decisions

- Decision: 先做 `Ancient Egyptians`
  - Why: 它是 Oops 四派系里最核心的新机制承载者，先打通埋葬主链路，后续 `Vikings` 可以复用。

- Decision: `Vikings` 第二波实施
  - Why: 同样会消费 bury / discard / hidden information，紧跟埋葬体系最容易复用和收敛。

- Decision: `Cowboys` 与 `Samurai` 放在埋葬稳定后
  - Why: 它们更偏向目标选择、移动、对战破坏和替代去向，不应和 bury UI 一起混着调试。

- Decision: UI 和领域逻辑同步推进
  - Why: 埋葬类机制如果只做领域逻辑、不补可见性和操作入口，后续审计时会被判定为“不完整实现”。

- Decision: 从 `Ancient Egyptians` 开始逐派系审计
  - Why: 已经出现 `Bury this card` 出牌时缺少基地目标的实现偏差，必须把审计门禁前移到首个派系，而不是等到四派系全部完成后再集中发现。

- Decision: 最终 E2E 必须围绕“新交互类型”设计
  - Why: 旧的资源可见性 E2E 只能证明卡图能显示，不能证明玩法真正可玩。

- Decision: 统一审计只负责汇总，不替代单派系审计
  - Why: 单派系审计能更早暴露共享链路问题；最终统一审计只用来做跨派系回归和证据收口。

## Risks / Trade-offs

- Risk: Ancient Egyptians 和 Vikings 共用 bury 体系，改动容易影响 `vampires_pod`
  - Mitigation: 每波次都运行 bury / vampires_pod 相关现有测试，再加新测试。

- Risk: 一些 action 文本可能需要新的 targetType 或 mixed-source 选择
  - Mitigation: 先复用现有 `simple-choice` / `base` / `minion` / `card` 模式；只有复用失败时再修改交互系统。

- Risk: 埋葬 UI 可见性实现如果写死到某派系，会破坏“面向百游戏”
  - Mitigation: UI 层围绕 `buriedCards` 状态通用渲染，不绑派系名。

## Migration Plan

1. 提案获批后，从 `Ancient Egyptians` 开始进入实现与首轮审计。
2. 每完成一个派系就先做该派系规则审计、共享链路扩审和回归测试，再进入下一个派系。
3. 四派系全部完成后，再做统一汇总审计和 E2E 收尾。

## Open Questions

- `Ancient Egyptians` 与 `Vikings` 的部分 bury action 是否需要新增更细粒度的卡面预览交互，而不是纯 button/card 列表。
- `Cowboys` 的 duel 流程是否足以复用现有 destroy target 交互，还是需要单独的“决斗展示”层。
