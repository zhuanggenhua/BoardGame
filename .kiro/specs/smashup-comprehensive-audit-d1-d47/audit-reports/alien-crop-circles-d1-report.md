# alien_crop_circles（麦田怪圈）D1 审计报告

**审计日期**: 2025-01-28  
**审计维度**: D1（实体筛选范围语义）、D5（交互语义完整性）、D37（交互选项动态刷新）  
**审计结论**: ✅ 通过

---

## 卡牌信息

**defId**: `alien_crop_circles`  
**中文名**: 麦田怪圈  
**英文名**: Crop Circles  
**类型**: 行动卡（Action）  
**派系**: 外星人（Aliens）  
**数量**: 1x

**Wiki 描述**:  
> "Choose a base. Return each minion on that base to its owner's hand."

**中文描述**:  
> "选择一个基地。将该基地上的每个随从返回其拥有者手牌。"

---

## 审计维度分析

### D1：实体筛选范围语义

**描述中的范围限定词**:
- **位置范围**: "一个基地"（a base）→ 单个基地选择，非全局
- **实体范围**: "该基地上的每个随从"（each minion on that base）→ 范围限定为所选基地
- **排除条件**: 隐含排除其他基地的随从

**代码实现验证**:

1. **能力触发阶段** (`src/games/smashup/abilities/aliens.ts:225-237`):
   ```typescript
   function alienCropCircles(ctx: AbilityContext): AbilityResult {
       const baseCandidates: { baseIndex: number; label: string }[] = [];
       for (let i = 0; i < ctx.state.bases.length; i++) {
           if (ctx.state.bases[i].minions.length > 0) {
               const baseDef = getBaseDef(ctx.state.bases[i].defId);
               baseCandidates.push({ baseIndex: i, label: `${baseDef?.name ?? `基地 ${i + 1}`} (${ctx.state.bases[i].minions.length} 个随从)` });
           }
       }
       if (baseCandidates.length === 0) return { events: [buildAbilityFeedback(ctx.playerId, 'feedback.no_valid_targets', ctx.now)] };
       return { events: [], matchState: queueInteraction(ctx.matchState, createSimpleChoice(
           `alien_crop_circles_${ctx.now}`, ctx.playerId, '选择一个基地，将随从返回手牌', buildBaseTargetOptions(baseCandidates, ctx.state), { sourceId: 'alien_crop_circles', targetType: 'base' }
       )) };
   }
   ```
   
   **验证结果**: ✅ 正确
   - 遍历所有基地 (`ctx.state.bases`)，筛选有随从的基地
   - 创建单选交互（`createSimpleChoice`），让玩家选择一个基地
   - 没有 `multi` 配置，确认为单选模式

2. **交互处理阶段** (`src/games/smashup/abilities/aliens.ts:468-477`):
   ```typescript
   registerInteractionHandler('alien_crop_circles', (state, playerId, value, _iData, _random, timestamp) => {
       const { baseIndex } = value as { baseIndex: number };
       const base = state.core.bases[baseIndex];
       if (!base) return undefined;

       // 直接返回该基地所有随从（强制效果："返回每个在这个基地上的随从"）
       const events = buildCropCirclesReturnEvents(state.core, baseIndex, base.minions.map(m => m.uid), timestamp, playerId);
       return { state, events };
   });
   ```
   
   **验证结果**: ✅ 正确
   - 只处理玩家选择的 `baseIndex`
   - 调用 `buildCropCirclesReturnEvents` 时只传入该基地的随从 UID 列表
   - 其他基地不受影响

3. **事件生成阶段** (`src/games/smashup/abilities/aliens.ts:340-365`):
   ```typescript
   function buildCropCirclesReturnEvents(
       core: SmashUpCore,
       baseIndex: number,
       selectedMinionUids: string[],
       timestamp: number,
       sourcePlayerId?: string
   ): MinionReturnedEvent[] {
       if (selectedMinionUids.length === 0) return [];
       const base = core.bases[baseIndex];
       if (!base) return [];
       const selectedSet = new Set(selectedMinionUids);
       return base.minions
           .filter(m => selectedSet.has(m.uid))
           .filter(m => {
               // 跳过受保护的对手随从
               if (sourcePlayerId && m.controller !== sourcePlayerId && isMinionProtected(core, m, baseIndex, sourcePlayerId, 'affect')) {
                   return false;
               }
               return true;
           })
           .map(m => ({
               type: SU_EVENTS.MINION_RETURNED,
               payload: {
                   minionUid: m.uid,
                   minionDefId: m.defId,
                   fromBaseIndex: baseIndex,
                   toPlayerId: m.owner,
                   reason: 'alien_crop_circles',
               },
               timestamp,
           } as MinionReturnedEvent));
   }
   ```
   
   **验证结果**: ✅ 正确
   - 只从 `core.bases[baseIndex]` 获取随从列表
   - 使用 `selectedSet` 过滤，确保只处理该基地的随从
   - 每个事件的 `fromBaseIndex` 都是所选基地的索引
   - 其他基地的随从不会被遍历或处理

**D1 审计结论**: ✅ **通过**
- 实现正确限定为单个基地
- 没有全局遍历所有基地的随从
- 范围限定与描述完全一致

---

### D5：交互语义完整性

**描述中的交互语义**:
- "选择一个基地"（Choose a base）→ 单选交互
- "返回每个随从"（Return each minion）→ 强制效果，返回所有随从，无需玩家逐个选择

**代码实现验证**:

1. **交互模式**:
   - 使用 `createSimpleChoice` 创建单选交互
   - 没有 `multi` 配置 → 单选模式 ✅
   - `targetType: 'base'` → 基地选择 ✅

2. **强制效果**:
   - 交互处理器直接返回该基地所有随从的 `MINION_RETURNED` 事件
   - 没有后续交互让玩家选择哪些随从返回 ✅
   - 符合"返回每个随从"的强制语义 ✅

**D5 审计结论**: ✅ **通过**
- 交互模式与描述语义一致（单选基地）
- 强制效果正确实现（自动返回所有随从）
- 没有不必要的多选交互

---

### D37：交互选项动态刷新

**框架层自动处理**:
- alien_crop_circles 的交互选项是基地列表（`baseIndex`）
- 框架层的 `refreshInteractionOptions` 会自动推断选项类型
- 基地选项不涉及动态刷新（基地在交互期间不会被移除）

**代码实现验证**:

1. **选项生成**:
   ```typescript
   const baseCandidates: { baseIndex: number; label: string }[] = [];
   for (let i = 0; i < ctx.state.bases.length; i++) {
       if (ctx.state.bases[i].minions.length > 0) {
           const baseDef = getBaseDef(ctx.state.bases[i].defId);
           baseCandidates.push({ baseIndex: i, label: `${baseDef?.name ?? `基地 ${i + 1}`} (${ctx.state.bases[i].minions.length} 个随从)` });
       }
   }
   ```
   
   **验证结果**: ✅ 正确
   - 只包含有随从的基地（`minions.length > 0`）
   - 空基地被自动过滤
   - 选项标签包含随从数量信息，便于玩家选择

2. **无需手动 optionsGenerator**:
   - 基地选项在交互创建时已正确过滤
   - 交互期间基地不会被移除，无需动态刷新
   - 框架层自动处理已足够 ✅

**D37 审计结论**: ✅ **通过**
- 选项生成逻辑正确（只包含有随从的基地）
- 无需手动 optionsGenerator
- 框架层自动处理已满足需求

---

## 现有测试覆盖

**已有测试文件**:
- `src/games/smashup/__tests__/alienAuditFixes.test.ts` (行 127-156)
- `src/games/smashup/__tests__/interactionChainE2E.test.ts` (行 1471-1504)
- `src/games/smashup/__tests__/promptE2E.test.ts` (行 371-403)
- `src/games/smashup/__tests__/promptResponseChain.test.ts` (行 230-235)
- `src/games/smashup/__tests__/factionAbilities.test.ts` (行 782-804)

**测试覆盖情况**:
- ✅ 选择基地后自动返回所有随从（强制效果）
- ✅ 多个有随从的基地时创建 Prompt
- ✅ 交互处理函数存在且为函数类型
- ✅ 循环选择流程（选基地 → 返回随从 → 完成）

**缺失测试**:
- ⚠️ 缺少明确验证"其他基地不受影响"的测试
- ⚠️ 缺少边界情况测试（只有一个基地有随从、没有基地有随从）

**建议**:
- 现有测试已覆盖核心功能
- 可补充边界情况测试，但非必需（实现已验证正确）

---

## 审计总结

### 通过项 ✅

1. **D1 实体筛选范围语义**: 实现正确限定为单个基地，没有全局遍历
2. **D5 交互语义完整性**: 单选基地 + 强制返回所有随从，符合描述
3. **D37 交互选项动态刷新**: 选项生成正确，框架层自动处理已足够

### 问题项 ❌

无

### 建议改进 💡

无（实现已正确）

---

## 审计方法论

本次审计采用以下方法：

1. **描述→实现全链路追踪**:
   - 提取描述中的范围限定词（"一个基地"、"该基地上的"）
   - 追踪代码中的筛选操作（`for` 循环、`.filter()`、`.map()`）
   - 验证每个筛选步骤的数据源和过滤条件

2. **三层验证**:
   - 能力触发阶段：验证交互创建逻辑
   - 交互处理阶段：验证选择处理逻辑
   - 事件生成阶段：验证事件生成范围

3. **边界情况分析**:
   - 多个基地有随从
   - 只有一个基地有随从
   - 没有基地有随从

4. **现有测试覆盖分析**:
   - 搜索所有相关测试文件
   - 评估测试覆盖范围
   - 识别缺失测试场景

---

## 参考文档

- `docs/ai-rules/testing-audit.md` - D1/D5/D37 维度定义
- `src/games/smashup/abilities/aliens.ts` - alien_crop_circles 实现
- `src/games/smashup/__tests__/fixtures/wikiSnapshots.ts` - Wiki 描述快照
