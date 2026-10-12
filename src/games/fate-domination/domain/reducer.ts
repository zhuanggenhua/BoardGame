import type { RandomFn, MatchState } from '../../../engine/types';
import { FATE_ATTACK_BY_ID, FATE_MASTER_BY_ID, FATE_SERVANT_BY_ID, FATE_SITUATIONS } from '../data';
import { FATE_BATTLE_LOCATION_ORDER } from './types';
import type { FateDominationCommand, FateDominationCore, FateDominationEvent, BattleResult, LocationId } from './types';
import { resolveFateMovement } from './movement';
import { situationPowerBonus, eventPowerBonus } from './rules';
import { executeFateAbility, resolveFateAbilityDefinition } from './abilityRegistry';
import {
    addFateRuleModifier,
    canSufferFateDefeat,
    createFateDefeatMarker,
    expireFateRuleModifiers,
    fateEliminationOutcome,
    normalizeFateRuleState,
    resolveFatePowerValue,
    removeFateRuleModifier,
} from './mechanics';

const eventMeta = (command: FateDominationCommand) => ({ sourceCommandType: command.type, timestamp: typeof command.timestamp === 'number' ? command.timestamp : 0 });

const removePlayerFromBattlefield = (
    battlefield: FateDominationCore['battlefield'],
    playerId: string,
): FateDominationCore['battlefield'] => Object.fromEntries(
    Object.entries(battlefield).map(([locationId, location]) => [
        locationId,
        { ...location, playerIds: location.playerIds.filter((id) => id !== playerId) },
    ]),
) as FateDominationCore['battlefield'];

const calculatePower = (core: FateDominationCore, playerId: string, cardIds: string[]) => {
    const player = core.players[playerId];
    const selected = cardIds.map((cardId) => {
        const card = player.hand.find((item) => item.id === cardId) ?? player.discard.find((item) => item.id === cardId);
        return card ? FATE_ATTACK_BY_ID[card.definitionId] : undefined;
    }).filter(Boolean);
    const attackTypes = selected.map((card) => card!.type ?? card!.name);
    const basePowers = selected.map((card) => {
        const result = resolveFatePowerValue(core, card!.basePower, {
            selector: 'attack',
            actorId: playerId,
            locationId: player.locationId ?? 'workshop',
            attackTypes: [card!.type ?? card!.name],
        });
        return result.value;
    });
    const base = basePowers.reduce((sum, power) => sum + power, 0);
    const location = player.locationId ? core.battlefield[player.locationId] : undefined;
    const terrain = player.locationId
        ? resolveFatePowerValue(core, location?.terrainPower ?? 0, {
            selector: 'terrain',
            actorId: playerId,
            locationId: player.locationId,
        }).value
        : 0;
    const total = base + terrain + (player.locationId ? situationPowerBonus(core, player.locationId, attackTypes) : 0) + (location ? eventPowerBonus(location.eventCards, attackTypes, basePowers) : 0);
    return player.locationId
        ? resolveFatePowerValue(core, total, { selector: 'total', actorId: playerId, locationId: player.locationId, attackTypes }).value
        : total;
};

const makeBattleResult = (core: FateDominationCore, playerId: string, power: number, locationOverride?: LocationId): BattleResult => {
    const locationId = locationOverride ?? core.players[playerId].locationId ?? 'workshop';
    const location = core.battlefield[locationId];
    const fallbackEvents = locationId === 'miyama' ? core.currentEvents.miyama : locationId === 'shinto' ? core.currentEvents.shinto : [];
    const activeEvents = location.eventCards.length > 0 ? location.eventCards : fallbackEvents;
    const eventVictoryPoints = activeEvents.reduce((sum, event) => sum + event.victoryPoints, 0);
    return { playerId, locationId, power, eventVictoryPoints, competitionVictoryPoints: location.competitionVictoryPoints, totalVictoryPoints: eventVictoryPoints + location.competitionVictoryPoints, status: locationId === 'recon' ? 'recon' : 'representative-win' };
};

const locationResults = (core: FateDominationCore, locationId: LocationId): BattleResult[] => {
    if (locationId === 'workshop') return [];
    const ids = core.battlefield[locationId].playerIds.filter((id) => !core.players[id].eliminated && core.players[id].defeatMarkers.length === 0);
    if (!ids.length) return [];
    const powers = ids.map((id) => ({ id, power: calculatePower(core, id, core.players[id].activeAttackIds) }));
    if (locationId === 'recon') {
        return powers.map(({ id, power }) => ({ ...makeBattleResult(core, id, power, locationId), status: 'recon' as const }));
    }
    const max = Math.max(...powers.map((item) => item.power));
    return powers.map(({ id, power }) => ({ ...makeBattleResult(core, id, power, locationId), status: power === max ? 'representative-win' : 'deferred' }));
};

const eliminationLimitForCompletedRound = (round: number): number | undefined => {
    if (round === 8) return 4;
    if (round === 9) return 3;
    if (round === 10) return 2;
    return undefined;
};

const eliminationCandidatesForRound = (
    core: FateDominationCore,
    results: BattleResult[],
): string[] => {
    const limit = eliminationLimitForCompletedRound(core.round);
    if (!limit) return [];
    const scores = Object.fromEntries(core.playerIds.map((id) => [
        id,
        core.players[id].victoryPoints + results
            .filter((result) => result.playerId === id)
            .reduce((sum, result) => sum + result.totalVictoryPoints, 0),
    ]));
    const ranked = core.playerIds
        .filter((id) => !core.players[id].eliminated)
        .map((id) => ({ id, score: scores[id] ?? 0 }))
        .sort((left, right) => right.score - left.score);
    const cutoff = ranked[limit - 1]?.score;
    if (cutoff === undefined) return [];
    return ranked.filter((entry) => entry.score < cutoff).map((entry) => entry.id);
};

export function execute(state: MatchState<FateDominationCore>, command: FateDominationCommand, _random: RandomFn): FateDominationEvent[] {
    const core = state.core;
    const meta = eventMeta(command);
    switch (command.type) {
        case 'SELECT_MASTER': return [{ type: 'MASTER_SELECTED', payload: { playerId: command.playerId, masterId: command.payload.masterId }, ...meta }];
        case 'SELECT_SERVANT': return [{ type: 'SERVANT_SELECTED', payload: { playerId: command.playerId, servantId: command.payload.servantId }, ...meta }];
        case 'DEPLOY_MASTER': { const location = core.battlefield[command.payload.locationId]; return [{ type: 'MASTER_DEPLOYED', payload: { playerId: command.playerId, locationId: command.payload.locationId, manaGain: command.payload.locationId === 'workshop' ? 2 : location.terrainPower }, ...meta }]; }
        case 'MOVE_PLAYER': {
            const from = core.players[command.playerId].locationId!;
            const resolution = resolveFateMovement(core, command.playerId, command.payload.locationId, 'normal');
            if (!resolution.valid || !resolution.path || resolution.cost === null) return [];
            return [{ type: 'PLAYER_MOVED', payload: { playerId: command.playerId, from, to: command.payload.locationId, path: [...resolution.path], mode: resolution.mode, manaSpent: resolution.cost }, ...meta }];
        }
        case 'PASS_ACTION': return [{ type: 'ACTION_PASSED', payload: { playerId: command.playerId }, ...meta }];
        case 'PLAY_SKILL': {
            const skill = core.players[command.playerId].skills.find((item) => item.id === command.payload.skillId)!;
            if (!resolveFateAbilityDefinition(skill.id)) {
                return [{ type: 'FATE_ABILITY_UNIMPLEMENTED', payload: { playerId: command.playerId, skillId: skill.id }, ...meta }];
            }
            const skillEvent: FateDominationEvent = { type: 'SKILL_PLAYED', payload: { playerId: command.playerId, skillId: skill.id, manaSpent: Number(skill.req ?? skill.cost ?? 0), targetPlayerId: command.payload.targetPlayerId, targetLocationId: command.payload.targetLocationId, targetCardId: command.payload.targetCardId }, ...meta };
            const abilityEvents = executeFateAbility({
                sourceId: skill.id,
                ownerId: command.playerId,
                playerId: command.playerId,
                timestamp: typeof command.timestamp === 'number' ? command.timestamp : 0,
                core,
                skill,
                targetPlayerId: command.payload.targetPlayerId,
                targetLocationId: command.payload.targetLocationId,
                targetCardId: command.payload.targetCardId,
            }).events;
            return [skillEvent, ...abilityEvents];
        }
        case 'SELECT_ATTACK_CARD': { const selected = core.players[command.playerId].selectedAttackIds.includes(command.payload.cardId); return [{ type: 'ATTACK_CARD_SELECTED', payload: { playerId: command.playerId, cardId: command.payload.cardId, selected: !selected }, ...meta }]; }
        case 'CONFIRM_ATTACK': { const cardIds = [...core.players[command.playerId].selectedAttackIds]; const manaSpent = cardIds.reduce((sum, id) => sum + (FATE_ATTACK_BY_ID[core.players[command.playerId].hand.find((item) => item.id === id)?.definitionId ?? '']?.manaCost ?? 0), 0); return [{ type: 'ATTACKS_CONFIRMED', payload: { playerId: command.playerId, cardIds, power: calculatePower(core, command.playerId, cardIds), manaSpent }, ...meta }]; }
        case 'INSPECT_CARD': return [{ type: 'CARD_INSPECTED', payload: { playerId: command.playerId, cardId: command.payload.cardId }, ...meta }];
        case 'RESOLVE_LOCATION': {
            const locationId = command.payload.locationId;
            const results = locationResults(core, locationId);
            const events: FateDominationEvent[] = [{ type: 'LOCATION_RESOLVED', payload: { locationId, results }, ...meta }];
            const projectedResults = [...core.resolvedResults, ...results];
            const resolvedCount = core.resolvedLocations.includes(locationId)
                ? core.resolvedLocations.length
                : core.resolvedLocations.length + 1;
            const battleLocationCount = core.battleResolution?.locationIds.length ?? FATE_BATTLE_LOCATION_ORDER.length;
            if (resolvedCount < battleLocationCount) return events;
            const awardResults = projectedResults.filter((result) => result.status === 'representative-win' || result.status === 'recon');
            const result = awardResults[0] ?? core.battleResult ?? makeBattleResult(core, command.playerId, 0);
            const nextRound = core.round + 1;
            const scores = Object.fromEntries(core.playerIds.map((id) => [
                id,
                core.players[id].victoryPoints + awardResults
                    .filter((item) => item.playerId === id)
                    .reduce((sum, item) => sum + item.totalVictoryPoints, 0),
            ]));
            const winner = Object.entries(scores).sort((a, b) => b[1] - a[1])[0]?.[0];
            const eliminationEvents: FateDominationEvent[] = eliminationCandidatesForRound(core, awardResults).map((playerId) => ({
                type: 'FATE_ELIMINATION_REQUESTED',
                payload: { playerId, reason: 'round-cut' },
                ...meta,
            }));
            events.push({ type: 'BATTLE_RESOLVED', payload: { result, nextRound, gameResult: nextRound > 11 && winner ? { winner, scores } : undefined }, ...meta }, ...eliminationEvents);
            return events;
        }
        case 'ADVANCE_PHASE': {
            if (core.phase === 'battle') {
                if (!core.battleResolution) {
                    return [{
                        type: 'FATE_BATTLE_RESOLUTION_STARTED',
                        payload: {
                            frameId: `fate:battle:${core.round}`,
                            round: core.round,
                            locationIds: [...FATE_BATTLE_LOCATION_ORDER],
                        },
                        ...meta,
                    }];
                }
                if (core.battleResolution.step !== 'awards') return [];
                const results = core.resolvedResults.filter((result) => result.status === 'representative-win' || result.status === 'recon');
                const result = results[0] ?? core.battleResult ?? makeBattleResult(core, command.playerId, 0);
                const nextRound = core.round + 1;
                const scores = Object.fromEntries(core.playerIds.map((id) => [
                    id,
                    core.players[id].victoryPoints + results
                        .filter((item) => item.playerId === id)
                        .reduce((sum, item) => sum + item.totalVictoryPoints, 0),
                ]));
                const winner = Object.entries(scores).sort((a, b) => b[1] - a[1])[0]?.[0];
                const eliminationEvents: FateDominationEvent[] = eliminationCandidatesForRound(core, results).map((playerId) => ({
                    type: 'FATE_ELIMINATION_REQUESTED',
                    payload: { playerId, reason: 'round-cut' },
                    ...meta,
                }));
                return [
                    { type: 'BATTLE_RESOLVED', payload: { result, nextRound, gameResult: nextRound > 11 && winner ? { winner, scores } : undefined }, ...meta },
                    ...eliminationEvents,
                ];
            }
            return [{ type: 'PHASE_ADVANCED', payload: { phase: core.phase === 'preparation' ? 'outpost' : 'action', round: core.round, currentPlayerId: core.currentPlayerId }, ...meta }];
        }
        default: return [];
    }
}

export function reduce(state: FateDominationCore, event: FateDominationEvent): FateDominationCore {
    switch (event.type) {
        case 'MASTER_SELECTED': { const player = state.players[event.payload.playerId]; const master = FATE_MASTER_BY_ID[event.payload.masterId]; if (!master) return state; const skills = [...(master.skills ?? []), ...(FATE_SERVANT_BY_ID[player.servantId]?.skillCards ?? [])].map((skill, index) => ({ ...skill, id: `${skill.id ?? skill.name}:${index}` })); return { ...state, players: { ...state.players, [event.payload.playerId]: { ...player, masterId: event.payload.masterId, mana: master.initMana ?? player.mana, skills, activeSkills: [] } } }; }
        case 'SERVANT_SELECTED': { const player = state.players[event.payload.playerId]; const servant = FATE_SERVANT_BY_ID[event.payload.servantId]; if (!servant) return state; const ids = servant.deck?.length ? servant.deck : player.deck.map((card) => card.definitionId); const deck = ids.map((definitionId, index) => ({ id: `${player.id}:${definitionId}:${index}`, definitionId })); const skills = [...(FATE_MASTER_BY_ID[player.masterId]?.skills ?? []), ...(servant.skillCards ?? [])].map((skill, index) => ({ ...skill, id: `${skill.id ?? skill.name}:${index}` })); return { ...state, players: { ...state.players, [event.payload.playerId]: { ...player, servantId: event.payload.servantId, hand: deck.slice(0, 6), deck: deck.slice(6), skills, activeSkills: [] } }, pendingChoice: { kind: null }, actionNotice: '身份已确认，可以开始本轮准备。' }; }
        case 'MASTER_DEPLOYED': {
            const player = state.players[event.payload.playerId];
            const battlefield = { ...state.battlefield };
            Object.keys(battlefield).forEach((id) => {
                battlefield[id as LocationId] = {
                    ...battlefield[id as LocationId],
                    playerIds: battlefield[id as LocationId].playerIds.filter((pid) => pid !== event.payload.playerId),
                };
            });
            battlefield[event.payload.locationId] = {
                ...battlefield[event.payload.locationId],
                playerIds: [...battlefield[event.payload.locationId].playerIds, event.payload.playerId],
            };
            const players = {
                ...state.players,
                [event.payload.playerId]: {
                    ...player,
                    locationId: event.payload.locationId,
                    mana: player.mana + event.payload.manaGain,
                },
            };
            const nextPlayerId = state.playerIds.find((id) => !players[id].eliminated && !players[id].locationId);
            const firstActivePlayerId = state.playerIds.find((id) => !players[id].eliminated) ?? event.payload.playerId;
            const allDeployed = !nextPlayerId;
            return {
                ...state,
                battlefield,
                players,
                phase: allDeployed ? 'action' : 'outpost',
                currentPlayerId: nextPlayerId ?? firstActivePlayerId,
                currentTurnIndex: state.turnOrder.indexOf(nextPlayerId ?? firstActivePlayerId),
                actionCount: 0,
                pendingChoice: allDeployed
                    ? { kind: 'attack-cards', playerId: firstActivePlayerId, minimum: 2, maximum: 2 }
                    : { kind: 'location', playerId: nextPlayerId },
                actionNotice: allDeployed ? '行动阶段：可移动或选择攻击牌。' : '部署阶段：轮到下一位玩家选择地点。',
            };
        }
        case 'PLAYER_MOVED': { const player = state.players[event.payload.playerId]; const battlefield = { ...state.battlefield }; battlefield[event.payload.from] = { ...battlefield[event.payload.from], playerIds: battlefield[event.payload.from].playerIds.filter((id) => id !== event.payload.playerId) }; battlefield[event.payload.to] = { ...battlefield[event.payload.to], playerIds: [...battlefield[event.payload.to].playerIds, event.payload.playerId] }; return { ...state, battlefield, players: { ...state.players, [event.payload.playerId]: { ...player, locationId: event.payload.to, mana: player.mana - event.payload.manaSpent } }, actionCount: state.actionCount + 1, actionNotice: `已移动至${battlefield[event.payload.to].label}。` }; }
        case 'ACTION_PASSED': {
            const players = { ...state.players, [event.payload.playerId]: { ...state.players[event.payload.playerId], hasPassedAction: true } };
            const activeIds = state.playerIds.filter((id) => players[id].locationId && !players[id].eliminated);
            const nextPlayerId = activeIds.find((id) => !players[id].hasPassedAction);
            const allPassed = !nextPlayerId;
            return { ...state, players, phase: allPassed ? 'battle' : state.phase, currentPlayerId: nextPlayerId ?? state.currentPlayerId, currentTurnIndex: nextPlayerId ? state.turnOrder.indexOf(nextPlayerId) : 0, pendingChoice: allPassed ? { kind: 'battle' } : { kind: 'attack-cards', playerId: nextPlayerId, minimum: 2, maximum: 2 }, actionNotice: allPassed ? '所有玩家结束行动，进入战斗阶段。' : '已结束行动，轮到下一位玩家。' };
        }
        case 'SKILL_PLAYED': {
            const player = state.players[event.payload.playerId];
            const skill = player.skills.find((item) => item.id === event.payload.skillId);
            const players = {
                ...state.players,
                [event.payload.playerId]: {
                    ...player,
                    mana: player.mana - event.payload.manaSpent,
                    activeSkills: [...player.activeSkills, event.payload.skillId],
                },
            };
            return { ...state, players, actionNotice: `已发动技能【${skill?.name ?? event.payload.skillId}】。` };
        }
        case 'FATE_ABILITY_UNIMPLEMENTED':
            return { ...state, actionNotice: `技能【${event.payload.skillId}】尚未接入权威效果，未扣除资源。` };
        case 'FATE_RULE_MODIFIER_ATTACHED':
            return { ...state, ruleState: addFateRuleModifier(normalizeFateRuleState(state.ruleState), event.payload.modifier) };
        case 'FATE_RULE_MODIFIER_REMOVED':
            return { ...state, ruleState: removeFateRuleModifier(normalizeFateRuleState(state.ruleState), event.payload.modifierId) };
        case 'FATE_COPY_PROXY_CREATED':
            return { ...state, ruleState: { ...normalizeFateRuleState(state.ruleState), copies: [...normalizeFateRuleState(state.ruleState).copies.filter((record) => record.id !== event.payload.record.id), event.payload.record] } };
        case 'FATE_BATTLE_RESOLUTION_STARTED':
            return {
                ...state,
                battleResolution: {
                    frameId: event.payload.frameId,
                    round: event.payload.round,
                    locationIds: [...event.payload.locationIds],
                    resolvedLocationIds: [],
                    step: 'locations',
                },
            };
        case 'FATE_DEFEAT_DECLARED': {
            const player = state.players[event.payload.playerId];
            if (!player || player.eliminated || player.defeatMarkers.some((marker) => marker.id === event.payload.markerId)) return state;
            if (!canSufferFateDefeat(state, event.payload.playerId, event.payload.sourceId, event.payload.direct, event.payload.unpreventable).allowed) return state;
            const marker = createFateDefeatMarker({
                id: event.payload.markerId,
                sourceId: event.payload.sourceId,
                direct: event.payload.direct,
            });
            return {
                ...state,
                players: {
                    ...state.players,
                    [event.payload.playerId]: {
                        ...player,
                        defeatMarkers: [...player.defeatMarkers, marker],
                    },
                },
            };
        }
        case 'FATE_DEFEAT_APPLIED': {
            const player = state.players[event.payload.playerId];
            if (!player || player.eliminated || player.defeatMarkers.some((marker) => marker.id === event.payload.marker.id)) return state;
            return {
                ...state,
                players: {
                    ...state.players,
                    [event.payload.playerId]: {
                        ...player,
                        defeatMarkers: [...player.defeatMarkers, event.payload.marker],
                    },
                },
            };
        }
        case 'FATE_DEFEAT_PREVENTED':
            return state;
        case 'FATE_ELIMINATION_REQUESTED': {
            const player = state.players[event.payload.playerId];
            if (!player || player.eliminated) return state;
            if (fateEliminationOutcome(state, event.payload.playerId) === 'prevent') {
                return {
                    ...state,
                    players: {
                        ...state.players,
                        [event.payload.playerId]: {
                            ...player,
                            mana: 0,
                            eliminationProtectionUsed: true,
                            defeatMarkers: [],
                        },
                    },
                };
            }
            const battlefield = removePlayerFromBattlefield(state.battlefield, event.payload.playerId);
            return {
                ...state,
                battlefield,
                players: {
                    ...state.players,
                    [event.payload.playerId]: {
                        ...player,
                        eliminated: true,
                        locationId: null,
                        defeatMarkers: [],
                    },
                },
            };
        }
        case 'FATE_ELIMINATION_PREVENTED': {
            const player = state.players[event.payload.playerId];
            if (!player || player.eliminated) return state;
            return {
                ...state,
                players: {
                    ...state.players,
                    [event.payload.playerId]: {
                        ...player,
                        mana: 0,
                        eliminationProtectionUsed: true,
                        defeatMarkers: [],
                    },
                },
            };
        }
        case 'FATE_PLAYER_ELIMINATED': {
            const player = state.players[event.payload.playerId];
            if (!player || player.eliminated) return state;
            const battlefield = removePlayerFromBattlefield(state.battlefield, event.payload.playerId);
            return {
                ...state,
                battlefield,
                players: {
                    ...state.players,
                    [event.payload.playerId]: {
                        ...player,
                        eliminated: true,
                        locationId: null,
                        defeatMarkers: [],
                    },
                },
            };
        }
        case 'ATTACK_CARD_SELECTED': { const player = state.players[event.payload.playerId]; const selectedAttackIds = event.payload.selected ? [...player.selectedAttackIds, event.payload.cardId] : player.selectedAttackIds.filter((id) => id !== event.payload.cardId); return { ...state, players: { ...state.players, [event.payload.playerId]: { ...player, selectedAttackIds } }, pendingChoice: { kind: 'attack-cards', playerId: event.payload.playerId, minimum: 2, maximum: 2 } }; }
        case 'ATTACKS_CONFIRMED': {
            const player = state.players[event.payload.playerId];
            const updatedPlayer = { ...player, mana: player.mana - event.payload.manaSpent, selectedAttackIds: [], activeAttackIds: event.payload.cardIds, hasPassedAction: true };
            const players = { ...state.players, [event.payload.playerId]: updatedPlayer };
            const activeIds = state.playerIds.filter((id) => players[id].locationId && !players[id].eliminated);
            const nextPlayerId = activeIds.find((id) => !players[id].hasPassedAction);
            const allConfirmed = !nextPlayerId;
            const result = makeBattleResult(state, event.payload.playerId, event.payload.power);
            return { ...state, phase: allConfirmed ? 'battle' : 'action', currentPlayerId: nextPlayerId ?? event.payload.playerId, currentTurnIndex: nextPlayerId ? state.turnOrder.indexOf(nextPlayerId) : 0, battleResult: result, players, pendingChoice: allConfirmed ? { kind: 'battle', playerId: event.payload.playerId } : { kind: 'attack-cards', playerId: nextPlayerId, minimum: 2, maximum: 2 }, actionNotice: allConfirmed ? '所有在场玩家已完成行动，进入战斗阶段。' : `已完成出牌，等待${nextPlayerId}行动。` };
        }
        case 'LOCATION_RESOLVED': {
            const resolvedLocations = [...new Set([...state.resolvedLocations, event.payload.locationId])];
            const battleResolution = state.battleResolution
                ? {
                    ...state.battleResolution,
                    resolvedLocationIds: [...new Set([...state.battleResolution.resolvedLocationIds, event.payload.locationId])],
                    step: resolvedLocations.length >= state.battleResolution.locationIds.length ? 'awards' as const : 'locations' as const,
                }
                : state.battleResolution;
            return {
                ...state,
                resolvedLocations,
                resolvedResults: [...state.resolvedResults, ...event.payload.results],
                battleResult: event.payload.results[0] ?? state.battleResult,
                battleResolution,
                actionNotice: `${state.battlefield[event.payload.locationId].label}战斗已结算。`,
            };
        }
        case 'CARD_INSPECTED': return state;
        case 'PHASE_ADVANCED': return { ...state, phase: event.payload.phase, currentPlayerId: event.payload.currentPlayerId, currentTurnIndex: 0, actionCount: 0, pendingChoice: event.payload.phase === 'outpost' ? { kind: 'location', playerId: event.payload.currentPlayerId } : { kind: 'attack-cards', playerId: event.payload.currentPlayerId, minimum: 2, maximum: 2 }, actionNotice: event.payload.phase === 'outpost' ? '部署阶段：选择一个地点。' : '行动阶段：可移动或出牌。' };
        case 'BATTLE_RESOLVED': {
            const result = event.payload.result;
            const player = state.players[result.playerId];
            const activeCardInstances = player.hand.filter((card) => player.activeAttackIds.includes(card.id));
            const nextRound = event.payload.nextRound;
            const isComplete = nextRound > 11;
            const nextPlayerId = state.playerIds[(state.playerIds.indexOf(result.playerId) + 1) % state.playerIds.length];
            const nextEvents = state.eventDeck.slice(0, 2);
            const eventDeck = state.eventDeck.slice(2);
            const currentEvents = { miyama: nextEvents.slice(0, 1), shinto: nextEvents.slice(1, 2) };
            const nextSituation = nextRound >= 11 ? FATE_SITUATIONS.find((situation) => situation.name === '天之杯') ?? state.situation : nextRound === 10 ? FATE_SITUATIONS.find((situation) => situation.name === '身处地狱之门') ?? state.situation : nextRound === 9 ? FATE_SITUATIONS.find((situation) => situation.name === '命运之夜') ?? state.situation : state.situation;
            const battlefield = Object.fromEntries(Object.entries(state.battlefield).map(([id, location]) => [id, { ...location, playerIds: [], eventCards: id === 'miyama' ? currentEvents.miyama : id === 'shinto' ? currentEvents.shinto : [] }])) as FateDominationCore['battlefield'];
            const players = Object.fromEntries(state.playerIds.map((id) => { const current = state.players[id]; const cards = current.activeAttackIds.length ? current.hand.filter((card) => current.activeAttackIds.includes(card.id)) : []; const discard = [...current.discard, ...cards]; const deck = [...current.deck]; const hand = current.hand.filter((card) => !current.activeAttackIds.includes(card.id)); while (!isComplete && hand.length < 3 && deck.length) hand.push(deck.pop()!); return [id, { ...current, locationId: null, activeAttackIds: [], selectedAttackIds: [], activeSkills: [], defeatMarkers: [], hasPassedAction: false, mana: Math.min(12, current.mana + (nextSituation.printedMana ?? 0)), hand, deck, discard }]; })) as FateDominationCore['players'];
            players[result.playerId] = { ...players[result.playerId], victoryPoints: players[result.playerId].victoryPoints + result.totalVictoryPoints, discard: [...players[result.playerId].discard.filter((card) => !activeCardInstances.includes(card)), ...activeCardInstances] };
            const awardResults = state.resolvedResults.length
                ? state.resolvedResults.filter((item) => item.status === 'representative-win' || item.status === 'recon')
                : [result];
            awardResults.forEach((item) => { if (item.playerId !== result.playerId) players[item.playerId] = { ...players[item.playerId], victoryPoints: players[item.playerId].victoryPoints + item.totalVictoryPoints }; });
            return { ...state, round: Math.min(nextRound, 11), phase: isComplete ? 'complete' : 'preparation', currentPlayerId: nextPlayerId, currentTurnIndex: 0, battlefield, situation: nextSituation, miyamaEvent: currentEvents.miyama[0] ?? state.miyamaEvent, battleResult: result, battleResolution: undefined, resolvedLocations: [], resolvedResults: [], situationDeckCount: Math.max(0, state.situationDeckCount - 1), eventDeckCount: eventDeck.length, eventDiscardCount: state.eventDiscardCount + 2, eventDeck, eventDiscard: [...state.eventDiscard, ...state.currentEvents.miyama, ...state.currentEvents.shinto], currentEvents, pendingChoice: isComplete ? { kind: null } : { kind: 'identity', playerId: nextPlayerId }, actionNotice: isComplete ? '第 11 回合结束，对局完成。' : `第 ${nextRound} 回合准备阶段已开始。`, gameResult: event.payload.gameResult, players, ruleState: expireFateRuleModifiers(expireFateRuleModifiers(normalizeFateRuleState(state.ruleState), 'turn-end'), 'round-end') };
        }
        default: return state;
    }
}
