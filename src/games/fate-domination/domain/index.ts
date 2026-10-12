import type { DomainCore, GameOverResult, MatchState, PlayerId, RandomFn } from '../../../engine/types';
import { createInitialFateDominationCore } from './setup';
import { validate } from './commands';
import { execute, reduce } from './reducer';
import type { FateDominationCommand, FateDominationCore, FateDominationEvent } from './types';
import { resolveFateMovement } from './movement';
import { resolveFateAbilityDefinition } from './abilityRegistry';
import { canSufferFateDefeat, fateEliminationOutcome, normalizeFateRuleState } from './mechanics';

export const FateDominationDomain: DomainCore<FateDominationCore, FateDominationCommand, FateDominationEvent> = {
    gameId: 'fate-domination',
    setup: (playerIds: PlayerId[], random: RandomFn) => createInitialFateDominationCore(playerIds, random),
    normalizeRuntimeState: (state: MatchState<FateDominationCore>) => {
        const core = state.core;
        const players = Object.fromEntries(Object.entries(core.players ?? {}).map(([playerId, player]) => [playerId, {
            ...player,
            defeatMarkers: Array.isArray(player.defeatMarkers) ? player.defeatMarkers : [],
            eliminationProtectionUsed: player.eliminationProtectionUsed === true,
        }])) as FateDominationCore['players'];
        const normalizedCore: FateDominationCore = {
            ...core,
            players,
            ruleState: normalizeFateRuleState(core.ruleState),
            resolvedLocations: Array.isArray(core.resolvedLocations) ? core.resolvedLocations : [],
            resolvedResults: Array.isArray(core.resolvedResults) ? core.resolvedResults : [],
            eventDeck: Array.isArray(core.eventDeck) ? core.eventDeck : [],
            eventDiscard: Array.isArray(core.eventDiscard) ? core.eventDiscard : [],
        };
        return normalizedCore === core ? state : { ...state, core: normalizedCore };
    },
    validate,
    execute,
    reduce,
    commitEvent: ({ state, event }) => {
        if (event.type === 'FATE_DEFEAT_DECLARED') {
            const verdict = canSufferFateDefeat(
                state.core,
                event.payload.playerId,
                event.payload.sourceId,
                event.payload.direct,
                event.payload.unpreventable,
            );
            if (!verdict.allowed) {
                return {
                    type: 'FATE_DEFEAT_PREVENTED',
                    payload: {
                        playerId: event.payload.playerId,
                        sourceId: event.payload.sourceId,
                        reason: verdict.reason ?? 'defeatPrevented',
                    },
                    sourceCommandType: event.sourceCommandType,
                    timestamp: event.timestamp,
                };
            }
            return event;
        }
        if (event.type === 'FATE_ELIMINATION_REQUESTED') {
            if (fateEliminationOutcome(state.core, event.payload.playerId) === 'prevent') {
                return {
                    type: 'FATE_ELIMINATION_PREVENTED',
                    payload: {
                        playerId: event.payload.playerId,
                        reason: 'first-elimination-protection',
                        penalty: 'lose-all-mana',
                    },
                    sourceCommandType: event.sourceCommandType,
                    timestamp: event.timestamp,
                };
            }
            return {
                type: 'FATE_PLAYER_ELIMINATED',
                payload: {
                    playerId: event.payload.playerId,
                    reason: event.payload.reason,
                    sourceId: event.payload.sourceId,
                },
                sourceCommandType: event.sourceCommandType,
                timestamp: event.timestamp,
            };
        }
        if (event.type !== 'PLAYER_MOVED') return event;
        const resolution = resolveFateMovement(
            state.core,
            event.payload.playerId,
            event.payload.to,
            event.payload.mode,
            event.payload.context,
        );
        if (!resolution.valid || !resolution.path || resolution.cost === null) return null;
        if (resolution.cost === event.payload.manaSpent && resolution.path.join('>') === event.payload.path.join('>')) return event;
        return {
            ...event,
            payload: {
                ...event.payload,
                path: [...resolution.path],
                manaSpent: resolution.cost,
            },
        };
    },
    discoverTimingOpportunities: ({ state, timing }) => {
        if (timing.event?.type === 'FATE_BATTLE_RESOLUTION_STARTED') {
            const event = timing.event;
            return {
                opportunities: [{
                    id: `fate:battle-frame:${event.payload.frameId}`,
                    timing,
                    sourceRef: {
                        kind: 'event',
                        id: event.payload.frameId,
                        ownerId: state.core.currentPlayerId,
                        controllerId: state.core.currentPlayerId,
                    },
                    controllerId: state.core.currentPlayerId,
                    class: 'mandatory',
                    condition: true,
                    resolution: {
                        type: 'child-frame' as const,
                        frameId: event.payload.frameId,
                        frameKind: 'fate:battle-resolution',
                        phase: 'battle',
                        phaseGate: 'block-advance-when-blocked' as const,
                        metadata: {
                            round: event.payload.round,
                            locationIds: [...event.payload.locationIds],
                        },
                    },
                    visibility: { scope: 'public' as const },
                }],
            };
        }
        const trigger = typeof timing.metadata?.fateAbilityTrigger === 'string'
            ? timing.metadata.fateAbilityTrigger
            : undefined;
        if (!trigger) return { opportunities: [] };
        const opportunities = state.core.playerIds.flatMap((playerId) => {
            const player = state.core.players[playerId];
            return player.skills.flatMap((skill) => {
                const definition = resolveFateAbilityDefinition(skill.id);
                if (!definition || definition.trigger !== trigger || !player.activeSkills.includes(skill.id)) return [];
                return [{
                    id: `fate:ability:${skill.id}:${timing.id}`,
                    timing,
                    sourceRef: {
                        kind: 'ability',
                        id: skill.id,
                        ownerId: playerId,
                        controllerId: playerId,
                    },
                    controllerId: playerId,
                    class: 'mandatory',
                    condition: true,
                    resolution: { type: 'none' as const },
                    visibility: { scope: 'controller' as const },
                    metadata: { abilityId: definition.id, mechanicFamily: definition.mechanicFamily },
                }];
            });
        });
        return { opportunities };
    },
    playerView: (state, playerId) => {
        const ruleState = normalizeFateRuleState(state.ruleState);
        return {
            ...state,
            ruleState: {
                ...ruleState,
                copies: ruleState.copies.filter((record) => record.context.controllerId === playerId || record.context.ownerId === playerId),
            },
            players: Object.fromEntries(state.playerIds.map((id) => [id, id === playerId ? state.players[id] : { ...state.players[id], hand: [], selectedAttackIds: [], activeAttackIds: [] }])),
        };
    },
    isGameOver: (state): GameOverResult | undefined => state.gameResult,
};

export * from './types';
export * from './setup';
export * from './rules';
export * from './movement';
export * from './mechanics';
export * from './abilityRegistry';
