/**
 * 大杀四方事件定义
 * 
 * 使用框架层 defineEvents() 定义音频策略
 */

import { defineEvents } from '../../../lib/audio/defineEvents';

// 音效 key 常量
const SELECTION_KEY = 'ui.general.khron_studio_rpg_interface_essentials_inventory_dialog_ucs_system_192khz.dialog.dialog_choice.uiclick_dialog_choice_01_krst_none';
const POSITIVE_SIGNAL_KEY = 'ui.general.ui_menu_sound_fx_pack_vol.signals.positive.signal_positive_bells_a';
const UPDATE_CHIME_KEY = 'ui.general.ui_menu_sound_fx_pack_vol.signals.update.update_chime_a';
const TURN_NOTIFY_KEY = 'ui.fantasy_ui_sound_fx_pack_vol.notifications_pop_ups.popup_a_001';
const MINION_PLAY_KEY = 'card.handling.decks_and_cards_sound_fx_pack.card_placing_001';
const ACTION_PLAY_KEY = 'card.fx.decks_and_cards_sound_fx_pack.fx_magic_deck_001';
const CARD_DRAW_KEY = 'card.handling.decks_and_cards_sound_fx_pack.card_take_001';
const CARD_DISCARD_KEY = 'card.fx.decks_and_cards_sound_fx_pack.fx_discard_001';
const CARD_SHUFFLE_KEY = 'card.handling.decks_and_cards_sound_fx_pack.cards_shuffle_fast_001';
const CARD_SCROLL_KEY = 'card.handling.decks_and_cards_sound_fx_pack.cards_scrolling_001';
const MOVE_KEY = 'card.handling.mini_games_sound_effects_and_music_pack.card.sfx_card_play_1';
const POWER_GAIN_KEY = 'status.general.player_status_sound_fx_pack_vol.positive_buffs_and_cures.charged_a';
const POWER_LOSE_KEY = 'status.general.player_status_sound_fx_pack_vol.positive_buffs_and_cures.purged_a';
const TALENT_KEY = 'magic.general.modern_magic_sound_fx_pack_vol.arcane_spells.arcane_spells_arcane_ripple_001';
const MADNESS_KEY = 'magic.dark.32.dark_spell_01';

/**
 * 大杀四方事件音频配置
 * 
 * 规则：
 * - 'ui': 本地 UI 交互音（选择阵营），只在本地播放
 * - 'immediate': 即时游戏反馈音（打牌/抽牌/回合切换），走 EventStream
 * - 'fx': 动画驱动音效（基地得分/随从摧毁），走 FX 系统
 * - 'silent': 静默事件（状态同步/内部更新），无音效
 */
export const SU_EVENTS = defineEvents({
  // ========== UI 交互（本地播放）==========
  'su:faction_selected': { audio: 'ui', sound: SELECTION_KEY },

  // ========== 即时反馈（EventStream）==========
  'su:minion_played': { audio: 'immediate', sound: MINION_PLAY_KEY },
  'su:action_played': 'fx',                                    // 行动卡展示（FX 系统 FeedbackPack）
  
  'su:cards_drawn': { audio: 'immediate', sound: CARD_DRAW_KEY },
  'su:cards_discarded': { audio: 'immediate', sound: CARD_DISCARD_KEY },
  'su:card_to_deck_top': { audio: 'immediate', sound: CARD_SCROLL_KEY },
  'su:card_to_deck_bottom': { audio: 'immediate', sound: CARD_SCROLL_KEY },
  'su:card_transferred': { audio: 'immediate', sound: CARD_SCROLL_KEY },
  'su:card_recovered_from_discard': { audio: 'immediate', sound: CARD_DRAW_KEY },
  'su:hand_shuffled_into_deck': { audio: 'immediate', sound: CARD_SHUFFLE_KEY },
  
  'su:turn_started': { audio: 'immediate', sound: TURN_NOTIFY_KEY },
  'su:turn_ended': { audio: 'immediate', sound: UPDATE_CHIME_KEY },
  
  'su:base_replaced': { audio: 'immediate', sound: UPDATE_CHIME_KEY },  // 基地替换（本地 AnimatePresence 过渡）
  'su:deck_reshuffled': { audio: 'immediate', sound: CARD_SHUFFLE_KEY },
  'su:deck_reordered': { audio: 'immediate', sound: CARD_SCROLL_KEY },
  'su:base_deck_reordered': { audio: 'immediate', sound: CARD_SCROLL_KEY },
  'su:base_deck_shuffled': { audio: 'immediate', sound: CARD_SHUFFLE_KEY },
  
  'su:minion_returned': { audio: 'immediate', sound: CARD_SCROLL_KEY },
  'su:minion_moved': { audio: 'immediate', sound: MOVE_KEY },
  
  'su:power_counter_added': { audio: 'immediate', sound: POWER_GAIN_KEY },
  'su:power_counter_removed': { audio: 'immediate', sound: POWER_LOSE_KEY },
  'su:permanent_power_added': { audio: 'immediate', sound: POWER_GAIN_KEY },
  'su:temp_power_added': { audio: 'immediate', sound: POWER_GAIN_KEY },
  
  'su:ongoing_attached': { audio: 'immediate', sound: ACTION_PLAY_KEY },
  'su:ongoing_detached': { audio: 'immediate', sound: CARD_DISCARD_KEY },
  'su:ongoing_card_counter_changed': { audio: 'immediate', sound: POWER_GAIN_KEY },
  
  'su:talent_used': { audio: 'immediate', sound: TALENT_KEY },
  'su:minion_play_effect_queued': 'silent',
  'su:minion_play_effect_consumed': 'silent',
  
  'su:madness_drawn': { audio: 'immediate', sound: MADNESS_KEY },
  'su:madness_returned': { audio: 'immediate', sound: MADNESS_KEY },
  
  'su:reveal_hand': { audio: 'immediate', sound: CARD_SCROLL_KEY },
  'su:reveal_deck_top': { audio: 'immediate', sound: CARD_SCROLL_KEY },
  
  'su:breakpoint_modified': { audio: 'immediate', sound: UPDATE_CHIME_KEY },
  'su:limit_modified': { audio: 'immediate', sound: POSITIVE_SIGNAL_KEY },
  'su:special_limit_used': { audio: 'immediate', sound: UPDATE_CHIME_KEY },
  'su:special_after_scoring_armed': 'silent',
  'su:special_after_scoring_consumed': 'silent',
  'su:scoring_eligible_bases_locked': 'silent',  // 进入 scoreBases 阶段时锁定 eligible 基地列表
  'su:before_scoring_triggered': 'silent',  // 标记基地已触发 beforeScoring（防止重复触发）
  'su:before_scoring_cleared': 'silent',  // 清空 beforeScoring 触发标记（计分阶段结束）
  
  'su:ability_feedback': { audio: 'immediate', sound: UPDATE_CHIME_KEY },
  'su:ability_triggered': 'fx',        // 持续效果/触发器激活（FX 动画）

  // ========== 动画驱动（FX 系统）==========
  'su:base_scored': 'fx',             // 基地得分（飞行动画 onImpact）
  'su:base_cleared': 'silent',         // 基地清除（计分后弃置随从/ongoing，紧跟 afterScoring）
  'su:vp_awarded': 'fx',              // VP 授予（飞行动画 onImpact）
  'su:minion_destroyed': { audio: 'immediate', sound: 'dark_fantasy_studio.smashed.smashed_1' },  // 随从摧毁

  // ========== 静默事件 ==========
  'su:all_factions_selected': 'silent', // 所有阵营选择完成（内部状态）
});

// 导出事件类型常量（用于 emit 和类型定义）
export const SU_EVENT_TYPES = {
  MINION_PLAYED: SU_EVENTS['su:minion_played'].type,
  ACTION_PLAYED: SU_EVENTS['su:action_played'].type,
  BASE_SCORED: SU_EVENTS['su:base_scored'].type,
  VP_AWARDED: SU_EVENTS['su:vp_awarded'].type,
  CARDS_DRAWN: SU_EVENTS['su:cards_drawn'].type,
  CARDS_DISCARDED: SU_EVENTS['su:cards_discarded'].type,
  TURN_STARTED: SU_EVENTS['su:turn_started'].type,
  TURN_ENDED: SU_EVENTS['su:turn_ended'].type,
  BASE_REPLACED: SU_EVENTS['su:base_replaced'].type,
  DECK_RESHUFFLED: SU_EVENTS['su:deck_reshuffled'].type,
  DECK_REORDERED: SU_EVENTS['su:deck_reordered'].type,
  MINION_RETURNED: SU_EVENTS['su:minion_returned'].type,
  LIMIT_MODIFIED: SU_EVENTS['su:limit_modified'].type,
  FACTION_SELECTED: SU_EVENTS['su:faction_selected'].type,
  ALL_FACTIONS_SELECTED: SU_EVENTS['su:all_factions_selected'].type,
  MINION_DESTROYED: SU_EVENTS['su:minion_destroyed'].type,
  MINION_MOVED: SU_EVENTS['su:minion_moved'].type,
  POWER_COUNTER_ADDED: SU_EVENTS['su:power_counter_added'].type,
  POWER_COUNTER_REMOVED: SU_EVENTS['su:power_counter_removed'].type,
  PERMANENT_POWER_ADDED: SU_EVENTS['su:permanent_power_added'].type,
  ONGOING_ATTACHED: SU_EVENTS['su:ongoing_attached'].type,
  ONGOING_DETACHED: SU_EVENTS['su:ongoing_detached'].type,
  ONGOING_CARD_COUNTER_CHANGED: SU_EVENTS['su:ongoing_card_counter_changed'].type,
  TALENT_USED: SU_EVENTS['su:talent_used'].type,
  CARD_TO_DECK_TOP: SU_EVENTS['su:card_to_deck_top'].type,
  CARD_TO_DECK_BOTTOM: SU_EVENTS['su:card_to_deck_bottom'].type,
  CARD_TRANSFERRED: SU_EVENTS['su:card_transferred'].type,
  CARD_RECOVERED_FROM_DISCARD: SU_EVENTS['su:card_recovered_from_discard'].type,
  HAND_SHUFFLED_INTO_DECK: SU_EVENTS['su:hand_shuffled_into_deck'].type,
  MADNESS_DRAWN: SU_EVENTS['su:madness_drawn'].type,
  MADNESS_RETURNED: SU_EVENTS['su:madness_returned'].type,
  BASE_DECK_REORDERED: SU_EVENTS['su:base_deck_reordered'].type,
  REVEAL_HAND: SU_EVENTS['su:reveal_hand'].type,
  REVEAL_DECK_TOP: SU_EVENTS['su:reveal_deck_top'].type,
  TEMP_POWER_ADDED: SU_EVENTS['su:temp_power_added'].type,
  BREAKPOINT_MODIFIED: SU_EVENTS['su:breakpoint_modified'].type,
  BASE_DECK_SHUFFLED: SU_EVENTS['su:base_deck_shuffled'].type,
  SPECIAL_LIMIT_USED: SU_EVENTS['su:special_limit_used'].type,
  SPECIAL_AFTER_SCORING_ARMED: SU_EVENTS['su:special_after_scoring_armed'].type,
  SPECIAL_AFTER_SCORING_CONSUMED: SU_EVENTS['su:special_after_scoring_consumed'].type,
  SCORING_ELIGIBLE_BASES_LOCKED: SU_EVENTS['su:scoring_eligible_bases_locked'].type,
  BEFORE_SCORING_TRIGGERED: SU_EVENTS['su:before_scoring_triggered'].type,
  BEFORE_SCORING_CLEARED: SU_EVENTS['su:before_scoring_cleared'].type,
  ABILITY_FEEDBACK: SU_EVENTS['su:ability_feedback'].type,
  ABILITY_TRIGGERED: SU_EVENTS['su:ability_triggered'].type,
  MINION_PLAY_EFFECT_QUEUED: SU_EVENTS['su:minion_play_effect_queued'].type,
  MINION_PLAY_EFFECT_CONSUMED: SU_EVENTS['su:minion_play_effect_consumed'].type,
  BASE_CLEARED: SU_EVENTS['su:base_cleared'].type,
} as const;
