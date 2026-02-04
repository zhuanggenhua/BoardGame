/**
 * 通用音效配置
 * 定义所有游戏共享的音效（卡牌、骰子、UI、状态、代币等）
 * 游戏层可通过同名 key 覆盖这些定义
 */
import type { GameAudioConfig } from './types';
import { FLOW_EVENTS } from '../../engine/systems/FlowSystem';

// 通用音效资源基础路径
const COMMON_BASE = 'common/audio';

export const COMMON_AUDIO_CONFIG: GameAudioConfig = {
    basePath: COMMON_BASE,

    sounds: {
        // ============ 骰子音效 ============
        dice_roll: { src: 'dice/compressed/Dice_Roll_Velvet_001.ogg', volume: 0.8, category: { group: 'dice', sub: 'roll' } },
        dice_roll_2: { src: 'dice/compressed/Few_Dice_Roll_001.ogg', volume: 0.8, category: { group: 'dice', sub: 'roll' } },
        dice_roll_3: { src: 'dice/compressed/SFX_Dice_Roll_3.ogg', volume: 0.8, category: { group: 'dice', sub: 'roll' } },
        dice_lock: { src: 'dice/compressed/Dice_Handling_001.ogg', volume: 0.5, category: { group: 'dice', sub: 'lock' } },
        dice_confirm: { src: 'ui/compressed/UIClick_Accept_Button_01.ogg', volume: 0.6, category: { group: 'dice', sub: 'confirm' } },
        bonus_die_roll: { src: 'dice/compressed/Single_Die_Roll_001.ogg', volume: 0.8, category: { group: 'dice', sub: 'bonus' } },
        die_modify: { src: 'dice/compressed/Dice_Handling_002.ogg', volume: 0.5, category: { group: 'dice', sub: 'modify' } },
        die_reroll: { src: 'dice/compressed/Dice_Roll_Velvet_002.ogg', volume: 0.8, category: { group: 'dice', sub: 'reroll' } },

        // ============ 卡牌音效 ============
        card_draw: { src: 'card/compressed/Card_Take_001.ogg', volume: 0.7, category: { group: 'card', sub: 'draw' } },
        card_play: { src: 'card/compressed/Card_Placing_001.ogg', volume: 0.8, category: { group: 'card', sub: 'play' } },
        card_discard: { src: 'card/compressed/FX_Discard_001.ogg', volume: 0.6, category: { group: 'card', sub: 'discard' } },
        card_sell: { src: 'card/compressed/Small_Coin_Drop_001.ogg', volume: 0.7, category: { group: 'card', sub: 'sell' } },
        card_sell_undo: { src: 'card/compressed/Small_Reward_001.ogg', volume: 0.6, category: { group: 'card', sub: 'sell_undo' } },
        card_reorder: { src: 'card/compressed/Cards_Scrolling_001.ogg', volume: 0.5, category: { group: 'card', sub: 'reorder' } },
        deck_shuffle: { src: 'card/compressed/Cards_Shuffle_Fast_001.ogg', volume: 0.7, category: { group: 'card', sub: 'shuffle' } },

        // ============ 代币/资源音效 ============
        // Token 在游戏中代表 Buff/增益状态（如太极、闪避、净化），使用 Buff 音效而非物理 Token 音效
        token_gain: { src: 'status/compressed/Ready_A.ogg', volume: 0.6, category: { group: 'token', sub: 'gain' } },
        token_use: { src: 'status/compressed/Purged_A.ogg', volume: 0.5, category: { group: 'token', sub: 'use' } },
        cp_gain: { src: 'status/compressed/Charged_A.ogg', volume: 0.6, category: { group: 'system', sub: 'cp_gain' } },
        cp_spend: { src: 'status/compressed/Purged_A.ogg', volume: 0.5, category: { group: 'system', sub: 'cp_spend' } },

        // ============ 状态效果音效 ============
        status_apply: { src: 'status/compressed/Charged_A.ogg', volume: 0.6, category: { group: 'status', sub: 'apply' } },
        status_remove: { src: 'status/compressed/Purged_A.ogg', volume: 0.5, category: { group: 'status', sub: 'remove' } },
        heal: { src: 'status/compressed/Healed_A.ogg', volume: 0.7, category: { group: 'status', sub: 'heal' } },
        damage_shield_gain: { src: 'status/compressed/Water_Shield.ogg', volume: 0.75, category: { group: 'status', sub: 'shield' } },

        // ============ UI 音效 ============
        click: { src: 'ui/compressed/UIClick_Accept_Button_01.ogg', volume: 0.4, category: { group: 'ui', sub: 'click' } },
        hover: { src: 'ui/compressed/UIClick_Mouseover_Dialog_Option_01.ogg', volume: 0.2, category: { group: 'ui', sub: 'hover' } },
        phase_change: { src: 'ui/compressed/UIAlert_Dialog_Screen_Appears_01.ogg', volume: 0.5, category: { group: 'system', sub: 'phase_change' } },
        turn_change: { src: 'ui/compressed/Update_Chime_A.ogg', volume: 0.6, category: { group: 'system', sub: 'turn_change' } },
        response_open: { src: 'ui/compressed/Signal_Positive_Wood_Chimes_A.ogg', volume: 0.5, category: { group: 'system', sub: 'response_open' } },
        response_close: { src: 'ui/compressed/Signal_Negative_Wood_Chimes_A.ogg', volume: 0.5, category: { group: 'system', sub: 'response_close' } },
        choice_request: { src: 'status/compressed/Ready_A.ogg', volume: 0.5, category: { group: 'system', sub: 'choice_request' } },
        choice_resolve: { src: 'ui/compressed/Signal_Positive_Spring_A.ogg', volume: 0.5, category: { group: 'system', sub: 'choice_resolve' } },

        // ============ 通用结果音效 ============
        victory: { src: 'stinger/compressed/STGR_Action_Win.ogg', volume: 1.0, category: { group: 'stinger', sub: 'victory' } },
        defeat: { src: 'stinger/compressed/STGR_Action_Lose.ogg', volume: 1.0, category: { group: 'stinger', sub: 'defeat' } },
    },

    // 通用事件映射（游戏层可覆盖或扩展）
    eventSoundMap: {
        [FLOW_EVENTS.PHASE_CHANGED]: 'phase_change',
        BONUS_DIE_ROLLED: 'bonus_die_roll',
        DIE_LOCK_TOGGLED: 'dice_lock',
        ROLL_CONFIRMED: 'dice_confirm',
        DIE_MODIFIED: 'die_modify',
        DIE_REROLLED: 'die_reroll',
        CARD_DRAWN: 'card_draw',
        CARD_DISCARDED: 'card_discard',
        CARD_SOLD: 'card_sell',
        SELL_UNDONE: 'card_sell_undo',
        CARD_REORDERED: 'card_reorder',
        DECK_SHUFFLED: 'deck_shuffle',
        TOKEN_GRANTED: 'token_gain',
        TOKEN_USED: 'token_use',
        STATUS_APPLIED: 'status_apply',
        STATUS_REMOVED: 'status_remove',
        HEAL_APPLIED: 'heal',
        DAMAGE_SHIELD_GRANTED: 'damage_shield_gain',
        CHOICE_REQUESTED: 'choice_request',
        CHOICE_RESOLVED: 'choice_resolve',
        RESPONSE_WINDOW_OPENED: 'response_open',
        RESPONSE_WINDOW_CLOSED: 'response_close',
        TURN_CHANGED: 'turn_change',
    },
};
