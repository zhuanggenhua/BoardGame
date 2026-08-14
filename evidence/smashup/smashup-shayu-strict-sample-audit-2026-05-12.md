# SmashUp shayu 严格抽样调查（2026-05-12）

## 结论边界

- 本轮是对 `smashup-shayu-full-chain-audit-2026-05-12.md` 的再次抽样调查，不替代 39 卡 + 6 基地全量矩阵。
- 抽样策略：优先抽 L1 / 残余 / 容易发生“第一入口被二次 prompt 复选”的对象。
- 本轮没有新增浏览器 E2E 截图，因此结论仍停在 L2 行为验证；不得解释为逐对象 L3 E2E 收口。

## 抽样对象

| 对象 | 抽样原因 | 描述动作链 | 旧风险 | 本轮结论 |
| --- | --- | --- | --- | --- |
| `sharks_dangerous_waters` | L1；持续行动卡天赋，依赖附着基地上下文 | 打到基地 → 天赋选择这里一个随从 -2 | 可能跨基地选错目标 | 通过。prompt 只包含附着基地随从，结算只修改该基地目标。 |
| `tornados_cyclone` | L1；自移动天赋，易把目的地当第一入口 | 自身 → 选择另一个基地 → 移动自身 | 可能源/目的地反转 | 通过。第一入口是天赋自身，prompt 只选择目标基地，最终自身移动。 |
| `mythic_greeks_favor_of_hermes` | L1；无目标额度类，需证明不会产生伪交互 | 无目标 → +2 行动额度 | 可能只有结构无行为证据 | 通过。无 interaction，`actionLimit` 从 1 到 3。 |
| `mythic_greeks_favor_of_zeus` | L1；base 第一入口，最容易重复选基地 | 选择基地 → 该基地爆破点 -5 | **发现问题：命令已选基地后 handler 又弹一次 base prompt** | 已修复。handler 直接消费 `ctx.targetBaseIndex ?? ctx.baseIndex`，不再二次 prompt；L2 通过。 |
| `base_wooden_horse` | L1/L2；任意玩家行动后由行动玩家选择 | 行动玩家打出目标基地行动 → 触发基地 → 行动玩家可选这里任意随从 +2 | 可能选择权归属错成基地 owner / 目标归属过窄 | 通过。prompt.playerId 是行动玩家；可给该基地任意归属随从 +2。 |

## 发现项

### F1：宙斯的恩惠存在“第一入口基地被二次选择”的入口链缺口（已修复）

- 文案：选择一个基地，直到回合结束，那里破坏点 -5。
- 数据：`playNeedsBase: true`，UI/validator 第一入口已经是基地。
- 旧实现：`favorOfZeus` 忽略 `ctx.targetBaseIndex/ctx.baseIndex`，再次调用 `greekBasePromptProgram`，导致玩家选完基地后又看到一次“选择降低爆破点的基地”。
- 根因分类：通用交互入口矩阵的“单一真相/直接入口消费”落地不够细；不是素材、文案或 Board 单点问题。
- 修复：`src/games/smashup/abilities/mythic_greeks.ts` 中 `favorOfZeus` 改为直接发 `modifyBreakpoint(ctx.targetBaseIndex ?? ctx.baseIndex, -5, ...)`。
- 新测试：`抽样复审：宙斯的恩惠使用第一入口基地直接降低爆破点，不再二次弹基地选择`。

## 本轮同步补强

- `.spec/knowledge/standards/testing-audit.md` 最低门禁新增通用规则：如果第一入口已由命令 payload / UI 点击对象确定，handler 必须直接消费该入口；不得再创建同 targetType 的二次选择 prompt。
- `src/games/smashup/__tests__/shayuFactionAbilities.test.ts` 新增 5 条抽样复审 L2 行为测试。

## 验证记录

- `npx eslint src/games/smashup/abilities/mythic_greeks.ts src/games/smashup/__tests__/shayuFactionAbilities.test.ts` → 0 errors。
- `npx vitest run src/games/smashup/__tests__/shayuFactionAbilities.test.ts -t "抽样复审"` → 5 passed / 16 skipped。
- `npx vitest run src/games/smashup/__tests__/shayuFactionAbilities.test.ts` → 21 passed。
- `npx vitest run --config vitest.config.audit.ts src/games/smashup/__tests__/abilityBehaviorAudit.test.ts -t "直接入口字段|控制者约束"` → 2 passed / 24 skipped。

## 残余范围

- 本轮没有新增浏览器 E2E 截图，不能宣称 L3。
- `mythic_greeks_argonaut` 跨派系 action-trigger 泛化仍是后续专项；本轮未扩大为跨全派系参数化审计。
