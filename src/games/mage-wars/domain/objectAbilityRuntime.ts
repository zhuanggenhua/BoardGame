import {
    createAbilityChoiceContract,
    createAbilityExecutorRegistry,
    createAbilityOpportunity,
    type AbilityContext,
    type AbilityResult,
} from '../../../engine/primitives/ability';
import { createTimingPoint, type Opportunity } from '../../../engine/TimingOpportunity';
import type { MatchState, RandomFn, ValidationResult } from '../../../engine/types';
import {
    getPresetSpellbookCardIdsFromConfig,
    getMageWarsSpellCardFromConfig,
    hasPresetSpellbookCardInConfig,
    type MageWarsConfigSpellCard,
} from '../data/configPackage';
import {
    type MageWarsObjectAbilityEffect,
    type MageWarsObjectAbilityDef,
    mageWarsObjectAbilityRegistry,
} from './abilityCatalog';
import type { MageWarsUseArenaObjectAbilityCommand } from './commands';
import { MAGE_WARS_COMMANDS } from './commands';
import { MAGE_WARS_EVENTS } from './events';
import { MAGE_WARS_GAME_ID, MAGE_WARS_OBJECT_ABILITY_IDS, type MageWarsObjectAbilityId } from './ids';
import {
    getMageWarsZoneDistance,
    hasMageWarsStunStatus,
    isMageWarsAnimalArenaObject,
    isMageWarsElementalStaffBindableSpell,
    isMageWarsLivingArenaObject,
    resolveMageWarsAttachedBeastStaff,
    resolveMageWarsAttachedElementalStaff,
    resolveMageWarsObjectAbilityActionTrack,
} from './spellRules';
import type {
    MageWarsArenaObjectState,
    MageWarsCore,
    MageWarsEvent,
    MageWarsPhase,
    MageWarsPlayerState,
} from './types';
import { getArenaObject } from './utils';
import { hasObjectAbilityUseInRound } from './objectAbilityUsage';
import { hasTemporarySwift, hasTemporaryTeleportMovement } from './temporaryTraits';

type MageWarsObjectAbilityValidator = (ctx: MageWarsObjectAbilityValidationContext) => ValidationResult;

interface MageWarsObjectAbilityValidationContext {
    state: MatchState<MageWarsCore>;
    player: MageWarsPlayerState;
    command: MageWarsUseArenaObjectAbilityCommand;
    phase: MageWarsPhase;
    ability: MageWarsObjectAbilityDef;
}

export interface MageWarsObjectAbilityContext extends AbilityContext {
    state: MatchState<MageWarsCore>;
    command: MageWarsUseArenaObjectAbilityCommand;
    random: RandomFn;
    phase: MageWarsPhase;
    ability: MageWarsObjectAbilityDef;
}

export interface MageWarsObjectAbilityActivationChoiceValue {
    action: 'activate-object-ability';
    objectId: string;
    abilityId: MageWarsObjectAbilityId;
    manaCost: number;
    targetObjectId?: string;
    mode?: MageWarsUseArenaObjectAbilityCommand['payload']['mode'];
    boundSpellCardId?: number;
}

export const mageWarsObjectAbilityExecutorRegistry = createAbilityExecutorRegistry<
    MageWarsObjectAbilityContext,
    MageWarsEvent
>('mage-wars-object-ability-executors');

function invalid(error: string): ValidationResult {
    return { valid: false, error };
}

function rollD3(random: RandomFn, diceCount: number): number[] {
    return Array.from({ length: diceCount }, () => random.d(3));
}

function hasSpellbookCard(player: MageWarsPlayerState, spellCardId: number): boolean {
    return hasPresetSpellbookCardInConfig(player.mageId, spellCardId);
}

function resolveMageWarsElementalStaffBoundSpell(
    player: MageWarsPlayerState,
    spellCardId: number | undefined,
): MageWarsConfigSpellCard | undefined {
    if (spellCardId === undefined || !Number.isInteger(spellCardId)) return undefined;
    const spell = getMageWarsSpellCardFromConfig(spellCardId);
    return spell
        && hasSpellbookCard(player, spellCardId)
        && isMageWarsElementalStaffBindableSpell(spell)
        ? spell
        : undefined;
}

function resolveReadyCreatureSource(ctx: MageWarsObjectAbilityValidationContext):
    | { object: MageWarsArenaObjectState }
    | { result: ValidationResult } {
    if (ctx.phase !== 'creatureAction') return { result: invalid('wrongPhase') };
    const object = getArenaObject(ctx.state.core, ctx.command.payload.objectId);
    if (!object) return { result: invalid('invalidSourceObject') };
    if (object.ownerId !== ctx.player.id) return { result: invalid('notYourObject') };
    if (object.kind !== 'creature') return { result: invalid('objectCannotAct') };
    if (!object.actionReady) return { result: invalid('objectActionSpent') };
    if (hasMageWarsStunStatus(object)) return { result: invalid('objectStunned') };
    return { object };
}

function validateElementalStaffBind(ctx: MageWarsObjectAbilityValidationContext): ValidationResult {
    const source = resolveMageWarsAttachedElementalStaff(ctx.state.core, ctx.player.id);
    if (!source) return invalid('invalidArenaObjectAbilitySource');
    if (ctx.command.payload.objectId !== source.object.id) return invalid('invalidArenaObjectAbilitySource');
    if (ctx.phase !== 'initiativeQuickcast' && ctx.phase !== 'finalQuickcast') return invalid('wrongPhase');
    if (ctx.command.payload.targetObjectId || ctx.command.payload.mode !== undefined) {
        return invalid('invalidTargetMode');
    }
    if (source.object.boundSpellCardId === undefined) return invalid('elementalStaffNotBound');
    if (ctx.command.payload.boundSpellCardId === source.object.boundSpellCardId) {
        return invalid('sameBoundSpell');
    }
    if (!resolveMageWarsElementalStaffBoundSpell(ctx.player, ctx.command.payload.boundSpellCardId)) {
        return invalid('invalidBoundSpell');
    }
    if (ctx.command.payload.manaCost !== 3) return invalid('manaCostMismatch');
    if (ctx.player.mana < 3) return invalid('insufficientMana');
    return { valid: true };
}

function validateBeastStaff(ctx: MageWarsObjectAbilityValidationContext): ValidationResult {
    const source = resolveMageWarsAttachedBeastStaff(ctx.state.core, ctx.player.id);
    if (!source) return invalid('invalidArenaObjectAbilitySource');
    if (ctx.command.payload.objectId !== source.object.id) return invalid('invalidArenaObjectAbilitySource');
    if (source.trait.requiredMageId !== ctx.player.mageId) return invalid('invalidMageRestriction');
    const actionTrack = resolveMageWarsObjectAbilityActionTrack(ctx.phase, source.trait.actionSpeed);
    if (!actionTrack) return invalid('wrongPhase');
    if (
        source.trait.oncePerRound
        && hasObjectAbilityUseInRound(source.object, source.trait.abilityId, ctx.state.core.turnNumber)
    ) {
        return invalid('objectAbilityAlreadyUsedThisRound');
    }
    if (ctx.command.payload.manaCost !== source.trait.manaCost) return invalid('manaCostMismatch');
    if (ctx.player.mana < source.trait.manaCost) return invalid('insufficientMana');
    if (hasMageWarsStunStatus(ctx.player)) return invalid('playerStunned');
    if (ctx.command.payload.mode !== 'melee-bonus' && ctx.command.payload.mode !== 'heal') {
        return invalid('invalidAbilityMode');
    }
    if (!ctx.command.payload.targetObjectId) return invalid('missingTarget');

    const targetObject = getArenaObject(ctx.state.core, ctx.command.payload.targetObjectId);
    if (
        !targetObject
        || targetObject.ownerId !== ctx.player.id
        || !isMageWarsAnimalArenaObject(targetObject)
        || !isMageWarsLivingArenaObject(targetObject)
    ) {
        return invalid('invalidTargetObject');
    }
    const distance = getMageWarsZoneDistance(ctx.state.core, ctx.player.mageZoneId, targetObject.zoneId);
    if (
        distance === undefined
        || distance < source.trait.range.min
        || distance > source.trait.range.max
    ) {
        return invalid('targetOutOfRange');
    }
    return { valid: true };
}

function validateBlueGremlinSwiftTeleport(ctx: MageWarsObjectAbilityValidationContext): ValidationResult {
    const source = resolveReadyCreatureSource(ctx);
    if ('result' in source) return source.result;

    if (ctx.command.payload.manaCost !== 1) return invalid('manaCostMismatch');
    if (ctx.player.mana < ctx.command.payload.manaCost) return invalid('insufficientMana');
    if (source.object.sourceSpellCardId !== 2822) return invalid('invalidArenaObjectAbilitySource');
    if (hasTemporarySwift(source.object) || hasTemporaryTeleportMovement(source.object)) {
        return invalid('objectAbilityAlreadyActive');
    }

    return { valid: true };
}

function validateAsyranClericHealingLight(ctx: MageWarsObjectAbilityValidationContext): ValidationResult {
    const source = resolveReadyCreatureSource(ctx);
    if ('result' in source) return source.result;

    if (ctx.command.payload.manaCost !== 0) return invalid('manaCostMismatch');
    if (source.object.sourceSpellCardId !== 2811) return invalid('invalidArenaObjectAbilitySource');
    if (!ctx.command.payload.targetObjectId) return invalid('missingTarget');

    const targetObject = getArenaObject(ctx.state.core, ctx.command.payload.targetObjectId);
    if (!targetObject || !isMageWarsLivingArenaObject(targetObject)) return invalid('invalidTargetObject');

    const distance = getMageWarsZoneDistance(ctx.state.core, source.object.zoneId, targetObject.zoneId);
    if (distance === undefined || distance > 1) return invalid('targetOutOfRange');

    return { valid: true };
}

function validateGreyAngelRedemptionSacrifice(ctx: MageWarsObjectAbilityValidationContext): ValidationResult {
    const source = resolveReadyCreatureSource(ctx);
    if ('result' in source) return source.result;

    if (ctx.command.payload.manaCost !== 0) return invalid('manaCostMismatch');
    if (source.object.sourceSpellCardId !== 2907) return invalid('invalidArenaObjectAbilitySource');
    if (!ctx.command.payload.targetObjectId) return invalid('missingTarget');

    const targetObject = getArenaObject(ctx.state.core, ctx.command.payload.targetObjectId);
    if (!targetObject || !isMageWarsLivingArenaObject(targetObject)) return invalid('invalidTargetObject');

    return { valid: true };
}

const mageWarsObjectAbilityValidators: Record<MageWarsObjectAbilityId, MageWarsObjectAbilityValidator> = {
    [MAGE_WARS_OBJECT_ABILITY_IDS.BLUE_GREMLIN_SWIFT_TELEPORT]: validateBlueGremlinSwiftTeleport,
    [MAGE_WARS_OBJECT_ABILITY_IDS.ASYRAN_CLERIC_HEALING_LIGHT]: validateAsyranClericHealingLight,
    [MAGE_WARS_OBJECT_ABILITY_IDS.GREY_ANGEL_REDEMPTION_SACRIFICE]: validateGreyAngelRedemptionSacrifice,
    [MAGE_WARS_OBJECT_ABILITY_IDS.BEAST_STAFF]: validateBeastStaff,
    [MAGE_WARS_OBJECT_ABILITY_IDS.ELEMENTAL_STAFF_BIND]: validateElementalStaffBind,
};

export function validateMageWarsArenaObjectAbility(
    state: MatchState<MageWarsCore>,
    player: MageWarsPlayerState,
    command: MageWarsUseArenaObjectAbilityCommand,
    phase: MageWarsPhase,
): ValidationResult {
    const ability = mageWarsObjectAbilityRegistry.get(command.payload.abilityId);
    if (!ability) return invalid('unknownArenaObjectAbility');

    const validator = mageWarsObjectAbilityValidators[ability.id];
    if (!validator) return invalid('unknownArenaObjectAbility');

    return validator({ state, player, command, phase, ability });
}

function resolveObjectAbilityManaCost(args: {
    state: MatchState<MageWarsCore>;
    player: MageWarsPlayerState;
    sourceObject: MageWarsArenaObjectState;
    ability: MageWarsObjectAbilityDef;
}): number | undefined {
    if (args.ability.meta.manaCost.type === 'fixed') return args.ability.meta.manaCost.amount;

    if (args.ability.id === MAGE_WARS_OBJECT_ABILITY_IDS.BEAST_STAFF) {
        const source = resolveMageWarsAttachedBeastStaff(args.state.core, args.player.id);
        return source?.object.id === args.sourceObject.id
            && source.trait.abilityId === args.ability.id
            ? source.trait.manaCost
            : undefined;
    }

    return undefined;
}

type BuildMageWarsObjectAbilityActivationOpportunityArgs = {
    state: MatchState<MageWarsCore>;
    playerId: string;
    objectId: string;
    abilityId: MageWarsObjectAbilityId;
    timestamp?: number;
};

function createMageWarsObjectAbilityCommand(args: {
    playerId: string;
    sourceObjectId: string;
    abilityId: MageWarsObjectAbilityId;
    manaCost: number;
    timestamp?: number;
    targetObjectId?: string;
    mode?: MageWarsUseArenaObjectAbilityCommand['payload']['mode'];
    boundSpellCardId?: number;
}): MageWarsUseArenaObjectAbilityCommand {
    return {
        type: MAGE_WARS_COMMANDS.USE_ARENA_OBJECT_ABILITY,
        playerId: args.playerId,
        payload: {
            objectId: args.sourceObjectId,
            abilityId: args.abilityId,
            manaCost: args.manaCost,
            ...(args.targetObjectId ? { targetObjectId: args.targetObjectId } : {}),
            ...(args.mode ? { mode: args.mode } : {}),
            ...(args.boundSpellCardId !== undefined ? { boundSpellCardId: args.boundSpellCardId } : {}),
        },
        ...(typeof args.timestamp === 'number' ? { timestamp: args.timestamp } : {}),
    };
}

function buildMageWarsObjectAbilityActivationLifecycle(args: {
    sourceObject: MageWarsArenaObjectState;
    playerId: string;
    ability: MageWarsObjectAbilityDef;
}) {
    return {
        sourceId: args.sourceObject.id,
        sourceKind: 'ability' as const,
        controllerId: args.playerId,
        ownerId: args.sourceObject.ownerId,
        phase: 'activation' as const,
        trigger: args.ability.trigger,
        metadata: {
            mageWarsObjectAbilityId: args.ability.id,
            sourceSpellCardId: args.ability.meta.sourceSpellCardId,
            objectId: args.sourceObject.id,
        },
    };
}

function buildMageWarsObjectAbilityActivationTiming(args: {
    state: MatchState<MageWarsCore>;
    playerId: string;
    sourceObject: MageWarsArenaObjectState;
    ability: MageWarsObjectAbilityDef;
    manaCost: number;
    timestamp?: number;
}) {
    const phase = args.state.sys.phase as MageWarsPhase;
    const command = createMageWarsObjectAbilityCommand({
        playerId: args.playerId,
        sourceObjectId: args.sourceObject.id,
        abilityId: args.ability.id,
        manaCost: args.manaCost,
        timestamp: args.timestamp,
    });

    return createTimingPoint<MageWarsUseArenaObjectAbilityCommand>({
        gameId: MAGE_WARS_GAME_ID,
        position: 'before',
        factKind: 'command',
        command,
        source: {
            kind: 'ability',
            id: args.ability.id,
            ownerId: args.sourceObject.ownerId,
            controllerId: args.playerId,
            metadata: {
                objectId: args.sourceObject.id,
                sourceSpellCardId: args.ability.meta.sourceSpellCardId,
            },
        },
        controllerId: args.playerId,
        timestamp: args.timestamp,
        metadata: {
            phase,
            objectId: args.sourceObject.id,
            abilityId: args.ability.id,
            targetMode: args.ability.meta.targetMode,
        },
    });
}

function buildMageWarsObjectAbilityTargetRequest(ability: MageWarsObjectAbilityDef) {
    if (ability.meta.targetMode === 'self') {
        return {
            kind: 'confirm' as const,
            min: 1,
            max: 1,
            description: ability.name,
        };
    }
    if (
        ability.meta.targetMode === 'living-object'
        || ability.meta.targetMode === 'friendly-living-animal'
    ) {
        return {
            kind: 'select-object' as const,
            min: 1,
            max: 1,
            description: ability.name,
            metadata: {
                targetMode: ability.meta.targetMode,
            },
        };
    }
    if (ability.meta.targetMode === 'bound-spell') {
        return {
            kind: 'select-card' as const,
            min: 1,
            max: 1,
            description: ability.name,
            metadata: {
                targetMode: ability.meta.targetMode,
            },
        };
    }
    return null;
}

const MAGE_WARS_BEAST_STAFF_MODES = ['melee-bonus', 'heal'] as const;

function buildMageWarsObjectAbilityActivationCandidates(args: {
    state: MatchState<MageWarsCore>;
    player: MageWarsPlayerState;
    sourceObject: MageWarsArenaObjectState;
    ability: MageWarsObjectAbilityDef;
    manaCost: number;
    phase: MageWarsPhase;
    timestamp?: number;
}) {
    if (args.ability.meta.targetMode === 'self') {
        const command = createMageWarsObjectAbilityCommand({
            playerId: args.player.id,
            sourceObjectId: args.sourceObject.id,
            abilityId: args.ability.id,
            manaCost: args.manaCost,
            timestamp: args.timestamp,
        });
        const validation = validateMageWarsArenaObjectAbility(args.state, args.player, command, args.phase);
        return {
            candidates: [{
                id: 'activate',
                label: args.ability.name,
                value: {
                    action: 'activate-object-ability' as const,
                    objectId: args.sourceObject.id,
                    abilityId: args.ability.id,
                    manaCost: args.manaCost,
                },
                displayMode: 'button' as const,
                commands: [{
                    type: MAGE_WARS_COMMANDS.USE_ARENA_OBJECT_ABILITY,
                    payload: command.payload,
                }],
                ...(validation.valid
                    ? {}
                    : {
                        disabled: true,
                        disabledReason: validation.error ?? 'invalidArenaObjectAbility',
                    }),
            }],
            condition: validation.valid
                ? { satisfied: true }
                : { satisfied: false, reason: validation.error ?? 'invalidArenaObjectAbility' },
            aiPolicyId: 'mage-wars-button-options',
        };
    }

    if (
        args.ability.meta.targetMode === 'living-object'
        || args.ability.meta.targetMode === 'friendly-living-animal'
    ) {
        const modes = args.ability.meta.targetMode === 'friendly-living-animal'
            ? MAGE_WARS_BEAST_STAFF_MODES
            : [undefined];
        const candidates = Object.values(args.state.core.objects)
            .sort((left, right) => left.id.localeCompare(right.id))
            .flatMap((targetObject) => modes.map((mode) => {
                const command = createMageWarsObjectAbilityCommand({
                    playerId: args.player.id,
                    sourceObjectId: args.sourceObject.id,
                    abilityId: args.ability.id,
                    manaCost: args.manaCost,
                    timestamp: args.timestamp,
                    targetObjectId: targetObject.id,
                    ...(mode ? { mode } : {}),
                });
                const validation = validateMageWarsArenaObjectAbility(args.state, args.player, command, args.phase);
                const candidateId = mode
                    ? `target:${targetObject.id}:mode:${mode}`
                    : `target:${targetObject.id}`;
                return {
                    id: candidateId,
                    label: mode ? `${targetObject.name} / ${mode}` : targetObject.name,
                    value: {
                        action: 'activate-object-ability' as const,
                        objectId: args.sourceObject.id,
                        abilityId: args.ability.id,
                        manaCost: args.manaCost,
                        targetObjectId: targetObject.id,
                        ...(mode ? { mode } : {}),
                    },
                    displayMode: 'card' as const,
                    commands: [{
                        type: MAGE_WARS_COMMANDS.USE_ARENA_OBJECT_ABILITY,
                        payload: command.payload,
                    }],
                    metadata: {
                        targetObjectId: targetObject.id,
                        targetOwnerId: targetObject.ownerId,
                        targetZoneId: targetObject.zoneId,
                        ...(mode ? { mode } : {}),
                    },
                    actionKind: mode
                        ? 'mage-wars-object-ability-target-mode'
                        : 'mage-wars-object-ability-target',
                    actionKeyParts: [
                        'ability',
                        'activation',
                        args.sourceObject.id,
                        args.ability.id,
                        'target',
                        targetObject.id,
                        ...(mode ? ['mode', mode] : []),
                    ],
                    ...(validation.valid
                        ? {}
                        : {
                            disabled: true,
                            disabledReason: validation.error ?? 'invalidArenaObjectAbility',
                        }),
                };
            }));
        const firstDisabledReason = candidates.find((candidate) => candidate.disabled)?.disabledReason;
        return {
            candidates,
            condition: candidates.some((candidate) => candidate.disabled !== true)
                ? { satisfied: true }
                : { satisfied: false, reason: firstDisabledReason ?? 'missingTarget' },
            aiPolicyId: 'choice-request:simple-target',
        };
    }

    if (args.ability.meta.targetMode === 'bound-spell') {
        const candidateSpellCardIds = Array.from(new Set(getPresetSpellbookCardIdsFromConfig(args.player.mageId)))
            .sort((left, right) => left - right);
        const candidates = candidateSpellCardIds.map((spellCardId) => {
            const spell = getMageWarsSpellCardFromConfig(spellCardId);
            const command = createMageWarsObjectAbilityCommand({
                playerId: args.player.id,
                sourceObjectId: args.sourceObject.id,
                abilityId: args.ability.id,
                manaCost: args.manaCost,
                timestamp: args.timestamp,
                boundSpellCardId: spellCardId,
            });
            const validation = validateMageWarsArenaObjectAbility(args.state, args.player, command, args.phase);
            return {
                id: `bound-spell:${spellCardId}`,
                label: spell?.name ?? String(spellCardId),
                value: {
                    action: 'activate-object-ability' as const,
                    objectId: args.sourceObject.id,
                    abilityId: args.ability.id,
                    manaCost: args.manaCost,
                    boundSpellCardId: spellCardId,
                },
                displayMode: 'card' as const,
                commands: [{
                    type: MAGE_WARS_COMMANDS.USE_ARENA_OBJECT_ABILITY,
                    payload: command.payload,
                }],
                metadata: {
                    cardId: spellCardId,
                    boundSpellCardId: spellCardId,
                    spellType: spell?.spellType,
                },
                actionKind: 'mage-wars-object-ability-bound-spell',
                actionKeyParts: [
                    'ability',
                    'activation',
                    args.sourceObject.id,
                    args.ability.id,
                    'bound-spell',
                    spellCardId,
                ],
                ...(validation.valid
                    ? {}
                    : {
                        disabled: true,
                        disabledReason: validation.error ?? 'invalidBoundSpell',
                    }),
            };
        });
        const firstDisabledReason = candidates.find((candidate) => candidate.disabled)?.disabledReason;
        return {
            candidates,
            condition: candidates.some((candidate) => candidate.disabled !== true)
                ? { satisfied: true }
                : { satisfied: false, reason: firstDisabledReason ?? 'invalidBoundSpell' },
            aiPolicyId: 'choice-request:simple-target',
        };
    }

    return null;
}

/**
 * 把一个可发动的 Mage Wars 对象能力投影成通用 Ability -> Opportunity -> ChoiceRequest 合同。
 *
 * 这是只读合同投影：它不创建 interaction、不执行命令、不支付费用。
 * 当前覆盖固定费用 self / living-object / bound-spell 能力，以及群兽法杖这类 source-trait 费用 / 多模式目标合同。
 */
export function buildMageWarsObjectAbilityActivationOpportunity(
    args: BuildMageWarsObjectAbilityActivationOpportunityArgs,
): Opportunity<MageWarsObjectAbilityActivationChoiceValue> | null {
    const ability = mageWarsObjectAbilityRegistry.get(args.abilityId);
    const sourceObject = getArenaObject(args.state.core, args.objectId);
    const player = args.state.core.players[args.playerId];
    if (!ability || !sourceObject || !player) return null;

    const manaCost = resolveObjectAbilityManaCost({
        state: args.state,
        player,
        sourceObject,
        ability,
    });
    if (manaCost === undefined) return null;

    const phase = args.state.sys.phase as MageWarsPhase;
    const targetRequest = buildMageWarsObjectAbilityTargetRequest(ability);
    if (!targetRequest) return null;
    const candidateContract = buildMageWarsObjectAbilityActivationCandidates({
        state: args.state,
        player,
        sourceObject,
        ability,
        manaCost,
        phase,
        timestamp: args.timestamp,
    });
    if (!candidateContract) return null;
    const lifecycle = buildMageWarsObjectAbilityActivationLifecycle({
        sourceObject,
        playerId: args.playerId,
        ability,
    });
    const timing = buildMageWarsObjectAbilityActivationTiming({
        state: args.state,
        playerId: args.playerId,
        sourceObject,
        ability,
        manaCost,
        timestamp: args.timestamp,
    });

    return createAbilityOpportunity({
        def: ability,
        timing,
        lifecycle,
        condition: candidateContract.condition,
        targetRequest,
        resolution: { type: 'choice-request' },
        choice: createAbilityChoiceContract<MageWarsObjectAbilityEffect, typeof ability.trigger, MageWarsObjectAbilityActivationChoiceValue>({
            def: ability,
            lifecycle,
            targetRequest,
            candidates: candidateContract.candidates,
            selection: { min: 1, max: 1 },
            skipPolicy: 'forbidden',
            resolution: { type: 'candidate-commands' },
            ai: { status: 'shared-policy', policyId: candidateContract.aiPolicyId },
            metadata: {
                phase,
                objectId: sourceObject.id,
                abilityId: ability.id,
                targetMode: ability.meta.targetMode,
            },
        }),
        metadata: {
            phase,
            objectId: sourceObject.id,
            abilityId: ability.id,
            targetMode: ability.meta.targetMode,
        },
    });
}

/**
 * 兼容旧试点名：只返回 self 目标能力的合同，不替目标型能力乱开入口。
 */
export function buildMageWarsSelfObjectAbilityActivationOpportunity(
    args: BuildMageWarsObjectAbilityActivationOpportunityArgs,
): Opportunity<MageWarsObjectAbilityActivationChoiceValue> | null {
    const ability = mageWarsObjectAbilityRegistry.get(args.abilityId);
    if (ability?.meta.targetMode !== 'self') return null;
    return buildMageWarsObjectAbilityActivationOpportunity(args);
}

function executeBeastStaff(ctx: MageWarsObjectAbilityContext): AbilityResult<MageWarsEvent> {
    const source = resolveMageWarsAttachedBeastStaff(ctx.state.core, ctx.ownerId);
    const targetObject = ctx.command.payload.targetObjectId
        ? getArenaObject(ctx.state.core, ctx.command.payload.targetObjectId)
        : undefined;
    const actionTrack = source
        ? resolveMageWarsObjectAbilityActionTrack(ctx.phase, source.trait.actionSpeed)
        : undefined;
    if (!source || ctx.command.payload.objectId !== source.object.id || !targetObject || !actionTrack) {
        return { events: [] };
    }

    const abilityEvent: MageWarsEvent = {
        type: MAGE_WARS_EVENTS.ARENA_OBJECT_ABILITY_RESOLVED,
        payload: {
            ownerId: ctx.ownerId,
            objectId: source.object.id,
            abilityId: ctx.ability.id,
            abilityName: ctx.ability.name,
            manaCost: source.trait.manaCost,
            targetObjectId: targetObject.id,
            mode: ctx.command.payload.mode,
            actionTrack,
            actionCost: ctx.ability.meta.actionCost,
            roundNumber: ctx.state.core.turnNumber,
        },
        sourceCommandType: ctx.command.type,
        timestamp: ctx.timestamp,
    };

    if (ctx.command.payload.mode === 'melee-bonus') {
        return {
            events: [abilityEvent, {
                type: MAGE_WARS_EVENTS.ARENA_OBJECT_TEMPORARY_TRAITS_GAINED,
                payload: {
                    ownerId: targetObject.ownerId,
                    objectId: targetObject.id,
                    sourceAbilityId: ctx.ability.id,
                    spellCardId: source.object.sourceSpellCardId,
                    meleeDiceModifier: source.trait.meleeDiceModifier,
                    meleeDiceModifierUntilRoundNumber: ctx.state.core.turnNumber,
                },
                sourceCommandType: ctx.command.type,
                timestamp: ctx.timestamp,
            }],
        };
    }

    const diceResults = rollD3(ctx.random, source.trait.healingDiceCount);
    const healing = diceResults.reduce((total, result) => total + result, 0);
    return {
        events: [abilityEvent, {
            type: MAGE_WARS_EVENTS.SPELL_HEALING_ROLLED,
            payload: {
                playerId: ctx.ownerId,
                spellCardId: source.object.sourceSpellCardId,
                sourceAbilityId: ctx.ability.id,
                targetObjectId: targetObject.id,
                targetZoneId: targetObject.zoneId,
                diceResults,
                healing,
                actualHealing: Math.min(targetObject.damage, healing),
            },
            sourceCommandType: ctx.command.type,
            timestamp: ctx.timestamp,
        }],
    };
}

function executeElementalStaffBind(ctx: MageWarsObjectAbilityContext): AbilityResult<MageWarsEvent> {
    const source = resolveMageWarsAttachedElementalStaff(ctx.state.core, ctx.ownerId);
    const actionTrack = source
        ? resolveMageWarsObjectAbilityActionTrack(ctx.phase, 'quick')
        : undefined;
    if (
        !source
        || ctx.command.payload.objectId !== source.object.id
        || ctx.command.payload.boundSpellCardId === undefined
        || !actionTrack
    ) {
        return { events: [] };
    }

    return {
        events: [{
            type: MAGE_WARS_EVENTS.ARENA_OBJECT_ABILITY_RESOLVED,
            payload: {
                ownerId: ctx.ownerId,
                objectId: source.object.id,
                abilityId: ctx.ability.id,
                abilityName: ctx.ability.name,
                manaCost: ctx.command.payload.manaCost,
                boundSpellCardId: ctx.command.payload.boundSpellCardId,
                actionTrack,
                actionCost: ctx.ability.meta.actionCost,
            },
            sourceCommandType: ctx.command.type,
            timestamp: ctx.timestamp,
        }],
    };
}

function executeBlueGremlinSwiftTeleport(ctx: MageWarsObjectAbilityContext): AbilityResult<MageWarsEvent> {
    const object = getArenaObject(ctx.state.core, ctx.command.payload.objectId);
    if (!object || object.sourceSpellCardId !== ctx.ability.meta.sourceSpellCardId) return { events: [] };

    return {
        events: [{
            type: MAGE_WARS_EVENTS.ARENA_OBJECT_ABILITY_RESOLVED,
            payload: {
                ownerId: ctx.ownerId,
                objectId: object.id,
                abilityId: ctx.ability.id,
                abilityName: ctx.ability.name,
                manaCost: ctx.command.payload.manaCost,
                actionCost: ctx.ability.meta.actionCost,
                grants: ['swift', 'teleportMovement'],
            },
            sourceCommandType: ctx.command.type,
            timestamp: ctx.timestamp,
        }],
    };
}

function executeAsyranClericHealingLight(ctx: MageWarsObjectAbilityContext): AbilityResult<MageWarsEvent> {
    const object = getArenaObject(ctx.state.core, ctx.command.payload.objectId);
    const targetObject = ctx.command.payload.targetObjectId
        ? getArenaObject(ctx.state.core, ctx.command.payload.targetObjectId)
        : undefined;
    if (
        !object
        || object.sourceSpellCardId !== ctx.ability.meta.sourceSpellCardId
        || !targetObject
        || !isMageWarsLivingArenaObject(targetObject)
    ) {
        return { events: [] };
    }

    const diceResults = rollD3(ctx.random, 1);
    const healing = diceResults.reduce((total, result) => total + result, 0);
    const actualHealing = Math.min(targetObject.damage, healing);

    return {
        events: [
            {
                type: MAGE_WARS_EVENTS.ARENA_OBJECT_ABILITY_RESOLVED,
                payload: {
                    ownerId: ctx.ownerId,
                    objectId: object.id,
                    abilityId: ctx.ability.id,
                    abilityName: ctx.ability.name,
                    manaCost: ctx.command.payload.manaCost,
                    targetObjectId: targetObject.id,
                    actionCost: ctx.ability.meta.actionCost,
                    grants: [],
                },
                sourceCommandType: ctx.command.type,
                timestamp: ctx.timestamp,
            },
            {
                type: MAGE_WARS_EVENTS.SPELL_HEALING_ROLLED,
                payload: {
                    playerId: ctx.ownerId,
                    spellCardId: ctx.ability.meta.sourceSpellCardId,
                    sourceAbilityId: ctx.ability.id,
                    targetObjectId: targetObject.id,
                    targetZoneId: targetObject.zoneId,
                    diceResults,
                    healing,
                    actualHealing,
                },
                sourceCommandType: ctx.command.type,
                timestamp: ctx.timestamp,
            },
        ],
    };
}

function executeGreyAngelRedemptionSacrifice(ctx: MageWarsObjectAbilityContext): AbilityResult<MageWarsEvent> {
    const object = getArenaObject(ctx.state.core, ctx.command.payload.objectId);
    const targetObject = ctx.command.payload.targetObjectId
        ? getArenaObject(ctx.state.core, ctx.command.payload.targetObjectId)
        : undefined;
    if (
        !object
        || object.sourceSpellCardId !== ctx.ability.meta.sourceSpellCardId
        || !targetObject
        || !isMageWarsLivingArenaObject(targetObject)
    ) {
        return { events: [] };
    }

    const diceResults = rollD3(ctx.random, 6);
    const healing = diceResults.reduce((total, result) => total + result, 0);
    const actualHealing = Math.min(targetObject.damage, healing);

    return {
        events: [
            {
                type: MAGE_WARS_EVENTS.ARENA_OBJECT_ABILITY_RESOLVED,
                payload: {
                    ownerId: ctx.ownerId,
                    objectId: object.id,
                    abilityId: ctx.ability.id,
                    abilityName: ctx.ability.name,
                    manaCost: ctx.command.payload.manaCost,
                    targetObjectId: targetObject.id,
                    actionCost: ctx.ability.meta.actionCost,
                    grants: [],
                },
                sourceCommandType: ctx.command.type,
                timestamp: ctx.timestamp,
            },
            {
                type: MAGE_WARS_EVENTS.SPELL_HEALING_ROLLED,
                payload: {
                    playerId: ctx.ownerId,
                    spellCardId: ctx.ability.meta.sourceSpellCardId,
                    sourceAbilityId: ctx.ability.id,
                    targetObjectId: targetObject.id,
                    targetZoneId: targetObject.zoneId,
                    diceResults,
                    healing,
                    actualHealing,
                },
                sourceCommandType: ctx.command.type,
                timestamp: ctx.timestamp,
            },
            {
                type: MAGE_WARS_EVENTS.ARENA_OBJECT_DEFEATED,
                payload: {
                    objectId: object.id,
                    ownerId: ctx.ownerId,
                    sourceAbilityId: ctx.ability.id,
                    spellCardId: ctx.ability.meta.sourceSpellCardId,
                },
                sourceCommandType: ctx.command.type,
                timestamp: ctx.timestamp,
            },
        ],
    };
}

mageWarsObjectAbilityExecutorRegistry.register(
    MAGE_WARS_OBJECT_ABILITY_IDS.BLUE_GREMLIN_SWIFT_TELEPORT,
    executeBlueGremlinSwiftTeleport,
    { tag: 'arena-object-ability' },
);
mageWarsObjectAbilityExecutorRegistry.register(
    MAGE_WARS_OBJECT_ABILITY_IDS.ASYRAN_CLERIC_HEALING_LIGHT,
    executeAsyranClericHealingLight,
    { tag: 'arena-object-ability' },
);
mageWarsObjectAbilityExecutorRegistry.register(
    MAGE_WARS_OBJECT_ABILITY_IDS.GREY_ANGEL_REDEMPTION_SACRIFICE,
    executeGreyAngelRedemptionSacrifice,
    { tag: 'arena-object-ability' },
);
mageWarsObjectAbilityExecutorRegistry.register(
    MAGE_WARS_OBJECT_ABILITY_IDS.BEAST_STAFF,
    executeBeastStaff,
    { tag: 'arena-object-ability' },
);
mageWarsObjectAbilityExecutorRegistry.register(
    MAGE_WARS_OBJECT_ABILITY_IDS.ELEMENTAL_STAFF_BIND,
    executeElementalStaffBind,
    { tag: 'arena-object-ability' },
);

export function executeMageWarsObjectAbility(params: {
    state: MatchState<MageWarsCore>;
    command: MageWarsUseArenaObjectAbilityCommand;
    random: RandomFn;
    timestamp: number;
    phase: MageWarsPhase;
}): MageWarsEvent[] {
    const ability = mageWarsObjectAbilityRegistry.get(params.command.payload.abilityId);
    if (!ability) return [];
    const executor = mageWarsObjectAbilityExecutorRegistry.resolve(ability.id, 'arena-object-ability');
    if (!executor) return [];

    return executor({
        ...params,
        ability,
        sourceId: ability.id,
        ownerId: params.command.playerId,
    }).events;
}

export function isMageWarsObjectAbilityRegistered(abilityId: string): boolean {
    return mageWarsObjectAbilityRegistry.has(abilityId);
}

export const MAGE_WARS_OBJECT_ABILITY_EXECUTION_TAG = 'arena-object-ability' as const;
