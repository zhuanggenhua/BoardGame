# DiceThrone 火法"焚灭"变体技能防御阶段不显示修复

## 问题描述

用户反馈：使用火法"焚灭"(Incinerate)变体技能攻击时，防御方在防御阶段看不到对方使用的技能卡牌展示。

## 问题根因

`useAttackShowcase.ts` 中的 `buildShowcaseData` 函数无法正确处理变体技能ID：

1. **变体ID无法映射到槽位**：`getAbilitySlotId('incinerate')` 返回 `null`，因为 `ABILITY_SLOT_MAP` 中只有基础ID `'fiery-combo'`，没有变体ID `'incinerate'`
2. **变体ID无法查找等级**：`abilityLevels` 中存储的是 `{ 'fiery-combo': 2 }`，而不是 `{ 'incinerate': 2 }`
3. **正则表达式无法提取基础ID**：`'incinerate'.replace(/-\d+(-\d+)?$/, '')` → `'incinerate'`（没变化），因为变体ID不是"基础ID-数字"格式

### 原有逻辑的假设

原有代码假设所有技能ID都是"基础ID-数字"格式（如 `fist-technique-5`、`fist-technique-2-3`），可以通过正则表达式提取基础ID。但变体技能使用独立的ID（如 `incinerate`），不符合这个格式。

## 修复方案

使用 `findPlayerAbility` 函数正确处理变体ID：

### 修改文件

**`src/games/dicethrone/hooks/useAttackShowcase.ts`**

1. **导入 `findPlayerAbility` 和 `DiceThroneCore` 类型**：
   ```typescript
   import { findPlayerAbility } from '../domain/abilityLookup';
   import type { DiceThroneCore } from '../domain/types';
   ```

2. **在 `AttackShowcaseConfig` 接口中添加 `state` 参数**：
   ```typescript
   interface AttackShowcaseConfig {
       // ... 其他字段
       /** 游戏状态（用于查找变体技能） */
       state: DiceThroneCore;
   }
   ```

3. **修改 `buildShowcaseData` 函数**：
   ```typescript
   function buildShowcaseData(
       pendingAttack: PendingAttack,
       selectedCharacters: Record<PlayerId, CharacterId>,
       abilityLevels: Record<string, Record<string, number>>,
       state: DiceThroneCore,  // 新增参数
   ): AttackShowcaseData | null {
       const sourceAbilityId = pendingAttack.sourceAbilityId;
       if (!sourceAbilityId) return null;

       const attackerCharId = selectedCharacters[pendingAttack.attackerId];
       if (!attackerCharId || attackerCharId === 'unselected') return null;

       // 使用 findPlayerAbility 查找技能（支持变体ID）
       const match = findPlayerAbility(state, pendingAttack.attackerId, sourceAbilityId);
       if (!match) return null;

       // 获取基础技能ID（用于查找槽位和等级）
       const baseAbilityId = match.ability.id;
       
       // 使用基础ID查找槽位
       const slotId = getAbilitySlotId(baseAbilityId);

       // 使用基础ID查找等级
       const attackerLevels = abilityLevels[pendingAttack.attackerId] ?? {};
       const level = attackerLevels[baseAbilityId] ?? 1;

       // 使用基础ID和等级查找升级卡
       const upgradePreviewRef = level > 1
           ? getUpgradeCardPreviewRef(attackerCharId, baseAbilityId, level)
           : undefined;

       return {
           attackerCharacterId: attackerCharId,
           sourceAbilityId,
           slotId,
           upgradePreviewRef,
           abilityLevel: level,
       };
   }
   ```

4. **更新 `useAttackShowcase` 函数调用**：
   ```typescript
   export function useAttackShowcase(config: AttackShowcaseConfig): AttackShowcaseState {
       const {
           // ... 其他字段
           state,  // 新增
       } = config;

       // ...

       const showcaseData = shouldShow && pendingAttack
           ? buildShowcaseData(pendingAttack, selectedCharacters, abilityLevels, state)
           : null;
   }
   ```

**`src/games/dicethrone/Board.tsx`**

在调用 `useAttackShowcase` 时传递 `state` 参数：

```typescript
const {
    isShowcaseVisible: isAttackShowcaseVisible,
    showcaseData: attackShowcaseData,
    dismissShowcase: dismissAttackShowcase,
} = useAttackShowcase({
    currentPhase,
    currentPlayerId: rootPid,
    isSpectator,
    selectedCharacters: G.selectedCharacters,
    abilityLevels: attackerAbilityLevels,
    pendingAttack: G.pendingAttack ?? null,
    state: G,  // 新增
});
```

## 修复效果

- ✅ 变体技能（如"焚灭"）现在可以正确显示在防御阶段
- ✅ 通过 `findPlayerAbility` 正确查找变体对应的基础技能
- ✅ 使用基础技能ID查找槽位、等级和升级卡
- ✅ 保持向后兼容，不影响非变体技能的展示

## 技术要点

1. **变体技能处理**：变体技能使用独立的ID（如 `incinerate`），不能通过正则表达式提取基础ID
2. **`findPlayerAbility` 函数**：引擎层提供的工具函数，支持查找变体技能并返回对应的基础技能
3. **数据流**：`pendingAttack.sourceAbilityId`（变体ID）→ `findPlayerAbility`（查找）→ `match.ability.id`（基础ID）→ 查找槽位/等级/升级卡

## 相关文件

- `src/games/dicethrone/hooks/useAttackShowcase.ts` - 修复变体ID处理逻辑
- `src/games/dicethrone/Board.tsx` - 传递 `state` 参数
- `src/games/dicethrone/domain/abilityLookup.ts` - 提供 `findPlayerAbility` 工具函数
- `src/games/dicethrone/heroes/pyromancer/abilities.ts` - 火法技能定义（包含"焚灭"变体）

## 测试建议

1. 使用火法，升级"炽焰连击"到2级
2. 满足"焚灭"触发条件（2火焰 + 2爆发）
3. 选择"焚灭"变体攻击对手
4. 确认防御方在防御阶段能看到"焚灭"的升级卡图片

## 日期

2026-03-04
