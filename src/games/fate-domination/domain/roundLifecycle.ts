import { fateFinalResult, emptyFateBattleResult } from './battleAwards';
import type { BattleResult, FateDominationEvent } from './types';
import { drawFateCards } from './cardDraw';
import { fateSituationEventCounts, distributeFateRoundEvents } from './environmentRules';
import type { RandomFn } from '../../../engine/types';
import type { BattleResolvedEvent, FateDominationCore, CardInstance, EventCardDefinition } from './types';
import { FATE_SITUATIONS } from '../data';
import { FATE_DEFAULT_HAND_LIMIT, capFateMana } from './rules';
import { FATE_LOCATION_ORDER } from './movement';
import { expireFateRuleModifiers, normalizeFateRuleState } from './mechanics';

/** Random choices are event facts so replay and undo do not reshuffle. */
export function prepareFateDeckRecycling(core: FateDominationCore, random: RandomFn): Pick<BattleResolvedEvent['payload'], 'recycledAttackDecks' | 'eventDraw'> {
    if (core.round >= 11) return {};
    const recycledAttackDecks: Record<string, CardInstance[]> = {};
    for (const player of Object.values(core.players)) {
        if (player.eliminated) continue;
        const remaining = player.hand.filter(card => !player.activeAttackIds.includes(card.id));
        if (remaining.length + player.deck.length >= FATE_DEFAULT_HAND_LIMIT) continue;
        const spent = player.hand.filter(card => player.activeAttackIds.includes(card.id));
        recycledAttackDecks[player.id] = random.shuffle([...player.discard, ...spent]);
    }
    const counts=fateSituationEventCounts(nextFateSituation(core));
    const eventDraw=drawFateCards(core.eventDeck,[...core.eventDiscard,...core.currentEvents.miyama,...core.currentEvents.shinto],counts.miyama+counts.shinto,random);
    return { recycledAttackDecks, eventDraw };
}

export function reduceFateRound(state: FateDominationCore, event: BattleResolvedEvent): FateDominationCore {
    const result = event.payload.result;
    const nextRound = event.payload.nextRound;
    const isComplete = nextRound > 11;
    const turnOrder = [...state.turnOrder.slice(1), state.turnOrder[0]];
    const nextPlayerId = turnOrder.find(id => !state.players[id].eliminated) ?? turnOrder[0];
    const availableEvents = [...state.eventDeck, ...(event.payload.recycledEventDeck ?? [])];
    const nextEvents = isComplete ? [] : event.payload.eventDraw?.drawn ?? availableEvents.slice(0, 2);
    const eventDeck = isComplete ? state.eventDeck : event.payload.eventDraw?.deck ?? availableEvents.slice(2);
    const eventDiscard = event.payload.eventDraw?.discard ?? (event.payload.recycledEventDeck ? [] : [...state.eventDiscard, ...state.currentEvents.miyama, ...state.currentEvents.shinto]);
    const nextSituation = nextFateSituation(state);
    const currentEvents = distributeFateRoundEvents(nextEvents,nextSituation);
    const situationDeck = state.situationDeck?.slice(!isComplete && nextRound <= 8 ? 1 : 0);
    const battlefield = { ...state.battlefield };
    for (const id of FATE_LOCATION_ORDER) {
        battlefield[id] = { ...state.battlefield[id], playerIds: [], eventCards: id === 'miyama' ? currentEvents.miyama : id === 'shinto' ? currentEvents.shinto : [] };
    }
    const players = Object.fromEntries(state.playerIds.map(id => {
        const current = state.players[id];
        const spent = current.hand.filter(card => current.activeAttackIds.includes(card.id));
        const recycled = event.payload.recycledAttackDecks?.[id];
        const discard = recycled ? [] : [...current.discard, ...spent];
        const deck = [...current.deck, ...(recycled ?? [])];
        const hand = current.hand.filter(card => !current.activeAttackIds.includes(card.id));
        while (!isComplete && !current.eliminated && hand.length < FATE_DEFAULT_HAND_LIMIT && deck.length) hand.push(deck.shift()!);
        const skills = current.skills.filter(skill => !(skill.oncePerGame && current.activeSkills.includes(skill.id)));
        return [id, {
            ...current, locationId: null, deploymentSlot: null,
            skills,
            revealedSkillIds: current.revealedSkillIds.filter(id => skills.some(skill => skill.id === id)),
            activeAttackIds: [], selectedAttackIds: [], selectedFaceDownIds: [], faceDownAttackIds: [], forcedRevealedHand: [], activeSkills: [], usedAbilityIds: [],
            normalAttackPlayed: false, normalMoveCompleted: false, defeatMarkers: [], hasPassedAction: false,
            mana: capFateMana(current.masterId, current.mana + (isComplete || current.eliminated ? 0 : nextSituation.printedMana ?? 0)),
            hand, deck, discard,
        }];
    })) as FateDominationCore['players'];
    const awardResults = state.resolvedResults.length ? state.resolvedResults.filter(item => item.status === 'representative-win' || item.status === 'recon') : [result];
    for (const award of awardResults) players[award.playerId] = { ...players[award.playerId], victoryPoints: players[award.playerId].victoryPoints + award.totalVictoryPoints };
    return { ...state, round: Math.min(nextRound, 11), phase: isComplete ? 'complete' : 'preparation', turnOrder, phaseCompletedPlayerIds: [], shintoEventFaceDown: !isComplete, currentPlayerId: nextPlayerId, currentTurnIndex: turnOrder.indexOf(nextPlayerId), battlefield, situation: nextSituation, miyamaEvent: currentEvents.miyama[0] ?? state.miyamaEvent, battleResult: result, battleResolution: undefined, resolvedLocations: [], resolvedResults: [], situationDeck, situationDeckCount: situationDeck?.length ?? Math.max(0, state.situationDeckCount - 1), eventDeckCount: eventDeck.length, eventDiscardCount: eventDiscard.length, eventDeck, eventDiscard, currentEvents, pendingChoice: { kind: null }, actionNotice: isComplete ? '第 11 回合结束，对局完成。' : `第 ${nextRound} 回合准备阶段已开始。`, gameResult: event.payload.gameResult, players, ruleState: expireFateRuleModifiers(expireFateRuleModifiers(normalizeFateRuleState(state.ruleState), 'turn-end'), 'round-end') };
}

function nextFateSituation(state:FateDominationCore):FateDominationCore['situation'] {
    const nextRound=state.round+1;
    return nextRound >= 11 ? FATE_SITUATIONS.find((situation) => situation.name === '天之杯') ?? state.situation : nextRound === 10 ? FATE_SITUATIONS.find((situation) => situation.name === '身处地狱之门') ?? state.situation : nextRound === 9 ? FATE_SITUATIONS.find((situation) => situation.name === '命运之夜') ?? state.situation : state.situationDeck?.[0] ?? state.situation;
}

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

/** Single end-of-round event writer, called after all committed choices have landed. */
export function finishFateRoundEvents(core:FateDominationCore,results:BattleResult[],random:RandomFn,meta:{timestamp:number;sourceCommandType?:string}):FateDominationEvent[] {
    const awards=results.filter(result=>result.status==='representative-win'||result.status==='recon');
    const nextRound=core.round+1;
    return [
        ...eliminationCandidatesForRound(core,awards).map(playerId=>({type:'FATE_ELIMINATION_REQUESTED' as const,payload:{playerId,reason:'round-cut' as const},...meta})),
        {type:'BATTLE_RESOLVED',payload:{result:awards[0]??emptyFateBattleResult(core.currentPlayerId),nextRound,...prepareFateDeckRecycling(core,random),gameResult:nextRound>11?fateFinalResult(core,awards):undefined},...meta},
    ];
}
