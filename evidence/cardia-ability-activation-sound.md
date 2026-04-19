# Cardia 激活能力音效添加

## 需求
用户要求："增加一个激活能力音效"

## 实现

### 音效选择
从音频注册表中选择了 **Mana Surge** 音效，这是一个奥术魔法能量涌动的音效，非常适合表现能力激活的瞬间。

**音效键名**：
```
magic.general.modern_magic_sound_fx_pack_vol.arcane_spells.arcane_spells_mana_surge_001
```

**文件路径**：
```
sfx/magic/general/Modern Magic Sound FX Pack Vol. 1/Arcane Spells/Arcane Spells Mana Surge 001.ogg
```

### 修改内容

#### 1. 更新事件定义 (src/games/cardia/domain/events.ts)
```typescript
// 从 fx（动画驱动）改为 immediate（即时反馈）
ABILITY_ACTIVATED: { 
    audio: 'immediate', 
    sound: 'magic.general.modern_magic_sound_fx_pack_vol.arcane_spells.arcane_spells_mana_surge_001' 
},
```

**变更说明**：
- **之前**：`audio: 'fx'` - 由 FX 系统负责播放（无音效）
- **现在**：`audio: 'immediate'` - 即时反馈音效，通过 EventStream 自动播放

#### 2. 更新预加载列表 (src/games/cardia/audio.config.ts)
```typescript
criticalSounds: Array.from(new Set([
    ...collectPreloadKeys(CARDIA_EVENTS),
    // ... 其他音效
    'magic.general.modern_magic_sound_fx_pack_vol.arcane_spells.arcane_spells_mana_surge_001',  // 激活能力
])),
```

## 工作原理

### 触发时机
当玩家激活卡牌能力时：
1. 游戏逻辑发射 `ABILITY_ACTIVATED` 事件
2. 音频系统检测到该事件
3. 自动播放 `arcane_spells_mana_surge_001` 音效

### 事件发射位置
`src/games/cardia/domain/execute.ts` 的 `executeActivateAbility` 函数：
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

## 验证

### 静态检查
- ✅ ESLint: 0 errors (3 warnings 为既有代码)
- ✅ i18n check: passed
- ✅ 音效键名在注册表中存在

### 预期行为
当玩家点击能力按钮激活能力时，会听到奥术能量涌动的音效 ✨

## 音效特点
- **类型**：奥术魔法（Arcane Spells）
- **效果**：能量涌动（Mana Surge）
- **风格**：现代魔法音效包
- **适用场景**：能力激活、魔法施放、技能触发

## 其他可选音效
如果需要更换音效，以下是其他合适的选项：

### 轻量级音效
- `magic.general.spells_variations_vol_1.little_arcane_blast_01_krst` - 小型奥术爆发
- `magic.general.spells_variations_vol_2.twinkle_tweak_01_krst_none` - 闪烁调整

### 中等强度音效
- `magic.general.modern_magic_sound_fx_pack_vol.arcane_spells.arcane_spells_aetherial_pulse_001` - 以太脉冲
- `magic.general.modern_magic_sound_fx_pack_vol.arcane_spells.arcane_spells_arcane_ripple_001` - 奥术涟漪

### 强力音效
- `magic.general.spells_variations_vol_1.arcane_blast_01_krst` - 奥术爆炸
- `magic.general.modern_magic_sound_fx_pack_vol.arcane_spells.arcane_spells_astral_flare_001` - 星界闪耀

## 修改文件
- `src/games/cardia/domain/events.ts` - 更新 ABILITY_ACTIVATED 事件定义
- `src/games/cardia/audio.config.ts` - 添加音效到预加载列表

## 技术债务
无

## 后续建议
在浏览器中测试实际音效播放，确认音效音量和时机合适。如需调整音量，可在预加载配置中添加音量参数。
