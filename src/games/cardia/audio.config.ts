import type { AudioEvent, AudioRuntimeContext, GameAudioConfig } from '../../lib/audio/types';
import { createFeedbackResolver, collectPreloadKeys } from '../../lib/audio/defineEvents';
import { CARDIA_EVENTS } from './domain/events';
import { ABILITY_IDS } from './domain/ids';

/**
 * BGM 常量定义
 * 从现有音频注册表中选择符合魔法城市主题的曲目
 * 注意：避免与 DiceThrone 重复使用相同曲目
 * Cardia 游戏体量小，使用单一 BGM 即可
 */

// 主 BGM（动感魔法主题 - Dragon Dance），避免复用 The Gang/SmashUp 反派曲目。
const BGM_MAIN_KEY = 'bgm.fantasy.fantasy_music_pack_vol.dragon_dance_rt_2.fantasy_vol5_dragon_dance_main';

/**
 * 能力音效映射表
 * 为每张卡牌的能力定制专属音效
 */
const ABILITY_SOUND_MAP: Record<string, string> = {
    // Card 01 - 雇佣剑士：弃掉本牌和相对的牌
    [ABILITY_IDS.MERCENARY_SWORDSMAN]: 'card.fx.decks_and_cards_sound_fx_pack.fx_discard_001',
    
    // Card 02 - 虚空法师：从任一张牌上弃掉所有修正标记和持续标记
    [ABILITY_IDS.VOID_MAGE]: 'magic.dark.32.dark_spell_01',
    
    // Card 03 - 外科医生：为你下一张打出的牌添加-5影响力
    [ABILITY_IDS.SURGEON]: 'status.general.player_status_sound_fx_pack_vol.mental_and_magical_debuffs.cursed_a',
    
    // Card 04 - 调停者：🔄 这次遭遇为平局
    [ABILITY_IDS.MEDIATOR]: 'magic.general.modern_magic_sound_fx_pack_vol.arcane_spells.arcane_ripple_001',
    
    // Card 05 - 破坏者：你的对手弃掉他牌库的2张顶牌
    [ABILITY_IDS.SABOTEUR]: 'magic.general.modern_magic_sound_fx_pack_vol.offensive_spells.offensive_spells_shockwave_slam_001',
    
    // Card 06 - 占卜师：下一次遭遇中，你的对手必须在你之前朝上打出牌
    [ABILITY_IDS.DIVINER]: 'magic.general.modern_magic_sound_fx_pack_vol.arcane_spells.glyphic_resonance_001',
    
    // Card 07 - 宫廷卫士：你选择一个派系，你的对手可以选择弃掉一张该派系的手牌，否则本牌添加+7影响力
    [ABILITY_IDS.COURT_GUARD]: 'magic.general.modern_magic_sound_fx_pack_vol.divine_magic.divine_magic_smite_001',
    
    // Card 08 - 审判官：🔄 你赢得所有平局，包括之后的遭遇
    [ABILITY_IDS.MAGISTRATE]: 'magic.general.modern_magic_sound_fx_pack_vol.divine_magic.divine_magic_hallowed_beam_001',
    
    // Card 09 - 伏击者：选择一个派系，你的对手弃掉所有该派系的手牌
    [ABILITY_IDS.AMBUSHER]: 'magic.general.modern_magic_sound_fx_pack_vol.dark_magic.dark_magic_shadow_wail_001',
    
    // Card 10 - 傀儡师：弃掉相对的牌，替换为你从对手手牌随机抽取的一张牌
    [ABILITY_IDS.PUPPETEER]: 'magic.general.modern_magic_sound_fx_pack_vol.dark_magic.dark_magic_blight_curse_001',
    
    // Card 11 - 钟表匠：添加+3影响力到你上一个遭遇的牌和你下一次打出的牌
    [ABILITY_IDS.CLOCKMAKER]: 'magic.general.modern_magic_sound_fx_pack_vol.arcane_spells.aetherial_pulse_001',
    
    // Card 12 - 财务官：🔄 上个遭遇获胜的牌额外获得1枚印戒
    [ABILITY_IDS.TREASURER]: 'coins.decks_and_cards_sound_fx_pack.small_reward_001',
    
    // Card 13 - 沼泽守卫：拿取一张你之前打出的牌回到手上，并弃掉其相对的牌
    [ABILITY_IDS.SWAMP_GUARD]: 'magic.general.modern_magic_sound_fx_pack_vol.water_magic.water_magic_tidal_rush_001',
    
    // Card 14 - 女导师：复制并发动你的一张影响力不小于本牌的已打出牌的即时能力
    [ABILITY_IDS.GOVERNESS]: 'magic.general.modern_magic_sound_fx_pack_vol.arcane_spells.astral_flare_001',
    
    // Card 15 - 发明家：添加+3影响力到任一张牌，并添加-3影响力到另外任一张牌
    [ABILITY_IDS.INVENTOR]: 'magic.general.modern_magic_sound_fx_pack_vol.arcane_spells.arcane_ripple_003',
    
    // Card 16 - 精灵：你赢得游戏
    [ABILITY_IDS.ELF]: 'stinger.mini_games_sound_effects_and_music_pack.stinger.stgr_action_win',
};

type CardiaAudioPayload = {
    abilityId?: string;
    value?: number;
    winnerId?: string;
};

const getCurrentPlayerId = (context: AudioRuntimeContext): string | undefined => {
    if ('playerId' in context && typeof context.playerId === 'string') return context.playerId;
    if (context.ctx && typeof context.ctx === 'object' && 'playerId' in context.ctx) {
        const playerId = context.ctx.playerId;
        return typeof playerId === 'string' ? playerId : undefined;
    }
    return undefined;
};

/**
 * Cardia 音频配置
 */
export const CARDIA_AUDIO_CONFIG: GameAudioConfig = {
    // 关键音效预加载（自动收集 + 手动补充去重）
    criticalSounds: Array.from(new Set([
        ...collectPreloadKeys(CARDIA_EVENTS),
        // 手动补充高频音效（如果 collectPreloadKeys 已包含则会被去重）
        'card.handling.decks_and_cards_sound_fx_pack.card_placing_001',  // 打出卡牌
        'card.handling.decks_and_cards_sound_fx_pack.card_take_001',   // 抽取卡牌
        'card.handling.decks_and_cards_sound_fx_pack.cards_shuffle_fast_001',
        'card.fx.decks_and_cards_sound_fx_pack.fx_discard_001',
        'coins.decks_and_cards_sound_fx_pack.small_reward_001',
        'status.general.player_status_sound_fx_pack_vol.positive_buffs_and_cures.charged_a',
        'status.general.player_status_sound_fx_pack_vol.mental_and_magical_debuffs.cursed_a',
        'status.general.player_status_sound_fx_pack_vol.positive_buffs_and_cures.purged_a',
        'stinger.mini_games_sound_effects_and_music_pack.stinger.stgr_action_win',
        'stinger.mini_games_sound_effects_and_music_pack.stinger.stgr_action_lose',
        // 能力音效（16张卡牌）
        ...Object.values(ABILITY_SOUND_MAP),
    ])),

    // BGM 列表（单一主题 BGM）
    bgm: [
        {
            key: BGM_MAIN_KEY,
            name: 'Dragon Dance',
            src: '',
            volume: 0.5,
            category: { group: 'bgm', sub: 'main' },
        },
    ],

    // BGM 分组（单一分组）
    bgmGroups: {
        main: [BGM_MAIN_KEY],
    },

    // 事件音效解析器（自定义以支持动态音效选择）
    feedbackResolver: (event: AudioEvent, context: AudioRuntimeContext) => {
        const { type } = event;
        const payload = event.payload as CardiaAudioPayload | undefined;
        
        // ABILITY_ACTIVATED：根据 abilityId 返回对应的音效
        if (type === CARDIA_EVENTS.ABILITY_ACTIVATED.type) {
            const abilityId = payload?.abilityId;
            if (abilityId && ABILITY_SOUND_MAP[abilityId]) {
                return ABILITY_SOUND_MAP[abilityId];
            }
            // 如果没有定制音效，返回默认音效
            return 'magic.general.modern_magic_sound_fx_pack_vol.arcane_spells.arcane_spells_mana_surge_001';
        }
        
        // 处理动态音效选择
        if (type === CARDIA_EVENTS.MODIFIER_TOKEN_PLACED.type) {
            const value = payload?.value ?? 0;
            return value >= 0  // 注意：零值也返回增益音效
                ? 'status.general.player_status_sound_fx_pack_vol.positive_buffs_and_cures.charged_a'
                : 'status.general.player_status_sound_fx_pack_vol.mental_and_magical_debuffs.cursed_a';
        }
        
        // 处理游戏胜利/失败音效选择
        if (type === CARDIA_EVENTS.GAME_WON.type) {
            const winnerId = payload?.winnerId;
            const currentPlayerId = getCurrentPlayerId(context);
            
            // 如果当前玩家是获胜者，播放胜利音效；否则播放失败音效
            return winnerId === currentPlayerId
                ? 'stinger.mini_games_sound_effects_and_music_pack.stinger.stgr_action_win'
                : 'stinger.mini_games_sound_effects_and_music_pack.stinger.stgr_action_lose';
        }
        
        // 其他事件使用基础 resolver
        const baseResolver = createFeedbackResolver(CARDIA_EVENTS);
        return baseResolver(event, context);
    },

    // BGM 切换规则（单一 BGM，无需切换）
    bgmRules: [
        {
            when: () => true,
            key: BGM_MAIN_KEY,
            group: 'main',
        },
    ],
};
