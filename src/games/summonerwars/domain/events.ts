/**
 * 召唤师战争事件定义
 * 
 * 使用框架层 defineEvents() 定义音频策略
 */

import { defineEvents } from '../../../lib/audio/defineEvents';

// 音效 key 常量
const UNIT_SUMMON_KEY = 'magic.general.modern_magic_sound_fx_pack_vol.arcane_spells.arcane_spells_summon_creature_001';
const UNIT_MOVE_KEY = 'ambient.general.footsteps_sound_fx_pack_vol.footsteps_grass.footsteps_grass_walk_001';
const UNIT_ATTACK_KEY = 'combat.general.mini_games_sound_effects_and_music_pack.weapon_swoosh.sfx_weapon_melee_swoosh_sword_1';
const UNIT_CHARGE_KEY = 'status.general.player_status_sound_fx_pack_vol.positive_buffs_and_cures.charged_a';

const STRUCTURE_BUILD_KEY = 'ambient.general.khron_studio_sound_of_survival_vol_1_assets.items.item_or_weapon_hit_wood.weapmisc_item_or_weapon_hit_wood_01_krst';

const MAGIC_CHANGE_KEY = 'magic.general.modern_magic_sound_fx_pack_vol.arcane_spells.arcane_spells_mana_surge_001';

const CARD_DRAW_KEY = 'card.handling.decks_and_cards_sound_fx_pack.card_take_001';
const CARD_DISCARD_KEY = 'card.fx.decks_and_cards_sound_fx_pack.fx_discard_001';
const EVENT_PLAY_KEY = 'card.fx.decks_and_cards_sound_fx_pack.fx_magic_deck_001';
const CARD_RETRIEVE_KEY = 'card.handling.decks_and_cards_sound_fx_pack.card_take_001';

const PHASE_CHANGE_KEY = 'fantasy.gothic_fantasy_sound_fx_pack_vol.musical.drums_of_fate_002';
const TURN_CHANGE_KEY = 'ui.general.ui_menu_sound_fx_pack_vol.signals.update.update_chime_a';

const ABILITY_TRIGGER_KEY = 'magic.general.modern_magic_sound_fx_pack_vol.arcane_spells.arcane_spells_arcane_ripple_001';
const STRENGTH_MODIFY_KEY = 'status.general.player_status_sound_fx_pack_vol.positive_buffs_and_cures.charged_a';
const EVENT_ATTACH_KEY = 'magic.general.modern_magic_sound_fx_pack_vol.arcane_spells.arcane_spells_glyphic_resonance_001';

const UNIT_PUSH_KEY = 'combat.general.fight_fury_vol_2.versatile_punch_hit.fghtimpt_versatile_punch_hit_01_krst';
const UNIT_PULL_KEY = 'combat.general.fight_fury_vol_2.versatile_punch_hit.fghtimpt_versatile_punch_hit_01_krst';
const UNIT_SWAP_KEY = 'magic.general.modern_magic_sound_fx_pack_vol.arcane_spells.arcane_spells_teleport_001';

const EXTRA_ATTACK_KEY = 'combat.general.mini_games_sound_effects_and_music_pack.weapon_swoosh.sfx_weapon_melee_swoosh_sword_1';
const DAMAGE_REDUCE_KEY = 'status.general.player_status_sound_fx_pack_vol.positive_buffs_and_cures.purged_a';
const HYPNOTIC_LURE_KEY = 'magic.general.modern_magic_sound_fx_pack_vol.dark_magic.dark_magic_shadow_wail_001';
const HEALING_MODE_KEY = 'status.general.player_status_sound_fx_pack_vol.positive_buffs_and_cures.charged_a';
const ABILITIES_COPY_KEY = 'magic.general.modern_magic_sound_fx_pack_vol.arcane_spells.arcane_spells_arcane_ripple_001';
const UNIT_ATTACH_KEY = 'magic.general.modern_magic_sound_fx_pack_vol.arcane_spells.arcane_spells_glyphic_resonance_001';
const ACTION_CONSUME_KEY = 'ui.general.modern_ui_sound_fx_pack_vol.menu_navigation.menu_navigation_select_001';

const SUMMON_REQUEST_KEY = 'ui.fantasy_ui_sound_fx_pack_vol.notifications_pop_ups.popup_a_001';
const CONTROL_TRANSFER_KEY = 'magic.general.modern_magic_sound_fx_pack_vol.arcane_spells.arcane_spells_teleport_001';

// UI 交互音效 key
const FACTION_SELECT_KEY = 'ui.general.khron_studio_rpg_interface_essentials_inventory_dialog_ucs_system_192khz.dialog.dialog_choice.uiclick_dialog_choice_01_krst_none';
const PLAYER_READY_KEY = 'ui.general.ui_menu_sound_fx_pack_vol.signals.positive.signal_positive_bells_a';
const HOST_START_KEY = 'ui.general.ui_menu_sound_fx_pack_vol.signals.update.update_chime_a';

/**
 * 召唤师战争事件音频配置
 * 
 * 规则：
 * - 'ui': 本地 UI 交互音（选择阵营/准备/开始），只在本地播放
 * - 'immediate': 即时游戏反馈音（召唤/移动/攻击/抽牌），走 EventStream
 * - 'fx': 动画驱动音效（伤害/治疗/建造/摧毁），走 FX 系统
 * - 'silent': 静默事件（状态同步/内部更新），无音效
 */
export const SW_EVENTS = defineEvents({
  // ========== UI 交互（本地播放）==========
  FACTION_SELECTED: { audio: 'ui', sound: FACTION_SELECT_KEY },
  PLAYER_READY: { audio: 'ui', sound: PLAYER_READY_KEY },
  HOST_STARTED: { audio: 'ui', sound: HOST_START_KEY },

  // ========== 即时反馈（EventStream）==========
  UNIT_SUMMONED: { audio: 'immediate', sound: UNIT_SUMMON_KEY },
  UNIT_MOVED: { audio: 'immediate', sound: UNIT_MOVE_KEY },
  UNIT_ATTACKED: { audio: 'immediate', sound: UNIT_ATTACK_KEY },
  UNIT_CHARGED: { audio: 'immediate', sound: UNIT_CHARGE_KEY },
  
  STRUCTURE_BUILT: { audio: 'immediate', sound: STRUCTURE_BUILD_KEY },
  
  MAGIC_CHANGED: { audio: 'immediate', sound: MAGIC_CHANGE_KEY },
  
  CARD_DRAWN: { audio: 'immediate', sound: CARD_DRAW_KEY },
  CARD_DISCARDED: { audio: 'immediate', sound: CARD_DISCARD_KEY },
  EVENT_PLAYED: { audio: 'immediate', sound: EVENT_PLAY_KEY },
  ACTIVE_EVENT_DISCARDED: { audio: 'immediate', sound: CARD_DISCARD_KEY },
  CARD_RETRIEVED: { audio: 'immediate', sound: CARD_RETRIEVE_KEY },
  
  PHASE_CHANGED: { audio: 'immediate', sound: PHASE_CHANGE_KEY },
  TURN_CHANGED: { audio: 'immediate', sound: TURN_CHANGE_KEY },
  
  ABILITY_TRIGGERED: { audio: 'immediate', sound: ABILITY_TRIGGER_KEY },
  STRENGTH_MODIFIED: { audio: 'immediate', sound: STRENGTH_MODIFY_KEY },
  FUNERAL_PYRE_CHARGED: { audio: 'immediate', sound: UNIT_CHARGE_KEY },
  EVENT_ATTACHED: { audio: 'immediate', sound: EVENT_ATTACH_KEY },
  
  UNIT_PUSHED: { audio: 'immediate', sound: UNIT_PUSH_KEY },
  UNIT_PULLED: { audio: 'immediate', sound: UNIT_PULL_KEY },
  UNITS_SWAPPED: { audio: 'immediate', sound: UNIT_SWAP_KEY },
  
  EXTRA_ATTACK_GRANTED: { audio: 'immediate', sound: EXTRA_ATTACK_KEY },
  DAMAGE_REDUCED: { audio: 'immediate', sound: DAMAGE_REDUCE_KEY },
  HYPNOTIC_LURE_MARKED: { audio: 'immediate', sound: HYPNOTIC_LURE_KEY },
  HEALING_MODE_SET: { audio: 'immediate', sound: HEALING_MODE_KEY },
  ABILITIES_COPIED: { audio: 'immediate', sound: ABILITIES_COPY_KEY },
  UNIT_ATTACHED: { audio: 'immediate', sound: UNIT_ATTACH_KEY },
  MOVE_ACTION_CONSUMED: { audio: 'immediate', sound: ACTION_CONSUME_KEY },
  ATTACK_ACTION_CONSUMED: { audio: 'immediate', sound: ACTION_CONSUME_KEY },
  
  SUMMON_FROM_DISCARD_REQUESTED: { audio: 'immediate', sound: SUMMON_REQUEST_KEY },
  SOUL_TRANSFER_REQUESTED: { audio: 'immediate', sound: SUMMON_REQUEST_KEY },
  MIND_CAPTURE_REQUESTED: { audio: 'immediate', sound: SUMMON_REQUEST_KEY },
  GRAB_FOLLOW_REQUESTED: { audio: 'immediate', sound: SUMMON_REQUEST_KEY },
  CONTROL_TRANSFERRED: { audio: 'immediate', sound: CONTROL_TRANSFER_KEY },

  // ========== 动画驱动（FX 系统）==========
  UNIT_DAMAGED: 'fx',            // 单位受伤（飞行动画 onImpact）
  UNIT_HEALED: 'fx',             // 单位治疗（飞行动画 onImpact）
  UNIT_DESTROYED: 'fx',          // 单位摧毁（飞行动画 onImpact）
  
  STRUCTURE_DESTROYED: 'fx',     // 建筑摧毁（飞行动画 onImpact）
  STRUCTURE_HEALED: 'fx',        // 建筑治疗（飞行动画 onImpact）

  // ========== 静默事件 ==========
  GAME_INITIALIZED: 'silent',    // 游戏初始化（内部状态）
  GAME_OVER: 'silent',           // 游戏结束（内部状态）
});

