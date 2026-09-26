import type { RandomFn, PlayerId } from '../../../engine/types';
import { FATE_ATTACK_CARDS, FATE_EVENTS, FATE_SERVANTS, FATE_SITUATIONS, FATE_MASTERS } from '../data';
import type { BattlefieldState, CardInstance, FateDominationCore, LocationId, PlayerState } from './types';

const createDeck = (playerId: PlayerId, servantId: string): CardInstance[] => {
    const servant = FATE_SERVANTS.find((item) => item.id === servantId);
    const ids = servant?.deck?.length ? servant.deck : FATE_ATTACK_CARDS.filter((card) => card.basePower > 0).slice(0, 12).map((card) => card.id);
    return ids.map((definitionId, index) => ({ id: `${playerId}:${definitionId}:${index}`, definitionId }));
};

const createBattlefield = (): Record<LocationId, BattlefieldState> => ({
    workshop: { id: 'workshop', label: '魔术工房', movementCost: 0, terrainPower: 0, competitionVictoryPoints: 0, capacity: 4, playerIds: [], eventCards: [] },
    miyama: { id: 'miyama', label: '深山町', movementCost: 1, terrainPower: 2, competitionVictoryPoints: 2, capacity: null, playerIds: [], eventCards: [] },
    shinto: { id: 'shinto', label: '新都', movementCost: 2, terrainPower: 3, competitionVictoryPoints: 3, capacity: null, playerIds: [], eventCards: [] },
    recon: { id: 'recon', label: '侦察', movementCost: 0, terrainPower: 0, competitionVictoryPoints: 0, capacity: 1, playerIds: [], eventCards: [] },
});

const createPlayer = (playerId: PlayerId, index: number, _random: RandomFn): PlayerState => {
    const master = index === 0
        ? (FATE_MASTERS.find((item) => item.name === '卫宫士郎') ?? FATE_MASTERS[0])
        : FATE_MASTERS[index % FATE_MASTERS.length];
    const servant = index === 0 ? (FATE_SERVANTS.find((item) => item.id === 'servant-saber') ?? FATE_SERVANTS[0]) : FATE_SERVANTS[index % FATE_SERVANTS.length];
    const deck = createDeck(playerId, servant.id);
    return {
        id: playerId,
        masterId: master.id,
        servantId: servant.id,
        locationId: null,
        mana: master.initMana ?? 4,
        victoryPoints: 0,
        commandSpells: 3,
        hand: deck.splice(0, 6),
        selectedAttackIds: [],
        activeAttackIds: [],
        discard: [],
        deck,
        hasPassedAction: false,
        eliminated: false,
        isRevealed: false,
        activeSkills: [],
        skills: [
            ...(master.skills ?? []),
            ...(servant.skillCards ?? []),
        ].map((skill, skillIndex) => ({ ...skill, id: `${skill.id ?? skill.name}:${skillIndex}` })),
    };
};

export function createInitialFateDominationCore(playerIds: PlayerId[], random: RandomFn): FateDominationCore {
    const normalizedPlayerIds = playerIds.length > 0 ? playerIds : ['0', '1', '2'];
    const players = Object.fromEntries(normalizedPlayerIds.map((playerId, index) => [playerId, createPlayer(playerId, index, random)]));
    const eventDeck = random.shuffle(FATE_EVENTS.filter((event) => event.name !== '命运之战').map((event) => ({ ...event })));
    const canonicalEvent = FATE_EVENTS.find((event) => event.name === '命运之战') ?? FATE_EVENTS[0];
    const currentEvents = { miyama: canonicalEvent ? [{ ...canonicalEvent }] : [], shinto: eventDeck.splice(0, 1) };
    const battlefield = createBattlefield();
    return {
        gameId: 'fate-domination',
        round: 1,
        phase: 'preparation',
        currentPlayerId: normalizedPlayerIds[0],
        playerIds: normalizedPlayerIds,
        players,
        battlefield,
        situation: FATE_SITUATIONS[0],
        miyamaEvent: currentEvents.miyama[0] ?? FATE_EVENTS[0],
        shintoEventFaceDown: true,
        situationDeckCount: 12,
        eventDeckCount: eventDeck.length,
        eventDiscardCount: 0,
        pendingChoice: { kind: 'identity', playerId: normalizedPlayerIds[0] },
        battleResult: null,
        actionNotice: '准备阶段：局势牌与事件牌已翻开。',
        turnOrder: [...normalizedPlayerIds],
        currentTurnIndex: 0,
        actionLimit: 2,
        actionCount: 0,
        resolvedLocations: [],
        resolvedResults: [],
        eventDeck,
        eventDiscard: [],
        currentEvents,
    };
}
