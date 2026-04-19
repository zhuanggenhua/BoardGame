# Cardia - 能力激活音效最终实现

## 用户需求

用户希望在激活能力时听到音效。

## 实现方案

### 1. 事件定义（events.ts）

将 `ABILITY_ACTIVATED` 定义为即时音效：

```typescript
ABILITY_ACTIVATED: { 
    audio: 'immediate', 
    sound: 'magic.general.modern_magic_sound_fx_pack_vol.arcane_spells.arcane_spells_mana_surge_001' 
},
```

### 2. 音频配置（audio.config.ts）

- 添加音效到预加载列表
- feedbackResolver 使用 base resolver，自动返回事件定义中的 sound key

### 3. 音效选择

选择了 `arcane_spells_mana_surge_001`（奥术法术 - 法力涌动），符合魔法城市主题。

## 技术细节

### 事件发射

所有能力激活都会在 `executeActivateAbility` 函数中发射 `ABILITY_ACTIVATED` 事件（execute.ts:416）：

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

### 音效播放

音效通过 EventStream 系统自动播放：

1. `ABILITY_ACTIVATED` 事件进入 EventStream
2. `useGameAudio` hook 监听 EventStream
3. `feedbackResolver` 返回音效 key
4. AudioManager 播放音效

## 验证结果

- ✅ ESLint: 0 errors
- ✅ i18n check: passed
- ✅ 音效配置测试通过：`ABILITY_ACTIVATED 应该返回能力激活音效`

## 修改文件

- `src/games/cardia/domain/events.ts` - 定义 `ABILITY_ACTIVATED` 为 immediate 音效
- `src/games/cardia/audio.config.ts` - 添加音效到预加载列表
- `src/games/cardia/__tests__/audio-config.test.ts` - 更新测试期望

## 设计说明

### 为什么使用即时音效？

1. **统一体验**：所有能力激活都播放相同音效，提供一致的反馈
2. **即时反馈**：玩家点击激活能力后立即听到音效，确认操作成功
3. **简单实现**：不需要为每个能力单独配置音效

### 与 DiceThrone 的区别

- **DiceThrone**：能力音效由 FX 系统处理，每个能力可以有不同音效
- **Cardia**：所有能力使用统一的激活音效，更简单直接

这个设计选择符合 Cardia 的游戏体量和复杂度。

