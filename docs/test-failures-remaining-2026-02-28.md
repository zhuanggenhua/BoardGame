# SmashUp 剩余测试失败总结 (2026-02-28)

## 修复进度

- ✅ 初始失败: 27 个测试
- ✅ 已修复: 14 个测试
- ❌ 剩余失败: **13 个测试**

## 剩余失败清单

### 1. Igor onDestroy 相关 (4个失败)

**根因**: Igor 双重触发 bug 已在 `reducer.ts` 中修复（line 1008），但测试仍然失败

**失败测试**:
1. `igor-big-gulp-two-igors.test.ts` - 一大口消灭一个 Igor → 只触发一次 onDestroy
2. `igor-double-trigger-bug.test.ts` - base_rlyeh 消灭 Igor 时触发两次（场景测试）
3. `igor-ondestroy-idempotency.test.ts` (2个):
   - D9: 重复调用 processDestroyTriggers 不会产生重复交互
   - D8: 验证 Igor onDestroy 只在 Phase 2（确认消灭）时触发

**状态**: 代码已修复，但测试可能需要更新或有其他问题

---

### 2. Wizard Archmage 相关 (2个失败)

**问题**: 从弃牌堆打出大法师后，大法师没有出现在基地上

**失败测试**:
1. `wizard-archmage-debug.test.ts` - 从弃牌堆打出大法师 - 详细追踪
2. `wizard-archmage-zombie-interaction.test.ts` - 使用"它们不断来临"从弃牌堆打出大法师应该获得额外行动

**错误信息**:
- `expect(archmageOnBase).toBeDefined()` 失败
- `archmageOnBase` 为 `undefined`

**可能原因**:
- 大法师的 onPlay 能力（获得额外行动）没有正确执行
- 从弃牌堆打出随从的逻辑有问题

---

### 3. 交互创建问题 (3个失败)

**问题**: 期望创建交互但实际 `interaction.current` 为 `undefined`

**失败测试**:
1. `ninja-hidden-ninja-interaction-bug.test.ts` - 便衣忍者打出后应该创建交互（即使手牌中只有 2 张随从）
2. `zombieInteractionChain.test.ts` - 行尸 onPlay 看到的牌库顶应是搜索后的牌库顶，而非行尸自己
3. `igor-two-igors-one-destroyed.test.ts` - vampire_big_gulp 消灭一个 Igor → 只触发一次 onDestroy

**共同特征**: 都是交互没有被正确创建

---

### 4. 数据完整性问题 (2个失败)

**4.1 bigGulpDroneIntercept.test.ts**
- 问题: 一大口自动解决消灭科学小怪时，雄蜂防止消灭交互的 playerId 错误
- 期望: `playerId` 为 `'0'`
- 实际: `playerId` 为 `'1'`

**4.2 interactionDefIdAudit.test.ts**
- 问题: 所有 createSimpleChoice 的卡牌选项必须包含 defId
- 有 2 个交互的选项缺少 `defId`/`minionDefId`/`baseDefId`

---

### 5. 多基地计分问题 (1个失败)

**失败测试**: `multi-base-afterscoring-bug.test.ts`
- 问题: 完整流程：3个基地依次计分，中间有 afterScoring 交互
- 期望: 3 个基地都触发 afterScoring
- 实际: 只有 1 个基地触发

---

### 6. 事件链问题 (1个失败)

**失败测试**: `interactionChainE2E.test.ts`
- 问题: alien_probe 2步链的 `sourceId` 为 undefined
- 测试: 选对手 → 选放顶/底 → 牌库顶放到底

**错误**: 交互的 `sourceId` 字段缺失

---

### 7. 触发时机问题 (1个失败)

**失败测试**: `newFactionAbilities.test.ts`
- 问题: 投机主义：对手随从被消灭后才给附着随从+1
- 期望: 有 POWER_COUNTER_ADDED 事件
- 实际: 事件为 undefined

**可能原因**: 触发时机或条件判断有问题

---

## 失败分类统计

| 类别 | 数量 | 测试文件 |
|------|------|----------|
| Igor onDestroy | 4 | igor-big-gulp-two-igors, igor-double-trigger-bug, igor-ondestroy-idempotency (2个) |
| Wizard Archmage | 2 | wizard-archmage-debug, wizard-archmage-zombie-interaction |
| 交互创建 | 3 | ninja-hidden-ninja-interaction-bug, zombieInteractionChain, igor-two-igors-one-destroyed |
| 数据完整性 | 2 | bigGulpDroneIntercept, interactionDefIdAudit |
| 多基地计分 | 1 | multi-base-afterscoring-bug |
| 事件链 | 1 | interactionChainE2E |
| 触发时机 | 1 | newFactionAbilities |

---

## 下一步行动

### 优先级1: 验证 Igor 修复
1. 运行 Igor 相关的 4 个测试，确认修复是否生效
2. 如果仍然失败，需要进一步调查

### 优先级2: 修复交互创建问题
1. 调查为什么交互没有被创建（3个测试）
2. 检查 `createSimpleChoice` 的调用链路

### 优先级3: 修复 Wizard Archmage
1. 调查从弃牌堆打出随从的逻辑
2. 检查大法师的 onPlay 能力实现

### 优先级4: 修复数据完整性和其他问题
1. 修复 playerId 错误
2. 补充缺失的 defId
3. 修复多基地计分链
4. 修复 alien_probe sourceId
5. 修复投机主义触发时机

---

## 总结

从 27 个失败减少到 13 个失败，已经修复了 **51.9%** 的测试。剩余的 13 个失败主要集中在：
- Igor onDestroy 相关（4个）- 代码已修复，需要验证
- 交互创建问题（3个）- 需要调查根因
- Wizard Archmage（2个）- 从弃牌堆打出逻辑
- 其他零散问题（4个）- 数据完整性、计分链、触发时机

**关键问题**: Igor 的修复已经完成，但测试仍然失败，需要确认是测试问题还是修复不完整。
