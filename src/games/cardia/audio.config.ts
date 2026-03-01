import type { GameAudioConfig } from '../../lib/audio/types';
import { CARDIA_EVENTS } from './domain/events';

/**
 * 卡迪亚音频配置
 * 
 * 音效策略：
 * - 无动画事件：返回 SoundKey（音效由音频系统播放）
 * - 有动画事件：返回 null（音效交给动画层）
 * 
 * 当前实现：所有事件都无动画，直接返回音效
 */

// 音效 key 常量
const CARD_PLAY_KEY = 'card.handling.decks_and_cards_sound_fx_pack.card_placing_001';
const CARD_DRAW_KEY = 'card.handling.decks_and_cards_sound_fx_pack.card_take_001';
const CARD_DISCARD_KEY = 'card.fx.decks_and_cards_sound_fx_pack.fx_discard_001';
const CARD_RECYCLE_KEY = 'card.handling.decks_and_cards_sound_fx_pack.card_shuffle_001';
const ABILITY_ACTIVATE_KEY = 'magic.general.spells_variations_vol_1.arcane_blast.magspel_arcane_blast_01_krst';
const ABILITY_SKIP_KEY = 'ui.general.ui_menu_sound_fx_pack_vol.signals.negative.signal_negative_a';
const ENCOUNTER_RESOLVE_KEY = 'ui.general.ui_menu_sound_fx_pack_vol.signals.update.update_chime_a';
const SIGNET_GRANT_KEY = 'status.general.player_status_sound_fx_pack_vol.positive_buffs_and_cures.charged_a';
const MODIFIER_ADD_KEY = 'status.general.player_status_sound_fx_pack_vol.positive_buffs_and_cures.buff_a';
const MODIFIER_REMOVE_KEY = 'status.general.player_status_sound_fx_pack_vol.negative_debuffs_and_ailments.debuff_a';
const TURN_CHANGE_KEY = 'ui.general.ui_menu_sound_fx_pack_vol.signals.update.update_chime_b';
const PHASE_CHANGE_KEY = 'ui.general.ui_menu_sound_fx_pack_vol.signals.update.update_chime_c';

// BGM 常量
const BGM_NORMAL_KEY = 'bgm.general.casual_music_pack_vol.tiki_party_rt_2.casual_tiki_party_main';
const BGM_BATTLE_KEY = 'bgm.funk.funk_music_pack.move_your_feet_rt_2.funk_move_your_feet_main';

export const cardiaAudioConfig: GameAudioConfig = {
    /**
     * 事件音效解析器
     * @param event 游戏事件
     * @returns 音效键名，或 null（交给动画层）
     */
    feedbackResolver: (event) => {
        switch (event.type) {
            // 卡牌相关
            case CARDIA_EVENTS.CARD_PLAYED:
                return CARD_PLAY_KEY;
            case CARDIA_EVENTS.CARD_DRAWN:
                return CARD_DRAW_KEY;
            case CARDIA_EVENTS.CARD_DISCARDED:
                return CARD_DISCARD_KEY;
            case CARDIA_EVENTS.CARD_RECYCLED:
                return CARD_RECYCLE_KEY;
            
            // 能力相关
            case CARDIA_EVENTS.ABILITY_ACTIVATED:
                return ABILITY_ACTIVATE_KEY;
            
            // 遭遇战相关
            case CARDIA_EVENTS.ENCOUNTER_RESOLVED:
                return ENCOUNTER_RESOLVE_KEY;
            case CARDIA_EVENTS.SIGNET_GRANTED:
                return SIGNET_GRANT_KEY;
            
            // 修正标记相关
            case CARDIA_EVENTS.MODIFIER_ADDED:
                return MODIFIER_ADD_KEY;
            case CARDIA_EVENTS.MODIFIER_REMOVED:
                return MODIFIER_REMOVE_KEY;
            
            // 持续效果相关
            case CARDIA_EVENTS.ONGOING_ADDED:
                return MODIFIER_ADD_KEY;  // 复用修正标记音效
            case CARDIA_EVENTS.ONGOING_REMOVED:
                return MODIFIER_REMOVE_KEY;  // 复用修正标记音效
            
            // 回合相关
            case CARDIA_EVENTS.TURN_ENDED:
                return TURN_CHANGE_KEY;
            case CARDIA_EVENTS.PHASE_CHANGED:
                return PHASE_CHANGE_KEY;
            
            // 其他事件无音效
            case CARDIA_EVENTS.HAND_VIEWED:
            case CARDIA_EVENTS.DECK_SHUFFLED:
                return null;
            
            default:
                return null;
        }
    },
    
    /**
     * 关键音效列表
     * 进入游戏后立即预加载，确保高频音效流畅播放
     */
    criticalSounds: [
        CARD_PLAY_KEY,        // 打出卡牌（高频）
        CARD_DRAW_KEY,        // 抽牌（高频）
        CARD_DISCARD_KEY,     // 弃牌（高频）
        ABILITY_ACTIVATE_KEY, // 激活能力（高频）
        ENCOUNTER_RESOLVE_KEY,// 遭遇战解析（高频）
        SIGNET_GRANT_KEY,     // 印戒授予（中频）
        TURN_CHANGE_KEY,      // 回合切换（中频）
        PHASE_CHANGE_KEY,     // 阶段切换（中频）
    ],
    
    /**
     * BGM 列表
     */
    bgm: [
        {
            key: BGM_NORMAL_KEY,
            name: 'Tiki Party',
            src: '',
            volume: 0.5,
        },
        {
            key: BGM_BATTLE_KEY,
            name: 'Move Your Feet',
            src: '',
            volume: 0.5,
        },
    ],
    
    /**
     * BGM 分组
     */
    bgmGroups: {
        normal: [BGM_NORMAL_KEY],
        battle: [BGM_BATTLE_KEY],
    },
    
    /**
     * BGM 规则
     */
    bgmRules: [
        {
            when: () => true,
            key: BGM_NORMAL_KEY,
            group: 'normal',
        },
    ],
};

export default cardiaAudioConfig;
