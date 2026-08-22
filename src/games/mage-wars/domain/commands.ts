import type { Command, PlayerId } from '../../../engine/types';
import type { ArenaZoneId, MageWarsMageAbilityId, MageWarsObjectAbilityId, MageWarsWallEdgeId, StatusTokenId } from './ids';

export const MAGE_WARS_COMMANDS = {
    PLAN_SPELLS: 'mw:plan_spells',
    PLAN_OBJECT_SPELL: 'mw:plan_object_spell',
    CAST_SPELL: 'mw:cast_spell',
    USE_MAGE_ABILITY: 'mw:use_mage_ability',
    USE_ARENA_OBJECT_ABILITY: 'mw:use_arena_object_ability',
    MOVE_MAGE: 'mw:move_mage',
    MOVE_ARENA_OBJECT: 'mw:move_arena_object',
    GUARD: 'mw:guard',
    DECLARE_ATTACK: 'mw:declare_attack',
    DECLARE_OBJECT_ATTACK: 'mw:declare_object_attack',
    DECLARE_EQUIPMENT_ATTACK: 'mw:declare_equipment_attack',
    ROLL_ARENA_OBJECT_DEFENSE: 'mw:roll_arena_object_defense',
} as const;

export interface MageWarsPlanSpellsCommand extends Command<typeof MAGE_WARS_COMMANDS.PLAN_SPELLS> {
    payload: {
        spellCardIds: number[];
    };
}

export interface MageWarsCastSpellCommand extends Command<typeof MAGE_WARS_COMMANDS.CAST_SPELL> {
    payload: {
        spellCardId: number;
        manaCost: number;
        casterObjectId?: string;
        targetPlayerId?: PlayerId;
        targetObjectId?: string;
        targetZoneId?: ArenaZoneId;
        targetWallEdgeId?: MageWarsWallEdgeId;
        newTargetPlayerId?: PlayerId;
        newTargetObjectId?: string;
        newTargetZoneId?: ArenaZoneId;
        pushToZoneId?: ArenaZoneId;
        boundSpellCardId?: number;
        chainLightningTargets?: Array<{
            targetObjectId: string;
        }>;
    };
}

export interface MageWarsPlanObjectSpellCommand extends Command<typeof MAGE_WARS_COMMANDS.PLAN_OBJECT_SPELL> {
    payload: {
        objectId: string;
        spellCardId: number;
    };
}

export interface MageWarsUseMageAbilityCommand extends Command<typeof MAGE_WARS_COMMANDS.USE_MAGE_ABILITY> {
    payload: {
        abilityId: MageWarsMageAbilityId;
        manaCost: number;
        casterObjectId?: string;
        targetPlayerId?: PlayerId;
        targetObjectId?: string;
        statusTokenIds: StatusTokenId[];
    };
}

export interface MageWarsUseArenaObjectAbilityCommand extends Command<typeof MAGE_WARS_COMMANDS.USE_ARENA_OBJECT_ABILITY> {
    payload: {
        objectId: string;
        abilityId: MageWarsObjectAbilityId;
        manaCost: number;
        targetObjectId?: string;
        mode?: 'melee-bonus' | 'heal';
        boundSpellCardId?: number;
    };
}

export interface MageWarsMoveMageCommand extends Command<typeof MAGE_WARS_COMMANDS.MOVE_MAGE> {
    payload: {
        toZoneId: ArenaZoneId;
    };
}

export interface MageWarsMoveArenaObjectCommand extends Command<typeof MAGE_WARS_COMMANDS.MOVE_ARENA_OBJECT> {
    payload: {
        objectId: string;
        toZoneId: ArenaZoneId;
    };
}

export interface MageWarsGuardCommand extends Command<typeof MAGE_WARS_COMMANDS.GUARD> {
    payload: {
        objectId?: string;
    };
}

export interface MageWarsDeclareAttackCommand extends Command<typeof MAGE_WARS_COMMANDS.DECLARE_ATTACK> {
    payload: {
        targetPlayerId: PlayerId;
    };
}

export interface MageWarsDeclareObjectAttackCommand extends Command<typeof MAGE_WARS_COMMANDS.DECLARE_OBJECT_ATTACK> {
    payload: {
        attackerObjectId: string;
        attackProfileId: string;
        targetPlayerId?: PlayerId;
        targetObjectId?: string;
    };
}

export interface MageWarsDeclareEquipmentAttackCommand extends Command<typeof MAGE_WARS_COMMANDS.DECLARE_EQUIPMENT_ATTACK> {
    payload: {
        equipmentObjectId: string;
        attackProfileId: string;
        targetPlayerId?: PlayerId;
        targetObjectId?: string;
    };
}

export interface MageWarsRollArenaObjectDefenseCommand extends Command<typeof MAGE_WARS_COMMANDS.ROLL_ARENA_OBJECT_DEFENSE> {
    payload: {
        defenderObjectId: string;
        defenseProfileId: string;
    };
}

export type MageWarsCommand =
    | MageWarsPlanSpellsCommand
    | MageWarsPlanObjectSpellCommand
    | MageWarsCastSpellCommand
    | MageWarsUseMageAbilityCommand
    | MageWarsUseArenaObjectAbilityCommand
    | MageWarsMoveMageCommand
    | MageWarsMoveArenaObjectCommand
    | MageWarsGuardCommand
    | MageWarsDeclareAttackCommand
    | MageWarsDeclareObjectAttackCommand
    | MageWarsDeclareEquipmentAttackCommand
    | MageWarsRollArenaObjectDefenseCommand;
