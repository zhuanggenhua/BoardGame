# 审计 4.3：堕落王国士兵能力

## 审计对象
- 血腥狂怒（blood_rage）+ 力量强化（power_boost）+ 衰减（blood_rage_decay）
- 献祭（sacrifice）
- 无魂（soulless）
- 感染（infection）
- 灵魂转移（soul_transfer）

---

## 1. 血腥狂怒（blood_rage）

### 权威描述
- **blood_rage**: "每当一个单位在你的回合中被消灭时，将本单位充能。"
- **power_boost**: "本单位每有1点充能，则获得战力+1，至多为+5。"
- **blood_rage_decay**: "在你的回合结束时，从本单位上移除2点充能。"

### 原子步骤
1. [触发] 任意单位在你的回合中被消灭 → 触发 onUnitDestroyed
2. [充能] 本单位获得1点充能 → addCharge(self, 1)
3. [被动] 每点充能+1战力（最多+5）→ modifyStrength(self, charge)
4. [衰减] 回合结束时移除2点充能 → removeCharge(self, 2)

### 八层链路检查

| 层级 | 状态 | 检查内容 |
|------|------|----------|
| 定义层 | ✅ | `blood_rage`: trigger=onUnitDestroyed, condition=always, effect=addCharge(self,1)。`power_boost`: trigger=onDamageCalculation, effect=modifyStrength(self, charge)。`blood_rage_decay`: trigger=onTurnEnd, condition=hasCharge(self,1), effect=removeCharge(self,2) |
| 注册层 | ✅ | 三个技能均在 abilityRegistry 注册，亡灵战士配置 abilities=['blood_rage','power_boost','blood_rage_decay'] |
| 执行层 | ✅ | `emitDestroyWithTriggers` → `triggerAllUnitsAbilities('onUnitDestroyed', core, opts.playerId)` 只遍历当前回合玩家的单位，正确约束"在你的回合中"。`resolveEffect` 正确处理 addCharge/removeCharge/modifyStrength |
| 状态层 | ✅ | reduce.ts 中 UNIT_CHARGED 事件正确更新 boosts 字段 |
| 验证层 | ✅ | 被动技能无需验证 |
| UI层 | ✅ | 被动自动触发，无需交互 UI |
| i18n层 | ✅ | zh-CN 和 en 均有 blood_rage/power_boost/blood_rage_decay 条目 |
| 测试层 | ✅（已修复） | 原测试只断言 UNIT_CHARGED 事件，**已补充 reduce 后状态断言**（warrior.boosts > 0） |

### 发现与修复
- **[medium] 测试反模式 #2/#4**：blood_rage 测试只断言事件发射，未验证 reduce 后状态。**已修复**：补充 `expect(warrior!.boosts).toBeGreaterThan(0)` 断言。

---

## 2. 献祭（sacrifice）

### 权威描述
"在本单位被消灭之后，对其相邻的每个敌方单位造成1点伤害。"

### 原子步骤
1. [触发] 本单位被消灭 → 触发 onDeath
2. [伤害] 对相邻每个敌方单位造成1伤 → damage(adjacentEnemies, 1)

### 八层链路检查

| 层级 | 状态 | 检查内容 |
|------|------|----------|
| 定义层 | ✅ | trigger=onDeath, effect=damage(adjacentEnemies, 1) |
| 注册层 | ✅ | 在 abilityRegistry 注册，地狱火教徒配置 abilities=['sacrifice'] |
| 执行层 | ✅ | `emitDestroyWithTriggers` → `triggerAbilities('onDeath', victimCtx)` 正确触发。`resolveEffect` 的 damage 分支正确解析 adjacentEnemies 目标 |
| 状态层 | ✅ | UNIT_DAMAGED 事件在 reduce.ts 中正确增加伤害标记 |
| 验证层 | ✅ | 被动触发无需验证 |
| UI层 | ✅ | 被动自动触发，无需交互 UI |
| i18n层 | ✅ | zh-CN 和 en 均有 sacrifice 条目 |
| 测试层 | ✅ | entity-chain-integrity 中有正向测试（相邻敌方受伤）和边界测试（无相邻敌方/链式击杀），abilities.test.ts 验证定义正确性 |

---

## 3. 无魂（soulless）

### 权威描述
"当本单位消灭敌方单位时，你不会获得魔力。"

### 原子步骤
1. [触发] 本单位消灭敌方 → 触发 onKill
2. [阻止] 阻止击杀者获得魔力 → preventMagicGain

### 八层链路检查

| 层级 | 状态 | 检查内容 |
|------|------|----------|
| 定义层 | ✅ | trigger=onKill, effect=preventMagicGain(owner) |
| 注册层 | ✅ | 在 abilityRegistry 注册，疫病体配置 abilities=['soulless','infection'] |
| 执行层 | ✅ | execute.ts 中 `attackerHasSoulless = attackerAbilities.includes('soulless')` → 在 UNIT_DAMAGED 事件上设置 `skipMagicReward: true`，并传递给 `emitDestroyWithTriggers`。**注意**：`attackerAbilities` 通过 `getUnitAbilities(attackerUnit, core)` 获取，走统一查询入口 ✅ |
| 状态层 | ✅ | reduce.ts 中 UNIT_DESTROYED 处理器检查 `skipMagicReward`，为 true 时 `rewardPlayerId = undefined`，不给击杀者魔力 |
| 验证层 | ✅ | 被动效果无需验证 |
| UI层 | ✅ | 被动自动触发，无需交互 UI |
| i18n层 | ✅ | zh-CN 和 en 均有 soulless 条目 |
| 测试层 | ✅（已修复） | 原测试只断言 skipMagicReward 事件标记，**已补充 reduce 后状态断言**（magic 不变） |

### 发现与修复
- **[medium] 测试反模式 #2/#4**：soulless 测试只断言事件 skipMagicReward=true，未验证 reduce 后魔力不变。**已修复**：补充 `expect(newState.players['0'].magic).toBe(magicBefore)` 断言。

---

## 4. 感染（infection）

### 权威描述
"在本单位消灭一个单位之后，你可以使用你的弃牌堆中一个疫病体单位替换被消灭的单位。"

### 原子步骤
1. [触发] 本单位消灭一个单位 → 触发 onKill
2. [条件] 弃牌堆中有疫病体 → hasCardInDiscard(plagueZombie)
3. [交互] 玩家选择弃牌堆中的疫病体 → CardSelectorOverlay
4. [召唤] 将疫病体放置到被消灭单位的位置 → summonFromDiscard(plagueZombie, victim)

### 八层链路检查

| 层级 | 状态 | 检查内容 |
|------|------|----------|
| 定义层 | ✅ | trigger=onKill, condition=hasCardInDiscard(plagueZombie), effect=summonFromDiscard(plagueZombie, victim)。有 customValidator 验证选卡和位置 |
| 注册层 | ✅ | 在 abilityRegistry 注册，executor 在 necromancer.ts 注册 |
| 执行层 | ✅ | necromancer.ts 的 infection executor 从弃牌堆找卡并发射 UNIT_SUMMONED 事件 |
| 状态层 | ✅ | UNIT_SUMMONED 事件在 reduce.ts 中正确放置单位到棋盘 |
| 验证层 | ✅ | customValidator 使用 `isPlagueZombieCard(card)` 验证选卡合法性 ✅ |
| UI层 | ✅（已修复） | CardSelectorOverlay 有取消按钮（"可以/可选"效果有跳过选项）。**但 UI 过滤器使用内联字符串匹配而非 isPlagueZombieCard**，已修复 |
| i18n层 | ✅ | zh-CN 和 en 均有 infection 相关条目（cardSelector、statusBanners、abilities） |
| 测试层 | ✅ | 正向测试验证召唤到指定位置（含状态断言），负向测试验证弃牌堆无疫病体时拒绝 |

### 发现与修复
- **[medium] 数据查询一致性**：Board.tsx 中感染卡牌过滤器使用 `c.id.includes('plague-zombie') || c.name.includes('疫病体')` 内联逻辑，而非统一的 `isPlagueZombieCard(c)` 工具函数。**已修复**：改为使用 `isPlagueZombieCard(c)`。

---

## 5. 灵魂转移（soul_transfer）

### 权威描述
"当本单位消灭3个区格以内的一个单位后，你可使用本单位替换被消灭的单位。"

### 原子步骤
1. [触发] 本单位消灭3格内的一个单位 → 触发 onKill + isInRange(victim, 3)
2. [请求] 发射 SOUL_TRANSFER_REQUESTED 事件 → custom(soul_transfer_request)
3. [交互] UI 显示确认/跳过按钮 → StatusBanners soulTransferMode
4. [确认] 玩家确认 → ACTIVATE_ABILITY(soul_transfer, targetPosition=victimPosition)
5. [移动] 弓箭手移动到被消灭位置 → UNIT_MOVED

### 八层链路检查

| 层级 | 状态 | 检查内容 |
|------|------|----------|
| 定义层 | ✅ | trigger=onKill, condition=isInRange(victim, 3), effect=custom(soul_transfer_request)。requiresTargetSelection=false（可选触发，UI 确认） |
| 注册层 | ✅ | customActionHandlers.ts 注册 soul_transfer_request → SOUL_TRANSFER_REQUESTED。executors/necromancer.ts 注册 soul_transfer executor |
| 执行层 | ✅ | soul_transfer executor 发射 UNIT_MOVED 事件。customValidator 验证目标位置为空 |
| 状态层 | ✅ | UNIT_MOVED 事件在 reduce.ts 中正确移动单位。SOUL_TRANSFER_REQUESTED 为 no-op（不修改状态） |
| 验证层 | ✅ | customValidator 检查 targetPosition 存在且为空 |
| UI层 | ✅ | StatusBanners 显示确认/跳过按钮（"可以/可选"效果有确认 UI ✅）。handleConfirmSoulTransfer 发送 ACTIVATE_ABILITY 命令，handleSkipSoulTransfer 清除模式 |
| i18n层 | ✅ | zh-CN 和 en 均有 soul_transfer 和 statusBanners.soulTransfer 条目 |
| 测试层 | ✅ | 正向测试验证移动到空格（含状态断言），负向测试验证位置被占据时拒绝。abilities-advanced.test.ts 验证 onKill 触发和范围限制 |

---

## 审计反模式检查清单

| # | 反模式 | 检查结果 |
|---|--------|----------|
| 1 | "可以/可选"效果自动执行 | ✅ infection 有 CardSelector+取消，soul_transfer 有确认/跳过 |
| 2 | 测试只断言事件发射 | ✅（已修复）soulless 和 blood_rage 测试已补充状态断言 |
| 3 | `as any` 绕过类型检查 | ⚠️ 测试中有 `(payload as any).skipMagicReward` 等，但这是测试代码中的类型断言，不影响运行时正确性 |
| 4 | 测试层标 ✅ 但只有事件断言 | ✅（已修复）同 #2 |
| 5 | 消费点绕过统一查询入口 | ✅（已修复）Board.tsx 感染过滤器已改用 isPlagueZombieCard |
| 8 | 限定条件全程约束 | ✅ blood_rage "在你的回合中" 通过 triggerAllUnitsAbilities(playerId) 约束；soul_transfer "3格内" 通过 isInRange condition 约束 |
| 9 | UI 层直接读底层字段 | ✅（已修复）同 #5 |

## 修复汇总

| # | 严重度 | 描述 | 修复 |
|---|--------|------|------|
| 1 | medium | soulless 测试缺少 reduce 后魔力状态断言 | 补充 `expect(newState.players['0'].magic).toBe(magicBefore)` |
| 2 | medium | blood_rage 测试缺少 reduce 后充能状态断言 | 补充 `expect(warrior!.boosts).toBeGreaterThan(0)` |
| 3 | medium | Board.tsx 感染卡牌过滤器未使用 isPlagueZombieCard | 改为 `isPlagueZombieCard(c)` 并添加 import |
