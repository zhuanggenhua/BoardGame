# Dice Throne 特殊交互 UI 复审（2026-04-05）

## 审计范围

- 游戏：`dicethrone`
- 范围：本轮只复审“规则里明确要求展示比较/对决语义”的特殊交互，不再只看规则闭环。
- 重点链路：
  - `src/games/dicethrone/heroes/gunslinger/abilities.ts`
  - `src/games/dicethrone/domain/customActions/gunslinger.ts`
  - `src/games/dicethrone/domain/systems.ts`
  - `src/games/dicethrone/hooks/useDiceThroneState.ts`
  - `src/games/dicethrone/ui/ChoiceModal.tsx`
  - `src/games/dicethrone/ui/BonusDieOverlay.tsx`

## 权威来源

- `src/games/dicethrone/heroes/gunslinger/abilities.ts`
- `src/games/dicethrone/rule/枪手录入核对.md`
- `.spec/knowledge/standards/testing-audit.md`

## 审计方法

1. 搜索描述中包含“双方各掷 / 比较 / 对决”语义的能力。
2. 反查这些能力的运行时实现是否把比较结果显式交给 UI。
3. 再检查前端是否存在承载“双骰对比”语义的专门组件；若没有，再确认是否被降级成普通按钮或普通 bonus die。

## 逐项结论

### 1. 枪手 `Showdown / 枪战决斗` 命中 UI 语义缺口

- 描述语义：
  - `src/games/dicethrone/heroes/gunslinger/abilities.ts` 明确写的是“双方各掷 1 颗骰子。若你的结果不小于对手，改为造成 X 点伤害；否则造成 Y 点伤害。”
- 实现入口：
  - `src/games/dicethrone/domain/customActions/gunslinger.ts` `handleShowdownBonus`
- 当前实现：
  - 直接在领域层 `random.d(6)` 两次得到 `attackerRoll` / `defenderRoll`
  - 然后只在胜利时发 `BONUS_DAMAGE_ADDED`
  - 没有发 `BONUS_DIE_ROLLED`、没有发专门的“比较结果”事件、也没有创建能展示双方骰点的 interaction
- UI 后果：
  - 前端只能看到最终伤害变化，看不到“双方各掷 1 颗骰并比较”的过程与结果。
- 命中维度：
  - `D5 交互完整`
  - `D15 UI 状态同步`
  - `D20 状态可观测性`
  - `D47 测试覆盖完整性`
- 判定：
  - 规则执行链存在，但 UI 语义表达不完整。
  - 这不是“未实装伤害结算”，而是“特殊比较交互被隐藏成纯数值后处理”。

### 2. 枪手 `Duel / 对决` 命中更明显的 UI 语义缺口

- 描述语义：
  - `src/games/dicethrone/heroes/gunslinger/abilities.ts` 明确要求“你与攻击方各掷 1 颗骰并比较”；胜利后再二选一。
- 实现入口：
  - `src/games/dicethrone/domain/customActions/gunslinger.ts` `handleDuelResolve`
- 当前实现：
  - 防御方骰点直接读 `state.dice[0]?.value`
  - 攻击方骰点在领域层 `random.d(6)` 生成
  - 若赢，只发 `CHOICE_REQUESTED`
  - 系统层把它转成 `simple-choice`
  - 前端最终用 `ChoiceModal` 的默认按钮模式展示“造成 3 点不可防御伤害 / 抵挡 1/2 进攻伤害”
- UI 后果：
  - 玩家能做后续选择，但看不到这次对决里“我掷了几，攻击方掷了几，为什么我现在能选这两个分支”。
  - 这条比 `Showdown` 更严重，因为它不只是“少了表现”，还把“对决结果”与“后续分支选择”割裂了。
- 命中维度：
  - `D5 交互完整`
  - `D15 UI 状态同步`
  - `D20 状态可观测性`
  - `D48 UI 交互渲染模式完整性`
- 判定：
  - 当前不应再表述为“Duel 已完整审过”。
  - 更准确的结论是：`Duel` 的规则逻辑已实现，但专属交互语义 UI 未实现。

### 3. 当前命中的共享根因是“比较型特殊交互”没有统一表示层

- 现状：
  - `ChoiceModal` 能承载普通按钮、token 选择、target choice、slider
  - `BonusDieOverlay` 能承载单骰/多骰 bonus die 与重掷
  - 但没有“双方对掷并比较结果”的统一展示模型
- 共享问题：
  - 领域层一旦直接把比较结果折叠成 `BONUS_DAMAGE_ADDED` 或普通 `CHOICE_REQUESTED`，UI 就不可能补出真实语义。
- 结论：
  - 根因不是枪手某一招少写 JSX，而是共享抽象缺口。
  - 如果后续修复，优先级应是新增通用的“compare-roll”展示/交互模型，而不是继续给单个技能做临时按钮补丁。

## 测试与证据

- 已核对现有行为测试：
  - `src/games/dicethrone/__tests__/cross-hero.test.ts`
  - 其中已有 `duel win creates choice and prevent-half branch works`
  - 以及 `duel loss deals 1 undefendable damage without choice`
- 当前测试缺口：
  - 没有任何测试验证 `Showdown` / `Duel` 是否向 UI 暴露了双方骰点比较结果。
  - 现有测试只能证明规则数值落地，不能证明特殊交互 UI 语义成立。

## 修订结论

- 旧口径若写成“枪手特殊交互已审完”，该结论失效。
- 更新后应拆成两层：
  - 规则闭环：`Showdown` / `Duel` 已有基础执行链
  - UI 语义闭环：未完成，且属于共享抽象缺口

## Addendum（2026-04-05）：compare-roll 交互已补齐

- 上述“UI 语义闭环未完成”的结论在本轮实现后已失效。
- 当前修复内容：
  - 引擎层新增 `compare-roll-choice` 一等交互类型：
    - `src/engine/systems/InteractionSystem.ts`
    - `src/engine/systems/CompareRollChoiceSystem.ts`
  - DiceThrone 领域层新增 `COMPARE_ROLL_REQUESTED` 事件并接入系统映射：
    - `src/games/dicethrone/domain/events.ts`
    - `src/games/dicethrone/domain/systems.ts`
  - 枪手 `Showdown / Duel` 改为发 compare-roll 事件，不再分别退化成“纯数值后处理”或“普通 simple-choice”：
    - `src/games/dicethrone/domain/customActions/gunslinger.ts`
  - 前端新增 `CompareRollOverlay`，同时展示双方骰点、标题、结果语义，以及 `Duel` 的后续二选一：
    - `src/games/dicethrone/ui/CompareRollOverlay.tsx`
    - `src/games/dicethrone/ui/BoardOverlays.tsx`
    - `src/games/dicethrone/Board.tsx`
  - 本地化已补齐：
    - `public/locales/zh-CN/game-dicethrone.json`
    - `public/locales/en/game-dicethrone.json`
  - E2E 已补：
    - `e2e/dicethrone-defense-selection.e2e.ts`
    - 证据见 `evidence/dicethrone-compare-roll-e2e-test.md`
- 更新后的结论：
  - `Showdown` / `Duel` 不再属于“规则已实现但 UI 语义未实现”。
  - 当前这类“双方掷骰比较”交互已有共享抽象和真实 UI 承载层。

## 后续建议

1. 若未来其他英雄再接入“双方掷骰比较”类能力，必须直接复用 `compare-roll-choice`，不要再退回 `simple-choice` 或纯日志事件。
2. 若后续要增强表现，可以继续为 compare-roll overlay 增补角色头像、胜负动效或更完整的结果帧截图，但不应改回每个技能各写一套 UI。
3. 继续保留至少 1 条 UI/E2E 验证，防止后续回归把 compare-roll 再次降级成普通选择框。

## 未覆盖风险

1. 当前 E2E 截图属于过程帧，能证明 overlay 和双骰同屏出现；若未来要把它当“完整结果帧”证据，仍需补更稳定的取帧时机。
2. 本轮显式落地的是枪手 `Showdown / Duel`；若后续其他英雄新增 compare-roll 语义，仍需单独补回归或复用现有场景。
