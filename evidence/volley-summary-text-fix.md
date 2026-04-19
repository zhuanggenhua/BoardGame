# Volley 汇总文本显示修复

## 问题描述

用户反馈：Volley（万箭齐发）卡牌使用后，右下角的 CardSpotlightOverlay 显示了卡牌和 5 颗骰子，但**没有显示伤害加成文本**（如"2个弓面：伤害+2"）。

## 根本原因

### 数据流分析

1. **Volley 发射 6 个 BONUS_DIE_ROLLED 事件**：
   - 前 5 个：单颗骰子事件（`effectKey: 'bonusDie.effect.volley'`）
   - 第 6 个：汇总事件（`effectKey: 'bonusDie.effect.volley.result'`，包含 `bowCount` 和 `bonusDamage`）

2. **useCardSpotlight 将所有 6 个事件添加到 bonusDice 数组**：
   - 问题：汇总事件被当作第 6 个骰子显示
   - 结果：CardSpotlightOverlay 显示 6 个 BonusDieSpotlightContent 组件

3. **BonusDieSpotlightContent 显示骰子 + 文本**：
   - 前 5 个：显示骰子（无 effectText）
   - 第 6 个：显示骰子 + 文本（"2个弓面：伤害+2"）
   - 问题：第 6 个骰子不应该显示，只应该显示文本

## 解决方案

### 方案：分离骰子和汇总文本

修改数据结构和渲染逻辑，将汇总事件从 `bonusDice` 数组中分离出来，单独存储在 `summaryText` 字段。

### 实现步骤

#### 1. 修改 CardSpotlightItem 类型定义

```typescript
// src/games/dicethrone/ui/CardSpotlightOverlay.tsx
export interface CardSpotlightItem {
    // ... 现有字段
    bonusDice?: Array<{...}>;  // 只包含普通骰子事件
    summaryText?: {             // 新增：汇总文本
        effectKey: string;
        effectParams: Record<string, string | number>;
    };
}
```

#### 2. 修改 useCardSpotlight 逻辑

```typescript
// src/games/dicethrone/hooks/useCardSpotlight.ts
// 检测是否为汇总事件（effectKey 包含 .result）
const isSummaryEvent = bonusEffectKey?.includes('.result');

if (cardCandidate) {
    if (isSummaryEvent) {
        // 汇总事件：添加到 summaryText 字段
        setCardSpotlightQueue(prev =>
            prev.map(item =>
                item.id === cardCandidate.id
                    ? { ...item, summaryText: { effectKey, effectParams } }
                    : item
            )
        );
    } else {
        // 普通骰子事件：添加到 bonusDice 数组
        setCardSpotlightQueue(prev =>
            prev.map(item =>
                item.id === cardCandidate.id
                    ? { ...item, bonusDice: [...(item.bonusDice || []), die] }
                    : item
            )
        );
    }
}
```

#### 3. 修改 CardSpotlightOverlay 渲染

```typescript
// src/games/dicethrone/ui/CardSpotlightOverlay.tsx
{hasBonusDice && (
    <div className="flex flex-col items-center gap-[1vw]">
        {/* 骰子行 */}
        <div className="flex items-center gap-[1vw]">
            {currentItem.bonusDice!.map((die, index) => (
                <BonusDieSpotlightContent key={...} {...die} />
            ))}
        </div>
        
        {/* 汇总文本（如"2个弓面：伤害+2"） */}
        {currentItem.summaryText && (
            <SummaryText
                effectKey={currentItem.summaryText.effectKey}
                effectParams={currentItem.summaryText.effectParams}
            />
        )}
    </div>
)}
```

#### 4. 新增 SummaryText 组件

```typescript
// src/games/dicethrone/ui/CardSpotlightOverlay.tsx
const SummaryText: React.FC<{
    effectKey: string;
    effectParams: Record<string, string | number>;
}> = ({ effectKey, effectParams }) => {
    const { t } = useTranslation('game-dicethrone');
    const text = t(effectKey, effectParams);
    
    return (
        <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            className="text-white text-[1.8vw] font-black italic ..."
        >
            {text}
        </motion.div>
    );
};
```

## 修改文件

- `src/games/dicethrone/ui/CardSpotlightOverlay.tsx`：
  - 修改 `CardSpotlightItem` 类型定义，新增 `summaryText` 字段
  - 修改渲染逻辑，分离骰子和汇总文本
  - 新增 `SummaryText` 组件
- `src/games/dicethrone/hooks/useCardSpotlight.ts`：
  - 修改事件处理逻辑，检测汇总事件并分离存储
- `src/games/dicethrone/ui/BonusDieSpotlightContent.tsx`：
  - 移除调试日志

## 预期效果

使用 Volley 卡牌后，CardSpotlightOverlay 应该显示：

1. **左侧**：万箭齐发卡牌图片
2. **右侧上方**：5 颗骰子（横向排列）
3. **右侧下方**：汇总文本（"2个弓面：伤害+2"）

## 验证方法

1. 运行游戏，选择月精灵
2. 进入攻击阶段，打出 Volley 卡牌
3. 观察右下角的 CardSpotlightOverlay：
   - ✅ 应该显示 5 颗骰子（不是 6 颗）
   - ✅ 骰子下方应该显示汇总文本（"X个弓面：伤害+Y"）
   - ✅ ActionLog 应该显示伤害加成信息

## 相关问题

- **Volley 5 Dice Display**：已修复（发射 5 个独立事件 + 1 个汇总事件 + 1 个 settlement 事件）
- **Volley Damage Bonus**：已修复（汇总事件包含 `effectKey` 和 `effectParams`）
- **ActionLog Display**：已验证（i18n key 正确，feedbackResolver 正确）

## 下一步

运行游戏验证修复效果，确认：
1. CardSpotlightOverlay 显示 5 颗骰子 + 汇总文本
2. 汇总文本正确显示伤害加成（"2个弓面：伤害+2"）
3. ActionLog 正确记录伤害加成信息
