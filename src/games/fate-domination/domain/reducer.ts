import type { RandomFn, MatchState } from '../../../engine/types';
import { FATE_ATTACK_BY_ID, FATE_MASTER_BY_ID, FATE_SERVANT_BY_ID, FATE_SITUATIONS } from '../data';
import type { FateDominationCommand, FateDominationCore, FateDominationEvent, BattleResult, LocationId } from './types';
import { movementCost, situationPowerBonus, eventPowerBonus } from './rules';

const eventMeta = (command: FateDominationCommand) => ({ sourceCommandType: command.type, timestamp: typeof command.timestamp === 'number' ? command.timestamp : 0 });

const calculatePower = (core: FateDominationCore, playerId: string, cardIds: string[]) => {
    const player = core.players[playerId];
    const selected = cardIds.map((cardId) => {
        const card = player.hand.find((item) => item.id === cardId) ?? player.discard.find((item) => item.id === cardId);
        return card ? FATE_ATTACK_BY_ID[card.definitionId] : undefined;
    }).filter(Boolean);
    const basePowers = selected.map((card) => card!.basePower);
    const attackTypes = selected.map((card) => card!.type ?? card!.name);
    const base = basePowers.reduce((sum, power) => sum + power, 0);
    const location = player.locationId ? core.battlefield[player.locationId] : undefined;
    return base + (location?.terrainPower ?? 0) + (player.locationId ? situationPowerBonus(core, player.locationId, attackTypes) : 0) + (location ? eventPowerBonus(location.eventCards, attackTypes, basePowers) : 0);
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
    const ids = core.battlefield[locationId].playerIds.filter((id) => !core.players[id].eliminated);
    if (!ids.length) return [];
    const powers = ids.map((id) => ({ id, power: calculatePower(core, id, core.players[id].activeAttackIds) }));
    const max = Math.max(...powers.map((item) => item.power));
    return powers.map(({ id, power }) => ({ ...makeBattleResult(core, id, power, locationId), status: power === max ? 'representative-win' : 'deferred' }));
};

export function execute(state: MatchState<FateDominationCore>, command: FateDominationCommand, _random: RandomFn): FateDominationEvent[] {
    const core = state.core;
    const meta = eventMeta(command);
    switch (command.type) {
        case 'SELECT_MASTER': return [{ type: 'MASTER_SELECTED', payload: { playerId: command.playerId, masterId: command.payload.masterId }, ...meta }];
        case 'SELECT_SERVANT': return [{ type: 'SERVANT_SELECTED', payload: { playerId: command.playerId, servantId: command.payload.servantId }, ...meta }];
        case 'DEPLOY_MASTER': { const location = core.battlefield[command.payload.locationId]; return [{ type: 'MASTER_DEPLOYED', payload: { playerId: command.playerId, locationId: command.payload.locationId, manaGain: command.payload.locationId === 'workshop' ? 2 : location.terrainPower }, ...meta }]; }
        case 'MOVE_PLAYER': { const from = core.players[command.playerId].locationId!; return [{ type: 'PLAYER_MOVED', payload: { playerId: command.playerId, from, to: command.payload.locationId, manaSpent: movementCost(from, command.payload.locationId) ?? 0 }, ...meta }]; }
        case 'PASS_ACTION': return [{ type: 'ACTION_PASSED', payload: { playerId: command.playerId }, ...meta }];
        case 'PLAY_SKILL': { const skill = core.players[command.playerId].skills.find((item) => item.id === command.payload.skillId)!; return [{ type: 'SKILL_PLAYED', payload: { playerId: command.playerId, skillId: skill.id, manaSpent: Number(skill.req ?? skill.cost ?? 0), targetPlayerId: command.payload.targetPlayerId, targetLocationId: command.payload.targetLocationId }, ...meta }]; }
        case 'SELECT_ATTACK_CARD': { const selected = core.players[command.playerId].selectedAttackIds.includes(command.payload.cardId); return [{ type: 'ATTACK_CARD_SELECTED', payload: { playerId: command.playerId, cardId: command.payload.cardId, selected: !selected }, ...meta }]; }
        case 'CONFIRM_ATTACK': { const cardIds = [...core.players[command.playerId].selectedAttackIds]; const manaSpent = cardIds.reduce((sum, id) => sum + (FATE_ATTACK_BY_ID[core.players[command.playerId].hand.find((item) => item.id === id)?.definitionId ?? '']?.manaCost ?? 0), 0); return [{ type: 'ATTACKS_CONFIRMED', payload: { playerId: command.playerId, cardIds, power: calculatePower(core, command.playerId, cardIds), manaSpent }, ...meta }]; }
        case 'INSPECT_CARD': return [{ type: 'CARD_INSPECTED', payload: { playerId: command.playerId, cardId: command.payload.cardId }, ...meta }];
        case 'RESOLVE_LOCATION': return [{ type: 'LOCATION_RESOLVED', payload: { locationId: command.payload.locationId, results: locationResults(core, command.payload.locationId) }, ...meta }];
        case 'ADVANCE_PHASE': {
            if (core.phase === 'battle') { const results = core.resolvedResults.length ? core.resolvedResults.filter((result) => result.status === 'representative-win') : [core.battleResult ?? makeBattleResult(core, command.playerId, 0)]; const result = results[0] ?? core.battleResult ?? makeBattleResult(core, command.playerId, 0); const nextRound = core.round + 1; const scores = Object.fromEntries(core.playerIds.map((id) => [id, core.players[id].victoryPoints + results.filter((item) => item.playerId === id).reduce((sum, item) => sum + item.totalVictoryPoints, 0)])); const winner = Object.entries(scores).sort((a, b) => b[1] - a[1])[0]?.[0]; return [{ type: 'BATTLE_RESOLVED', payload: { result, nextRound, gameResult: nextRound > 11 && winner ? { winner, scores } : undefined }, ...meta }]; }
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
        case 'SKILL_PLAYED': { const player = state.players[event.payload.playerId]; const skill = player.skills.find((item) => item.id === event.payload.skillId); const desc = skill?.desc ?? ''; const nextPlayer = event.payload.targetPlayerId && state.players[event.payload.targetPlayerId] ? { ...state.players[event.payload.targetPlayerId], victoryPoints: desc.includes('战果') && desc.includes('失去') ? Math.max(0, state.players[event.payload.targetPlayerId].victoryPoints - 1) : state.players[event.payload.targetPlayerId].victoryPoints } : undefined; const players = { ...state.players, [event.payload.playerId]: { ...player, mana: player.mana - event.payload.manaSpent, activeSkills: [...player.activeSkills, event.payload.skillId], victoryPoints: desc.includes('获得') && desc.includes('战果') ? player.victoryPoints + 1 : player.victoryPoints }, ...(nextPlayer ? { [event.payload.targetPlayerId!]: nextPlayer } : {}) }; return { ...state, players, actionNotice: `已发动技能【${skill?.name ?? event.payload.skillId}】。` }; }
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
        case 'LOCATION_RESOLVED': return { ...state, resolvedLocations: [...new Set([...state.resolvedLocations, event.payload.locationId])], resolvedResults: [...state.resolvedResults, ...event.payload.results], battleResult: event.payload.results[0] ?? state.battleResult, actionNotice: `${state.battlefield[event.payload.locationId].label}战斗已结算。` };
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
            const players = Object.fromEntries(state.playerIds.map((id) => { const current = state.players[id]; const cards = current.activeAttackIds.length ? current.hand.filter((card) => current.activeAttackIds.includes(card.id)) : []; const discard = [...current.discard, ...cards]; const deck = [...current.deck]; const hand = current.hand.filter((card) => !current.activeAttackIds.includes(card.id)); while (!isComplete && hand.length < 3 && deck.length) hand.push(deck.pop()!); return [id, { ...current, locationId: null, activeAttackIds: [], selectedAttackIds: [], activeSkills: [], hasPassedAction: false, mana: Math.min(12, current.mana + (nextSituation.printedMana ?? 0)), hand, deck, discard }]; })) as FateDominationCore['players'];
            players[result.playerId] = { ...players[result.playerId], victoryPoints: players[result.playerId].victoryPoints + result.totalVictoryPoints, discard: [...players[result.playerId].discard.filter((card) => !activeCardInstances.includes(card)), ...activeCardInstances] };
            const awardResults = state.resolvedResults.length ? state.resolvedResults.filter((item) => item.status === 'representative-win') : [result];
            awardResults.forEach((item) => { if (item.playerId !== result.playerId) players[item.playerId] = { ...players[item.playerId], victoryPoints: players[item.playerId].victoryPoints + item.totalVictoryPoints }; });
            return { ...state, round: Math.min(nextRound, 11), phase: isComplete ? 'complete' : 'preparation', currentPlayerId: nextPlayerId, currentTurnIndex: 0, battlefield, situation: nextSituation, miyamaEvent: currentEvents.miyama[0] ?? state.miyamaEvent, battleResult: result, resolvedLocations: [], resolvedResults: [], situationDeckCount: Math.max(0, state.situationDeckCount - 1), eventDeckCount: eventDeck.length, eventDiscardCount: state.eventDiscardCount + 2, eventDeck, eventDiscard: [...state.eventDiscard, ...state.currentEvents.miyama, ...state.currentEvents.shinto], currentEvents, pendingChoice: isComplete ? { kind: null } : { kind: 'identity', playerId: nextPlayerId }, actionNotice: isComplete ? '第 11 回合结束，对局完成。' : `第 ${nextRound} 回合准备阶段已开始。`, gameResult: event.payload.gameResult, players };
        }
        default: return state;
    }
}
