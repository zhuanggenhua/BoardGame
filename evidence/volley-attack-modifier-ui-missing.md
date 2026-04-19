# Volley 攻击修正 UI 缺失

## 问题描述

用户反馈：Volley 卡牌使用后，**没有显示攻击修正的伤害加成数值**（如"+2伤害"）。

## 当前状态

### 已有的 UI 组件

1. **CardSpotlightOverlay**（右下角卡牌特写）
   - 显示：卡牌图片 + 骰子结果
   - 位置：屏幕右下角
   - 不显示：伤害加成数值

2. **ActiveModifierBadge**（攻击修正徽章）
   - 显示："攻击修正 ×1"标签
   - 位置：骰子区域上方
   - 不显示：具体的伤害加成数值

3. **BonusDieSpotlightContent**（骰子特写内容）
   - 显示：骰子 + 效果文本（如"2个弓面：伤害+2"）
   - 位置：CardSpotlightOverlay 右侧
   - **问题**：汇总事件被当作第 6 个骰子显示，文本可能不显示

### 缺失的 UI 组件

**攻击修正伤害显示 UI**：
- 功能：显示当前攻击的伤害加成（`pendingAttack.bonusDamage`）
- 位置：应该在攻击阶段显示，让玩家知道当前攻击的总伤害
- 参考：SummonerWars 有类似的 UI（显示战力 breakdown）

## 数据流

### 1. Volley 修改 pendingAttack.bonusDamage

```typescript
// src/games/dicethrone/domain/customActions/moon_elf.ts
if (bowCount > 0 && state.pendingAttack && state.pendingAttack.attackerId === attackerId) {
    state.pendingAttack.bonusDamage = (state.pendingAttack.bonusDamage ?? 0) + bowCount;
}
```

### 2. pendingAttack 数据结构

```typescript
export interface PendingAttack {
    attackerId: PlayerId;
    defenderId: PlayerId;
    sourceAbilityId?: string;
    baseDamage?: number;
    bonusDamage?: number;  // ← 伤害加成
    totalDamage?: number;
    isDefendable: boolean;
    // ...
}
```

### 3. 当前没有 UI 读取 pendingAttack.bonusDamage

搜索结果显示：
- ❌ CardSpotlightOverlay：不读取 pendingAttack
- ❌ ActiveModifierBadge：不读取 pendingAttack
- ❌ BonusDieSpotlightContent：不读取 pendingAttack
- ❌ AttackShowcaseOverlay：不读取 pendingAttack

## 解决方案

### 方案 1：在 CardSpotlightOverlay 中显示伤害加成

修改 CardSpotlightOverlay，添加一个显示伤害加成的区域：

```typescript
// src/games/dicethrone/ui/CardSpotlightOverlay.tsx
interface CardSpotlightItem {
    // ... 现有字段
    bonusDamage?: number;  // ← 新增：伤害加成
}

// 渲染
{currentItem.bonusDamage && currentItem.bonusDamage > 0 && (
    <div className="text-amber-400 text-[1.5vw] font-bold">
        +{currentItem.bonusDamage} 伤害
    </div>
)}
```

### 方案 2：创建独立的攻击修正 UI 组件

创建一个新组件 `AttackModifierDisplay`，显示当前攻击的伤害加成：

```typescript
// src/games/dicethrone/ui/AttackModifierDisplay.tsx
export const AttackModifierDisplay: React.FC<{
    bonusDamage: number;
}> = ({ bonusDamage }) => {
    if (bonusDamage <= 0) return null;
    
    return (
        <motion.div
            initial={{ opacity: 0, scale: 0.8 }}
            animate={{ opacity: 1, scale: 1 }}
            className="fixed bottom-[20vh] right-[20vw] bg-amber-900/90 border-2 border-amber-500 rounded-lg px-4 py-2"
        >
            <div className="text-amber-200 text-xl font-bold">
                攻击修正：+{bonusDamage} 伤害
            </div>
        </motion.div>
    );
};
```

### 方案 3：在 BonusDieSpotlightContent 中正确显示汇总文本

修复 BonusDieSpotlightContent，确保汇总事件的 effectText 正确显示：

1. 检查 effectKey 是否正确传递
2. 检查 i18n 翻译是否正确
3. 检查渲染条件是否满足（`!isRolling && effectText`）

## 推荐方案

**方案 3（修复现有组件）+ 方案 2（新增独立 UI）**：

1. **短期**：修复 BonusDieSpotlightContent，确保汇总文本显示
2. **长期**：创建 AttackModifierDisplay 组件，在攻击阶段持续显示伤害加成

## 下一步

1. 运行游戏，查看控制台日志（已添加调试日志到 BonusDieSpotlightContent）
2. 确认 effectKey 和 effectParams 是否正确传递
3. 确认翻译是否正确
4. 根据日志结果选择修复方案

