import type { StatusEffectInstance, StatusEffectDef } from '../../systems/StatusEffectSystem';
import type { AbilityDef } from '../../systems/AbilitySystem';
import type { MonkStatusEffectId } from './monk/statusEffects';

export type TurnPhase =
    | 'setup'
    | 'upkeep'
    | 'income'
    | 'main1'
    | 'offensiveRoll'
    | 'defensiveRoll'
    | 'main2'
    | 'discard';

export type DieFace = 'fist' | 'palm' | 'taiji' | 'lotus';

// 重新导出以保持兼容
export type { MonkStatusEffectId as StatusEffectId };
export type { StatusEffectInstance };

export interface PendingAttack {
    attackerId: string;
    defenderId: string;
    isDefendable: boolean;
    damage?: number;
    sourceAbilityId?: string;
    defenseAbilityId?: string;
    isUltimate?: boolean;
    preDefenseResolved?: boolean;
    bonusDamage?: number;
    extraRoll?: {
        value?: number;
        resolved?: boolean;
    };
}

export interface PendingChoiceOption {
    statusId: string;
    value: number;
}

export interface PendingChoice {
    id: string;
    playerId: string;
    sourceAbilityId: string;
    title: string;
    options: PendingChoiceOption[];
}

export interface AbilityCard {
    id: string;
    name: string;
    type: 'upgrade' | 'action'; // 升级卡 vs 技能卡
    cpCost: number;
    timing: 'main' | 'roll' | 'instant';
    description: string;
    atlasIndex?: number;
}

export interface Die {
    id: number;
    value: number; // 1-6
    isKept: boolean;
}

export interface HeroState {
    id: string;
    characterId: 'monk';
    health: number;
    cp: number;
    hand: AbilityCard[];
    deck: AbilityCard[];
    discard: AbilityCard[];
    /** 状态效果（使用新系统，支持动态效果ID） */
    statusEffects: Record<string, number>;
    /** 基础技能列表（引用通用 AbilityDef） */
    abilities: AbilityDef[];
    /** 技能等级追踪 { abilityId: level (1-3) } */
    abilityLevels: Record<string, number>;
}

export interface DiceThroneState {
    players: Record<string, HeroState>;
    dice: Die[];
    rollCount: number;
    rollLimit: number;
    rollDiceCount: number;
    rollConfirmed: boolean;
    turnPhase: TurnPhase;
    activePlayerId: string;
    startingPlayerId: string;
    turnNumber: number;
    pendingAttack: PendingAttack | null;
    pendingChoice?: PendingChoice | null;
    availableAbilityIds: string[];
    /** 状态效果定义（使用新系统） */
    statusDefinitions: StatusEffectDef[];
    activatingAbilityId?: string;
    lastEffectSourceByPlayerId?: Record<string, string | undefined>;
    /** 最后一次售出的卡牌ID，用于撤回操作 */
    lastSoldCardId?: string;
}
