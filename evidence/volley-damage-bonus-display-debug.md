# Volley 伤害加成显示调试

## 问题描述

用户反馈：Volley 卡牌使用后，右下角的 CardSpotlightOverlay 显示了卡牌和骰子，但**没有显示伤害加成文本**（如"2个弓面：伤害+2"）。

## 预期效果

CardSpotlightOverlay 应该显示：
1. 左侧：万箭齐发卡牌图片
2. 右侧：5 颗骰子（横向排列）
3. 骰子下方：**伤害加成文本**（"2个弓面：伤害+2"）

## 当前实现

### 1. Volley 发射汇总事件

```typescript
// src/games/dicethrone/domain/customActions/moon_elf.ts
events.push({
    type: 'BONUS_DIE_ROLLED',
    payload: { 
        value: diceValues[0],
        face: diceFaces[0], 
        playerId: attackerId, 
        targetPlayerId: opponentId, 
        effectKey: 'bonusDie.effect.volley.result',  // ← i18n key
        effectParams: { 
            bowCount,
            bonusDamage
        } 
    },
    timestamp: timestamp + 5,
});
```

### 2. useCardSpotlight 收集骰子数据

```typescript
// src/games/dicethrone/hooks/useCardSpotlight.ts
setCardSpotlightQueue(prev =>
    prev.map(item =>
        item.id === cardCandidate.id
            ? {
                ...item,
                bonusDice: [
                    ...(item.bonusDice || []),
                    {
                        value: bonusValue,
                        face: bonusFace,
                        timestamp: eventTimestamp,
                        effectKey: bonusEffectKey,  // ← 传递 effectKey
                        effectParams: bonusEffectParams,  // ← 传递 effectParams
                        characterId: resolvedCharacterId,
                    },
                ],
            }
            : item
    )
);
```

### 3. CardSpotlightOverlay 渲染骰子

```typescript
// src/games/dicethrone/ui/CardSpotlightOverlay.tsx
{hasBonusDice && (
    <div className="flex items-center gap-[1vw] relative z-[1]">
        {currentItem.bonusDice!.map((die, index) => (
            <BonusDieSpotlightContent
                key={`${die.timestamp}-${index}`}
                value={die.value}
                face={die.face}
                effectKey={die.effectKey}  // ← 传递 effectKey
                effectParams={die.effectParams}  // ← 传递 effectParams
                locale={locale}
                size="10vw"
                characterId={die.characterId}
            />
        ))}
    </div>
)}
```

### 4. BonusDieSpotlightContent 显示文本

```typescript
// src/games/dicethrone/ui/BonusDieSpotlightContent.tsx
const effectText = React.useMemo(() => {
    if (!effectKey) return null;
    const translated = t(effectKey, effectParams);
    return translated;
}, [t, effectKey, effectParams]);

// ...

{!isRolling && effectText && (
    <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        exit={{ opacity: 0 }}
        className="text-white text-[1.8vw] font-black italic tracking-wider whitespace-nowrap bg-black/60 px-[1.5vw] py-[0.4vw] rounded-full border border-white/20 shadow-lg"
        style={{
            textShadow: `0 0 1vw ${FACE_GLOW_COLORS[face]}`,
        }}
    >
        {effectText}
    </motion.div>
)}
```

### 5. i18n 翻译文本

```json
// public/locales/zh-CN/game-dicethrone.json
"bonusDie": {
  "effect": {
    "volley": "万箭齐发投掷：{{value}}",
    "volley.result": "{{bowCount}}个弓面：伤害+{{bonusDamage}}"
  }
}
```

## 可能的问题

### 问题 1：effectKey 路径不正确

**检查**：effectKey 是 `'bonusDie.effect.volley.result'`，i18n key 是 `'volley.result'`（在 `bonusDie.effect` 命名空间下）

**结论**：路径正确，`t('bonusDie.effect.volley.result')` 应该能找到翻译

### 问题 2：只有汇总事件有 effectKey

**检查**：Volley 发射了 6 个 BONUS_DIE_ROLLED 事件：
- 前 5 个：单颗骰子事件，effectKey = `'bonusDie.effect.volley'`，effectParams = `{ value, index }`
- 第 6 个：汇总事件，effectKey = `'bonusDie.effect.volley.result'`，effectParams = `{ bowCount, bonusDamage }`

**问题**：CardSpotlightOverlay 会为每个 BONUS_DIE_ROLLED 事件创建一个 BonusDieSpotlightContent，所以会显示 6 个骰子组件，但只有第 6 个有伤害加成文本。

**预期**：应该只显示 5 个骰子（前 5 个事件），然后在底部显示汇总文本（第 6 个事件）

### 问题 3：汇总事件被绑定到卡牌队列

**检查**：useCardSpotlight 会尝试将 BONUS_DIE_ROLLED 事件绑定到最近的 CARD_PLAYED 事件（时间差 ≤ 1500ms）

**问题**：所有 6 个 BONUS_DIE_ROLLED 事件都会被绑定到同一个 CardSpotlightItem，导致显示 6 个骰子组件

**根本原因**：汇总事件不应该显示为独立的骰子，应该显示为文本

## 解决方案

### 方案 1：汇总事件不显示骰子，只显示文本

修改 CardSpotlightOverlay，检测汇总事件（effectKey 包含 `.result`），只显示文本不显示骰子。

### 方案 2：汇总事件不绑定到卡牌队列

修改 useCardSpotlight，汇总事件不添加到 `bonusDice` 数组，而是添加到 `summaryText` 字段。

### 方案 3：BonusDieSpotlightContent 支持"仅文本"模式

添加一个 `textOnly` prop，当为 true 时只显示文本不显示骰子。

## 调试步骤

1. **添加日志**：在 BonusDieSpotlightContent 中添加日志，检查 effectKey 和 effectParams 是否正确传递
2. **检查翻译**：确认 `t('bonusDie.effect.volley.result', { bowCount: 2, bonusDamage: 2 })` 返回正确的文本
3. **检查渲染条件**：确认 `!isRolling && effectText` 条件是否满足
4. **检查 CSS**：确认文本元素是否被其他元素遮挡或隐藏

## 下一步

1. 运行游戏，使用 Volley 卡牌
2. 查看控制台日志，确认 effectKey 和 effectParams 是否正确
3. 根据日志结果选择合适的解决方案

## 修改文件

- `src/games/dicethrone/ui/BonusDieSpotlightContent.tsx`：添加调试日志

