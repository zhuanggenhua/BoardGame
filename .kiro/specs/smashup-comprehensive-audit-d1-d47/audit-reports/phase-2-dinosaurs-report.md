# 恐龙（Dinosaurs）派系审计报告

## 审计概述

**审计日期**：2025-01-XX  
**审计范围**：恐龙派系代表性能力（4个）  
**审计维度**：D1（实体筛选范围）、D8（时序正确性）、D11/D12（额度对称性）、D14（回合清理）、D31（拦截路径完整性）、D33（跨派系一致性）  
**审计结果**：✅ 100% 通过（4/4）

---

## 审计能力清单

### 1. dino_survival_of_the_fittest（适者生存）

**审计维度**：D1 子项（实体筛选范围）、D33（跨派系一致性）

**能力描述**：
- Wiki：`"Destroy the lowest-power minion (you choose in case of a tie) on each base with a higher-power minion."`
- 中文：`"每个基地上，如果存在两个及以上随从且有力量差异，消灭一个最低力量的随从（平局时由当前玩家选择）"`

**审计结果**：✅ 通过

**D1 子项审计**：
- ✅ 筛选范围正确：代码遍历 `ctx.state.bases`（所有基地），而非单个基地
- ✅ 条件判断正确：检查 `base.minions.length < 2` 和 `hasHigher`（有力量差异）
- ✅ 平局处理正确：单个最低力量随从直接消灭，多个最低力量随从创建交互让玩家选择
- ✅ 链式交互正确：多个基地有平局时，通过 `continuationContext` 链式传递

**D33 审计**：
- ✅ 与 `dino_natural_selection`（物竞天择）实现路径一致：都使用 `getMinionPower` 计算力量，都使用 `destroyMinion` 事件
- ✅ 与其他派系的"消灭力量更低随从"能力（如 `ninja_assassination`）实现路径一致

**测试覆盖**：
1. ✅ 单基地单个最低力量随从自动消灭
2. ✅ 单基地多个最低力量随从（平局）创建交互
3. ✅ 多基地同时触发（验证全局扫描）
4. ✅ 基地无力量差异不触发消灭
5. ✅ 跨派系一致性（使用 `getMinionPower` 和 `destroyMinion`）

**测试文件**：`src/games/smashup/__tests__/audit-d1-d8-d33-dino-survival-of-the-fittest.test.ts`

---

### 2. dino_armor_stego_pod（装甲剑龙 POD版 Talent）

**审计维度**：D8（时序正确性 — 回合判断）

**能力描述**：
- Wiki：`"Ongoing: Has +2 power during other players' turns."`
- 中文：`"持续：在其他玩家的回合拥有+2力量"`

**POD版实现**：
- Talent 执行体为空操作（引擎层自动设置 `talentUsed=true`）
- +2 力量加成由 `ongoingModifiers` 系统中的 `dino_armor_stego` modifier 根据 `talentUsed` 判断
- 判断逻辑：`ctx.state.turnOrder[ctx.state.currentPlayerIndex] !== ctx.minion.controller`

**审计结果**：✅ 通过

**D8 审计**：
- ✅ 回合判断正确：使用 `currentPlayerIndex` 获取当前回合玩家，与随从控制者比较
- ✅ 不使用 `ctx.playerId`：避免了 `afterScoring` 回调中的常见错误（`ctx.playerId` 是触发玩家而非当前回合玩家）
- ✅ 持续效果正确：通过 `ongoingModifiers` 系统实现，每次力量查询时动态计算
- ✅ Talent 标记正确：`talentUsed` 在回合开始时重置，匹配"直到你下个回合开始"的持续时间

**测试覆盖**：
1. ✅ 己方回合无力量加成
2. ✅ 对手回合+2力量加成
3. ✅ Talent 未使用时无力量加成（即使在对手回合）
4. ✅ 多个剑龙各自独立计算
5. ✅ 原版 `dino_armor_stego` 永久被动无需 Talent

**测试文件**：`src/games/smashup/__tests__/audit-d8-dino-armor-stego.test.ts`

---

### 3. dino_rampage（狂暴）

**审计维度**：D11/D12（额度写入-消耗对称性）、D14（回合清理完整性）

**能力描述**：
- Wiki：`"Reduce the breakpoint of a base by the power of one of your minions on that base until the end of the turn."`
- 中文：`"将一个基地的爆破点降低等同于你在该基地的随从总力量（直到回合结束）"`

**实现方式**：
- 写入路径：`modifyBreakpoint(baseIndex, -myPower, 'dino_rampage', timestamp)` 发射 `BREAKPOINT_MODIFIED` 事件
- 消耗路径：reducer 中 `state.tempBreakpointModifiers[baseIndex] = delta`
- 清理路径：`TURN_CHANGED` 事件处理中 `state.tempBreakpointModifiers = {}`
- 查询路径：`getEffectiveBreakpoint` 中 `tempDelta = state.tempBreakpointModifiers?.[baseIndex] ?? 0`

**审计结果**：✅ 通过

**D11/D12 审计**：
- ✅ 写入路径正确：`modifyBreakpoint` 发射 `BREAKPOINT_MODIFIED` 事件，payload 包含 `baseIndex` 和 `delta`
- ✅ 消耗路径正确：reducer 中根据 `baseIndex` 写入 `tempBreakpointModifiers[baseIndex]`
- ✅ 查询路径正确：`getEffectiveBreakpoint` 中根据 `baseIndex` 读取 `tempBreakpointModifiers[baseIndex]`
- ✅ 对称性正确：写入和消耗都使用 `baseIndex` 作为键，不会混淆不同基地的修正

**D14 审计**：
- ✅ 回合清理正确：`TURN_CHANGED` 事件处理中清空 `tempBreakpointModifiers`
- ✅ 清理时机正确：在回合结束时清理，不会泄漏到下回合
- ✅ 清理完整性：清空整个对象，不会遗漏任何基地的修正

**测试覆盖**：
1. ✅ 单基地降低爆破点（验证写入和查询路径）
2. ✅ 回合结束清理（验证临时修正在回合结束时清零）
3. ✅ 多基地独立修正（验证不同基地的修正互不干扰）
4. ✅ 力量快照（验证修正值基于打出时的力量）
5. ✅ 边界条件（无己方随从时不降低爆破点）

**测试文件**：`src/games/smashup/__tests__/audit-d11-d12-d14-dino-rampage.test.ts`

---

### 4. dino_tooth_and_claw（全副武装）

**审计维度**：D31（效果拦截路径完整性）

**能力描述**：
- Wiki：`"Play on a minion. Ongoing: This minion is not affected by other players' cards."`
- Wiki：`"If an ability would affect this minion, destroy this card instead. That ability does not affect this minion."`
- 中文：`"打出到一个随从上。持续：此随从不受其他玩家卡牌影响。"`
- 中文：`"如果一个能力将会影响该随从，消灭本卡，那个能力将不会影响该随从。"`

**实现方式**：
- 保护检查：`registerProtection('dino_tooth_and_claw', 'affect', dinoToothAndClawChecker, { consumable: true })`
- 拦截器：`registerInterceptor('dino_tooth_and_claw', dinoToothAndClawInterceptor)`
- 拦截事件：`MINION_DESTROYED` / `MINION_RETURNED` / `CARD_TO_DECK_BOTTOM`
- 拦截逻辑：检查目标随从是否附着了 `tooth_and_claw`，如果是且来源是其他玩家，则自毁 `tooth_and_claw` 并阻止原事件

**审计结果**：✅ 通过

**D31 审计**：
- ✅ 拦截路径1（直接命令执行）：`execute()` 中产生的 `MINION_DESTROYED` 事件被 `filterProtectedEvents` 过滤
- ✅ 拦截路径2（交互解决）：交互 handler 返回的事件经过 `afterEvents` 处理，调用 `filterProtectedEvents`
- ✅ 拦截路径3（FlowHooks 后处理）：`postProcess` 中产生的事件经过 `filterProtectedEvents`
- ✅ 拦截路径4（触发链递归）：`processDestroyTriggers` 内部产生的事件经过 `filterProtectedEvents`
- ✅ 自毁逻辑正确：拦截器返回 `ONGOING_DETACHED` 事件，替换原事件
- ✅ 来源检查正确：只拦截其他玩家发起的影响（`ownerId !== target.controller`）

**测试覆盖**：
1. ✅ 拦截路径1（直接命令执行）— 拦截消灭事件
2. ✅ 拦截路径2（交互解决）— 拦截返回手牌事件
3. ✅ 不拦截己方操作 — 己方消灭自己的随从
4. ✅ POD版简单保护 — 只保护不自毁
5. ✅ 拦截路径完整性 — 多次拦截

**测试文件**：`src/games/smashup/__tests__/audit-d31-dino-tooth-and-claw.test.ts`

---

## 审计总结

### 通过率统计

- **总能力数**：4
- **通过能力数**：4
- **通过率**：100%

### 维度覆盖

| 维度 | 覆盖能力 | 结果 |
|------|---------|------|
| D1 子项（实体筛选范围） | dino_survival_of_the_fittest | ✅ 通过 |
| D8（时序正确性） | dino_armor_stego_pod | ✅ 通过 |
| D11/D12（额度对称性） | dino_rampage | ✅ 通过 |
| D14（回合清理） | dino_rampage | ✅ 通过 |
| D31（拦截路径完整性） | dino_tooth_and_claw | ✅ 通过 |
| D33（跨派系一致性） | dino_survival_of_the_fittest | ✅ 通过 |

### 发现的问题

**无**

### 最佳实践

1. **全局扫描正确实现**：`dino_survival_of_the_fittest` 正确遍历所有基地，而非单个基地
2. **回合判断正确实现**：`dino_armor_stego_pod` 使用 `currentPlayerIndex` 而非 `ctx.playerId`，避免了常见错误
3. **额度对称性正确实现**：`dino_rampage` 的写入、消耗、查询路径都使用 `baseIndex` 作为键，确保对称性
4. **回合清理完整实现**：`dino_rampage` 在回合结束时清空整个 `tempBreakpointModifiers` 对象
5. **拦截路径完整实现**：`dino_tooth_and_claw` 在所有事件产生路径上都正确拦截

### 与 Aliens 派系对比

| 维度 | Aliens 派系 | Dinosaurs 派系 |
|------|------------|---------------|
| 通过率 | 100% (7/7) | 100% (4/4) |
| D1 子项 | ✅ alien_collector | ✅ dino_survival_of_the_fittest |
| D8 时序 | ✅ alien_scout | ✅ dino_armor_stego_pod |
| D31 拦截 | ✅ alien_scout | ✅ dino_tooth_and_claw |
| D33 一致性 | - | ✅ dino_survival_of_the_fittest |

### 下一步行动

1. ✅ 恐龙派系审计完成
2. ⏭️ 继续审计海盗（Pirates）派系（任务 2.3）
3. ⏭️ 继续审计忍者（Ninjas）派系（任务 2.4）
4. ⏭️ 继续审计机器人（Robots）派系（任务 2.5）

---

## 附录：测试文件清单

1. `src/games/smashup/__tests__/audit-d1-d8-d33-dino-survival-of-the-fittest.test.ts`
2. `src/games/smashup/__tests__/audit-d8-dino-armor-stego.test.ts`
3. `src/games/smashup/__tests__/audit-d11-d12-d14-dino-rampage.test.ts`
4. `src/games/smashup/__tests__/audit-d31-dino-tooth-and-claw.test.ts`

---

**审计完成日期**：2025-01-XX  
**审计人员**：AI Assistant (Kiro)  
**审计方法**：GameTestRunner 行为测试 + 代码审查
