# Cardia - 为每张卡牌定制能力音效方案

## 目标

为 Cardia Deck I 的 16 张卡牌（card01-16）的能力定制专属音效，替代当前统一的 `arcane_spells_mana_surge_001`。

## 音效选择原则

1. **匹配能力主题**：根据能力的效果类型选择合适的音效
2. **区分度**：不同类型的能力使用不同音效
3. **可用性**：只使用音频注册表中已有的音效

## 卡牌能力音效映射

### Card 01 - 雇佣剑士（Mercenary Swordsman）
- **能力**：弃掉本牌和相对的牌
- **音效**：`card.fx.decks_and_cards_sound_fx_pack.fx_discard_001`
- **理由**：弃牌效果，使用卡牌弃掉音效

### Card 02 - 虚空法师（Void Mage）
- **能力**：从任一张牌上弃掉所有修正标记和持续标记
- **音效**：`magic.dark.32.dark_spell_01`
- **理由**：虚空/移除效果，使用暗黑魔法音效

### Card 03 - 外科医生（Surgeon）
- **能力**：为你下一张打出的牌添加-5影响力
- **音效**：`status.general.player_status_sound_fx_pack_vol.mental_and_magical_debuffs.cursed_a`
- **理由**：负面修正效果，使用诅咒音效

### Card 04 - 调停者（Mediator）
- **能力**：🔄 这次遭遇为平局
- **音效**：`magic.general.modern_magic_sound_fx_pack_vol.arcane_spells.arcane_ripple_001`
- **理由**：持续效果/平衡效果，使用奥术涟漪音效

### Card 05 - 破坏者（Saboteur）
- **能力**：你的对手弃掉他牌库的2张顶牌
- **音效**：`magic.general.modern_magic_sound_fx_pack_vol.offensive_spells.offensive_spells_shockwave_slam_001`
- **理由**：破坏/攻击效果，使用冲击波音效

### Card 06 - 占卜师（Diviner）
- **能力**：下一次遭遇中，你的对手必须在你之前朝上打出牌
- **音效**：`magic.general.modern_magic_sound_fx_pack_vol.arcane_spells.glyphic_resonance_001`
- **理由**：预知/控制效果，使用符文共鸣音效

### Card 07 - 宫廷卫士（Court Guard）
- **能力**：你选择一个派系，你的对手可以选择弃掉一张该派系的手牌，否则本牌添加+7影响力
- **音效**：`magic.general.modern_magic_sound_fx_pack_vol.divine_magic.divine_magic_smite_001`
- **理由**：条件增益/惩罚，使用神圣惩击音效

### Card 08 - 审判官（Magistrate）
- **能力**：🔄 你赢得所有平局，包括之后的遭遇
- **音效**：`magic.general.modern_magic_sound_fx_pack_vol.divine_magic.divine_magic_hallowed_beam_001`
- **理由**：持续强力效果/审判，使用神圣光束音效

### Card 09 - 伏击者（Ambusher）
- **能力**：选择一个派系，你的对手弃掉所有该派系的手牌
- **音效**：`magic.general.modern_magic_sound_fx_pack_vol.dark_magic.dark_magic_shadow_wail_001`
- **理由**：大规模弃牌/伏击，使用暗影哀嚎音效

### Card 10 - 傀儡师（Puppeteer）
- **能力**：弃掉相对的牌，替换为你从对手手牌随机抽取的一张牌
- **音效**：`magic.general.modern_magic_sound_fx_pack_vol.dark_magic.dark_magic_blight_curse_001`
- **理由**：控制/操纵效果，使用枯萎诅咒音效

### Card 11 - 钟表匠（Clockmaker）
- **能力**：添加+3影响力到你上一个遭遇的牌和你下一次打出的牌
- **音效**：`magic.general.modern_magic_sound_fx_pack_vol.arcane_spells.aetherial_pulse_001`
- **理由**：时间操控/双重效果，使用以太脉冲音效

### Card 12 - 财务官（Treasurer）
- **能力**：🔄 上个遭遇获胜的牌额外获得1枚印戒
- **音效**：`coins.decks_and_cards_sound_fx_pack.small_reward_001`
- **理由**：印戒/奖励效果，使用金币奖励音效

### Card 13 - 沼泽守卫（Swamp Guard）
- **能力**：拿取一张你之前打出的牌回到手上，并弃掉其相对的牌
- **音效**：`magic.general.modern_magic_sound_fx_pack_vol.water_magic.water_magic_tidal_rush_001`
- **理由**：回收/沼泽主题，使用潮汐冲击音效

### Card 14 - 女导师（Governess）
- **能力**：复制并发动你的一张影响力不小于本牌的已打出牌的即时能力
- **音效**：`magic.general.modern_magic_sound_fx_pack_vol.arcane_spells.astral_flare_001`
- **理由**：复制/强力效果，使用星界闪耀音效

### Card 15 - 发明家（Inventor）
- **能力**：添加+3影响力到任一张牌，并添加-3影响力到另外任一张牌
- **音效**：`magic.general.modern_magic_sound_fx_pack_vol.arcane_spells.arcane_ripple_003`
- **理由**：双重修正/平衡，使用奥术涟漪音效

### Card 16 - 精灵（Elf）
- **能力**：你赢得游戏
- **音效**：`stinger.mini_games_sound_effects_and_music_pack.stinger.stgr_action_win`
- **理由**：直接胜利，使用胜利音效

## 实现方案

### 方案选择：feedbackResolver 动态选择

在 `audio.config.ts` 的 `feedbackResolver` 中添加 `ABILITY_ACTIVATED` 事件的处理逻辑，根据 `abilityId` 返回对应的音效 key。

### 优点

1. **集中管理**：所有音效映射在一个地方
2. **易于维护**：修改音效只需要改一个文件
3. **不影响事件定义**：事件定义保持简洁

### 实现步骤

1. 在 `audio.config.ts` 中创建 `ABILITY_SOUND_MAP` 常量
2. 在 `feedbackResolver` 中添加 `ABILITY_ACTIVATED` 处理逻辑
3. 添加所有音效到 `criticalSounds` 预加载列表
4. 更新测试

## 预加载音效列表

所有定制音效都需要添加到 `criticalSounds` 中：

```typescript
// 能力音效
'card.fx.decks_and_cards_sound_fx_pack.fx_discard_001',
'magic.dark.32.dark_spell_01',
'status.general.player_status_sound_fx_pack_vol.mental_and_magical_debuffs.cursed_a',
'magic.general.modern_magic_sound_fx_pack_vol.arcane_spells.arcane_ripple_001',
'magic.general.modern_magic_sound_fx_pack_vol.offensive_spells.offensive_spells_shockwave_slam_001',
'magic.general.modern_magic_sound_fx_pack_vol.arcane_spells.glyphic_resonance_001',
'magic.general.modern_magic_sound_fx_pack_vol.divine_magic.divine_magic_smite_001',
'magic.general.modern_magic_sound_fx_pack_vol.divine_magic.divine_magic_hallowed_beam_001',
'magic.general.modern_magic_sound_fx_pack_vol.dark_magic.dark_magic_shadow_wail_001',
'magic.general.modern_magic_sound_fx_pack_vol.dark_magic.dark_magic_blight_curse_001',
'magic.general.modern_magic_sound_fx_pack_vol.arcane_spells.aetherial_pulse_001',
'coins.decks_and_cards_sound_fx_pack.small_reward_001',
'magic.general.modern_magic_sound_fx_pack_vol.water_magic.water_magic_tidal_rush_001',
'magic.general.modern_magic_sound_fx_pack_vol.arcane_spells.astral_flare_001',
'magic.general.modern_magic_sound_fx_pack_vol.arcane_spells.arcane_ripple_003',
'stinger.mini_games_sound_effects_and_music_pack.stinger.stgr_action_win',
```
