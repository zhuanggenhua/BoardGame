# SmashUp 测试修复进度 (2026-02-28)

## 修复进度总结

- ✅ 初始失败: 27 个测试
- ✅ 已修复: 15 个测试 (55.6%)
- ❌ 剩余失败: **12 个测试**

## 关键修复

### 1. Igor onDestroy 双重触发 Bug (已修复)

**根因**: `processDestroyTriggers` 函数在处理 `MINION_DESTROYED` 事件时，没有对输入事件数组进行去重，导致同一个 `minionUid` 被处理多次。

**修复方案**: 在 `processDestroyTriggers` 函数开头添加去重逻辑：

```typescript
// ✅ 去重：同一个 minionUid 只处理一次（防止重复触发 onDestroy）
const destroyEventsRaw = filteredEvents.filter(e => e.type === SU_EVENTS.MINION_DESTROYED) as MinionDestroyedEvent[];
const seenUids = new Set<string>();
const destroyEvents = destroyEventsRaw.filter(e => {
    const uid = e.payload.minionUid;
    if (seenUids.has(uid)) {
        console.log('[processDestroyTriggers] Skipping duplicate destroy event for:', uid);
        return false;
    }
    seenUids.add(uid);
    return true;
});
```

**修复文件**: `src/games/smashup/domain/reducer.ts` (line 580-592)

**验证**: `igor-big-gulp-two-igors.test.ts` 现在通过 ✅

---

## 剩余失败清单 (12个)

### 1. Igor onDestroy 相关 (3个失败)

虽然主要的双重触发 bug 已修复，但仍有 3 个 Igor 相关测试失败：

1. **igor-double-trigger-bug.test.ts** - 期望 1 个 Igor 交互，实际 0 个
   - 问题：测试直接调用 `processDestroyTriggers`，但 Igor onDestroy 在只有一个候选时会自动执行（不创建交互）
   - 需要：修改测试期望或添加更多候选随从

2. **igor-ondestroy-idempotency.test.ts** (2个测试)
   - D9: 重复调用 processDestroyTriggers 不会产生重复交互 - 期望 1 个交互，实际 0 个
   - D8: 验证 Igor onDestroy 只在 Phase 2（确认消灭）时触发 - 九命之屋交互期望 >0，实际 0
   - 问题：测试直接调用底层函数，绕过了正常的命令执行流程

3. **igor-two-igors-one-destroyed.test.ts** - vampire_big_gulp 交互未创建
   - 问题：需要调查为什么 vampire_big_gulp 的交互没有被创建

---

### 2. Wizard Archmage 相关 (2个失败)

**问题**: 从弃牌堆打出大法师后，大法师没有出现在基地上

**失败测试**:
1. `wizard-archmage-debug.test.ts` - 从弃牌堆打出大法师 - 详细追踪
2. `wizard-archmage-zombie-interaction.test.ts` - 使用"它们不断来临"从弃牌堆打出大法师应该获得额外行动

**错误信息**: `expect(archmageOnBase).toBeDefined()` 失败

---

### 3. 交互创建问题 (2个失败)

**问题**: 期望创建交互但实际 `interaction.current` 为 `undefined`

**失败测试**:
1. `ninja-hidden-ninja-interaction-bug.test.ts` - 便衣忍者打出后应该创建交互
2. `zombieInteractionChain.test.ts` - 行尸 onPlay 看到的牌库顶应是搜索后的牌库顶

---

### 4. 数据完整性问题 (2个失败)

**4.1 bigGulpDroneIntercept.test.ts**
- 问题: 一大口自动解决消灭科学小怪时，雄蜂防止消灭交互的 playerId 错误
- 期望: `playerId` 为 `'0'`
- 实际: `playerId` 为 `'1'`

**4.2 interactionDefIdAudit.test.ts**
- 问题: 所有 createSimpleChoice 的卡牌选项必须包含 defId
- 有 2 个交互的选项缺少 `defId`/`minionDefId`/`baseDefId`
- 位置: `cthulhu.ts:362` 和 `cthulhu.ts:639`

---

### 5. 多基地计分问题 (1个失败)

**失败测试**: `multi-base-afterscoring-bug.test.ts`
- 问题: 完整流程：3个基地依次计分，中间有 afterScoring 交互
- 期望: 3 个基地都触发 afterScoring
- 实际: 只有 0 个基地触发

---

### 6. 事件链问题 (1个失败)

**失败测试**: `interactionChainE2E.test.ts`
- 问题: alien_probe 2步链的 `sourceId` 为 undefined
- 测试: 选对手 → 选放顶/底 → 牌库顶放到底

---

### 7. 触发时机问题 (1个失败)

**失败测试**: `newFactionAbilities.test.ts`
- 问题: 投机主义：对手随从被消灭后才给附着随从+1
- 期望: 有 POWER_COUNTER_ADDED 事件
- 实际: 事件为 undefined

---

## 失败分类统计

| 类别 | 数量 | 测试文件 |
|------|------|----------|
| Igor onDestroy | 3 | igor-double-trigger-bug, igor-ondestroy-idempotency (2个), igor-two-igors-one-destroyed |
| Wizard Archmage | 2 | wizard-archmage-debug, wizard-archmage-zombie-interaction |
| 交互创建 | 2 | ninja-hidden-ninja-interaction-bug, zombieInteractionChain |
| 数据完整性 | 2 | bigGulpDroneIntercept, interactionDefIdAudit |
| 多基地计分 | 1 | multi-base-afterscoring-bug |
| 事件链 | 1 | interactionChainE2E |
| 触发时机 | 1 | newFactionAbilities |

---

## 下一步行动

### 优先级1: 修复 Igor 相关测试 (3个)
1. 修改测试期望以匹配实际行为（自动执行 vs 创建交互）
2. 或者修改测试场景以创建多个候选随从

### 优先级2: 修复交互创建问题 (2个)
1. 调查为什么交互没有被创建
2. 检查 `createSimpleChoice` 的调用链路

### 优先级3: 修复 Wizard Archmage (2个)
1. 调查从弃牌堆打出随从的逻辑
2. 检查大法师的 onPlay 能力实现

### 优先级4: 修复数据完整性和其他问题 (5个)
1. 修复 playerId 错误
2. 补充缺失的 defId
3. 修复多基地计分链
4. 修复 alien_probe sourceId
5. 修复投机主义触发时机

---

## 总结

从 27 个失败减少到 12 个失败，已经修复了 **55.6%** 的测试。最关键的 Igor onDestroy 双重触发 bug 已经修复，这是一个重大进展。剩余的 12 个失败主要是：
- Igor 相关测试需要调整期望（3个）
- 交互创建问题（2个）
- Wizard Archmage 从弃牌堆打出逻辑（2个）
- 其他零散问题（5个）

**关键成就**: Igor onDestroy 双重触发的根因已经找到并修复，这是一个影响多个测试的核心 bug。
