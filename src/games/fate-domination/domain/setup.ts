import { fateSituationEventCounts, distributeFateRoundEvents } from './environmentRules';
import { capFateMana } from './rules';
import type { RandomFn, PlayerId } from '../../../engine/types';
import { FATE_ATTACK_CARDS, FATE_EVENTS, FATE_SERVANTS, FATE_SITUATIONS, FATE_MASTERS } from '../data';
import type { BattlefieldState, CardInstance, FateDominationCore, LocationId, PlayerState } from './types';
import { createInitialFateRuleState } from './mechanics';

export const createFateAttackDeck = (playerId: PlayerId, servantId: string): CardInstance[] => {
    const servant = FATE_SERVANTS.find((item) => item.id === servantId);
    const ids = servant?.deck?.length ? servant.deck : FATE_ATTACK_CARDS.filter((card) => card.basePower > 0).slice(0, 12).map((card) => card.id);
    return ids.map((definitionId, index) => ({ id: `${playerId}:${definitionId}:${index}`, definitionId }));
};

const createBattlefield = (): Record<LocationId, BattlefieldState> => ({
    workshop: { id: 'workshop', label: '魔术工房', movementCost: 0, terrainPower: 0, competitionVictoryPoints: 0, capacity: 4, playerIds: [], eventCards: [] },
    miyama: { id: 'miyama', label: '深山町', movementCost: 1, terrainPower: 0, competitionVictoryPoints: 2, capacity: null, playerIds: [], eventCards: [] },
    shinto: { id: 'shinto', label: '新都', movementCost: 2, terrainPower: 0, competitionVictoryPoints: 3, capacity: null, playerIds: [], eventCards: [] },
    recon: { id: 'recon', label: '侦察', movementCost: 0, terrainPower: 0, competitionVictoryPoints: 0, capacity: 1, playerIds: [], eventCards: [] },
});

const createPlayer = (playerId: PlayerId, index: number): PlayerState => {
    const master = index === 0
        ? (FATE_MASTERS.find((item) => item.name === '卫宫士郎') ?? FATE_MASTERS[0])
        : FATE_MASTERS[index % FATE_MASTERS.length];
    const servant = index === 0 ? (FATE_SERVANTS.find((item) => item.id === 'servant-saber') ?? FATE_SERVANTS[0]) : FATE_SERVANTS[index % FATE_SERVANTS.length];
    const deck = createFateAttackDeck(playerId, servant.id);
    return {
        id: playerId,
        masterId: master.id,
        servantId: servant.id,
        locationId: null,
        deploymentSlot: null,
        mana: master.initMana ?? 4,
        victoryPoints: 0,
        commandSpells: master.initialCommandSpells ?? 3,
        hand: [],
        selectedAttackIds: [], selectedFaceDownIds: [], faceDownAttackIds: [], forcedRevealedHand: [],
        activeAttackIds: [],
        discard: [],
        deck,
        hasPassedAction: false,
        eliminated: false,
        defeatMarkers: [],
        eliminationProtectionUsed: false,
        isRevealed: false,
        activeSkills: [],
        usedAbilityIds: [],
        revealedSkillIds: [],
        normalAttackPlayed: false,
        normalMoveCompleted: false,
        skills: [
            ...(master.skills ?? []),
            ...(servant.skillCards ?? []),
        ].map((skill, skillIndex) => ({ ...skill, id: `${skill.id ?? skill.name}:${skillIndex}` })),
    };
};

export function createInitialFateDominationCore(playerIds: PlayerId[], random: RandomFn, setupData?: unknown): FateDominationCore {
    const normalizedPlayerIds = playerIds.length > 0 ? playerIds : ['0', '1', '2'];
    const setupRecord = setupData && typeof setupData === 'object' && !Array.isArray(setupData)
        ? setupData as { firstPlayerId?: unknown; turnOrder?: unknown }
        : undefined;
    const requestedTurnOrder = Array.isArray(setupRecord?.turnOrder)
        && setupRecord.turnOrder.length === normalizedPlayerIds.length
        && setupRecord.turnOrder.every((playerId): playerId is string => typeof playerId === 'string' && normalizedPlayerIds.includes(playerId))
        && new Set(setupRecord.turnOrder).size === normalizedPlayerIds.length
        ? setupRecord.turnOrder
        : undefined;
    const requestedFirstPlayerId = setupRecord?.firstPlayerId;
    const firstPlayerIndex = typeof requestedFirstPlayerId === 'string'
        ? normalizedPlayerIds.indexOf(requestedFirstPlayerId)
        : -1;
    const turnOrder = requestedTurnOrder
        ? [...requestedTurnOrder]
        : firstPlayerIndex > 0
        ? [...normalizedPlayerIds.slice(firstPlayerIndex), ...normalizedPlayerIds.slice(0, firstPlayerIndex)]
        : [...normalizedPlayerIds];
    const players = Object.fromEntries(normalizedPlayerIds.map((playerId, index) => [playerId, createPlayer(playerId, index)]));
    const eventDeck = random.shuffle(FATE_EVENTS.map((event) => ({ ...event })));
    // CHM setup: shuffle ten ordinary situations, burn two, then reveal round one.
    const ordinarySituations = random.shuffle(FATE_SITUATIONS.filter(card => !card.climax));
    const [situation, ...situationDeck] = ordinarySituations.slice(2);
    const counts=fateSituationEventCounts(situation);
    const currentEvents=distributeFateRoundEvents(eventDeck.splice(0,counts.miyama+counts.shinto),situation);
    const battlefield=createBattlefield();battlefield.miyama.eventCards=currentEvents.miyama;battlefield.shinto.eventCards=currentEvents.shinto;
    for (const player of Object.values(players)) {
        player.mana = capFateMana(player.masterId, player.mana + situation.printedMana);
    }
    return {
        gameId: 'fate-domination',
        round: 1,
        phase: 'preparation',
        currentPlayerId: turnOrder[0],
        playerIds: normalizedPlayerIds,
        players,
        battlefield,
        situation,
        situationDeck,
        miyamaEvent: currentEvents.miyama[0] ?? FATE_EVENTS[0],
        shintoEventFaceDown: true,
        situationDeckCount: situationDeck.length,
        eventDeckCount: eventDeck.length,
        eventDiscardCount: 0,
        pendingChoice: { kind: 'identity', playerId: turnOrder[0] },
        battleResult: null,
        actionNotice: '准备阶段：局势牌与事件牌已翻开。',
        turnOrder,
        phaseCompletedPlayerIds: [],
        initialAttackHandDealtPlayerIds: [],
        currentTurnIndex: 0,
        actionLimit: 2,
        actionCount: 0,
        resolvedLocations: [],
        resolvedResults: [],
        eventDeck,
        eventDiscard: [],
        currentEvents,
        ruleState: createInitialFateRuleState(),
    };
}
