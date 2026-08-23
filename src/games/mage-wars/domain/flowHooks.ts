import type { FlowHooks } from '../../../engine/systems/FlowSystem';
import type { RandomFn } from '../../../engine/types';
import { MAGE_WARS_EVENTS } from './events';
import { MAGE_WARS_OBJECT_ABILITY_IDS, STATUS_TOKEN_IDS, type StatusTokenId } from './ids';
import type { MageWarsCore, MageWarsEvent, MageWarsPhase } from './types';
import {
    isMageWarsLivingArenaObject,
    resolveMageWarsAttachedVisibleEnchantmentUpkeepDirectDamage,
    resolveMageWarsAttachedVisibleEnchantmentUpkeepHealTransfers,
    resolveMageWarsAttachedVisibleEnchantmentUpkeepManaCosts,
    resolveMageWarsObjectRegeneration,
} from './spellRules';
import { MAGE_WARS_PHASE_ORDER } from './types';
import { getCreatureObjectIdsForOwner, getOpponentId } from './utils';
import { getStatusTokenAmount } from './statusTokens';
import {
    getTemporaryChargeDiceModifier,
    getTemporaryMeleeDiceModifier,
    getTemporaryNextMeleePierceModifier,
    getTemporaryTraitIdsForTurnCleanup,
    hasTemporarySwift,
    hasTemporarySwiftFreeMoveUsed,
    hasTemporaryTeleportMovement,
    hasTemporaryVampiricNextMelee,
} from './temporaryTraits';

const PRINTED_SWIFT_TRAIT_SOURCE_ID = 'mw.trait.swift.printed';
const POST_MOVE_QUICK_ACTION_SOURCE_ID = 'mw.move.quick-action-window';
const CHARGE_ON_SPELL_SOURCE_ID = 'mw.spell.3407';
const BLOODSTRIKE_SPELL_SOURCE_ID = 'mw.spell.3404';
const CALL_OF_THE_WILD_SPELL_SOURCE_ID = 'mw.spell.3417';

const SIMULTANEOUS_PREPARATION_PHASES = new Set<MageWarsPhase>([
    'reset',
    'channel',
    'upkeep',
    'planning',
]);

const SEQUENTIAL_PHASES = new Set<MageWarsPhase>([
    'deployment',
    'initiativeQuickcast',
    'creatureAction',
    'finalQuickcast',
]);

function resolveNextPhase(from: string): MageWarsPhase {
    const currentIndex = MAGE_WARS_PHASE_ORDER.indexOf(from as MageWarsPhase);
    if (currentIndex < 0) return MAGE_WARS_PHASE_ORDER[0];
    return MAGE_WARS_PHASE_ORDER[(currentIndex + 1) % MAGE_WARS_PHASE_ORDER.length];
}

function resolveNextPlayer(core: MageWarsCore): { playerId: string; turnNumber: number } {
    const currentIndex = core.playerOrder.indexOf(core.currentPlayerId);
    const nextIndex = currentIndex < 0 ? 0 : (currentIndex + 1) % core.playerOrder.length;
    return {
        playerId: core.playerOrder[nextIndex] ?? core.currentPlayerId,
        turnNumber: nextIndex === 0 ? core.turnNumber + 1 : core.turnNumber,
    };
}

function resolvePhaseActorId(core: MageWarsCore): string {
    return core.phaseActorId ?? core.currentPlayerId;
}

function resolveEnteredPhaseActorId(
    core: MageWarsCore,
    exitEvents?: readonly { type: string; payload?: unknown }[],
): string {
    const turnAdvanced = exitEvents?.find((event): event is {
        type: typeof MAGE_WARS_EVENTS.TURN_ADVANCED;
        payload: { toPlayerId: string };
    } => {
        const payload = event.payload as { toPlayerId?: unknown } | undefined;
        return event.type === MAGE_WARS_EVENTS.TURN_ADVANCED && typeof payload?.toPlayerId === 'string';
    });

    return turnAdvanced?.payload.toPlayerId ?? core.phaseActorId ?? core.currentPlayerId;
}

function resolveReadyPlayerIds(core: MageWarsCore, playerId: string): string[] {
    const ready = core.phaseReadyPlayerIds ?? [];
    return ready.includes(playerId) ? ready : [...ready, playerId];
}

function allPlayersReady(core: MageWarsCore, readyPlayerIds: string[]): boolean {
    return core.playerOrder.every((playerId) => readyPlayerIds.includes(playerId));
}

function updatePhaseControl(
    state: Parameters<NonNullable<FlowHooks<MageWarsCore>['onPhaseExit']>>[0]['state'],
    patch: Partial<MageWarsCore>,
): typeof state {
    return {
        ...state,
        core: {
            ...state.core,
            ...patch,
        },
    };
}

function createUpkeepRegenerationEvents(
    core: MageWarsCore,
    sourceCommandType: string,
    timestamp: number,
): MageWarsEvent[] {
    return Object.values(core.objects).flatMap((object) => {
        const regeneration = resolveMageWarsObjectRegeneration(core, object);
        if (regeneration.value <= 0 || object.damage <= 0) return [];

        return [{
            type: MAGE_WARS_EVENTS.ARENA_OBJECT_REGENERATED,
            payload: {
                ownerId: object.ownerId,
                objectId: object.id,
                regeneration: regeneration.value,
                actualHealing: Math.min(object.damage, regeneration.value),
                sourceObjectIds: regeneration.sourceObjectIds,
            },
            sourceCommandType,
            timestamp,
        }];
    });
}

function createObjectManaChannelEvents(
    core: MageWarsCore,
    sourceCommandType: string,
    timestamp: number,
): MageWarsEvent[] {
    return Object.values(core.objects)
        .filter((object) => object.ownerId === core.currentPlayerId && (object.spellcastingSource?.channeling ?? 0) > 0)
        .map((object): MageWarsEvent => ({
            type: MAGE_WARS_EVENTS.OBJECT_MANA_CHANNELED,
            payload: {
                ownerId: object.ownerId,
                objectId: object.id,
                amount: object.spellcastingSource?.channeling ?? 0,
            },
            sourceCommandType,
            timestamp,
        }));
}

function createObjectSpellReturnEvents(
    core: MageWarsCore,
    sourceCommandType: string,
    timestamp: number,
): MageWarsEvent[] {
    return Object.values(core.objects)
        .filter((object) => object.preparedSpellCardId !== undefined)
        .map((object): MageWarsEvent => ({
            type: MAGE_WARS_EVENTS.OBJECT_SPELL_RETURNED,
            payload: {
                ownerId: object.ownerId,
                objectId: object.id,
                spellCardId: object.preparedSpellCardId!,
                reason: 'turn-expired',
            },
            sourceCommandType,
            timestamp,
        }));
}

function createUpkeepRotDamageAvailableEvents(
    core: MageWarsCore,
    sourceCommandType: string,
    timestamp: number,
): MageWarsEvent[] {
    const events: MageWarsEvent[] = [];

    for (const player of Object.values(core.players)) {
        const rotAmount = getStatusTokenAmount(player, STATUS_TOKEN_IDS.ROT);
        if (rotAmount <= 0) continue;
        events.push({
            type: MAGE_WARS_EVENTS.UPKEEP_ROT_DAMAGE_AVAILABLE,
            payload: {
                targetPlayerId: player.id,
                sourcePlayerId: player.id,
                amount: rotAmount,
            },
            sourceCommandType,
            timestamp,
        });
    }

    for (const object of Object.values(core.objects)) {
        const rotAmount = getStatusTokenAmount(object, STATUS_TOKEN_IDS.ROT);
        if (rotAmount <= 0 || !isMageWarsLivingArenaObject(object)) continue;
        events.push({
            type: MAGE_WARS_EVENTS.UPKEEP_ROT_DAMAGE_AVAILABLE,
            payload: {
                targetObjectId: object.id,
                sourcePlayerId: object.ownerId,
                amount: rotAmount,
            },
            sourceCommandType,
            timestamp,
        });
    }

    return events;
}

function createUpkeepEnchantmentDirectDamageAvailableEvents(
    core: MageWarsCore,
    sourceCommandType: string,
    timestamp: number,
): MageWarsEvent[] {
    const events: MageWarsEvent[] = [];

    for (const object of Object.values(core.objects)) {
        if (!isMageWarsLivingArenaObject(object)) continue;

        for (const source of resolveMageWarsAttachedVisibleEnchantmentUpkeepDirectDamage(core, object)) {
            events.push({
                type: MAGE_WARS_EVENTS.UPKEEP_ENCHANTMENT_DIRECT_DAMAGE_AVAILABLE,
                payload: {
                    sourceObjectId: source.sourceObjectId,
                    sourceSpellCardId: source.sourceSpellCardId,
                    sourcePlayerId: source.ownerId,
                    targetObjectId: object.id,
                    amount: source.effect.amount,
                    damageType: source.effect.damageType,
                },
                sourceCommandType,
                timestamp,
            });
        }
    }

    return events;
}

function createUpkeepEnchantmentCostEvents(
    core: MageWarsCore,
    sourceCommandType: string,
    timestamp: number,
): MageWarsEvent[] {
    return Object.values(core.objects).flatMap((object) => {
        if (object.kind !== 'creature') return [];

        return resolveMageWarsAttachedVisibleEnchantmentUpkeepManaCosts(core, object)
            .map((source): MageWarsEvent => ({
                type: MAGE_WARS_EVENTS.UPKEEP_COST_AVAILABLE,
                payload: {
                    playerId: object.ownerId,
                    sourceObjectId: source.sourceObjectId,
                    sourceSpellCardId: source.sourceSpellCardId,
                    targetObjectId: object.id,
                    amount: source.amount,
                },
                sourceCommandType,
                timestamp,
            }));
    });
}

function createUpkeepEnchantmentHealTransferEvents(
    core: MageWarsCore,
    sourceCommandType: string,
    timestamp: number,
): MageWarsEvent[] {
    return Object.values(core.objects).flatMap((object) => {
        if (!isMageWarsLivingArenaObject(object)) return [];

        return resolveMageWarsAttachedVisibleEnchantmentUpkeepHealTransfers(core, object)
            .flatMap((source): MageWarsEvent[] => {
                const player = core.players[source.playerId];
                const availableHealing = Math.min(source.maxHealing, player?.damage ?? 0);
                if (availableHealing <= 0) return [];
                return [{
                    type: MAGE_WARS_EVENTS.UPKEEP_HEAL_TRANSFER_AVAILABLE,
                    payload: {
                        playerId: source.playerId,
                        sourceObjectId: source.sourceObjectId,
                        sourceSpellCardId: source.sourceSpellCardId,
                        targetObjectId: object.id,
                        maxHealing: source.maxHealing,
                        availableHealing,
                    },
                    sourceCommandType,
                    timestamp,
                }];
            });
    });
}

function createUpkeepBurnRollAvailableEvents(
    core: MageWarsCore,
    sourceCommandType: string,
    timestamp: number,
    random: RandomFn,
): MageWarsEvent[] {
    const events: MageWarsEvent[] = [];

    for (const player of Object.values(core.players)) {
        const burnAmount = getStatusTokenAmount(player, STATUS_TOKEN_IDS.BURN);
        if (burnAmount <= 0) continue;
        events.push({
            type: MAGE_WARS_EVENTS.UPKEEP_BURN_ROLL_AVAILABLE,
            payload: {
                targetPlayerId: player.id,
                sourcePlayerId: player.id,
                burnRolls: Array.from({ length: burnAmount }, () => random.range(0, 2)),
            },
            sourceCommandType,
            timestamp,
        });
    }

    for (const object of Object.values(core.objects)) {
        const burnAmount = getStatusTokenAmount(object, STATUS_TOKEN_IDS.BURN);
        if (burnAmount <= 0) continue;
        events.push({
            type: MAGE_WARS_EVENTS.UPKEEP_BURN_ROLL_AVAILABLE,
            payload: {
                targetObjectId: object.id,
                sourcePlayerId: object.ownerId,
                burnRolls: Array.from({ length: burnAmount }, () => random.range(0, 2)),
            },
            sourceCommandType,
            timestamp,
        });
    }

    return events;
}

function createCreatureActionStatusRemovalAvailableEvents(
    core: MageWarsCore,
    statusTokenId: StatusTokenId,
    sourceAbilityId: string,
    sourceCommandType: string,
    timestamp: number,
): MageWarsEvent[] {
    const player = core.players[core.currentPlayerId];
    const events: MageWarsEvent[] = [];
    const playerStatusAmount = player ? getStatusTokenAmount(player, statusTokenId) : 0;
    if (player && playerStatusAmount > 0) {
        events.push({
            type: MAGE_WARS_EVENTS.STATUS_TOKEN_REMOVAL_AVAILABLE,
            payload: {
                targetPlayerId: player.id,
                statusTokenId,
                amount: playerStatusAmount,
                sourceAbilityId,
            },
            sourceCommandType,
            timestamp,
        });
    }

    for (const objectId of getCreatureObjectIdsForOwner(core, core.currentPlayerId)) {
        const object = core.objects[objectId];
        const objectStatusAmount = object ? getStatusTokenAmount(object, statusTokenId) : 0;
        if (!object || objectStatusAmount <= 0) continue;
        events.push({
            type: MAGE_WARS_EVENTS.STATUS_TOKEN_REMOVAL_AVAILABLE,
            payload: {
                targetObjectId: object.id,
                statusTokenId,
                amount: objectStatusAmount,
                sourceAbilityId,
            },
            sourceCommandType,
            timestamp,
        });
    }
    return events;
}

function createCreatureActionCrippleEscapeAvailableEvents(
    core: MageWarsCore,
    sourceCommandType: string,
    timestamp: number,
    random: RandomFn,
): MageWarsEvent[] {
    const events: MageWarsEvent[] = [];

    for (const objectId of getCreatureObjectIdsForOwner(core, core.currentPlayerId)) {
        const object = core.objects[objectId];
        const crippleAmount = object ? getStatusTokenAmount(object, STATUS_TOKEN_IDS.CRIPPLE) : 0;
        if (!object || crippleAmount <= 0) continue;

        const effectDieResult = random.d(12);
        if (effectDieResult < 7) continue;

        events.push({
            type: MAGE_WARS_EVENTS.STATUS_TOKEN_REMOVAL_AVAILABLE,
            payload: {
                targetObjectId: object.id,
                statusTokenId: STATUS_TOKEN_IDS.CRIPPLE,
                amount: crippleAmount,
                sourceAbilityId: 'mw.status.cripple.escape-check',
                effectDieResult,
            },
            sourceCommandType,
            timestamp,
        });
    }

    return events;
}

function createArenaObjectTemporaryTraitsClearAvailableEvents(
    core: MageWarsCore,
    sourceCommandType: string,
    timestamp: number,
): MageWarsEvent[] {
    return getCreatureObjectIdsForOwner(core, core.currentPlayerId)
        .flatMap((objectId): MageWarsEvent[] => {
            const object = core.objects[objectId];
            if (!object) return [];
            const traitIds = getTemporaryTraitIdsForTurnCleanup(object, core.turnNumber);
            if (traitIds.length === 0) return [];

            const hasTemporarySwiftOrTeleport = hasTemporarySwift(object)
                || hasTemporaryTeleportMovement(object);
            const hasChargeOn = getTemporaryChargeDiceModifier(object) > 0;
            const hasCallOfTheWild = getTemporaryMeleeDiceModifier(object) > 0;
            const hasBloodstrike = hasTemporaryVampiricNextMelee(object)
                || getTemporaryNextMeleePierceModifier(object) > 0;
            const hasPrintedSwiftFreeMove = hasTemporarySwiftFreeMoveUsed(object)
                && !hasTemporarySwiftOrTeleport;
            return [{
                type: MAGE_WARS_EVENTS.ARENA_OBJECT_TEMPORARY_TRAITS_CLEAR_AVAILABLE,
                payload: {
                    ownerId: object.ownerId,
                    objectId: object.id,
                    traitIds,
                    sourceAbilityId: hasChargeOn
                        ? CHARGE_ON_SPELL_SOURCE_ID
                        : hasCallOfTheWild
                            ? CALL_OF_THE_WILD_SPELL_SOURCE_ID
                            : hasBloodstrike
                                ? BLOODSTRIKE_SPELL_SOURCE_ID
                                : hasTemporarySwiftOrTeleport
                                    ? MAGE_WARS_OBJECT_ABILITY_IDS.BLUE_GREMLIN_SWIFT_TELEPORT
                                    : hasPrintedSwiftFreeMove
                                        ? PRINTED_SWIFT_TRAIT_SOURCE_ID
                                        : POST_MOVE_QUICK_ACTION_SOURCE_ID,
                },
                sourceCommandType,
                timestamp,
            }];
        });
}

export const mageWarsFlowHooks: FlowHooks<MageWarsCore> = {
    initialPhase: MAGE_WARS_PHASE_ORDER[0],

    canAdvance: ({ state, from, command }) => {
        if (state.core.gameResult || state.sys.gameover) return { ok: false, error: 'gameOver' };

        const phase = from as MageWarsPhase;
        const ready = state.core.phaseReadyPlayerIds ?? [];
        if (ready.includes(command.playerId) && !allPlayersReady(state.core, ready)) {
            return { ok: false, error: 'phaseAlreadyCompleted' };
        }

        if (SEQUENTIAL_PHASES.has(phase) && command.playerId !== resolvePhaseActorId(state.core)) {
            return { ok: false, error: 'notActivePhasePlayer' };
        }

        return { ok: true };
    },

    getNextPhase: ({ from }) => resolveNextPhase(from),

    onPhaseExit: ({ state, from, command, random }) => {
        const phase = from as MageWarsPhase;
        if (SIMULTANEOUS_PREPARATION_PHASES.has(phase)) {
            const ready = resolveReadyPlayerIds(state.core, command.playerId);
            if (!allPlayersReady(state.core, ready)) {
                return {
                    halt: true,
                    updatedState: updatePhaseControl(state, {
                    phaseReadyPlayerIds: ready,
                    }),
                };
            }

            return {
                updatedState: updatePhaseControl(state, {
                    phaseReadyPlayerIds: [],
                    phaseActorId: state.core.currentPlayerId,
                }),
            };
        }

        if (phase === 'creatureAction') {
            const ready = resolveReadyPlayerIds(state.core, command.playerId);
            const timestamp = command.timestamp ?? 0;
            const actionEndEvents = [
                ...createCreatureActionStatusRemovalAvailableEvents(
                    state.core,
                    STATUS_TOKEN_IDS.DAZE,
                    'mw.status.daze.end-creature-action',
                    command.type,
                    timestamp,
                ),
                ...createCreatureActionStatusRemovalAvailableEvents(
                    state.core,
                    STATUS_TOKEN_IDS.STUN,
                    'mw.status.stun.end-creature-action',
                    command.type,
                    timestamp,
                ),
                ...createCreatureActionCrippleEscapeAvailableEvents(state.core, command.type, timestamp, random),
                ...createArenaObjectTemporaryTraitsClearAvailableEvents(state.core, command.type, timestamp),
            ];
            if (!allPlayersReady(state.core, ready)) {
                return {
                    halt: true,
                    updatedState: updatePhaseControl(state, {
                        phaseReadyPlayerIds: ready,
                        phaseActorId: getOpponentId(state.core, command.playerId),
                    }),
                    events: actionEndEvents,
                };
            }

            return {
                updatedState: updatePhaseControl(state, {
                    phaseReadyPlayerIds: [],
                    phaseActorId: state.core.currentPlayerId,
                }),
                events: actionEndEvents,
            };
        }

        if (phase === 'deployment' || phase === 'initiativeQuickcast') {
            const ready = resolveReadyPlayerIds(state.core, command.playerId);
            if (!allPlayersReady(state.core, ready)) {
                const nextPlayerId = getOpponentId(state.core, command.playerId);
                return {
                    halt: true,
                    updatedState: updatePhaseControl(state, {
                        phaseReadyPlayerIds: ready,
                        phaseActorId: nextPlayerId,
                    }),
                };
            }

            return {
                updatedState: updatePhaseControl(state, {
                    phaseReadyPlayerIds: [],
                    phaseActorId: state.core.currentPlayerId,
                }),
            };
        }

        if (from !== 'finalQuickcast') return;
        const nextPlayer = resolveNextPlayer(state.core);
        return {
            updatedState: updatePhaseControl(state, {
                phaseReadyPlayerIds: [],
                phaseActorId: nextPlayer.playerId,
            }),
            events: [...createObjectSpellReturnEvents(state.core, command.type, command.timestamp ?? 0), {
                type: MAGE_WARS_EVENTS.TURN_ADVANCED,
                payload: {
                    fromPlayerId: state.core.currentPlayerId,
                    toPlayerId: nextPlayer.playerId,
                    turnNumber: nextPlayer.turnNumber,
                },
                sourceCommandType: command.type,
                timestamp: command.timestamp ?? 0,
            }, {
                type: MAGE_WARS_EVENTS.ACTION_READINESS_RESET,
                payload: {
                    playerId: nextPlayer.playerId,
                    objectIds: getCreatureObjectIdsForOwner(state.core, nextPlayer.playerId),
                },
                sourceCommandType: command.type,
                timestamp: command.timestamp ?? 0,
            }],
        };
    },

    onPhaseEnter: ({ state, to, command, random, exitEvents }) => {
        const timestamp = command.timestamp ?? 0;
        const phaseActorId = resolveEnteredPhaseActorId(state.core, exitEvents);
        if (to === 'upkeep') {
            return {
                updatedState: updatePhaseControl(state, {
                    phaseReadyPlayerIds: [],
                    phaseActorId,
                }),
                events: [
                    ...createUpkeepRegenerationEvents(state.core, command.type, timestamp),
                    ...createUpkeepRotDamageAvailableEvents(state.core, command.type, timestamp),
                    ...createUpkeepEnchantmentDirectDamageAvailableEvents(state.core, command.type, timestamp),
                    ...createUpkeepEnchantmentCostEvents(state.core, command.type, timestamp),
                    ...createUpkeepEnchantmentHealTransferEvents(state.core, command.type, timestamp),
                    ...createUpkeepBurnRollAvailableEvents(state.core, command.type, timestamp, random),
                ],
            };
        }

        if (to !== 'channel') {
            if (MAGE_WARS_PHASE_ORDER.includes(to as MageWarsPhase)) {
                return {
                    updatedState: updatePhaseControl(state, {
                        phaseReadyPlayerIds: [],
                        phaseActorId,
                    }),
                };
            }
            return;
        }
        const player = state.core.players[state.core.currentPlayerId];
        return {
            updatedState: updatePhaseControl(state, {
                phaseReadyPlayerIds: [],
                phaseActorId,
            }),
            events: player ? [{
                type: MAGE_WARS_EVENTS.MANA_CHANNELED,
                payload: {
                    playerId: player.id,
                    amount: player.channeling,
                },
                sourceCommandType: command.type,
                timestamp,
            }, ...createObjectManaChannelEvents(state.core, command.type, timestamp)] : [],
        };
    },

    onAutoContinueCheck: ({ state }) => {
        if (state.sys.phase !== 'planning') return;
        const ready = state.core.phaseReadyPlayerIds ?? [];
        if (!allPlayersReady(state.core, ready)) return;
        return { autoContinue: true, playerId: state.core.currentPlayerId };
    },

    getActivePlayerId: ({ state, from, to }) => {
        if (from === 'finalQuickcast' && to === 'reset') {
            return resolveNextPlayer(state.core).playerId;
        }
        return resolvePhaseActorId(state.core);
    },
};

export default mageWarsFlowHooks;
