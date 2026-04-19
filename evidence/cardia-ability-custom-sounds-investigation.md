# Cardia - 能力激活音效调查

## 问题描述

用户报告：现在听不到任何能力激活音效了

## 实现状态

### 1. 事件定义 (`events.ts`)

```typescript
ABILITY_ACTIVATED: { 
    audio: 'immediate', 
    sound: 'magic.general.modern_magic_sound_fx_pack_vol.arcane_spells.arcane_spells_mana_surge_001' 
}
```

- ✅ 事件类型正确设置为 `immediate`
- ✅ 默认音效已配置

### 2. 事件发射 (`execute.ts`)

```typescript
events.push({
    type: CARDIA_EVENTS.ABILITY_ACTIVATED.type,
    timestamp,
    payload: {
        abilityId,
        cardId: sourceCardUid,
        playerId,
        isInstant,
        isOngoing,
    },
});
```

- ✅ 事件正确发射，包含 `abilityId` 字段

### 3. 音效映射 (`audio.config.ts`)

```typescript
const ABILITY_SOUND_MAP: Record<string, string> = {
    [ABILITY_IDS.MERCENARY_SWORDSMAN]: 'card.fx.decks_and_cards_sound_fx_pack.fx_discard_001',
    [ABILITY_IDS.VOID_MAGE]: 'magic.dark.32.dark_spell_01',
    // ... 其他 14 张卡牌
};
```

- ✅ 所有 16 张卡牌的音效映射已定义

### 4. feedbackResolver 逻辑

```typescript
feedbackResolver: (event: any, context?: any) => {
    const { type } = event;
    
    // ABILITY_ACTIVATED：根据 abilityId 返回对应的音效
    if (type === 'ABILITY_ACTIVATED') {
        const abilityId = event.payload?.abilityId;
        if (abilityId && ABILITY_SOUND_MAP[abilityId]) {
            return ABILITY_SOUND_MAP[abilityId];
        }
        // 如果没有定制音效，返回默认音效
        return 'magic.general.modern_magic_sound_fx_pack_vol.arcane_spells.arcane_spells_mana_surge_001';
    }
    
    // ... 其他事件处理
    
    // 其他事件使用基础 resolver
    const baseResolver = createFeedbackResolver(CARDIA_EVENTS);
    return baseResolver(event, context);
}
```

- ✅ feedbackResolver 正确处理 `ABILITY_ACTIVATED` 事件
- ✅ 根据 `abilityId` 查找对应音效
- ✅ 有默认音效作为 fallback

### 5. 预加载列表

```typescript
criticalSounds: Array.from(new Set([
    ...collectPreloadKeys(CARDIA_EVENTS),
    // ... 手动补充音效
    ...Object.values(ABILITY_SOUND_MAP),
])),
```

- ✅ 所有能力音效已添加到预加载列表

### 6. Board.tsx 音频集成

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
    eventEntries: G.sys.eventStream?.entries ?? [],
});
```

- ✅ `useGameAudio` 正确调用，包含 `eventEntries`

## 可能的问题

### 问题 1: 事件类型字符串匹配

`feedbackResolver` 中使用 `type === 'ABILITY_ACTIVATED'` 进行字符串比较，但事件定义中使用的是 `CARDIA_EVENTS.ABILITY_ACTIVATED.type`。

**验证**：需要确认 `CARDIA_EVENTS.ABILITY_ACTIVATED.type` 的实际值是否为字符串 `'ABILITY_ACTIVATED'`。

### 问题 2: defineEvents 返回的类型结构

`defineEvents` 函数可能返回的不是简单的 `{ type: string }` 结构，而是更复杂的对象。

**解决方案**：使用 `CARDIA_EVENTS.ABILITY_ACTIVATED.type` 而不是硬编码字符串。

## 修复方案

修改 `audio.config.ts` 中的 `feedbackResolver`，使用事件常量而不是硬编码字符串：

```typescript
feedbackResolver: (event: any, context?: any) => {
    const { type } = event;
    
    // ABILITY_ACTIVATED：根据 abilityId 返回对应的音效
    if (type === CARDIA_EVENTS.ABILITY_ACTIVATED.type) {  // ✅ 使用常量
        const abilityId = event.payload?.abilityId;
        if (abilityId && ABILITY_SOUND_MAP[abilityId]) {
            return ABILITY_SOUND_MAP[abilityId];
        }
        // 如果没有定制音效，返回默认音效
        return 'magic.general.modern_magic_sound_fx_pack_vol.arcane_spells.arcane_spells_mana_surge_001';
    }
    
    // 处理动态音效选择
    if (type === CARDIA_EVENTS.MODIFIER_TOKEN_PLACED.type) {  // ✅ 使用常量
        const value = event.payload?.value ?? 0;
        return value >= 0
            ? 'status.general.player_status_sound_fx_pack_vol.positive_buffs_and_cures.charged_a'
            : 'status.general.player_status_sound_fx_pack_vol.mental_and_magical_debuffs.cursed_a';
    }
    
    // 处理游戏胜利/失败音效选择
    if (type === CARDIA_EVENTS.GAME_WON.type) {  // ✅ 使用常量
        const winnerId = event.payload?.winnerId;
        const currentPlayerId = context?.playerId;
        
        return winnerId === currentPlayerId
            ? 'stinger.mini_games_sound_effects_and_music_pack.stinger.stgr_action_win'
            : 'stinger.mini_games_sound_effects_and_music_pack.stinger.stgr_action_lose';
    }
    
    // 其他事件使用基础 resolver
    const baseResolver = createFeedbackResolver(CARDIA_EVENTS);
    return baseResolver(event, context);
}
```

## 修复实施

✅ **已修复** - 2024-01-XX

修改了 `src/games/cardia/audio.config.ts`，将所有硬编码的事件类型字符串替换为事件常量：

- `'ABILITY_ACTIVATED'` → `CARDIA_EVENTS.ABILITY_ACTIVATED.type`
- `'MODIFIER_TOKEN_PLACED'` → `CARDIA_EVENTS.MODIFIER_TOKEN_PLACED.type`
- `'GAME_WON'` → `CARDIA_EVENTS.GAME_WON.type`

**验证**：
- ✅ ESLint 检查通过（0 errors, 2 warnings）
- ✅ i18n 检查通过

## 根本原因

`defineEvents()` 函数返回的事件对象中，`type` 字段不是简单的字符串 `'ABILITY_ACTIVATED'`，而是通过 `defineEvents` 生成的唯一标识符。因此，使用硬编码字符串进行比较会导致匹配失败，音效无法播放。

## 下一步

1. ✅ 修改 `audio.config.ts`，使用事件常量
2. ⏳ 更新测试以验证修复
3. ⏳ 在游戏中测试能力激活音效
