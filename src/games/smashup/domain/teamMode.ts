import type { PlayerId } from '../../../engine/types';
import type { AiRelationToActor } from '../../../engine/ai';
import type { SmashUpCore, SmashUpTeamId, SmashUpTeamMode } from './types';
import { TEAM_VP_TO_WIN_2V2, VP_TO_WIN } from './types';
export { readSmashUpTeamMode } from '../roomSetup';

export const DEFAULT_SMASHUP_TEAM_MODE: SmashUpTeamMode = 'ffa';
export const SMASHUP_TEAM_MODE_OPTIONS = {
    off: DEFAULT_SMASHUP_TEAM_MODE,
    twoVsTwo: '2v2' as SmashUpTeamMode,
};
export const SMASHUP_TEAM_IDS: readonly SmashUpTeamId[] = ['team_13', 'team_24'];

function buildSeatOrderFallback(core: Pick<SmashUpCore, 'players' | 'turnOrder'>): PlayerId[] {
    const playerIds = Object.keys(core.players) as PlayerId[];
    const allNumeric = playerIds.every((playerId) => Number.isFinite(Number(playerId)));
    if (allNumeric && playerIds.length === core.turnOrder.length) {
        return [...playerIds].sort((left, right) => Number(left) - Number(right));
    }
    return [...core.turnOrder];
}

export function getSmashUpSeatOrder(core: Pick<SmashUpCore, 'seatOrder' | 'players' | 'turnOrder'>): PlayerId[] {
    if (Array.isArray(core.seatOrder) && core.seatOrder.length === core.turnOrder.length) {
        return [...core.seatOrder];
    }
    return buildSeatOrderFallback(core);
}

export function isSmashUpTwoVsTwoMode(
    core: Pick<SmashUpCore, 'teamMode' | 'turnOrder'>,
): boolean {
    return core.teamMode === '2v2' && core.turnOrder.length === 4;
}

export function getSmashUpVictoryTarget(
    core: Pick<SmashUpCore, 'teamMode' | 'turnOrder' | 'victoryTarget'> | undefined,
): number {
    if (
        typeof core?.victoryTarget === 'number'
        && Number.isFinite(core.victoryTarget)
        && core.victoryTarget > 0
        && core.victoryTarget !== VP_TO_WIN
    ) {
        return core.victoryTarget;
    }
    return core && isSmashUpTwoVsTwoMode(core) ? TEAM_VP_TO_WIN_2V2 : VP_TO_WIN;
}

export function getSmashUpTeamIdForSeatIndex(seatIndex: number): SmashUpTeamId | undefined {
    if (seatIndex === 0 || seatIndex === 2) {
        return 'team_13';
    }
    if (seatIndex === 1 || seatIndex === 3) {
        return 'team_24';
    }
    return undefined;
}

export function getSmashUpTeamIdForPlayer(
    core: Pick<SmashUpCore, 'seatOrder' | 'players' | 'turnOrder' | 'teamMode'>,
    playerId: PlayerId,
): SmashUpTeamId | undefined {
    if (!isSmashUpTwoVsTwoMode(core)) {
        return undefined;
    }

    const seatOrder = getSmashUpSeatOrder(core);
    const seatIndex = seatOrder.indexOf(playerId);
    if (seatIndex >= 0) {
        return getSmashUpTeamIdForSeatIndex(seatIndex);
    }

    if (Number.isFinite(Number(playerId))) {
        return getSmashUpTeamIdForSeatIndex(Number(playerId));
    }

    return undefined;
}

export function getSmashUpRelationToPlayer(
    core: Pick<SmashUpCore, 'seatOrder' | 'players' | 'turnOrder' | 'teamMode'>,
    actorPlayerId: PlayerId | undefined,
    targetPlayerId: PlayerId | undefined,
): AiRelationToActor | undefined {
    if (!actorPlayerId || !targetPlayerId) {
        return undefined;
    }
    if (actorPlayerId === targetPlayerId) {
        return 'self';
    }

    const actorTeamId = getSmashUpTeamIdForPlayer(core, actorPlayerId);
    const targetTeamId = getSmashUpTeamIdForPlayer(core, targetPlayerId);
    if (actorTeamId && targetTeamId && actorTeamId === targetTeamId) {
        return 'ally';
    }

    return 'enemy';
}

export function getSmashUpTeamMembers(
    core: Pick<SmashUpCore, 'seatOrder' | 'players' | 'turnOrder' | 'teamMode'>,
    teamId: SmashUpTeamId,
): PlayerId[] {
    if (!isSmashUpTwoVsTwoMode(core)) {
        return [];
    }

    const seatOrder = getSmashUpSeatOrder(core);
    const seatIndices = teamId === 'team_13' ? [0, 2] : [1, 3];
    return seatIndices
        .map((seatIndex) => seatOrder[seatIndex])
        .filter((playerId): playerId is PlayerId => typeof playerId === 'string');
}

export function getSmashUpTeamScores(
    core: Pick<SmashUpCore, 'seatOrder' | 'players' | 'turnOrder' | 'teamMode'>,
    playerScores: Record<PlayerId, number>,
): Record<SmashUpTeamId, number> {
    const teamScores: Record<SmashUpTeamId, number> = {
        team_13: 0,
        team_24: 0,
    };

    if (!isSmashUpTwoVsTwoMode(core)) {
        return teamScores;
    }

    for (const teamId of SMASHUP_TEAM_IDS) {
        teamScores[teamId] = getSmashUpTeamMembers(core, teamId)
            .reduce((sum, playerId) => sum + (playerScores[playerId] ?? 0), 0);
    }

    return teamScores;
}

export function getSmashUpRawTeamVpTotals(
    core: Pick<SmashUpCore, 'seatOrder' | 'players' | 'turnOrder' | 'teamMode'>,
): Record<SmashUpTeamId, number> {
    const rawScores = Object.fromEntries(
        Object.entries(core.players).map(([playerId, player]) => [playerId, player?.vp ?? 0]),
    ) as Record<PlayerId, number>;

    return getSmashUpTeamScores(core, rawScores);
}
