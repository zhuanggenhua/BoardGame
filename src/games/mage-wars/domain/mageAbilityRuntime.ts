import {
    createAbilityChoiceContract,
    createAbilityOpportunity,
    type AbilityDef,
} from '../../../engine/primitives/ability';
import { createTimingPoint, type Opportunity } from '../../../engine/TimingOpportunity';
import type { MatchState, ValidationResult } from '../../../engine/types';
import {
    getMageWarsMageAbilityFromConfig,
    getMageWarsSpellCardFromConfig,
    getMageWarsStatusTokenFromConfig,
    requireMageWarsStatusTokenFromConfig,
    type MageWarsConfigMageAbility,
} from '../data/configPackage';
import { MAGE_WARS_COMMANDS, type MageWarsUseMageAbilityCommand } from './commands';
import {
    MAGE_WARS_GAME_ID,
    MAGE_WARS_MAGE_ABILITY_IDS,
    STATUS_TOKEN_IDS,
    type MageWarsMageAbilityId,
    type StatusTokenId,
} from './ids';
import {
    getMageWarsZoneDistance,
    hasMageWarsStunStatus,
    parseMageWarsRange,
} from './spellRules';
import { getStatusTokenAmount } from './statusTokens';
import type {
    MageWarsArenaObjectState,
    MageWarsCore,
    MageWarsPhase,
    MageWarsPlayerState,
} from './types';
import { getArenaObject } from './utils';

type MageWarsMageAbilityTrigger = 'mage-ability:activation';

interface MageWarsMageAbilityEffect {
    kind: 'status-removal';
    statusTokenScope: MageWarsConfigMageAbility['statusTokenScope'];
}

type MageWarsMageAbilityDef = AbilityDef<MageWarsMageAbilityEffect, MageWarsMageAbilityTrigger> & {
    id: MageWarsMageAbilityId;
    trigger: MageWarsMageAbilityTrigger;
    meta: {
        mageId: MageWarsPlayerState['mageId'];
        actionSpeed: MageWarsConfigMageAbility['actionSpeed'];
        range: string;
        targetRule: string;
        statusTokenScope: MageWarsConfigMageAbility['statusTokenScope'];
    };
};

export interface MageWarsMageAbilityActivationChoiceValue {
    action: 'activate-mage-ability';
    playerId: string;
    abilityId: MageWarsMageAbilityId;
    manaCost: number;
    targetObjectId: string;
    statusTokenIds: StatusTokenId[];
}

export const MAGE_WARS_MAGE_ABILITY_STATUS_TOKEN_PRIORITY: readonly StatusTokenId[] = [
    STATUS_TOKEN_IDS.BURN,
    STATUS_TOKEN_IDS.DAZE,
    STATUS_TOKEN_IDS.ROT,
    STATUS_TOKEN_IDS.WEAK,
    STATUS_TOKEN_IDS.CRIPPLE,
    STATUS_TOKEN_IDS.STUN,
    STATUS_TOKEN_IDS.SLEEP,
];

const MAGE_WARS_QUICKCAST_PHASES: readonly MageWarsPhase[] = ['initiativeQuickcast', 'finalQuickcast'];
const MAGE_WARS_CAST_PHASES: readonly MageWarsPhase[] = ['deployment', 'initiativeQuickcast', 'creatureAction', 'finalQuickcast'];

function invalid(error: string): ValidationResult {
    return { valid: false, error };
}

function buildMageAbilityDef(ability: MageWarsConfigMageAbility): MageWarsMageAbilityDef {
    return {
        id: ability.abilityId,
        name: ability.name,
        description: ability.rulesSource,
        trigger: 'mage-ability:activation',
        effects: [{
            kind: 'status-removal',
            statusTokenScope: ability.statusTokenScope,
        }],
        meta: {
            mageId: ability.mageId,
            actionSpeed: ability.actionSpeed,
            range: ability.range,
            targetRule: ability.targetRule,
            statusTokenScope: ability.statusTokenScope,
        },
    };
}

export function resolveMageWarsPriestessRestoreAbilityIdForPhase(
    phase: string,
): MageWarsMageAbilityId | undefined {
    if (phase === 'initiativeQuickcast' || phase === 'finalQuickcast') {
        return MAGE_WARS_MAGE_ABILITY_IDS.PRIESTESS_RESTORE_QUICK;
    }
    if (phase === 'creatureAction') {
        return MAGE_WARS_MAGE_ABILITY_IDS.PRIESTESS_RESTORE_STANDARD;
    }
    return undefined;
}

export function resolveMageWarsMageAbilityActionTrack(
    phase: MageWarsPhase,
    ability: MageWarsConfigMageAbility,
): 'quickcast' | 'action' | undefined {
    if (MAGE_WARS_QUICKCAST_PHASES.includes(phase)) {
        return ability.actionSpeed === 'quick' ? 'quickcast' : undefined;
    }
    if (phase === 'creatureAction') {
        return 'action';
    }
    return undefined;
}

export function resolveMageWarsStatusRemovalCost(
    targetObject: MageWarsArenaObjectState,
    statusTokenIds: readonly StatusTokenId[],
): { manaCost: number } | { error: string } {
    let manaCost = 0;
    for (const statusTokenId of statusTokenIds) {
        const currentAmount = getStatusTokenAmount(targetObject, statusTokenId);
        if (currentAmount <= 0) {
            return { error: 'targetMissingStatusToken' };
        }

        const statusToken = requireMageWarsStatusTokenFromConfig(statusTokenId);
        if (statusToken.removalCostRule === 'none') {
            return { error: 'statusTokenCannotBeRemoved' };
        }
        if (statusToken.removalCostRule === 'target-creature-level') {
            const sourceSpell = getMageWarsSpellCardFromConfig(targetObject.sourceSpellCardId);
            if (typeof sourceSpell?.level !== 'number') {
                return { error: 'missingTargetCreatureLevel' };
            }
            manaCost += currentAmount * sourceSpell.level;
            continue;
        }
        if (statusToken.removalCostRule !== 'fixed' || statusToken.removalCost === undefined) {
            return { error: 'unsupportedStatusRemovalCostRule' };
        }

        manaCost += currentAmount * statusToken.removalCost;
    }
    return { manaCost };
}

function resolveRemovableStatusTokenIds(targetObject: MageWarsArenaObjectState): StatusTokenId[] {
    return MAGE_WARS_MAGE_ABILITY_STATUS_TOKEN_PRIORITY.filter((statusTokenId) => (
        getStatusTokenAmount(targetObject, statusTokenId) > 0
        && !('error' in resolveMageWarsStatusRemovalCost(targetObject, [statusTokenId]))
    ));
}

function buildStatusTokenSelections(
    ability: MageWarsConfigMageAbility,
    targetObject: MageWarsArenaObjectState,
): StatusTokenId[][] {
    const removableStatusTokenIds = resolveRemovableStatusTokenIds(targetObject);
    if (ability.statusTokenScope === 'single-status-type') {
        return removableStatusTokenIds.map((statusTokenId) => [statusTokenId]);
    }

    const selections: StatusTokenId[][] = [];
    const selectionCount = 2 ** removableStatusTokenIds.length;
    for (let mask = 1; mask < selectionCount; mask += 1) {
        selections.push(removableStatusTokenIds.filter((_, index) => (mask & (1 << index)) !== 0));
    }
    return selections.sort((left, right) => (
        right.length - left.length
        || left.join('+').localeCompare(right.join('+'))
    ));
}

function createMageWarsMageAbilityCommand(args: {
    playerId: string;
    abilityId: MageWarsMageAbilityId;
    manaCost: number;
    targetObjectId?: string;
    statusTokenIds: StatusTokenId[];
    timestamp?: number;
}): MageWarsUseMageAbilityCommand {
    return {
        type: MAGE_WARS_COMMANDS.USE_MAGE_ABILITY,
        playerId: args.playerId,
        payload: {
            abilityId: args.abilityId,
            manaCost: args.manaCost,
            ...(args.targetObjectId ? { targetObjectId: args.targetObjectId } : {}),
            statusTokenIds: [...args.statusTokenIds],
        },
        ...(typeof args.timestamp === 'number' ? { timestamp: args.timestamp } : {}),
    };
}

export function validateMageWarsMageAbilityStatusRemoval(
    state: MatchState<MageWarsCore>,
    player: MageWarsPlayerState,
    command: MageWarsUseMageAbilityCommand,
    phase: MageWarsPhase,
): ValidationResult {
    if (!MAGE_WARS_CAST_PHASES.includes(phase)) return invalid('wrongPhase');
    if (!Number.isInteger(command.payload.manaCost) || command.payload.manaCost < 0) {
        return invalid('invalidManaCost');
    }

    const ability = getMageWarsMageAbilityFromConfig(player.mageId, command.payload.abilityId);
    if (!ability) return invalid('unknownMageAbility');

    const actionTrack = resolveMageWarsMageAbilityActionTrack(phase, ability);
    if (!actionTrack) return invalid(MAGE_WARS_QUICKCAST_PHASES.includes(phase) ? 'abilityNotQuick' : 'wrongPhase');
    if (actionTrack === 'quickcast' && !player.quickcastReady) return invalid('quickcastSpent');
    if (actionTrack === 'action' && !player.actionReady) return invalid('actionSpent');
    if (hasMageWarsStunStatus(player)) return invalid('playerStunned');

    if (command.payload.targetPlayerId || !command.payload.targetObjectId) return invalid('invalidTargetMode');
    const targetObject = getArenaObject(state.core, command.payload.targetObjectId);
    if (!targetObject || targetObject.kind !== 'creature') return invalid('invalidTargetObject');

    const range = parseMageWarsRange(ability.range);
    const distance = getMageWarsZoneDistance(state.core, player.mageZoneId, targetObject.zoneId);
    if (!range || distance === undefined || distance < range.min || distance > range.max) {
        return invalid('targetOutOfRange');
    }

    const statusTokenIds = command.payload.statusTokenIds;
    if (!Array.isArray(statusTokenIds) || statusTokenIds.length === 0) {
        return invalid('missingStatusToken');
    }
    if (new Set(statusTokenIds).size !== statusTokenIds.length) {
        return invalid('duplicateStatusToken');
    }
    if (ability.statusTokenScope === 'single-status-type' && statusTokenIds.length !== 1) {
        return invalid('tooManyStatusTokenTypes');
    }

    const costResolution = resolveMageWarsStatusRemovalCost(targetObject, statusTokenIds);
    if ('error' in costResolution) return invalid(costResolution.error);
    if (command.payload.manaCost !== costResolution.manaCost) return invalid('manaCostMismatch');
    if (player.mana < costResolution.manaCost) return invalid('insufficientMana');

    return { valid: true };
}

function buildMageWarsMageAbilityTiming(args: {
    state: MatchState<MageWarsCore>;
    player: MageWarsPlayerState;
    ability: MageWarsConfigMageAbility;
    timestamp?: number;
}) {
    const phase = args.state.sys.phase as MageWarsPhase;
    const command = createMageWarsMageAbilityCommand({
        playerId: args.player.id,
        abilityId: args.ability.abilityId,
        manaCost: 0,
        statusTokenIds: [],
        timestamp: args.timestamp,
    });

    return createTimingPoint<MageWarsUseMageAbilityCommand>({
        gameId: MAGE_WARS_GAME_ID,
        position: 'before',
        factKind: 'command',
        command,
        source: {
            kind: 'ability',
            id: args.player.id,
            ownerId: args.player.id,
            controllerId: args.player.id,
            zoneId: args.player.mageZoneId,
            metadata: {
                mageId: args.player.mageId,
                abilityId: args.ability.abilityId,
            },
        },
        controllerId: args.player.id,
        timestamp: args.timestamp,
        metadata: {
            phase,
            playerId: args.player.id,
            mageId: args.player.mageId,
            abilityId: args.ability.abilityId,
            statusTokenScope: args.ability.statusTokenScope,
            targetMode: 'creature-status-removal',
        },
    });
}

function formatStatusTokenSelection(statusTokenIds: readonly StatusTokenId[]): string {
    return statusTokenIds
        .map((statusTokenId) => getMageWarsStatusTokenFromConfig(statusTokenId)?.name ?? statusTokenId)
        .join(' + ');
}

function buildDisabledMageAbilityCandidate(args: {
    state: MatchState<MageWarsCore>;
    player: MageWarsPlayerState;
    ability: MageWarsConfigMageAbility;
    targetObject: MageWarsArenaObjectState;
    phase: MageWarsPhase;
    timestamp?: number;
}) {
    const command = createMageWarsMageAbilityCommand({
        playerId: args.player.id,
        abilityId: args.ability.abilityId,
        manaCost: 0,
        targetObjectId: args.targetObject.id,
        statusTokenIds: [],
        timestamp: args.timestamp,
    });
    const validation = validateMageWarsMageAbilityStatusRemoval(
        args.state,
        args.player,
        command,
        args.phase,
    );

    return {
        id: `target:${args.targetObject.id}`,
        label: args.targetObject.name,
        value: {
            action: 'activate-mage-ability' as const,
            playerId: args.player.id,
            abilityId: args.ability.abilityId,
            manaCost: 0,
            targetObjectId: args.targetObject.id,
            statusTokenIds: [],
        },
        displayMode: 'card' as const,
        commands: [{
            type: MAGE_WARS_COMMANDS.USE_MAGE_ABILITY,
            payload: command.payload,
        }],
        metadata: {
            targetObjectId: args.targetObject.id,
            targetOwnerId: args.targetObject.ownerId,
            targetZoneId: args.targetObject.zoneId,
        },
        disabled: true,
        disabledReason: validation.valid ? 'missingStatusToken' : validation.error ?? 'invalidMageAbility',
    };
}

function buildMageWarsMageAbilityActivationCandidates(args: {
    state: MatchState<MageWarsCore>;
    player: MageWarsPlayerState;
    ability: MageWarsConfigMageAbility;
    phase: MageWarsPhase;
    timestamp?: number;
}) {
    const candidates = Object.values(args.state.core.objects)
        .sort((left, right) => left.id.localeCompare(right.id))
        .flatMap((targetObject) => {
            const selections = buildStatusTokenSelections(args.ability, targetObject);
            if (selections.length === 0) {
                return [buildDisabledMageAbilityCandidate({
                    state: args.state,
                    player: args.player,
                    ability: args.ability,
                    targetObject,
                    phase: args.phase,
                    timestamp: args.timestamp,
                })];
            }

            return selections.map((statusTokenIds) => {
                const costResolution = resolveMageWarsStatusRemovalCost(targetObject, statusTokenIds);
                const manaCost = 'error' in costResolution ? 0 : costResolution.manaCost;
                const command = createMageWarsMageAbilityCommand({
                    playerId: args.player.id,
                    abilityId: args.ability.abilityId,
                    manaCost,
                    targetObjectId: targetObject.id,
                    statusTokenIds,
                    timestamp: args.timestamp,
                });
                const validation = validateMageWarsMageAbilityStatusRemoval(args.state, args.player, command, args.phase);
                const statusPart = statusTokenIds.join('+') || 'none';
                const statusLabel = formatStatusTokenSelection(statusTokenIds);
                return {
                    id: `target:${targetObject.id}:status:${statusPart}`,
                    label: statusLabel ? `${targetObject.name} / ${statusLabel}` : targetObject.name,
                    value: {
                        action: 'activate-mage-ability' as const,
                        playerId: args.player.id,
                        abilityId: args.ability.abilityId,
                        manaCost,
                        targetObjectId: targetObject.id,
                        statusTokenIds: [...statusTokenIds],
                    },
                    displayMode: 'card' as const,
                    commands: [{
                        type: MAGE_WARS_COMMANDS.USE_MAGE_ABILITY,
                        payload: command.payload,
                    }],
                    metadata: {
                        targetObjectId: targetObject.id,
                        targetOwnerId: targetObject.ownerId,
                        targetZoneId: targetObject.zoneId,
                        statusTokenIds: [...statusTokenIds],
                    },
                    actionKind: 'mage-wars-mage-ability-status-removal',
                    actionKeyParts: [
                        'ability',
                        'activation',
                        args.player.id,
                        args.ability.abilityId,
                        'target',
                        targetObject.id,
                        'status',
                        ...statusTokenIds,
                    ],
                    ...(validation.valid
                        ? {}
                        : {
                            disabled: true,
                            disabledReason: validation.error ?? 'invalidMageAbility',
                        }),
                };
            });
        });
    const firstDisabledReason = candidates.find((candidate) => candidate.disabled)?.disabledReason;
    return {
        candidates,
        condition: candidates.some((candidate) => candidate.disabled !== true)
            ? { satisfied: true }
            : { satisfied: false, reason: firstDisabledReason ?? 'missingTarget' },
        aiPolicyId: 'choice-request:simple-target',
    };
}

export function buildMageWarsMageAbilityActivationOpportunity(args: {
    state: MatchState<MageWarsCore>;
    playerId: string;
    abilityId: MageWarsMageAbilityId;
    timestamp?: number;
}): Opportunity<MageWarsMageAbilityActivationChoiceValue> | null {
    const player = args.state.core.players[args.playerId];
    if (!player) return null;
    const ability = getMageWarsMageAbilityFromConfig(player.mageId, args.abilityId);
    if (!ability) return null;

    const phase = args.state.sys.phase as MageWarsPhase;
    const abilityDef = buildMageAbilityDef(ability);
    const lifecycle = {
        sourceId: player.id,
        sourceKind: 'ability' as const,
        controllerId: player.id,
        ownerId: player.id,
        phase: 'activation' as const,
        trigger: abilityDef.trigger,
        metadata: {
            mageId: player.mageId,
            abilityId: ability.abilityId,
            playerId: player.id,
        },
    };
    const timing = buildMageWarsMageAbilityTiming({
        state: args.state,
        player,
        ability,
        timestamp: args.timestamp,
    });
    const targetRequest = {
        kind: 'select-object' as const,
        min: 1,
        max: 1,
        description: ability.name,
        metadata: {
            targetMode: 'creature-status-removal',
            statusTokenScope: ability.statusTokenScope,
        },
    };
    const candidateContract = buildMageWarsMageAbilityActivationCandidates({
        state: args.state,
        player,
        ability,
        phase,
        timestamp: args.timestamp,
    });

    return createAbilityOpportunity({
        def: abilityDef,
        timing,
        lifecycle,
        condition: candidateContract.condition,
        targetRequest,
        resolution: { type: 'choice-request' },
        choice: createAbilityChoiceContract<MageWarsMageAbilityEffect, MageWarsMageAbilityTrigger, MageWarsMageAbilityActivationChoiceValue>({
            def: abilityDef,
            lifecycle,
            targetRequest,
            candidates: candidateContract.candidates,
            selection: { min: 1, max: 1 },
            skipPolicy: 'forbidden',
            resolution: { type: 'candidate-commands' },
            ai: { status: 'shared-policy', policyId: candidateContract.aiPolicyId },
            metadata: {
                phase,
                playerId: player.id,
                mageId: player.mageId,
                abilityId: ability.abilityId,
                targetMode: 'creature-status-removal',
                statusTokenScope: ability.statusTokenScope,
            },
        }),
        metadata: {
            phase,
            playerId: player.id,
            mageId: player.mageId,
            abilityId: ability.abilityId,
            targetMode: 'creature-status-removal',
            statusTokenScope: ability.statusTokenScope,
        },
    });
}
