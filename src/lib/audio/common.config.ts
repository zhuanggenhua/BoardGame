/**
 * 通用音效配置
 * 定义所有游戏共享的音效（卡牌、骰子、UI、状态、代币等）
 * 游戏层可通过同名 key 覆盖这些定义
 * @deprecated 已迁移到 registry.json + commonRegistry，待确认删除。
 */
import type { GameAudioConfig } from './types';

// 通用音效资源基础路径
const COMMON_BASE = 'common/audio';

export const COMMON_AUDIO_CONFIG: GameAudioConfig = {
    basePath: COMMON_BASE,

    sounds: {
        // ============ 骰子音效 ============
        dice_roll: { src: 'sfx/dice/Decks and Cards Sound FX Pack/Dice Roll Velvet 001.ogg', volume: 0.8, category: { group: 'dice', sub: 'roll' } },
        dice_roll_2: { src: 'sfx/dice/Decks and Cards Sound FX Pack/Few Dice Roll 001.ogg', volume: 0.8, category: { group: 'dice', sub: 'roll' } },
        dice_roll_3: { src: 'sfx/dice/Decks and Cards Sound FX Pack/Many Dice Roll Wood 001.ogg', volume: 0.8, category: { group: 'dice', sub: 'roll' } },
        dice_lock: { src: 'sfx/dice/Decks and Cards Sound FX Pack/Dice Handling 001.ogg', volume: 0.5, category: { group: 'dice', sub: 'lock' } },
        dice_confirm: { src: 'sfx/ui/general/Khron Studio - RPG Interface Essentials - Inventory & Dialog (UCS System 192Khz)/Buttons/Tab_Switching_Button/UIClick_Tab Switching Button 01_KRST_NONE.ogg', volume: 0.6, category: { group: 'dice', sub: 'confirm' } },
        bonus_die_roll: { src: 'sfx/dice/Decks and Cards Sound FX Pack/Single Die Roll 001.ogg', volume: 0.8, category: { group: 'dice', sub: 'bonus' } },
        die_modify: { src: 'sfx/dice/Decks and Cards Sound FX Pack/Dice Handling 002.ogg', volume: 0.5, category: { group: 'dice', sub: 'modify' } },
        die_reroll: { src: 'sfx/dice/Decks and Cards Sound FX Pack/Dice Roll Velvet 002.ogg', volume: 0.8, category: { group: 'dice', sub: 'reroll' } },

        // ============ 卡牌音效 ============
        card_draw: { src: 'sfx/cards/handling/Decks and Cards Sound FX Pack/Card Take 001.ogg', volume: 0.7, category: { group: 'card', sub: 'draw' } },
        card_play: { src: 'sfx/cards/handling/Decks and Cards Sound FX Pack/Card Placing 001.ogg', volume: 0.8, category: { group: 'card', sub: 'play' } },
        card_discard: { src: 'sfx/cards/fx/Decks and Cards Sound FX Pack/FX Discard 001.ogg', volume: 0.6, category: { group: 'card', sub: 'discard' } },
        card_sell: { src: 'sfx/coins/Decks and Cards Sound FX Pack/Small Coin Drop 001.ogg', volume: 0.7, category: { group: 'card', sub: 'sell' } },
        card_sell_undo: { src: 'sfx/coins/Decks and Cards Sound FX Pack/Small Reward 001.ogg', volume: 0.6, category: { group: 'card', sub: 'sell_undo' } },
        card_reorder: { src: 'sfx/cards/handling/Decks and Cards Sound FX Pack/Cards Scrolling 001.ogg', volume: 0.5, category: { group: 'card', sub: 'reorder' } },
        deck_shuffle: { src: 'sfx/cards/handling/Decks and Cards Sound FX Pack/Cards Shuffle Fast 001.ogg', volume: 0.7, category: { group: 'card', sub: 'shuffle' } },

        // ============ 代币/资源音效 ============
        // Token 在游戏中代表 Buff/增益状态（如太极、闪避、净化），使用 Buff 音效而非物理 Token 音效
        token_gain: { src: 'sfx/status/general/Player Status Sound FX Pack Vol. 3/Action and Interaction/Ready A.ogg', volume: 0.6, category: { group: 'token', sub: 'gain' } },
        token_use: { src: 'sfx/status/general/Player Status Sound FX Pack Vol. 3/Positive Buffs and Cures/Purged A.ogg', volume: 0.5, category: { group: 'token', sub: 'use' } },
        cp_gain: { src: 'sfx/status/general/Player Status Sound FX Pack Vol. 3/Positive Buffs and Cures/Charged A.ogg', volume: 0.6, category: { group: 'system', sub: 'cp_gain' } },
        cp_spend: { src: 'sfx/status/general/Player Status Sound FX Pack Vol. 3/Positive Buffs and Cures/Purged A.ogg', volume: 0.5, category: { group: 'system', sub: 'cp_spend' } },

        // ============ 状态效果音效 ============
        status_apply: { src: 'sfx/status/general/Player Status Sound FX Pack Vol. 3/Positive Buffs and Cures/Charged A.ogg', volume: 0.6, category: { group: 'status', sub: 'apply' } },
        status_remove: { src: 'sfx/status/general/Player Status Sound FX Pack Vol. 3/Positive Buffs and Cures/Purged A.ogg', volume: 0.5, category: { group: 'status', sub: 'remove' } },
        heal: { src: 'sfx/status/general/Player Status Sound FX Pack Vol. 3/Positive Buffs and Cures/Healed A.ogg', volume: 0.7, category: { group: 'status', sub: 'heal' } },
        damage_shield_gain: { src: 'sfx/magic/water/10.Water_Shield/Water_Shield.ogg', volume: 0.75, category: { group: 'status', sub: 'shield' } },

        // ============ UI 音效 ============
        click: { src: 'sfx/ui/general/Khron Studio - RPG Interface Essentials - Inventory & Dialog (UCS System 192Khz)/Dialog/Dialog_Choice/UIClick_Dialog Choice 01_KRST_NONE.ogg', volume: 0.4, category: { group: 'ui', sub: 'click' } },
        hover: { src: 'sfx/ui/general/Khron Studio - RPG Interface Essentials - Inventory & Dialog (UCS System 192Khz)/Dialog/Mouseover_Dialog_Option/UIClick_Mouseover Dialog Option 01_KRST_NONE.ogg', volume: 0.2, category: { group: 'ui', sub: 'hover' } },
        phase_change: { src: 'sfx/ui/general/Khron Studio - RPG Interface Essentials - Inventory & Dialog (UCS System 192Khz)/Dialog/Dialog_Screen_Appears/UIAlert_Dialog Screen Appears 01_KRST_NONE.ogg', volume: 0.5, category: { group: 'system', sub: 'phase_change' } },
        turn_change: { src: 'sfx/ui/general/UI & Menu Sound FX Pack Vol. 2/Signals/Update/Update Chime A.ogg', volume: 0.6, category: { group: 'system', sub: 'turn_change' } },
        response_open: { src: 'sfx/ui/general/UI & Menu Sound FX Pack Vol. 2/Signals/Positive/Signal Positive Spring A.ogg', volume: 0.5, category: { group: 'system', sub: 'response_open' } },
        response_close: { src: 'sfx/ui/general/UI & Menu Sound FX Pack Vol. 2/Signals/Negative/Signal Negative Spring A.ogg', volume: 0.5, category: { group: 'system', sub: 'response_close' } },
        choice_request: { src: 'sfx/status/general/Player Status Sound FX Pack Vol. 3/Action and Interaction/Ready A.ogg', volume: 0.5, category: { group: 'system', sub: 'choice_request' } },
        choice_resolve: { src: 'sfx/ui/general/UI & Menu Sound FX Pack Vol. 2/Signals/Positive/Signal Positive Bells A.ogg', volume: 0.5, category: { group: 'system', sub: 'choice_resolve' } },

        // ============ 通用结果音效 ============
        victory: { src: 'sfx/stinger/Mini Games Sound Effects and Music Pack/STINGER/STGR_Action_Win.ogg', volume: 1.0, category: { group: 'stinger', sub: 'victory' } },
        defeat: { src: 'sfx/stinger/Mini Games Sound Effects and Music Pack/STINGER/STGR_Action_Lose.ogg', volume: 1.0, category: { group: 'stinger', sub: 'defeat' } },
    },

    // 通用事件映射（游戏层可覆盖或扩展）
    eventSoundMap: {
        // 注意：阶段切换的音效不在这里统一播放。
        // 现在的阶段推进交互通常会触发 UI 点击音 + SYS_PHASE_CHANGED，
        // 如果这里再对 SYS_PHASE_CHANGED 播放 phase_change，会导致“推进阶段音效重复”。
        // 如需强调阶段变化，可在具体游戏层做更细粒度的 resolver（例如仅特定 phase 播）。
        // [FLOW_EVENTS.PHASE_CHANGED]: 'phase_change',
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
