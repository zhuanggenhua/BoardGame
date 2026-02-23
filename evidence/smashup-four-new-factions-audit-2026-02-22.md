# SmashUp 四个新派系逐个审计（2026-02-22）

## 审计范围
- 科学怪人 `frankenstein`
- 狼人 `werewolves`
- 吸血鬼 `vampires`
- 巨蚁 `giant_ants`

## 执行基线
- 规则与审计规范：@docs/ai-rules/testing-audit.md#65-117
- 自动审计验证：
  - `abilityBehaviorAudit.test.ts`
  - `interactionCompletenessAudit.test.ts`
  - `entity-chain-integrity.test.ts`
- 结果：3 files / 32 tests passed

---

## 1) 科学怪人（frankenstein）

### 结论
- 状态：✅ 本轮审计收口（含 Igor 被弃掉触发）

### 发现 A（高，已修复）
- **Igor “被弃掉后”触发已实装**
- 新增 `TriggerTiming: 'onMinionDiscardedFromBase'`（基地结算时随从被弃置，非消灭）
- `scoreOneBase` 在 `BASE_SCORED` 后、`afterScoring` 前对每个被弃随从触发该时机
- Igor 同时注册 `onMinionDestroyed` + `onMinionDiscardedFromBase`，弃置时排除被弃基地上的候选目标
- 确认雄蜂 `giant_ant_drone` 仅注册 `onMinionDestroyed`，基地结算不触发

### 发现 B（中，已修复）
- **The Monster 多同名来源错配已修复：交互值显式携带 sourceMinionUid/sourceBaseIndex，handler 优先使用精确来源**
- 修复：
  - @src/games/smashup/abilities/frankenstein.ts#156-179
  - @src/games/smashup/abilities/frankenstein.ts#452-478
- 回归：
  - @src/games/smashup/__tests__/newFactionAbilities.test.ts#753-800

---

## 2) 狼人（werewolves）

### 结论
- 状态：✅ 高风险语义缺陷已修复

### 发现 A（高，已修复）
- **“关门放狗”预算链路已修复，支持跨多次选择递减并按剩余预算过滤**
- 文案：@public/locales/zh-CN/game-smashup.json#1313-1316
- 修复：
  - @src/games/smashup/abilities/werewolves.ts#176-197
  - @src/games/smashup/abilities/werewolves.ts#264-316
- 回归：
  - @src/games/smashup/__tests__/newFactionAbilities.test.ts#862-952

---

## 3) 吸血鬼（vampires）

### 结论
- 状态：✅ 高/中风险语义缺陷已修复

### 发现 A（高，已修复）
- **The Count / Opportunist 现已按“另一个玩家”语义过滤被消灭随从归属**
- 文案：
  - @public/locales/zh-CN/game-smashup.json#1373-1376
  - @public/locales/zh-CN/game-smashup.json#1337-1340
- 修复：
  - @src/games/smashup/abilities/vampires.ts#484-496
  - @src/games/smashup/abilities/vampires.ts#498-511
- 回归：
  - @src/games/smashup/__tests__/newFactionAbilities.test.ts#753-867

### 发现 B（中，已修复）
- **Heavy Drinker / Nightstalker 多同名来源错配已修复，交互值显式携带 sourceMinionUid/sourceBaseIndex，handler 优先使用精确来源**
- 修复：
  - @src/games/smashup/abilities/vampires.ts#98-107
  - @src/games/smashup/abilities/vampires.ts#142-149
  - @src/games/smashup/abilities/vampires.ts#309-375
- 回归：
  - @src/games/smashup/__tests__/newFactionAbilities.test.ts#857-951

---

## 4) 巨蚁（giant_ants）

### 结论
- 状态：✅ 本轮核心能力与回归用例已对齐

### 已覆盖点
- 滑条数量交互、取消回滚、防止消灭语义与防递归
- 测试：@src/games/smashup/__tests__/newFactionAbilities.test.ts#313-709

### 架构级待办（非本轮回归缺陷）
- `承受压力/我们乃最强` 文案是计分前/后窗口，但数据定义为 `subtype: 'standard'`
- 定义：@src/games/smashup/data/factions/giant-ants.ts#93-100 @src/games/smashup/data/factions/giant-ants.ts#125-132

---

## 跨派系统一风险（测试层）
- `newFactionAbilities.test.ts` 已补科学怪人/狼人/吸血鬼关键语义回归
- 位置：@src/games/smashup/__tests__/newFactionAbilities.test.ts#753-1052
- 说明：自动审计能兜“注册完整性”，但不能替代关键语义行为回归。

## 推荐修复顺序（按风险）
1. Igor 弃置触发已实装，无待办项
