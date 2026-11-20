import { FATE_EVENTS, FATE_MASTER_BY_ID, FATE_SERVANT_BY_ID, FATE_SITUATIONS } from '../../data';
import { createFateAttackDeck, type FateDominationCore } from '../../domain';

export type SaberDayTenCase = 'safe' | 'counter' | 'pressure' | 'refill';

export function prepareSaberDayTen(core: FateDominationCore, scenario: SaberDayTenCase, { saberId, rivalId, workshopId, firstId = saberId }: {
    saberId: string; rivalId: string; workshopId: string; firstId?: string;
}) {
    const events = [FATE_EVENTS.find(card => card.id === 'fuyuki_E0')!];
    if (scenario === 'refill') events.push(FATE_EVENTS.find(card => card.id === 'fuyuki_E18')!);
    core.round = 10;
    core.phase = 'action';
    core.situation = FATE_SITUATIONS.find(card => card.id === 'sit12')!;
    core.currentEvents = { miyama: events, shinto: [] };
    core.turnOrder = [rivalId, workshopId, saberId];
    core.currentPlayerId = firstId;
    core.currentTurnIndex = core.turnOrder.indexOf(firstId);
    core.battlefield.miyama = { ...core.battlefield.miyama, playerIds: [rivalId, saberId], eventCards: events };
    core.battlefield.workshop = { ...core.battlefield.workshop, playerIds: [workshopId], eventCards: [] };
    core.battlefield.shinto = { ...core.battlefield.shinto, playerIds: [], eventCards: [] };

    const seats = [
        { id: saberId, masterId: 'm_shirou_emiya', servantId: 'servant-saber', locationId: 'miyama', deploymentSlot: 1,
            cards: ['cardB3', 'cardB2'], score: scenario === 'counter' || scenario === 'pressure' ? 12 : 19 },
        { id: rivalId, masterId: 'm_iliya', servantId: 'servant-heracles', locationId: 'miyama', deploymentSlot: 0,
            cards: scenario === 'pressure' || scenario === 'refill' ? ['cardB6', 'cardQ5'] : scenario === 'counter' ? ['cardB6', 'cardB5'] : ['cardB1', 'cardB1'], score: 19 },
        { id: workshopId, masterId: 'm_shinji', servantId: 'servant-medusa', locationId: 'workshop', deploymentSlot: 0,
            cards: ['cardB1', 'cardB2'], score: 30 },
    ] as const;
    for (const { id, masterId, servantId, locationId, deploymentSlot, cards, score } of seats) {
        const deck = createFateAttackDeck(id, servantId);
        const hand = cards.map(definitionId => {
            const card = deck.findIndex(card => card.definitionId === definitionId);
            if (card === -1) throw new Error(`Missing card ${definitionId} in ${servantId}`);
            return deck.splice(card, 1)[0];
        });
        Object.assign(core.players[id], {
            masterId, servantId, locationId, deploymentSlot, deck, hand,
            skills: [...(FATE_MASTER_BY_ID[masterId].skills ?? []), ...(FATE_SERVANT_BY_ID[servantId].skillCards ?? [])]
                .map((skill, index) => ({ ...skill, id: `${skill.id}:${index}` })),
            mana: id === saberId ? 8 : 0,
            commandSpells: 0,
            victoryPoints: score,
            activeAttackIds: id === saberId ? [] : hand.map(card => card.id),
            normalAttackPlayed: id !== saberId,
            hasPassedAction: id !== saberId && id !== firstId,
        });
    }
}
