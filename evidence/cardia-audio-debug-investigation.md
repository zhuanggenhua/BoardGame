# Cardia 音效无声问题调试

## 问题描述

用户报告以下音效实际听不到：
1. 打出卡牌音效 (`CARD_PLAYED`)
2. 获得印戒音效 (`SIGNET_GRANTED`)
3. 游戏胜利音效 (`GAME_WON`)

## 已验证的配置

### 1. 事件定义正确 ✅

**文件**: `src/games/cardia/domain/events.ts`

```typescript
CARD_PLAYED: { 
    audio: 'immediate', 
    sound: 'card.handling.decks_and_cards_sound_fx_pack.card_place_001' 
},
SIGNET_GRANTED: { 
    audio: 'immediate', 
    sound: 'coins.decks_and_cards_sound_fx_pack.small_reward_001' 
},
GAME_WON: { 
    audio: 'immediate', 
    sound: 'stinger.mini_games_sound_effects_and_music_pack.stinger.stgr_action_win' 
},
```

### 2. 音效键在预加载列表中 ✅

**文件**: `src/games/cardia/audio.config.ts`

```typescript
criticalSounds: Array.from(new Set([
    ...collectPreloadKeys(CARDIA_EVENTS),  // 自动收集包含上述三个音效
    'card.handling.decks_and_cards_sound_fx_pack.card_place_001',
    'coins.decks_and_cards_sound_fx_pack.small_reward_001',
    'stinger.mini_games_sound_effects_and_music_pack.stinger.stgr_action_win',
])),
```

### 3. 事件被正确发射 ✅

**文件**: `src/games/cardia/domain/execute.ts`

```typescript
// CARD_PLAYED 事件发射
events.push({
    type: CARDIA_EVENTS.CARD_PLAYED.type,
    timestamp,
    payload: {
        cardUid: card.uid,
        playerId,
        slotIndex,
    },
});
```

**文件**: `src/games/cardia/domain/flowHooks.ts`

```typescript
// SIGNET_GRANTED 事件发射
events.push({
    type: CARDIA_EVENTS.SIGNET_GRANTED.type,
    timestamp,
    payload: {
        playerId,
        cardUid,
        newTotal,
    },
});
```

**文件**: `src/games/cardia/domain/execute.ts` 和 `domain/abilities/group6-special.ts`

```typescript
// GAME_WON 事件发射
events.push({
    type: CARDIA_EVENTS.GAME_WON.type,
    timestamp: Date.now(),
    payload: {
        winnerId,
        reason,
    },
});
```

### 4. Board.tsx 正确传递 eventEntries ✅

**文件**: `src/games/cardia/Board.tsx`

```typescript
useGameAudio({
    config: CARDIA_AUDIO_CONFIG,
    gameId: CARDIA_MANIFEST.id,
    G: core,
    ctx: {
        currentPlayer: core.currentPlayerId,
        phase: phase,
        gameover: isGameOver,
    },
    eventEntries: G.sys.eventStream?.entries ?? [],  // ✅ 正确传递
});
```

### 5. EventStreamSystem 正确存储事件 ✅

**文件**: `src/engine/systems/EventStreamSystem.ts`

事件被存储为 `{ id: number, event: GameEvent }` 结构，`resolveAudioEvent` 函数正确从 `entry.event` 中提取事件。

## 调试步骤

### 已添加调试日志

**文件**: `src/games/cardia/audio.config.ts`

在 `feedbackResolver` 中添加了临时调试日志：

```typescript
feedbackResolver: (event: any, context?: any) => {
    // 临时调试：记录关键事件
    if (event.type === 'CARD_PLAYED' || event.type === 'SIGNET_GRANTED' || event.type === 'GAME_WON') {
        console.log('[Cardia Audio Debug] feedbackResolver called:', {
            eventType: event.type,
            payload: event.payload,
            timestamp: event.timestamp,
        });
    }
    
    // ... 处理逻辑 ...
    
    // 临时调试：记录解析结果
    if (event.type === 'CARD_PLAYED' || event.type === 'SIGNET_GRANTED' || event.type === 'GAME_WON') {
        console.log('[Cardia Audio Debug] feedbackResolver result:', {
            eventType: event.type,
            resolvedKey,
        });
    }
    
    return resolvedKey;
},
```

### 用户需要执行的测试步骤

1. **打开浏览器开发者工具**
   - 按 F12 或右键 → 检查
   - 切换到 Console 标签页

2. **开始 Cardia 游戏**
   - 进入游戏对局

3. **执行触发音效的操作**
   - 打出一张卡牌 → 应该看到 `[Cardia Audio Debug] feedbackResolver called: { eventType: 'CARD_PLAYED', ... }`
   - 获得印戒 → 应该看到 `[Cardia Audio Debug] feedbackResolver called: { eventType: 'SIGNET_GRANTED', ... }`
   - 游戏结束 → 应该看到 `[Cardia Audio Debug] feedbackResolver called: { eventType: 'GAME_WON', ... }`

4. **检查日志输出**
   - 如果看到 `feedbackResolver called` 但没有 `feedbackResolver result`，说明 `baseResolver` 返回了 `null`
   - 如果看到 `feedbackResolver result` 且 `resolvedKey` 不为 `null`，说明音效键解析成功
   - 如果完全没有看到日志，说明事件没有被传递到 `feedbackResolver`

## 可能的问题原因

### 假设 1: 事件类型字符串不匹配

`CARDIA_EVENTS.CARD_PLAYED.type` 可能不等于字符串 `'CARD_PLAYED'`。

**验证方法**:
```typescript
console.log('CARD_PLAYED type:', CARDIA_EVENTS.CARD_PLAYED.type);
```

### 假设 2: createFeedbackResolver 返回 null

`createFeedbackResolver(CARDIA_EVENTS)` 可能没有正确构建音效映射表。

**验证方法**: 查看调试日志中的 `resolvedKey` 值

### 假设 3: 音效文件加载失败

音效键正确但文件加载失败。

**验证方法**: 
- 在 Console 中查找音频加载错误
- 检查 Network 标签页中的音频文件请求

### 假设 4: eventEntries 为空或格式错误

`G.sys.eventStream?.entries` 可能为空或格式不正确。

**验证方法**:
```typescript
console.log('EventStream entries:', G.sys.eventStream?.entries);
```

## 下一步行动

根据用户提供的浏览器控制台日志，我们可以确定：

1. **如果没有任何调试日志** → 事件没有到达 `feedbackResolver`，需要检查 `useGameAudio` 的事件消费逻辑
2. **如果有 `feedbackResolver called` 但 `resolvedKey` 为 `null`** → `createFeedbackResolver` 没有正确映射事件类型
3. **如果 `resolvedKey` 有值但没有声音** → 音效文件加载或播放问题

## 临时解决方案

如果调试确认是 `createFeedbackResolver` 的问题，可以临时硬编码音效映射：

```typescript
feedbackResolver: (event: any, context?: any) => {
    // 硬编码映射（临时）
    const soundMap: Record<string, string> = {
        'CARD_PLAYED': 'card.handling.decks_and_cards_sound_fx_pack.card_place_001',
        'SIGNET_GRANTED': 'coins.decks_and_cards_sound_fx_pack.small_reward_001',
        'GAME_WON': 'stinger.mini_games_sound_effects_and_music_pack.stinger.stgr_action_win',
    };
    
    if (soundMap[event.type]) {
        return soundMap[event.type];
    }
    
    // 其他事件使用基础 resolver
    const baseResolver = createFeedbackResolver(CARDIA_EVENTS);
    return baseResolver(event, context);
},
```

## 文件清单

### 修改的文件
1. `src/games/cardia/audio.config.ts` - 添加调试日志

### 证据文档
- `evidence/cardia-audio-debug-investigation.md` (本文档)
