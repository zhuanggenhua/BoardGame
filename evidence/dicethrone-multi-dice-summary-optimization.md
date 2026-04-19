# 王权骰铸：多骰子卡牌显示优化

## 问题描述

用户反馈：打出多骰子卡牌（如万箭齐发、大吉大利、再来一次）时，每个骰子下方都显示相同的效果描述，导致界面拥挤且信息冗余。

**期望行为**：
- 统一效果的卡牌（所有骰子效果相同）：只显示汇总效果，不显示单个骰子描述
- 不同效果的卡牌（每个骰子效果不同）：保持显示单个骰子描述

## 解决方案

### 核心思路

通过控制 `BONUS_DIE_ROLLED` 事件的 `effectKey` 字段来控制是否显示描述：
- **单个骰子事件**：不设置 `effectKey`（只显示骰面图标，不显示描述文本）
- **汇总事件**：设置 `effectKey` 为 `.result` 后缀（显示汇总效果文本）

### 修改的卡牌

#### 1. 月精灵 - 万箭齐发 (Volley)
- **效果**：投掷5骰，每个弓面 +1 伤害
- **修改前**：5个骰子事件都有 `effectKey: 'bonusDie.effect.volley'`
- **修改后**：5个骰子事件无 `effectKey`，1个汇总事件有 `effectKey: 'bonusDie.effect.volley.result'`
- **汇总文本**：`{{bowCount}}个弓面：伤害+{{bonusDamage}}`

#### 2. 月精灵 - 爆裂箭 (Exploding Arrow)
- **效果**：投掷5骰，造成 3 + 2×弓 + 1×足 伤害
- **修改**：使用通用函数 `createMoonElfFiveDiceEvents`，逻辑同万箭齐发
- **汇总文本**：`{{bowCount}}弓 {{footCount}}足 {{moonCount}}月：3 + 2×{{bowCount}} + 1×{{footCount}} = {{damage}}伤害`

#### 3. 野蛮人 - 大吉大利 (Lucky Roll Heal)
- **效果**：投掷3骰，治疗 1 + 2×心面数
- **修改前**：3个骰子事件都有 `effectKey: 'bonusDie.effect.luckyRoll'`
- **修改后**：3个骰子事件无 `effectKey`，1个汇总事件有 `effectKey: 'bonusDie.effect.luckyRoll.result'`
- **汇总文本**：`{{heartCount}}个心面：治疗{{healAmount}}`

#### 4. 野蛮人 - 再来一次 (More Please)
- **效果**：投掷5骰，造成 1×剑面数 伤害
- **修改前**：5个骰子事件都有 `effectKey: 'bonusDie.effect.morePleaseRoll'`
- **修改后**：5个骰子事件无 `effectKey`，1个汇总事件有 `effectKey: 'bonusDie.effect.morePleaseRoll.result'`
- **汇总文本**：`{{swordCount}}个剑面：伤害+{{damage}}`

## 代码修改

### 1. 月精灵卡牌处理器 (`moon_elf.ts`)

```typescript
// 修改前：每个骰子都有 effectKey
events.push({
    type: 'BONUS_DIE_ROLLED',
    payload: { 
        value: diceValues[i], 
        face: diceFaces[i], 
        playerId: attackerId, 
        targetPlayerId: opponentId, 
        effectKey: 'bonusDie.effect.volley',  // ❌ 会显示描述
        effectParams: { value: diceValues[i], index: i } 
    },
    ...
});

// 修改后：单个骰子无 effectKey，只有汇总事件有
events.push({
    type: 'BONUS_DIE_ROLLED',
    payload: { 
        value: diceValues[i], 
        face: diceFaces[i], 
        playerId: attackerId, 
        targetPlayerId: opponentId, 
        // effectKey: undefined - ✅ 不显示描述，只显示骰面
        effectParams: { value: diceValues[i], index: i } 
    },
    ...
});

// 汇总事件（新增）
events.push({
    type: 'BONUS_DIE_ROLLED',
    payload: { 
        value: diceValues[0], 
        face: diceFaces[0], 
        playerId: attackerId, 
        targetPlayerId: opponentId, 
        effectKey: 'bonusDie.effect.volley.result',  // ✅ 显示汇总
        effectParams: { bowCount, bonusDamage } 
    },
    ...
});
```

### 2. 野蛮人卡牌处理器 (`barbarian.ts`)

同样的模式应用到 `handleLuckyRollHeal` 和 `handleMorePleaseRollDamage`。

### 3. i18n 翻译文件

**中文** (`public/locales/zh-CN/game-dicethrone.json`):
```json
{
  "bonusDie": {
    "effect": {
      "volley.result": "{{bowCount}}个弓面：伤害+{{bonusDamage}}",
      "luckyRoll.result": "{{heartCount}}个心面：治疗{{healAmount}}",
      "morePleaseRoll.result": "{{swordCount}}个剑面：伤害+{{damage}}"
    }
  }
}
```

**英文** (`public/locales/en/game-dicethrone.json`):
```json
{
  "bonusDie": {
    "effect": {
      "volley.result": "{{bowCount}} Bow: +{{bonusDamage}} Damage",
      "luckyRoll.result": "{{heartCount}} Heart: Heal {{healAmount}}",
      "morePleaseRoll.result": "{{swordCount}} Sword: +{{damage}} Damage"
    }
  }
}
```

## UI 渲染逻辑

`CardSpotlightOverlay.tsx` 和 `useCardSpotlight.ts` 已经支持汇总文本渲染：

1. **单个骰子事件**（无 `effectKey`）→ 添加到 `bonusDice` 数组 → 渲染骰面图标，不显示描述
2. **汇总事件**（有 `effectKey` 且包含 `.result`）→ 添加到 `summaryText` 字段 → 渲染汇总文本

```typescript
// useCardSpotlight.ts
const isSummaryEvent = bonusEffectKey?.includes('.result');

if (isSummaryEvent) {
    // 汇总事件：添加到 summaryText 字段
    nextCardSpotlightQueue[cardCandidateIndex] = {
        ...cardCandidate,
        summaryText: {
            effectKey: bonusEffectKey!,
            effectParams: bonusEffectParams!,
        },
    };
} else {
    // 普通骰子事件：添加到 bonusDice 数组
    nextCardSpotlightQueue[cardCandidateIndex] = {
        ...cardCandidate,
        bonusDice: [
            ...(cardCandidate.bonusDice || []),
            { value: bonusValue, face: bonusFace, ... },
        ],
    };
}
```

## 效果对比

### 修改前
```
[卡牌图片] [骰子1] [骰子2] [骰子3] [骰子4] [骰子5]
           弓面+1   弓面+1   弓面+1   弓面+1   弓面+1
```
- 问题：5个相同的描述文本，信息冗余

### 修改后
```
[卡牌图片] [骰子1] [骰子2] [骰子3] [骰子4] [骰子5]
           
           2个弓面：伤害+2
```
- 优点：只显示汇总效果，界面简洁

## 扩展性

这个方案可以轻松扩展到其他多骰子卡牌：

1. **统一效果**（如万箭齐发）：单个骰子事件不设置 `effectKey`，只在汇总事件中设置
2. **不同效果**（如看箭）：每个骰子事件设置不同的 `effectKey`（如 `watchOut.bow`、`watchOut.foot`），保持显示单个描述

## 测试建议

1. 打出万箭齐发，验证只显示汇总文本
2. 打出大吉大利，验证只显示汇总文本
3. 打出再来一次，验证只显示汇总文本
4. 打出爆裂箭，验证只显示汇总文本（5个骰子 + 汇总）
5. 打出看箭（不同效果），验证仍显示单个骰子描述
6. 打出月影袭人（条件效果），验证仍显示单个骰子描述

## 调试日志

为了排查爆裂箭只显示一个骰子的问题，在 `useCardSpotlight.ts` 中添加了详细日志：

### 日志位置

1. **汇总事件日志** (`bonus-summary-event`)：
   - 位置：`isSummaryEvent` 分支
   - 记录：cardId, effectKey, effectParams
   
2. **普通骰子事件日志** (`bonus-dice-event`)：
   - 位置：`else` 分支
   - 记录：cardId, diceIndex, value, face, effectKey, hasEffectKey
   
3. **绑定完成日志** (`bonus-bound-to-card`)：
   - 位置：`didUpdateCardSpotlightQueue = true` 后
   - 记录：eventType, cardCandidateIndex, isSummaryEvent, finalDiceCount

### 日志输出示例

```typescript
// 万箭齐发（5个骰子 + 1个汇总）
spotlightLogger.info('bonus-dice-event', {
    cardId: 'card-volley-12345',
    diceIndex: 0,
    value: 3,
    face: 'bow',
    effectKey: undefined,  // ✅ 无 effectKey，不显示描述
    hasEffectKey: false,
});
// ... 重复 4 次（diceIndex 1-4）

spotlightLogger.info('bonus-summary-event', {
    cardId: 'card-volley-12345',
    effectKey: 'bonusDie.effect.volley.result',
    effectParams: { bowCount: 2, bonusDamage: 2 },
});

spotlightLogger.info('bonus-bound-to-card', {
    eventType: 'BONUS_DIE_ROLLED',
    cardCandidateIndex: 0,
    isSummaryEvent: true,
    finalDiceCount: 5,  // ✅ 应该是 5 个骰子
});
```

### 排查步骤

1. 打开浏览器控制台，筛选 `DT_SPOTLIGHT` 日志
2. 打出爆裂箭，观察日志输出
3. 检查 `bonus-dice-event` 是否被调用 5 次（diceIndex 0-4）
4. 检查 `bonus-summary-event` 是否被调用 1 次
5. 检查 `bonus-bound-to-card` 的 `finalDiceCount` 是否为 5

### 可能的问题

1. **事件未发射**：`createMoonElfFiveDiceEvents` 没有发射 5 个事件
2. **事件被过滤**：`hasBonusDiceSettlement` 导致事件被跳过
3. **时间戳匹配失败**：`cardCandidateIndex` 为 -1，骰子未绑定到卡牌
4. **UI 渲染问题**：`CardSpotlightOverlay` 只渲染了第一个骰子

## 总结

通过控制事件的 `effectKey` 字段，实现了多骰子卡牌的显示优化：
- 统一效果卡牌：只显示汇总，界面简洁
- 不同效果卡牌：保持单个描述，信息完整
- 无需修改 UI 组件，只需调整事件发射逻辑
- 扩展性强，易于应用到其他卡牌
