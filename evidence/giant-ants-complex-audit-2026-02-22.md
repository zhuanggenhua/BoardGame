# 巨蚁派系复杂描述核查（2026-02-22）

## 范围
- 无人想要永生（Who Wants to Live Forever）
- 如同魔法（A Kind of Magic）
- 承受压力（Under Pressure）
- 我们乃最强（We Are the Champions）
- 雄蜂（Drone，防止消灭）

## 权威描述来源
- `giant_ant_who_wants_to_live_forever`：@public/locales/zh-CN/game-smashup.json#1377-1380
- `giant_ant_a_kind_of_magic`：@public/locales/zh-CN/game-smashup.json#1381-1384
- `giant_ant_under_pressure`：@public/locales/zh-CN/game-smashup.json#1393-1396
- `giant_ant_drone`：@public/locales/zh-CN/game-smashup.json#1413-1416
- `giant_ant_we_are_the_champions`：@public/locales/zh-CN/game-smashup.json#1417-1420

## 实现与测试核查结论

### 1) 无人想要永生
- 结论：✅ 已对齐（含你要求的可取消与回滚）
- 实现：@src/games/smashup/abilities/giant_ants.ts#554-727
- 测试：@src/games/smashup/__tests__/newFactionAbilities.test.ts#314-370

### 2) 如同魔法
- 结论：✅ 已对齐（先移除全部，再逐个重分配，支持取消回滚）
- 实现：@src/games/smashup/abilities/giant_ants.ts#586-795
- 测试：@src/games/smashup/__tests__/newFactionAbilities.test.ts#372-422

### 3) 承受压力（复杂交互）
- 结论：✅ 交互链路已对齐（来源 -> 目标 -> 滑条数量）
- 实现：
  - 来源/目标：@src/games/smashup/abilities/giant_ants.ts#816-854 @src/games/smashup/abilities/giant_ants.ts#856-914
  - 数量处理：@src/games/smashup/abilities/giant_ants.ts#916-935
- 测试：@src/games/smashup/__tests__/newFactionAbilities.test.ts#424-485

### 4) 我们乃最强（复杂交互）
- 结论：✅ 已改为统一滑条语义（来源 -> 目标 -> 滑条数量）
- 实现：@src/games/smashup/abilities/giant_ants.ts#937-1056
- 测试：@src/games/smashup/__tests__/newFactionAbilities.test.ts#487-544

### 5) 雄蜂（防止消灭）
- 结论：✅ 语义已修正为“prevent destroy”而非“replace to hand”
- 核心点：
  - 防止时：仅移除 1 指示物，不再发回手事件 @src/games/smashup/abilities/giant_ants.ts#364-371
  - 跳过时：恢复 `MINION_DESTROYED` @src/games/smashup/abilities/giant_ants.ts#347-361
  - 防递归：通过 reason 门禁避免重复拦截 @src/games/smashup/abilities/giant_ants.ts#1149-1169
  - trigger reason 透传：@src/games/smashup/domain/reducer.ts#588-596 @src/games/smashup/domain/ongoingEffects.ts#111-113
- 测试：@src/games/smashup/__tests__/newFactionAbilities.test.ts#630-709

## 机制级补充（本轮已落地）
- 审计规范新增“替代/防止语义合同审计（强制）”
  - 文档：@docs/ai-rules/testing-audit.md#100-117
- 审计测试新增“描述含 防止...被消灭 必须有 onMinionDestroyed 触发器”
  - 测试：@src/games/smashup/__tests__/abilityBehaviorAudit.test.ts#252-264
- 清理巨蚁历史豁免（避免再次漏审）
  - @src/games/smashup/__tests__/abilityBehaviorAudit.test.ts#271-282
  - @src/games/smashup/__tests__/abilityBehaviorAudit.test.ts#301-304

## 仍需关注的架构级差距（非本轮回归缺陷）
- `承受压力` 与 `我们乃最强` 文案含“计分前/计分后”时机语义，
  但当前卡牌定义是 `subtype: 'standard'` + `abilityTags: ['talent']`：
  - @src/games/smashup/data/factions/giant-ants.ts#93-100
  - @src/games/smashup/data/factions/giant-ants.ts#125-132
- 现有验证层对 `special` 的约束是“仅计分前 Me First 窗口可打出”：
  - @src/games/smashup/domain/commands.ts#190-193
- 因此“计分后 special”尚无通用窗口，属于引擎时机模型缺口（需要单独设计）。

## 本轮验证
- `npx vitest run src/games/smashup/__tests__/abilityBehaviorAudit.test.ts src/games/smashup/__tests__/newFactionAbilities.test.ts src/games/smashup/__tests__/interactionCompletenessAudit.test.ts src/games/smashup/__tests__/entity-chain-integrity.test.ts`
- 结果：4 files / 64 tests 全通过。
