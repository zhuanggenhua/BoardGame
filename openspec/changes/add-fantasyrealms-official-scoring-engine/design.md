## Context

幻想国度的计分不是简单求和，而是一个带搜索与顺序依赖的问题：

- `Shapeshifter / Mirage / Doppelganger` 会改变名称、花色、基础分或罚则
- `Book of Changes` 会在计分前改变一张牌的花色
- `Clears` 需要先结算，而且即便清除者稍后被封印，已生效的解罚仍要保留
- `Necromancer` 会在终局从弃牌堆引入第 8 张牌

如果这层不做成单一求值引擎，后续 Board、终局判定、AI 决策和测试都会继续各算各的。

## Goals / Non-Goals

- Goals:
  - 建立单一官方计分求值入口
  - 支持当前 53 张基础卡的正式加分/减分/封印语义
  - 在双人结束态返回正式胜者或平局
  - 让 Board 展示真实官方分数与分项
- Non-Goals:
  - 不在本轮开放 3~6 人基础版流程
  - 不在没有正式逐卡中文真相源前新增逐卡中文卡名/卡文

## Decisions

- Decision: 用“搜索赋值 + 单次求值器”的结构处理野牌、`Book of Changes` 与 `Necromancer`
  - Why: 幻想国度手牌上限只有 7（Necromancer 时最多 8），穷举搜索是可控的，而且比写大量局部启发式更可靠。

- Decision: 用“从全体牌都先视为 active 开始，反复移除被封印牌”的方式求最终 active 集
  - Why: 这能同时覆盖 `Blizzard` / `Great Flood` / `Wildfire` / `Basilisk` 这种互相封印链，并符合 FAQ 里“先算不会被封印的牌”的结果。

- Decision: `Clears` 先收集成上下文，再进入封印/减分阶段
  - Why: 规则和 FAQ 都明确要求解罚先于封印与减分，而且清除结果不会因为清除者随后被封印而回滚。

## Risks / Trade-offs

- Risk: 搜索空间在“三张野牌 + 易经 + 死灵法师 + 12 张弃牌”时会变大
  - Mitigation: 只在存在相关牌时展开对应搜索；无相关牌时直接单路径求值。

- Risk: 若把某些牌的语义硬编码错，测试只覆盖样例仍可能漏
  - Mitigation: 用 FAQ 样例、规则例子和代表性组合测试锁关键边界。

## Migration Plan

1. 新增 `fantasyrealms-scoring` change。
2. 实现领域层 scoring evaluator。
3. 接入 player summary 与 `isGameOver()` 胜者裁定。
4. 更新 Board 文案和测试。

## Open Questions

- 当前没有逐卡中文名录，因此 `scoreBreakdown` 继续使用英文卡名标签；等后续中文真相源落地后再统一替换。
