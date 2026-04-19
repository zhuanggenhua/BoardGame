# Cardia Card12 (Treasurer) 能力修复

## 问题描述

用户反馈：Cardia card12 (Treasurer) 技能没有生效。

## 问题根因

**时序问题**：Treasurer 能力在第N回合失败后的 ability 阶段激活，但此时 `previousEncounter` 已经被更新为第N回合的遭遇，而不是第N-1回合。

### 详细分析

1. **第5回合**：Player 0 的 card03 (Surgeon) vs Player 1 的 card02 (Void Mage)，Player 0 获胜
2. **第6回合**：Player 0 的 card12 (Treasurer) vs Player 1 的 card15 (Inventor)，Player 1 获胜
3. **遭遇解析**：`reduceEncounterResolved` 将 `previousEncounter` 更新为第6回合
4. **Treasurer 激活**：在 ability 阶段读取 `previousEncounter`，得到的是第6回合（自己所在的遭遇），而不是第5回合

### 代码问题

```typescript
// 错误的实现
const previousEncounter = ctx.core.previousEncounter;  // 这是第6回合！
```

`previousEncounter` 字段在遭遇解析时被更新：

```typescript
// reduce.ts - reduceEncounterResolved
let newCore = {
    ...core,
    previousEncounter: core.currentEncounter,  // ← 更新为当前遭遇
    currentEncounter: encounter,
    // ...
};
```

## 修复方案

改为读取 `encounterHistory` 的倒数第二个元素：

```typescript
// 修复后的实现
const encounterHistory = ctx.core.encounterHistory;
const previousEncounter = encounterHistory.length >= 2 
    ? encounterHistory[encounterHistory.length - 2]  // 倒数第二个遭遇
    : null;
```

### 修复逻辑

- **第N回合激活 Treasurer**：
  - `encounterHistory` 包含 N 个遭遇：`[encounter1, encounter2, ..., encounterN]`
  - `encounterHistory[length-2]` = `encounterHistory[N-2]` = 第N-1回合的遭遇 ✅
  - `previousEncounter` = 第N回合的遭遇 ❌

- **第1回合激活 Treasurer**：
  - `encounterHistory.length` = 1
  - `encounterHistory.length >= 2` = false
  - 返回 `null`，不产生额外印戒 ✅

## 测试验证

创建了单元测试 `src/games/cardia/__tests__/treasurer-previous-encounter-fix.test.ts`：

1. **测试1**：验证从 `encounterHistory` 读取倒数第二个遭遇
   - 构造第5回合和第6回合的遭遇历史
   - 验证 `encounterHistory[length-2]` 返回第5回合的遭遇
   - 验证 `previousEncounter` 是第6回合（错误的）

2. **测试2**：验证第1回合时返回 `null`
   - 构造只有第1回合的遭遇历史
   - 验证 `encounterHistory[length-2]` 返回 `null`

测试结果：
```
✓ src/games/cardia/__tests__/treasurer-previous-encounter-fix.test.ts (2 tests) 1ms
  ✓ Treasurer - Previous Encounter Fix (2)
    ✓ 应该从 encounterHistory 读取倒数第二个遭遇，而不是 previousEncounter 1ms
    ✓ 第1回合时，encounterHistory 只有1个元素，应该返回 null 0ms
```

## 修改文件

- `src/games/cardia/domain/abilities/group3-ongoing.ts` - 修复 Treasurer 能力实现
- `src/games/cardia/__tests__/treasurer-previous-encounter-fix.test.ts` - 新增单元测试

## 影响范围

- **Treasurer 能力**：现在能正确给上一个遭遇的获胜卡牌额外印戒
- **其他能力**：无影响（只修改了 Treasurer 的实现）

## 后续建议

考虑重命名 `previousEncounter` 字段为 `lastEncounter` 或 `currentEncounterSnapshot`，以避免语义混淆。当前命名容易让人误以为它指的是"上一个遭遇"，但实际上它在 ability 阶段已经是"当前遭遇"了。
