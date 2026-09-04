import type {
    BetrayalCore,
    BetrayalRoomNode,
} from './game';
import {
    isBloodFromStoneHaunt,
    isStoneCherubMonster,
    resolveControlledRoomId,
    resolveLivingHeroExplorers,
} from './hauntScenarioReadModel';
import { isRoomInAnyLivingHeroLineOfSight } from './monsterActionReadModel';
import type { BetrayalRoomFloor } from './scenarioConfig';

export type BetrayalBloodFromStoneSetupPlacementSource =
    | 'explorer-tile'
    | 'extra-out-of-sight'
    | 'extra-player-choice';

export interface BetrayalBloodFromStoneSetupPlacement {
    monsterId: string;
    roomId: string;
    roomName: string;
    source: BetrayalBloodFromStoneSetupPlacementSource;
    playerId?: string;
    index: number;
}

export interface BetrayalBloodFromStoneSetupPlacementPlan {
    active: boolean;
    additionalStoneCherubCount: number;
    totalRequiredStoneCherubCount: number;
    placedStoneCherubCount: number;
    explorerPlacements: BetrayalBloodFromStoneSetupPlacement[];
    automaticExtraPlacements: BetrayalBloodFromStoneSetupPlacement[];
    playerChoicePlacements: BetrayalBloodFromStoneSetupPlacement[];
    placements: BetrayalBloodFromStoneSetupPlacement[];
    pendingPlayerChoiceCount: number;
    playerChoiceCandidateRoomIds: string[];
    legalRoomIds: string[];
    canFullyAutoPlace: boolean;
    ruleNotes: string[];
}

function resolveBloodFromStoneAdditionalStoneCherubCount(playerCount: number): number {
    return Math.max(3, Math.min(6, playerCount));
}

function compareBloodFromStoneSetupRooms(left: BetrayalRoomNode, right: BetrayalRoomNode): number {
    const floorOrder: Record<BetrayalRoomFloor, number> = { ground: 0, upper: 1, basement: 2 };
    const floorDelta = floorOrder[left.floor] - floorOrder[right.floor];
    if (floorDelta !== 0) {
        return floorDelta;
    }
    const yDelta = left.y - right.y;
    if (yDelta !== 0) {
        return yDelta;
    }
    const xDelta = left.x - right.x;
    if (xDelta !== 0) {
        return xDelta;
    }
    return left.id.localeCompare(right.id);
}

function createBloodFromStoneSetupPlacement(
    monsterId: string,
    room: BetrayalRoomNode,
    source: BetrayalBloodFromStoneSetupPlacementSource,
    index: number,
    playerId?: string,
): BetrayalBloodFromStoneSetupPlacement {
    return {
        monsterId,
        roomId: room.id,
        roomName: room.name,
        source,
        playerId,
        index,
    };
}

function parseBloodFromStoneExtraStoneCherubIndex(monsterId: string): number | null {
    const match = /^stone-cherub-extra-(\d+)$/.exec(monsterId);
    if (!match) {
        return null;
    }
    const index = Number(match[1]);
    return Number.isInteger(index) && index > 0 ? index : null;
}

function resolveBloodFromStonePlayerChoicePlacements(
    core: BetrayalCore,
    roomById: Map<string, BetrayalRoomNode>,
    automaticExtraPlacementCount: number,
): BetrayalBloodFromStoneSetupPlacement[] {
    return core.monsters
        .map((monster) => {
            if (!isStoneCherubMonster(monster)) {
                return null;
            }
            const index = parseBloodFromStoneExtraStoneCherubIndex(monster.id);
            const room = roomById.get(monster.roomId);
            if (!index || index <= automaticExtraPlacementCount || !room) {
                return null;
            }
            return createBloodFromStoneSetupPlacement(
                monster.id,
                room,
                'extra-player-choice',
                index,
            );
        })
        .filter((placement): placement is BetrayalBloodFromStoneSetupPlacement => Boolean(placement))
        .sort((left, right) => left.index - right.index || left.monsterId.localeCompare(right.monsterId));
}

export function resolveBloodFromStoneSelectedExtraStoneCherubPlacements(
    core: BetrayalCore,
    roomIds: string[],
    existingExtraPlacementCount: number,
): BetrayalBloodFromStoneSetupPlacement[] {
    const roomById = new Map(core.rooms.map((room) => [room.id, room]));
    return roomIds
        .map((roomId, index) => {
            const room = roomById.get(roomId);
            const placementIndex = existingExtraPlacementCount + index + 1;
            return room
                ? createBloodFromStoneSetupPlacement(
                    `stone-cherub-extra-${placementIndex}`,
                    room,
                    'extra-player-choice',
                    placementIndex,
                )
                : null;
        })
        .filter((placement): placement is BetrayalBloodFromStoneSetupPlacement => Boolean(placement));
}

export function resolveBloodFromStoneSetupPlacementPlan(
    core: BetrayalCore,
): BetrayalBloodFromStoneSetupPlacementPlan {
    const active = isBloodFromStoneHaunt(core);
    const livingHeroes = active ? resolveLivingHeroExplorers(core) : [];
    const additionalStoneCherubCount = active
        ? resolveBloodFromStoneAdditionalStoneCherubCount(core.playerIds.length)
        : 0;
    const discoveredRooms = active
        ? [...core.rooms]
            .filter((room) => room.state === 'discovered')
            .sort(compareBloodFromStoneSetupRooms)
        : [];
    const roomById = new Map(discoveredRooms.map((room) => [room.id, room]));
    const explorerPlacements = livingHeroes
        .map((explorer, index) => {
            const room = roomById.get(resolveControlledRoomId(core, explorer));
            return room
                ? createBloodFromStoneSetupPlacement(
                    `stone-cherub-explorer-${explorer.playerId}`,
                    room,
                    'explorer-tile',
                    index + 1,
                    explorer.playerId,
                )
                : null;
        })
        .filter((placement): placement is BetrayalBloodFromStoneSetupPlacement => Boolean(placement));
    const outOfSightRooms = discoveredRooms.filter((room) => !isRoomInAnyLivingHeroLineOfSight(core, room.id));
    const automaticExtraPlacements = outOfSightRooms
        .slice(0, additionalStoneCherubCount)
        .map((room, index) => createBloodFromStoneSetupPlacement(
            `stone-cherub-extra-${index + 1}`,
            room,
            'extra-out-of-sight',
            index + 1,
        ));
    const playerChoicePlacements = resolveBloodFromStonePlayerChoicePlacements(
        core,
        roomById,
        automaticExtraPlacements.length,
    );
    const pendingPlayerChoiceCount = Math.max(
        0,
        additionalStoneCherubCount - automaticExtraPlacements.length - playerChoicePlacements.length,
    );
    const placements = [...explorerPlacements, ...automaticExtraPlacements, ...playerChoicePlacements];
    return {
        active,
        additionalStoneCherubCount,
        totalRequiredStoneCherubCount: livingHeroes.length + additionalStoneCherubCount,
        placedStoneCherubCount: placements.length,
        explorerPlacements,
        automaticExtraPlacements,
        playerChoicePlacements,
        placements,
        pendingPlayerChoiceCount,
        playerChoiceCandidateRoomIds: pendingPlayerChoiceCount > 0 ? discoveredRooms.map((room) => room.id) : [],
        legalRoomIds: discoveredRooms.map((room) => room.id),
        canFullyAutoPlace: active && pendingPlayerChoiceCount === 0,
        ruleNotes: active
            ? [
                '每名存活英雄所在房间先各放置 1 个石像小天使。',
                '额外石像小天使数量按玩家数取 3/4/5/6。',
                pendingPlayerChoiceCount > 0
                    ? '不在英雄视线内的房间不足，剩余石像小天使必须由玩家选择屋内合法房间放置。'
                    : '额外石像小天使均已自动放在不在英雄视线内的房间。',
            ]
            : ['当前不是第5号作祟《顽石之血》，没有石像小天使 setup 放置计划。'],
    };
}
