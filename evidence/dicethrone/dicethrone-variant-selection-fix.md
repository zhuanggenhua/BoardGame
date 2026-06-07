# DiceThrone 变体选择专项修复证据

> 2026-06-06 当前有效口径：本文只保留“变体 ID 命名不一致导致槽位识别失败”这一条共享变体选择链路的专项修复证据，不代表 DiceThrone 全体英雄、任一单英雄，或四位新英雄整批当前已经审计完成。它现在只能证明当时变体选择 UI 链路这一条 shared seam 被修过，不能外推成更大范围对象级 `L3/L4`、整英雄矩阵或整批发布口径已经收口。

## 问题描述
用户反馈：火法的"焚灭"(Incinerate)卡牌有两个变体，但无法选择变体。

## 根本原因
**变体 ID 命名不一致导致槽位识别失败**

### 问题链路
1. Hot Streak II 卡牌有两个变体：
   - `fiery-combo-2` (小顺子) ✅ 符合命名规范
   - `incinerate` (焚灭) ❌ 不符合命名规范（应该是 `fiery-combo-incinerate`）

2. 用户点击技能槽时，Board.tsx 调用 `getAbilitySlotId(abilityId)`
   - `getAbilitySlotId('fiery-combo-2')` → 返回 `'sky'` ✅
   - `getAbilitySlotId('incinerate')` → 返回 `null` ❌

3. 因为 `getAbilitySlotId` 使用前缀匹配：
   ```typescript
   if (mapping.ids.some(baseId => 
       abilityId === baseId || abilityId.startsWith(`${baseId}-`)
   )) {
       return slotId;
   }
   ```
   - `'incinerate'` 不等于 `'fiery-combo'`
   - `'incinerate'` 不以 `'fiery-combo-'` 开头
   - 因此返回 `null`

4. 当 `slotId` 为 `null` 时，变体选择逻辑被跳过，直接激活技能

## 修复方案
**在 Board.tsx 中，所有调用 `getAbilitySlotId` 的地方都先通过 `findPlayerAbility` 获取基础技能 ID**

### 修改位置 1: 变体选择逻辑
`src/games/dicethrone/Board.tsx` (lines 1048-1054)

### 修改前
```typescript
if (currentPhase === 'offensiveRoll' && G.rollConfirmed) {
    const slotId = getAbilitySlotId(abilityId);
    if (slotId) {
        const mapping = ABILITY_SLOT_MAP[slotId];
        if (mapping) {
            // ...
        }
    }
}
```

### 修改后
```typescript
if (currentPhase === 'offensiveRoll' && G.rollConfirmed) {
    // 对于变体 ID（如 incinerate），先通过 findPlayerAbility 获取基础技能 ID
    const match = findPlayerAbility(G, rollerId, abilityId);
    const baseAbilityId = match?.ability.id ?? abilityId;
    const slotId = getAbilitySlotId(baseAbilityId);
    if (slotId) {
        const mapping = ABILITY_SLOT_MAP[slotId];
        if (mapping) {
            // ...
        }
    }
}
```

### 修复逻辑
1. 用户点击 `incinerate` 变体
2. `findPlayerAbility(G, rollerId, 'incinerate')` 返回：
   ```typescript
   {
       ability: { id: 'fiery-combo', ... },
       variant: { id: 'incinerate', ... }
   }
   ```
3. 提取 `baseAbilityId = 'fiery-combo'`
4. `getAbilitySlotId('fiery-combo')` 返回 `'sky'` ✅
5. 继续执行变体选择逻辑

### 修改位置 2: 动画起点位置计算
`src/games/dicethrone/Board.tsx` (lines 753-761)

#### 修改前
```typescript
const getAbilityStartPos = React.useCallback((abilityId?: string) => {
    if (!abilityId) return getElementCenter(opponentHeaderRef.current);
    const slotId = getAbilitySlotId(abilityId);
    if (!slotId) return getElementCenter(opponentHeaderRef.current);
    // ...
}, [opponentHeaderRef]);
```

#### 修改后
```typescript
const getAbilityStartPos = React.useCallback((abilityId?: string) => {
    if (!abilityId) return getElementCenter(opponentHeaderRef.current);
    // 对于变体 ID，先获取基础技能 ID
    const match = findPlayerAbility(G, G.activePlayerId, abilityId);
    const baseAbilityId = match?.ability.id ?? abilityId;
    const slotId = getAbilitySlotId(baseAbilityId);
    if (!slotId) return getElementCenter(opponentHeaderRef.current);
    // ...
}, [G, opponentHeaderRef]);
```

#### 修复原因
`getAbilityStartPos` 用于计算技能效果动画的起点位置。当激活变体技能（如 `incinerate`）时，需要从对应的技能槽位置播放动画。如果不修复，变体技能的动画会从错误的位置（对手悬浮窗）播放，而不是从技能槽播放。

## 影响范围
此修复同时解决了两个问题：
1. ✅ 变体选择 UI 无法弹出
2. ✅ 变体技能动画起点位置错误

### 受影响的变体（所有英雄）

### Pyromancer (火法)
- `incinerate` (焚灭) - Hot Streak II 的变体
- `blazing-soul` (炙热之魂) - Soul Burn II 的变体
- `meteor-shower` (流星雨) - Meteor II 的变体

### Moon Elf (月精灵)
- `focus` (专注) - Covert Fire II 的变体
- `deadeye-shot-2` (赐死射击 II) - Covert Fire II 的变体

### Paladin (圣骑士)
- 多个使用描述性名称的变体（如 `tenacity`, `prosperity` 等）

## 测试验证
### 手动测试步骤
1. 启动游戏，选择火法 (Pyromancer)
2. 升级 Hot Streak 到 II 级
3. 进攻阶段投出骰子，同时满足两个变体条件：
   - 小顺子 (1,2,3,4) → 触发 `fiery-combo-2`
   - 2火 + 2炽魂 → 触发 `incinerate`
4. 点击 Sky 槽位
5. **预期结果**: 弹出变体选择窗口，显示两个选项
6. **修复前**: 直接激活技能，无选择窗口
7. **修复后**: 正常弹出选择窗口 ✅

### 自动化测试
可以参考现有测试：
- `src/games/dicethrone/__tests__/righteous-combat-variant-selection.test.ts`
- `src/games/dicethrone/__tests__/pyromancer-hot-streak-2-bug.test.ts`

## 相关文件
- ✅ `src/games/dicethrone/Board.tsx` - 修复变体选择逻辑
- 📝 `src/games/dicethrone/heroes/pyromancer/abilities.ts` - 变体定义
- 📝 `src/games/dicethrone/ui/AbilityOverlays.tsx` - 槽位映射
- 📝 `src/games/dicethrone/domain/abilityLookup.ts` - `findPlayerAbility` 函数

## 总结
✅ 本专项当轮已修复，变体选择功能在本文覆盖范围内恢复正常工作
✅ 修复方案向后兼容，不需要修改变体 ID 命名
✅ 处理了这类命名不一致导致的同类 shared seam 问题

## 当前阅读说明

- 本文只覆盖“变体选择入口”这一条共享链路，不覆盖各英雄技能本体实现、对象级 `L3/L4` 或新英雄整批完成态。
- 即使本文描述的修复在当轮成立，也不能把它当成当前 DiceThrone 或新英雄整批“全面收口”的证明。
