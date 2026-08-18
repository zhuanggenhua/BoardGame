import type { PlayerId } from '../../../engine/types';
import type { DiceThroneCore, DiceThroneRollContext, DtResponseWindowType, TeamId } from './types';

const TEAM_MODE_PLAYER_COUNT = 4;

export const isTeamMode = (state: DiceThroneCore): boolean => (
    Object.keys(state.players).length === TEAM_MODE_PLAYER_COUNT
);

export const getSeatingOrder = (state: DiceThroneCore): PlayerId[] => {
    const fallbackOrder = Object.keys(state.players) as PlayerId[];
    const seatingOrder = state.seatingOrder?.filter((playerId) => !!state.players[playerId]) ?? [];
    return seatingOrder.length === fallbackOrder.length ? seatingOrder : fallbackOrder;
};

const deriveTeamIdFromSeatIndex = (seatIndex: number): TeamId => (
    seatIndex % 2 === 0 ? 'A' : 'B'
);

export const buildTeamIdByPlayerIdFromSeatingOrder = (
    seatingOrder: PlayerId[],
): Record<PlayerId, TeamId> => seatingOrder.reduce((teamIdByPlayerId, playerId, seatIndex) => {
    teamIdByPlayerId[playerId] = deriveTeamIdFromSeatIndex(seatIndex);
    return teamIdByPlayerId;
}, {} as Record<PlayerId, TeamId>);

export const getTeamIdByPlayerIdMap = (state: DiceThroneCore): Record<PlayerId, TeamId> => {
    const playerIds = Object.keys(state.players) as PlayerId[];
    const explicitMap = state.teamIdByPlayerId;
    if (explicitMap && playerIds.every((playerId) => explicitMap[playerId])) {
        return explicitMap as Record<PlayerId, TeamId>;
    }

    const derivedMap = buildTeamIdByPlayerIdFromSeatingOrder(getSeatingOrder(state));
    for (const playerId of playerIds) {
        if (!derivedMap[playerId]) derivedMap[playerId] = 'A';
    }
    return derivedMap;
};

export const getTeamId = (state: DiceThroneCore, playerId: PlayerId): TeamId | undefined => {
    if (!state.players[playerId]) return undefined;
    if (!isTeamMode(state)) return 'A';
    return getTeamIdByPlayerIdMap(state)[playerId];
};

export const areTeammates = (state: DiceThroneCore, playerA: PlayerId, playerB: PlayerId): boolean => {
    if (!state.players[playerA] || !state.players[playerB]) return false;
    if (!isTeamMode(state)) return playerA === playerB;
    const teamA = getTeamId(state, playerA);
    const teamB = getTeamId(state, playerB);
    return !!teamA && teamA === teamB;
};

/** 当前骰区策略的唯一操作者判定。 */
export const isPlayerAllowedByRollContextPolicy = (
    state: DiceThroneCore,
    context: DiceThroneRollContext,
    playerId: PlayerId,
    action: 'modify' | 'reroll',
): boolean => {
    if (!state.players[playerId]) return false;

    const scope = action === 'modify'
        ? context.policy.modifiableBy
        : context.policy.rerollableBy;
    if (scope === 'none') return false;
    if (scope === 'any') return true;

    const isOwner = context.ownerPlayerId === playerId;
    if (scope === 'owner') return isOwner;

    const isAlly = areTeammates(state, context.ownerPlayerId, playerId);
    if (scope === 'allies') return isAlly;
    if (scope === 'opponents') return !isAlly;

    return isOwner || context.targetPlayerId === playerId;
};

const isConfirmedRollInterferenceWindow = (
    context: DiceThroneRollContext,
    responseWindowType?: DtResponseWindowType,
): boolean => (
    responseWindowType === 'afterRollConfirmed'
    && context.status === 'settling'
    && context.display.replayOnly !== true
    && context.policy.allowDiceCardTargeting === true
);

export const isPlayerAllowedToPassiveRerollCurrentRoll = (
    state: DiceThroneCore,
    context: DiceThroneRollContext,
    playerId: PlayerId,
    options: { responseWindowType?: DtResponseWindowType; allowConfirmedRollInterference?: boolean } = {},
): boolean => {
    if (context.policy.allowPassiveReroll !== true) return false;
    if (context.policy.rerollableBy === 'none') return false;
    if (isPlayerAllowedByRollContextPolicy(state, context, playerId, 'reroll')) {
        return true;
    }

    if (!isConfirmedRollInterferenceWindow(context, options.responseWindowType)) {
        return false;
    }
    if (options.allowConfirmedRollInterference !== true) {
        return false;
    }

    return isPlayerAllowedByRollContextPolicy(
        state,
        {
            ...context,
            policy: {
                ...context.policy,
                rerollableBy: 'opponents',
            },
        },
        playerId,
        'reroll',
    );
};
