import type { Command } from '../../../engine/types';
import type { PlayerId } from '../../../engine/types';
import type { FactionType } from './core-types';

/**
 * 命令常量表
 */
export const CARDIA_COMMANDS = {
    PLAY_CARD: 'cardia:play_card',
    ACTIVATE_ABILITY: 'cardia:activate_ability',
    SKIP_ABILITY: 'cardia:skip_ability',
    CHOOSE_CARD: 'cardia:choose_card',
    CHOOSE_FACTION: 'cardia:choose_faction',
    CHOOSE_MODIFIER: 'cardia:choose_modifier',
    CONFIRM_CHOICE: 'cardia:confirm_choice',
    END_TURN: 'cardia:end_turn',
    ADD_MODIFIER: 'cardia:add_modifier',
    REMOVE_MODIFIER: 'cardia:remove_modifier',
} as const;

/**
 * 打牌命令
 */
export interface PlayCardCommand extends Command<typeof CARDIA_COMMANDS.PLAY_CARD> {
    payload: {
        cardUid: string;
        slotIndex: number;
    };
}

/**
 * 激活能力命令
 */
export interface ActivateAbilityCommand extends Command<typeof CARDIA_COMMANDS.ACTIVATE_ABILITY> {
    payload: {
        abilityId: string;
        sourceCardUid: string;
    };
}

/**
 * 跳过能力命令
 */
export interface SkipAbilityCommand extends Command<typeof CARDIA_COMMANDS.SKIP_ABILITY> {
    payload: {
        playerId: PlayerId;
    };
}

/**
 * 选择卡牌命令
 */
export interface ChooseCardCommand extends Command<typeof CARDIA_COMMANDS.CHOOSE_CARD> {
    payload: {
        cardUid?: string;          // 单选（向后兼容）
        cardUids?: string[];       // 多选
        interactionId: string;
    };
}

/**
 * 选择派系命令
 */
export interface ChooseFactionCommand extends Command<typeof CARDIA_COMMANDS.CHOOSE_FACTION> {
    payload: {
        faction: FactionType;
        interactionId: string;
    };
}

/**
 * 选择修正标记命令
 */
export interface ChooseModifierCommand extends Command<typeof CARDIA_COMMANDS.CHOOSE_MODIFIER> {
    payload: {
        value: number;
        interactionId: string;
    };
}

/**
 * 确认选择命令
 */
export interface ConfirmChoiceCommand extends Command<typeof CARDIA_COMMANDS.CONFIRM_CHOICE> {
    payload: {
        interactionId: string;
    };
}

/**
 * 回合结束命令
 */
export interface EndTurnCommand extends Command<typeof CARDIA_COMMANDS.END_TURN> {
    payload: Record<string, never>;
}

/**
 * 添加修正标记命令
 */
export interface AddModifierCommand extends Command<typeof CARDIA_COMMANDS.ADD_MODIFIER> {
    payload: {
        cardUid: string;
        modifierValue: number;
    };
}

/**
 * 移除修正标记命令
 */
export interface RemoveModifierCommand extends Command<typeof CARDIA_COMMANDS.REMOVE_MODIFIER> {
    payload: {
        cardUid: string;
        modifierId: string;
    };
}

/**
 * Cardia 命令联合类型
 */
export type CardiaCommand =
    | PlayCardCommand
    | ActivateAbilityCommand
    | SkipAbilityCommand
    | ChooseCardCommand
    | ChooseFactionCommand
    | ChooseModifierCommand
    | ConfirmChoiceCommand
    | EndTurnCommand
    | AddModifierCommand
    | RemoveModifierCommand;
