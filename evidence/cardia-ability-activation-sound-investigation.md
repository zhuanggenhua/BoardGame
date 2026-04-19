# Cardia - 能力激活音效实现总结

## 用户需求

用户希望在激活能力时听到音效。

## 实现方案

### 最终方案：即时音效

将 `ABILITY_ACTIVATED` 配置为即时音效（`audio: 'immediate'`），所有能力激活时播放统一的魔法音效。

### 音效选择

`magic.general.modern_magic_sound_fx_pack_vol.arcane_spells.arcane_spells_mana_surge_001`（奥术法术 - 法力涌动）

## 实现细节

### 1. 事件定义（events.ts）

```typescript
ABILITY_ACTIVATED: { 
    audio: 'immediate', 
    sound: 'magic.general.modern_magic_sound_fx_pack_vol.arcane_spells.arcane_spells_mana_surge_001' 
},
```

### 2. 音频配置（audio.config.ts）

- 添加音效到 `criticalSounds` 预加载列表
- `feedbackResolver` 使用 base resolver，自动返回事件定义中的 sound key

### 3. 事件发射（execute.ts）

所有能力激活都会发射 `ABILITY_ACTIVATED` 事件：

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

## 验证结果

- ✅ ESLint: 0 errors
- ✅ i18n check: passed
- ✅ 音效配置测试通过：`ABILITY_ACTIVATED 应该返回能力激活音效`
- ✅ 所有能力激活都会播放音效

## 修改文件

1. `src/games/cardia/domain/events.ts` - 定义 `ABILITY_ACTIVATED` 为 immediate 音效
2. `src/games/cardia/audio.config.ts` - 添加音效到预加载列表
3. `src/games/cardia/__tests__/audio-config.test.ts` - 更新测试期望

## 设计说明

### 为什么使用即时音效？

1. **统一体验**：所有能力激活都播放相同音效，提供一致的反馈
2. **即时反馈**：玩家点击激活能力后立即听到音效，确认操作成功
3. **简单实现**：不需要为每个能力单独配置音效
4. **符合游戏体量**：Cardia 是轻量级游戏，统一音效足够

### 与 DiceThrone 的区别

- **DiceThrone**：能力音效由 FX 系统处理，每个能力可以有不同音效
- **Cardia**：所有能力使用统一的激活音效，更简单直接

这个设计选择符合 Cardia 的游戏定位和复杂度。

## 相关证据文档

- `evidence/cardia-ability-activation-sound.md` - 初始实现记录
- `evidence/cardia-ability-activation-sound-fix.md` - 最终实现说明

