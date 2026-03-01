/**
 * DiceThrone 命令类型定义
 */

import type { Command, PlayerId } from '../../../engine/types';
import type { SelectableCharacterId } from './core-types';
import type { PayToRemoveKnockdownCommandType } from './ids';

// ============================================================================
// 命令定义
// ============================================================================

/** 掷骰命令 */
export interface RollDiceCommand extends Command<'ROLL_DICE'> {
    payload: Record<string, never>;
}

/** 锁定/解锁骰子命令 */
export interface ToggleDieLockCommand extends Command<'TOGGLE_DIE_LOCK'> {
    payload: {
        dieId: number;
    };
}

/** 确认骰子结果命令 */
export interface ConfirmRollCommand extends Command<'CONFIRM_ROLL'> {
    payload: Record<string, unknown>;
}

/** 选择技能命令 */
export interface SelectAbilityCommand extends Command<'SELECT_ABILITY'> {
    payload: {
        abilityId: string;
    };
}

/** 抽牌命令 */
export interface DrawCardCommand extends Command<'DRAW_CARD'> {
    payload: Record<string, never>;
}

/** 弃牌命令 */
export interface DiscardCardCommand extends Command<'DISCARD_CARD'> {
    payload: {
        cardId: string;
    };
}

/** 售卖卡牌命令 */
export interface SellCardCommand extends Command<'SELL_CARD'> {
    payload: {
        cardId: string;
    };
}

/** 撤回售卖命令 */
export interface UndoSellCardCommand extends Command<'UNDO_SELL_CARD'> {
    payload: Record<string, never>;
}

/** 重排卡牌到末尾命令 */
export interface ReorderCardToEndCommand extends Command<'REORDER_CARD_TO_END'> {
    payload: {
        cardId: string;
    };
}

/** 打出卡牌命令 */
export interface PlayCardCommand extends Command<'PLAY_CARD'> {
    payload: {
        cardId: string;
    };
}

/** 打出升级卡命令 */
export interface PlayUpgradeCardCommand extends Command<'PLAY_UPGRADE_CARD'> {
    payload: {
        cardId: string;
        targetAbilityId: string;
    };
}

/** 解决选择命令 */
export interface ResolveChoiceCommand extends Command<'RESOLVE_CHOICE'> {
    payload: {
        statusId: string;
    };
}

/** 推进阶段命令 */
export interface AdvancePhaseCommand extends Command<'ADVANCE_PHASE'> {
    payload: Record<string, never>;
}

/** 选择角色命令 */
export interface SelectCharacterCommand extends Command<'SELECT_CHARACTER'> {
    payload: {
        characterId: SelectableCharacterId;
        /** 初始牌库顺序（教程/回放用，可选） */
        initialDeckCardIds?: string[];
    };
}

/** 房主开始命令 */
export interface HostStartGameCommand extends Command<'HOST_START_GAME'> {
    payload: Record<string, never>;
}

/** 玩家准备命令 */
export interface PlayerReadyCommand extends Command<'PLAYER_READY'> {
    payload: Record<string, never>;
}

/** 跳过响应窗口命令 */
export interface ResponsePassCommand extends Command<'RESPONSE_PASS'> {
    payload: { forPlayerId?: PlayerId };
}

/** 修改骰子命令 */
export interface ModifyDieCommand extends Command<'MODIFY_DIE'> {
    payload: {
        /** 骰子 ID */
        dieId: number;
        /** 新数值 */
        newValue: number;
    };
}

/** 重掷骰子命令 */
export interface RerollDieCommand extends Command<'REROLL_DIE'> {
    payload: {
        /** 骰子 ID */
        dieId: number;
    };
}

/** 移除状态效果命令 */
export interface RemoveStatusCommand extends Command<'REMOVE_STATUS'> {
    payload: {
        /** 目标玩家 ID */
        targetPlayerId: PlayerId;
        /** 状态 ID（可选，不提供则移除所有） */
        statusId?: string;
    };
}

/** 转移状态效果命令 */
export interface TransferStatusCommand extends Command<'TRANSFER_STATUS'> {
    payload: {
        /** 源玩家 ID */
        fromPlayerId: PlayerId;
        /** 目标玩家 ID */
        toPlayerId: PlayerId;
        /** 状态 ID */
        statusId: string;
    };
}

/** 确认交互命令（已废弃 - 迁移到 InteractionSystem 的 RESPOND 命令） */
export interface ConfirmInteractionCommand extends Command<'CONFIRM_INTERACTION'> {
    payload: {
        interactionId: string;
        selectedDiceIds?: number[];
        selectedPlayerId?: PlayerId;
    };
}

/** 取消交互命令（已废弃 - 迁移到 InteractionSystem 的 CANCEL 命令） */
export interface CancelInteractionCommand extends Command<'CANCEL_INTERACTION'> {
    payload: Record<string, never>;
}

/** 使用 Token 命令 */
export interface UseTokenCommand extends Command<'USE_TOKEN'> {
    payload: {
        /** Token ID（taiji / evasive） */
        tokenId: string;
        /** 消耗数量（太极可选择数量，闪避固定为 1） */
        amount: number;
    };
}

/** 跳过 Token 响应命令 */
export interface SkipTokenResponseCommand extends Command<'SKIP_TOKEN_RESPONSE'> {
    payload: Record<string, never>;
}

/** 使用净化 Token 命令（独立于伤害流程） */
export interface UsePurifyCommand extends Command<'USE_PURIFY'> {
    payload: {
        /** 要移除的负面状态 ID */
        statusId: string;
    };
}

/** 花费 CP 移除击倒命令 */
export interface PayToRemoveKnockdownCommand extends Command<PayToRemoveKnockdownCommandType> {
    payload: Record<string, never>;
}

/** 重掷奖励骰命令 */
export interface RerollBonusDieCommand extends Command<'REROLL_BONUS_DIE'> {
    payload: {
        /** 要重掷的骰子索引（0-based） */
        dieIndex: number;
    };
}

/** 跳过奖励骰重掷命令 */
export interface SkipBonusDiceRerollCommand extends Command<'SKIP_BONUS_DICE_REROLL'> {
    payload: Record<string, never>;
}

/** 使用被动能力命令（如教皇税：花费 CP 重掷/抽牌） */
export interface UsePassiveAbilityCommand extends Command<'USE_PASSIVE_ABILITY'> {
    payload: {
        /** 被动能力 ID（如 'tithes'） */
        passiveId: string;
        /** 动作索引（对应 PassiveAbilityDef.actions 数组下标） */
        actionIndex: number;
        /** 目标骰子 ID（rerollDie 时必填） */
        targetDieId?: number;
    };
}

/** 授予 Token 命令（交互确认后授予目标玩家 Token） */
export interface GrantTokensCommand extends Command<'GRANT_TOKENS'> {
    payload: {
        /** 目标玩家 ID */
        targetPlayerId: PlayerId;
        /** 要授予的 Token 列表 */
        tokens: Array<{ tokenId: string; amount: number }>;
    };
}

/** 所有 DiceThrone 命令 */
export type DiceThroneCommand =
    | RollDiceCommand
    | ToggleDieLockCommand
    | ConfirmRollCommand
    | SelectAbilityCommand
    | DrawCardCommand
    | DiscardCardCommand
    | SellCardCommand
    | UndoSellCardCommand
    | ReorderCardToEndCommand
    | PlayCardCommand
    | PlayUpgradeCardCommand
    | ResolveChoiceCommand
    | AdvancePhaseCommand
    | SelectCharacterCommand
    | HostStartGameCommand
    | PlayerReadyCommand
    | ResponsePassCommand
    | ModifyDieCommand
    | RerollDieCommand
    | RemoveStatusCommand
    | TransferStatusCommand
    // | ConfirmInteractionCommand  // 已废弃 - 使用 InteractionSystem
    // | CancelInteractionCommand   // 已废弃 - 使用 InteractionSystem
    | UseTokenCommand
    | SkipTokenResponseCommand
    | UsePurifyCommand
    | PayToRemoveKnockdownCommand
    | RerollBonusDieCommand
    | SkipBonusDiceRerollCommand
    | UsePassiveAbilityCommand
    | GrantTokensCommand;
