# 攻击修正伤害加成 UI 显示

## 问题描述

用户反馈：使用 Volley（万箭齐发）等攻击修正卡后，**右上角没有显示具体的伤害加成数值**（如"+2伤害"）。

## 用户澄清

- **位置**：右上角骰子区域上方（不是右下角的卡牌特写）
- **现有 UI**：`ActiveModifierBadge` 只显示"攻击修正 ×1"标签，不显示具体数值
- **期望 UI**：显示具体的伤害加成数值（如"+2伤害"）

## 解决方案

### 新增 AttackBonusDamageDisplay 组件

创建一个新的 UI 组件，显示当前攻击的伤害加成（`pendingAttack.bonusDamage`）。

#### 组件设计

```typescript
// src/games/dicethrone/ui/AttackBonusDamageDisplay.tsx
export const AttackBonusDamageDisplay: React.FC<{
    bonusDamage: number;
}> = ({ bonusDamage }) => {
    const { t } = useTranslation('game-dicethrone');

    if (bonusDamage <= 0) return null;

    return (
        <motion.div
            initial={{ opacity: 0, y: -8, scale: 0.9 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -8, scale: 0.9 }}
            className="pointer-events-auto"
        >
            <div className="flex items-center justify-center gap-[0.4vw] px-[0.8vw] py-[0.3vw] rounded-full bg-gradient-to-r from-red-900/90 to-orange-900/90 border border-red-500/50 shadow-[0_0_1vw_rgba(239,68,68,0.4)] backdrop-blur-sm">
                <Swords className="w-[0.9vw] h-[0.9vw] text-red-400" />
                <span className="text-red-200 text-[0.8vw] font-bold tracking-wide whitespace-nowrap">
                    {t('attackBonus.label', { damage: bonusDamage })}
                </span>
            </div>
        </motion.div>
    );
};
```

#### 视觉设计

- **颜色**：红色渐变（`from-red-900/90 to-orange-900/90`），与攻击主题一致
- **图标**：`Swords`（交叉剑），表示攻击伤害
- **文本**："+X 伤害"（中文）/ "+X Damage"（英文）
- **动画**：淡入 + 缩放，与 `ActiveModifierBadge` 一致
- **位置**：`absolute -top-[3.8vw]`，在 `ActiveModifierBadge` 上方

### 集成到 RightSidebar

#### 1. 修改 RightSidebar 组件

```typescript
// src/games/dicethrone/ui/RightSidebar.tsx
export const RightSidebar = ({
    // ... 现有 props
    bonusDamage,  // 新增：当前攻击的伤害加成
}: {
    // ... 现有类型
    bonusDamage?: number;  // 新增：从 pendingAttack.bonusDamage 读取
}) => {
    return (
        <div className="...">
            <div className="relative w-full flex flex-col items-center gap-[0.75vw]">
                {/* 攻击修正徽章 */}
                {activeModifiers && activeModifiers.length > 0 && (
                    <div className="absolute -top-[2.2vw] left-1/2 -translate-x-1/2 z-10">
                        <ActiveModifierBadge modifiers={activeModifiers} />
                    </div>
                )}
                {/* 伤害加成显示：在 ActiveModifierBadge 上方 */}
                {bonusDamage && bonusDamage > 0 && (
                    <div className="absolute -top-[3.8vw] left-1/2 -translate-x-1/2 z-10">
                        <AttackBonusDamageDisplay bonusDamage={bonusDamage} />
                    </div>
                )}
                {/* 骰子盘 */}
                <DiceTray ... />
            </div>
        </div>
    );
};
```

#### 2. 修改 Board.tsx

```typescript
// src/games/dicethrone/Board.tsx
<RightSidebar
    // ... 现有 props
    bonusDamage={G.pendingAttack?.bonusDamage}  // 新增：传递伤害加成
/>
```

### i18n 翻译

```json
// public/locales/zh-CN/game-dicethrone.json
{
  "attackBonus": {
    "label": "+{{damage}} 伤害"
  }
}

// public/locales/en/game-dicethrone.json
{
  "attackBonus": {
    "label": "+{{damage}} Damage"
  }
}
```

## 修改文件

- `src/games/dicethrone/ui/AttackBonusDamageDisplay.tsx`：新增组件
- `src/games/dicethrone/ui/RightSidebar.tsx`：
  - 导入 `AttackBonusDamageDisplay`
  - 新增 `bonusDamage` prop
  - 渲染 `AttackBonusDamageDisplay`
- `src/games/dicethrone/Board.tsx`：传递 `bonusDamage={G.pendingAttack?.bonusDamage}`
- `public/locales/zh-CN/game-dicethrone.json`：新增 `attackBonus.label` 翻译
- `public/locales/en/game-dicethrone.json`：新增 `attackBonus.label` 翻译

## 预期效果

使用 Volley 卡牌后，右上角骰子区域上方应该显示：

1. **最上方**："+2 伤害"（红色徽章，Swords 图标）← **新增**
2. **中间**："攻击修正 ×1"（琥珀色徽章，Zap 图标）← **已有**
3. **下方**：骰子盘

## 数据流

1. **Volley 修改 pendingAttack.bonusDamage**：
   ```typescript
   // src/games/dicethrone/domain/customActions/moon_elf.ts
   if (bowCount > 0 && state.pendingAttack && state.pendingAttack.attackerId === attackerId) {
       state.pendingAttack.bonusDamage = (state.pendingAttack.bonusDamage ?? 0) + bowCount;
   }
   ```

2. **Board.tsx 读取 pendingAttack.bonusDamage**：
   ```typescript
   <RightSidebar bonusDamage={G.pendingAttack?.bonusDamage} />
   ```

3. **RightSidebar 传递给 AttackBonusDamageDisplay**：
   ```typescript
   {bonusDamage && bonusDamage > 0 && (
       <AttackBonusDamageDisplay bonusDamage={bonusDamage} />
   )}
   ```

4. **AttackBonusDamageDisplay 显示**：
   ```typescript
   {t('attackBonus.label', { damage: bonusDamage })}  // "+2 伤害"
   ```

## 验证方法

1. 运行游戏，选择月精灵
2. 进入攻击阶段，打出 Volley 卡牌
3. 观察右上角骰子区域上方：
   - ✅ 应该显示"+2 伤害"（红色徽章）
   - ✅ 下方显示"攻击修正 ×1"（琥珀色徽章）
   - ✅ 伤害加成数值应该与 Volley 投出的弓面数量一致

## 相关问题

- **Volley 5 Dice Display**：已修复（发射 5 个独立事件 + 1 个汇总事件 + 1 个 settlement 事件）
- **Volley Summary Text**：已修复（汇总事件分离到 `summaryText` 字段，显示在骰子下方）
- **ActionLog Display**：已验证（i18n key 正确，feedbackResolver 正确）

## 下一步

运行游戏验证修复效果，确认：
1. 右上角显示"+2 伤害"徽章
2. 伤害加成数值正确（与弓面数量一致）
3. 徽章位置正确（在"攻击修正 ×1"上方）
4. 动画效果流畅（淡入 + 缩放）
