import type { PlayerId } from '../../../engine/types';
import type { ArenaZoneId, MageWarsWallEdgeId } from './ids';
import { ARENA_ZONE_IDS, getMageWarsWallEdgeId } from './ids';
import type { MageWarsArenaObjectState, MageWarsCore, MageWarsPlayerState, MageWarsWallState } from './types';

export function getOpponentId(core: MageWarsCore, playerId: PlayerId): PlayerId {
    return core.playerOrder.find((candidate) => candidate !== playerId) ?? playerId;
}

export function updatePlayer(
    core: MageWarsCore,
    playerId: PlayerId,
    updater: (player: MageWarsPlayerState) => MageWarsPlayerState,
): MageWarsCore {
    const player = core.players[playerId];
    if (!player) return core;

    const nextPlayer = updater(player);
    if (nextPlayer === player) return core;

    return {
        ...core,
        players: {
            ...core.players,
            [playerId]: nextPlayer,
        },
    };
}

export function getArenaZone(core: MageWarsCore, zoneId: ArenaZoneId) {
    return core.arena.find((zone) => zone.id === zoneId);
}

export function getArenaObject(core: MageWarsCore, objectId: string): MageWarsArenaObjectState | undefined {
    return core.objects[objectId];
}

export function isArenaZoneId(value: unknown): value is ArenaZoneId {
    return typeof value === 'string'
        && (Object.values(ARENA_ZONE_IDS) as string[]).includes(value);
}

export function areAdjacentZones(core: MageWarsCore, leftId: ArenaZoneId, rightId: ArenaZoneId): boolean {
    if (leftId === rightId) return false;
    const left = getArenaZone(core, leftId);
    const right = getArenaZone(core, rightId);
    if (!left || !right) return false;
    return Math.abs(left.row - right.row) + Math.abs(left.col - right.col) === 1;
}

export function resolveMageWarsWallEdgeZones(
    core: MageWarsCore,
    edgeId: MageWarsWallEdgeId | undefined,
): [ArenaZoneId, ArenaZoneId] | undefined {
    if (!edgeId) return undefined;
    const [left, right, extra] = edgeId.split('-');
    if (extra !== undefined || !isArenaZoneId(left) || !isArenaZoneId(right)) return undefined;
    if (getMageWarsWallEdgeId(left, right) !== edgeId) return undefined;
    if (!areAdjacentZones(core, left, right)) return undefined;
    return [left, right];
}

export function getMageWarsWallForEdge(
    core: MageWarsCore,
    edgeId: MageWarsWallEdgeId,
): MageWarsWallState | undefined {
    return core.walls?.[edgeId];
}

export function getMageWarsWallBetweenZones(
    core: MageWarsCore,
    leftId: ArenaZoneId,
    rightId: ArenaZoneId,
): MageWarsWallState | undefined {
    if (!areAdjacentZones(core, leftId, rightId)) return undefined;
    return getMageWarsWallForEdge(core, getMageWarsWallEdgeId(leftId, rightId));
}

function getZoneAt(core: MageWarsCore, row: number, col: number): ArenaZoneId | undefined {
    return core.arena.find((zone) => zone.row === row && zone.col === col)?.id;
}

export function doesMageWarsWallBlockLineOfSight(
    core: MageWarsCore,
    fromZoneId: ArenaZoneId,
    toZoneId: ArenaZoneId,
): boolean {
    if (fromZoneId === toZoneId) return false;
    const from = getArenaZone(core, fromZoneId);
    const to = getArenaZone(core, toZoneId);
    if (!from || !to) return false;

    if (areAdjacentZones(core, fromZoneId, toZoneId)) {
        return getMageWarsWallBetweenZones(core, fromZoneId, toZoneId)?.blocksLineOfSight === true;
    }

    if (from.row === to.row) {
        const minCol = Math.min(from.col, to.col);
        const maxCol = Math.max(from.col, to.col);
        for (let col = minCol; col < maxCol; col += 1) {
            const left = getZoneAt(core, from.row, col);
            const right = getZoneAt(core, from.row, col + 1);
            if (left && right && getMageWarsWallBetweenZones(core, left, right)?.blocksLineOfSight === true) {
                return true;
            }
        }
        return false;
    }

    if (from.col === to.col) {
        const minRow = Math.min(from.row, to.row);
        const maxRow = Math.max(from.row, to.row);
        for (let row = minRow; row < maxRow; row += 1) {
            const upper = getZoneAt(core, row, from.col);
            const lower = getZoneAt(core, row + 1, from.col);
            if (upper && lower && getMageWarsWallBetweenZones(core, upper, lower)?.blocksLineOfSight === true) {
                return true;
            }
        }
    }

    return false;
}

export function isSpellPrepared(player: MageWarsPlayerState, spellCardId: number): boolean {
    return player.preparedSpellCardIds.includes(spellCardId);
}

export function moveArenaOccupant(
    core: MageWarsCore,
    playerId: PlayerId,
    fromZoneId: ArenaZoneId,
    toZoneId: ArenaZoneId,
): MageWarsCore {
    return {
        ...core,
        arena: core.arena.map((zone) => {
            if (zone.id === fromZoneId) {
                return {
                    ...zone,
                    occupantIds: zone.occupantIds.filter((occupantId) => occupantId !== playerId),
                };
            }
            if (zone.id === toZoneId) {
                return zone.occupantIds.includes(playerId)
                    ? zone
                    : { ...zone, occupantIds: [...zone.occupantIds, playerId] };
            }
            return zone;
        }),
    };
}

export function moveArenaObject(
    core: MageWarsCore,
    objectId: string,
    fromZoneId: ArenaZoneId,
    toZoneId: ArenaZoneId,
): MageWarsCore {
    const object = getArenaObject(core, objectId);
    if (!object) return core;

    const moved: MageWarsCore = {
        ...core,
        objects: {
            ...core.objects,
            [objectId]: {
                ...object,
                zoneId: toZoneId,
            },
        },
        arena: core.arena.map((zone) => {
            if (zone.id === fromZoneId) {
                return {
                    ...zone,
                    objectIds: zone.objectIds.filter((candidate) => candidate !== objectId),
                    conjurationIds: zone.conjurationIds.filter((candidate) => candidate !== objectId),
                };
            }
            if (zone.id === toZoneId) {
                const nextObjectIds = zone.objectIds.includes(objectId)
                    ? zone.objectIds
                    : [...zone.objectIds, objectId];
                const nextConjurationIds = object.kind === 'conjuration' && !zone.conjurationIds.includes(objectId)
                    ? [...zone.conjurationIds, objectId]
                    : zone.conjurationIds;
                return {
                    ...zone,
                    objectIds: nextObjectIds,
                    conjurationIds: nextConjurationIds,
                };
            }
            return zone;
        }),
    };

    const attachedObjectIds = Object.values(core.objects)
        .filter((candidate) => candidate.anchoredToObjectId === objectId)
        .map((candidate) => candidate.id);

    return attachedObjectIds.reduce(
        (nextCore, attachedObjectId) => removeArenaObject(nextCore, attachedObjectId),
        moved,
    );
}

export function addArenaObject(core: MageWarsCore, object: MageWarsArenaObjectState): MageWarsCore {
    const zone = getArenaZone(core, object.zoneId);
    if (!zone) return core;

    return {
        ...core,
        objects: {
            ...core.objects,
            [object.id]: object,
        },
        arena: core.arena.map((candidate) => {
            if (candidate.id !== object.zoneId) return candidate;
            return {
                ...candidate,
                objectIds: candidate.objectIds.includes(object.id)
                    ? candidate.objectIds
                    : [...candidate.objectIds, object.id],
                conjurationIds: object.kind === 'conjuration' && !candidate.conjurationIds.includes(object.id)
                    ? [...candidate.conjurationIds, object.id]
                    : candidate.conjurationIds,
            };
        }),
    };
}

export function updateArenaObject(
    core: MageWarsCore,
    objectId: string,
    updater: (object: MageWarsArenaObjectState) => MageWarsArenaObjectState,
): MageWarsCore {
    const object = core.objects[objectId];
    if (!object) return core;

    const nextObject = updater(object);
    if (nextObject === object) return core;

    return {
        ...core,
        objects: {
            ...core.objects,
            [objectId]: nextObject,
        },
    };
}

export function removeArenaObject(core: MageWarsCore, objectId: string): MageWarsCore {
    if (!core.objects[objectId]) return core;

    const objectIdsToRemove = new Set<string>([objectId]);
    let changed = true;
    while (changed) {
        changed = false;
        for (const candidate of Object.values(core.objects)) {
            if (
                candidate.anchoredToObjectId
                && objectIdsToRemove.has(candidate.anchoredToObjectId)
                && !objectIdsToRemove.has(candidate.id)
            ) {
                objectIdsToRemove.add(candidate.id);
                changed = true;
            }
        }
    }

    const remainingObjects = Object.fromEntries(
        Object.entries(core.objects).flatMap(([candidateId, candidate]) => {
            if (objectIdsToRemove.has(candidateId)) return [];
            if (!candidate.restrainedByObjectId || !objectIdsToRemove.has(candidate.restrainedByObjectId)) {
                return [[candidateId, candidate]];
            }
            const { restrainedByObjectId: _restrainedByObjectId, ...unrestrained } = candidate;
            return [[candidateId, unrestrained]];
        }),
    );

    return {
        ...core,
        objects: remainingObjects,
        arena: core.arena.map((zone) => {
            return {
                ...zone,
                objectIds: zone.objectIds.filter((candidate) => !objectIdsToRemove.has(candidate)),
                conjurationIds: zone.conjurationIds.filter((candidate) => !objectIdsToRemove.has(candidate)),
            };
        }),
    };
}

export function resolveTargetZoneForObjectOrPlayer(
    core: MageWarsCore,
    payload: { targetObjectId?: string; targetPlayerId?: PlayerId; targetZoneId?: ArenaZoneId },
): ArenaZoneId | undefined {
    if (payload.targetZoneId) return payload.targetZoneId;
    if (payload.targetObjectId) return getArenaObject(core, payload.targetObjectId)?.zoneId;
    if (payload.targetPlayerId) return core.players[payload.targetPlayerId]?.mageZoneId;
    return undefined;
}

export function getCreatureObjectIdsForOwner(core: MageWarsCore, ownerId: PlayerId): string[] {
    return Object.values(core.objects)
        .filter((object) => object.ownerId === ownerId && object.kind === 'creature')
        .map((object) => object.id);
}
