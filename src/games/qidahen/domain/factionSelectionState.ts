import type {
    QidahenCore,
    QidahenEvent,
    QidahenFactionId,
} from './types';

const buildFactionPlayerIds = (
    state: QidahenCore,
    selections: NonNullable<QidahenCore['factionSelection']>['selections'],
): Partial<Record<QidahenFactionId, string>> => (
    Object.fromEntries(
        Object.entries(selections).map(([playerId, factionId]) => [factionId, playerId]),
    ) as Partial<Record<QidahenFactionId, string>>
);

export const resolveQidahenFactionSelectedEvent = (
    state: QidahenCore,
    event: Extract<QidahenEvent, { type: 'FACTION_SELECTED' }>,
): QidahenCore => {
    const selectionState = state.factionSelection;
    if (!selectionState || !state.playerIds.includes(event.payload.playerId)) {
        return state;
    }
    if (!selectionState.availableFactionIds.includes(event.payload.factionId)) {
        return state;
    }
    const factionTakenByAnotherPlayer = Object.entries(selectionState.selections).some(
        ([playerId, factionId]) => playerId !== event.payload.playerId && factionId === event.payload.factionId,
    );
    if (factionTakenByAnotherPlayer) {
        return state;
    }

    const selections = {
        ...selectionState.selections,
        [event.payload.playerId]: event.payload.factionId,
    };
    const allPlayersSelected = state.playerIds.every((playerId) => selections[playerId] != null);
    const selectedFactionName = state.factions[event.payload.factionId].name;

    if (!allPlayersSelected) {
        return {
            ...state,
            factionSelection: {
                ...selectionState,
                selections,
            },
            actionLog: [
                ...state.actionLog,
                {
                    id: `log-faction-selection-${event.timestamp}`,
                    faction: event.payload.factionId,
                    text: `一位玩家已确认${selectedFactionName}。`,
                },
            ],
        };
    }

    const playerIdsByFaction = buildFactionPlayerIds(state, selections);
    const factions = Object.fromEntries(
        Object.entries(state.factions).map(([factionId, faction]) => [
            factionId,
            {
                ...faction,
                playerId: playerIdsByFaction[factionId as QidahenFactionId] ?? faction.playerId,
            },
        ]),
    ) as QidahenCore['factions'];
    const openingFactionId = state.currentFactionOrder[0] ?? 'ming';

    return {
        ...state,
        factionSelection: null,
        factions,
        currentPlayer: factions[openingFactionId].playerId,
        actionLog: [
            ...state.actionLog,
            {
                id: `log-faction-selection-final-${event.timestamp}`,
                faction: openingFactionId,
                text: '全部玩家已确认阵营，进入人物与军备前置。',
            },
        ],
    };
};
