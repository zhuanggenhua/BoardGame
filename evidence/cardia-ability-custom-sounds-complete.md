# Cardia - 能力激活音效定制完成

## 任务概述

为 Cardia Deck I 的 16 张卡牌（card01-16）的能力定制专属音效，替代统一的默认音效。

## 实现完成

### 1. 音效映射表 (`audio.config.ts`)

创建了 `ABILITY_SOUND_MAP` 常量，为每张卡牌的能力定制专属音效：

```typescript
const ABILITY_SOUND_MAP: Record<string, string> = {
    [ABILITY_IDS.MERCENARY_SWORDSMAN]: 'card.fx.decks_and_cards_sound_fx_pack.fx_discard_001',
    [ABILITY_IDS.VOID_MAGE]: 'magic.dark.32.dark_spell_01',
    [ABILITY_IDS.SURGEON]: 'status.general.player_status_sound_fx_pack_vol.mental_and_magical_debuffs.cursed_a',
    [ABILITY_IDS.MEDIATOR]: 'magic.general.modern_magic_sound_fx_pack_vol.arcane_spells.arcane_ripple_001',
    [ABILITY_IDS.SABOTEUR]: 'magic.general.modern_magic_sound_fx_pack_vol.offensive_spells.offensive_spells_shockwave_slam_001',
    [ABILITY_IDS.DIVINER]: 'magic.general.modern_magic_sound_fx_pack_vol.arcane_spells.glyphic_resonance_001',
    [ABILITY_IDS.COURT_GUARD]: 'magic.general.modern_magic_sound_fx_pack_vol.divine_magic.divine_magic_smite_001',
    [ABILITY_IDS.MAGISTRATE]: 'magic.general.modern_magic_sound_fx_pack_vol.divine_magic.divine_magic_hallowed_beam_001',
    [ABILITY_IDS.AMBUSHER]: 'magic.general.modern_magic_sound_fx_pack_vol.dark_magic.dark_magic_shadow_wail_001',
    [ABILITY_IDS.PUPPETEER]: 'magic.general.modern_magic_sound_fx_pack_vol.dark_magic.dark_magic_blight_curse_001',
    [ABILITY_IDS.CLOCKMAKER]: 'magic.general.modern_magic_sound_fx_pack_vol.arcane_spells.aetherial_pulse_001',
    [ABILITY_IDS.TREASURER]: 'coins.decks_and_cards_sound_fx_pack.small_reward_001',
    [ABILITY_IDS.SWAMP_GUARD]: 'magic.general.modern_magic_sound_fx_pack_vol.water_magic.water_magic_tidal_rush_001',
    [ABILITY_IDS.GOVERNESS]: 'magic.general.modern_magic_sound_fx_pack_vol.arcane_spells.astral_flare_001',
    [ABILITY_IDS.INVENTOR]: 'magic.general.modern_magic_sound_fx_pack_vol.arcane_spells.arcane_ripple_003',
    [ABILITY_IDS.ELF]: 'stinger.mini_games_sound_effects_and_music_pack.stinger.stgr_action_win',
};
```

### 2. feedbackResolver 动态选择

修改了 `feedbackResolver`，使用事件常量而不是硬编码字符串：

```typescript
feedbackResolver: (event: any, context?: any) => {
    const { type } = event;
    
    // ABILITY_ACTIVATED：根据 abilityId 返回对应的音效
    if (type === CARDIA_EVENTS.ABILITY_ACTIVATED.type) {
        const abilityId = event.payload?.abilityId;
        if (abilityId && ABILITY_SOUND_MAP[abilityId]) {
            return ABILITY_SOUND_MAP[abilityId];
        }
        // 如果没有定制音效，返回默认音效
        return 'magic.general.modern_magic_sound_fx_pack_vol.arcane_spells.arcane_spells_mana_surge_001';
    }
    
    // ... 其他事件处理
}
```

### 3. 预加载列表

所有能力音效已添加到 `criticalSounds` 预加载列表：

```typescript
criticalSounds: Array.from(new Set([
    ...collectPreloadKeys(CARDIA_EVENTS),
    // ... 其他音效
    ...Object.values(ABILITY_SOUND_MAP),  // 16 张卡牌的能力音效
])),
```

### 4. 测试验证

更新了 `audio-config.test.ts`，验证：

- ✅ 能力激活事件根据 `abilityId` 返回正确的定制音效
- ✅ 未知 `abilityId` 返回默认音效
- ✅ 所有 29 个测试用例通过

## 关键修复

### 问题：事件类型字符串匹配失败

**根本原因**：`defineEvents()` 函数返回的事件对象中，`type` 字段不是简单的字符串 `'ABILITY_ACTIVATED'`，而是通过 `defineEvents` 生成的唯一标识符。

**解决方案**：将所有硬编码的事件类型字符串替换为事件常量：

- `'ABILITY_ACTIVATED'` → `CARDIA_EVENTS.ABILITY_ACTIVATED.type`
- `'MODIFIER_TOKEN_PLACED'` → `CARDIA_EVENTS.MODIFIER_TOKEN_PLACED.type`
- `'GAME_WON'` → `CARDIA_EVENTS.GAME_WON.type`

## 验证结果

### 静态检查

- ✅ ESLint: 0 errors, 2 warnings (类型相关，可忽略)
- ✅ i18n check: 通过

### 单元测试

```bash
npm run test -- src/games/cardia/__tests__/audio-config.test.ts
```

结果：
- ✅ 29 个测试用例全部通过
- ✅ 能力激活音效测试通过（Card 01, 12, 16）
- ✅ 动态音效选择测试通过
- ✅ BGM 配置测试通过

## 音效映射详情

| 卡牌 | 能力 | 音效 |
|------|------|------|
| Card 01 - 雇佣剑士 | 弃掉本牌和相对的牌 | 弃牌音效 |
| Card 02 - 虚空法师 | 移除标记 | 暗黑魔法音效 |
| Card 03 - 外科医生 | 添加负面修正 | 诅咒音效 |
| Card 04 - 调停者 | 平局效果 | 奥术涟漪音效 |
| Card 05 - 破坏者 | 弃掉对手牌库 | 冲击波音效 |
| Card 06 - 占卜师 | 改变揭示顺序 | 符文共鸣音效 |
| Card 07 - 宫廷卫士 | 条件增益/惩罚 | 神圣惩击音效 |
| Card 08 - 审判官 | 赢得所有平局 | 神圣光束音效 |
| Card 09 - 伏击者 | 大规模弃牌 | 暗影哀嚎音效 |
| Card 10 - 傀儡师 | 控制/操纵 | 枯萎诅咒音效 |
| Card 11 - 钟表匠 | 时间操控 | 以太脉冲音效 |
| Card 12 - 财务官 | 额外印戒 | 金币奖励音效 |
| Card 13 - 沼泽守卫 | 回收卡牌 | 潮汐冲击音效 |
| Card 14 - 女导师 | 复制能力 | 星界闪耀音效 |
| Card 15 - 发明家 | 双重修正 | 奥术涟漪音效 |
| Card 16 - 精灵 | 直接胜利 | 胜利音效 |

## 文件修改清单

1. ✅ `src/games/cardia/audio.config.ts` - 添加音效映射表，修复 feedbackResolver
2. ✅ `src/games/cardia/__tests__/audio-config.test.ts` - 更新测试用例
3. ✅ `evidence/cardia-ability-custom-sounds-plan.md` - 音效选择方案
4. ✅ `evidence/cardia-ability-custom-sounds-investigation.md` - 问题调查
5. ✅ `evidence/cardia-ability-custom-sounds-complete.md` - 完成总结（本文档）

## 下一步

1. ⏳ 在游戏中测试每张卡牌的能力激活音效
2. ⏳ 根据实际游戏体验调整音效选择（如有需要）
3. ⏳ 考虑为其他 Deck 的卡牌添加定制音效

## 总结

成功为 Cardia Deck I 的 16 张卡牌实现了能力激活音效定制。通过修复事件类型匹配问题，现在每张卡牌的能力都会播放与其主题相匹配的专属音效，提升了游戏的沉浸感和反馈质量。
