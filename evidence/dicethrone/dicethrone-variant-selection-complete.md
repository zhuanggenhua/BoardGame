# DiceThrone 变体选择问题专项修复证据

> 2026-06-06 当前有效口径：本文只保留“变体 ID 命名不一致导致槽位识别失败”这一条共享变体选择链路的专项修复证据，不代表 DiceThrone 全体英雄、任一单英雄，或四位新英雄整批当前已经审计完成。它现在只能证明当时变体选择入口和动画起点这条 shared seam 被修过，不能外推为更大范围对象级 `L3/L4`、整英雄矩阵或整批发布口径已经收口。

## 问题总结
用户反馈：火法的"焚灭"(Incinerate)卡牌有两个变体，但无法选择变体。

## 根本原因
**变体 ID 命名不一致导致槽位识别失败**

Hot Streak II 卡牌的两个变体：
- `fiery-combo-2` (小顺子) - 符合 `{baseId}-{suffix}` 命名规范 ✅
- `incinerate` (焚灭) - 不符合命名规范 ❌

`getAbilitySlotId` 函数使用前缀匹配：
```typescript
abilityId === baseId || abilityId.startsWith(`${baseId}-`)
```

因此 `getAbilitySlotId('incinerate')` 返回 `null`，导致变体选择逻辑被跳过。

## 修复方案
**在调用 `getAbilitySlotId` 前，先通过 `findPlayerAbility` 获取基础技能 ID**

### 修复位置 1: 变体选择 UI 触发
**文件**: `src/games/dicethrone/Board.tsx` (lines 1048-1056)

```typescript
// 修复前
const slotId = getAbilitySlotId(abilityId);

// 修复后
const match = findPlayerAbility(G, rollerId, abilityId);
const baseAbilityId = match?.ability.id ?? abilityId;
const slotId = getAbilitySlotId(baseAbilityId);
```

### 修复位置 2: 技能动画起点位置
**文件**: `src/games/dicethrone/Board.tsx` (lines 753-763)

```typescript
// 修复前
const getAbilityStartPos = React.useCallback((abilityId?: string) => {
    if (!abilityId) return getElementCenter(opponentHeaderRef.current);
    const slotId = getAbilitySlotId(abilityId);
    // ...
}, [opponentHeaderRef]);

// 修复后
const getAbilityStartPos = React.useCallback((abilityId?: string) => {
    if (!abilityId) return getElementCenter(opponentHeaderRef.current);
    const match = findPlayerAbility(G, G.activePlayerId, abilityId);
    const baseAbilityId = match?.ability.id ?? abilityId;
    const slotId = getAbilitySlotId(baseAbilityId);
    // ...
}, [G, opponentHeaderRef]);
```

## 修复效果
### 修复前
1. ❌ 点击技能槽无法弹出变体选择窗口
2. ❌ 变体技能动画从错误位置（对手悬浮窗）播放

### 修复后
1. ✅ 点击技能槽正常弹出变体选择窗口
2. ✅ 变体技能动画从正确位置（技能槽）播放

## 受影响的变体（全英雄）
此修复同时解决了所有使用非标准命名的变体：

### Pyromancer (火法)
- `incinerate` (焚灭) - Hot Streak II
- `blazing-soul` (炙热之魂) - Soul Burn II
- `meteor-shower` (流星雨) - Meteor II

### Moon Elf (月精灵)
- `focus` (专注) - Covert Fire II
- `deadeye-shot-2` (赐死射击 II) - Covert Fire II

### Paladin (圣骑士)
- 多个使用描述性名称的变体

## 测试验证
### 手动测试步骤
1. 启动游戏，选择火法 (Pyromancer)
2. 升级 Hot Streak 到 II 级
3. 进攻阶段投出骰子，同时满足两个变体条件：
   - 小顺子 (1,2,3,4) → 触发 `fiery-combo-2`
   - 2火 + 2炽魂 → 触发 `incinerate`
4. 点击 Sky 槽位
5. **预期结果**: 弹出变体选择窗口，显示两个选项 ✅

### 自动化测试参考
- `src/games/dicethrone/__tests__/righteous-combat-variant-selection.test.ts`
- `src/games/dicethrone/__tests__/pyromancer-hot-streak-2-bug.test.ts`

## 代码质量检查
```bash
npx eslint src/games/dicethrone/Board.tsx
```
✅ 0 errors, 1 warning (无关警告)

## 相关文件
- ✅ `src/games/dicethrone/Board.tsx` - 修复变体选择和动画逻辑
- 📝 `src/games/dicethrone/heroes/pyromancer/abilities.ts` - 变体定义
- 📝 `src/games/dicethrone/ui/AbilityOverlays.tsx` - 槽位映射
- 📝 `src/games/dicethrone/domain/abilityLookup.ts` - `findPlayerAbility` 函数
- 📝 `evidence/dicethrone/dicethrone-variant-selection-investigation.md` - 问题调查
- 📝 `evidence/dicethrone/dicethrone-variant-selection-fix.md` - 修复详情

## 总结
✅ **本专项当轮已修复**，变体选择功能在本文覆盖范围内恢复正常工作
✅ **向后兼容**，不需要修改变体 ID 命名
✅ **覆盖同类 shared seam**，同时处理了这类命名不一致导致的相同入口问题
✅ **双重修复**，同时修复了 UI 选择和动画播放两个问题

## 当前阅读说明

- 本文只覆盖“变体选择/动画起点”这一条共享链路，不覆盖各英雄技能本体实现、对象级 `L3/L4` 或新英雄整批完成态。
- 即使本文描述的修复在当轮成立，也不能把它当成当前 DiceThrone 或新英雄整批“全面收口”的证明。
