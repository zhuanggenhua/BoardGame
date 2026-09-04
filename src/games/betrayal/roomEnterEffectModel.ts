import type { RandomFn } from '../../engine/types';
import { rollBetrayalPip } from './diceRules';
import type {
    BetrayalCore,
    BetrayalRoomNode,
} from './game';
import {
    cloneBetrayalRoom,
    refreshExplorableRoomSlots,
    resolveDoorwayConnectionEdge,
    resolveOppositeRoomEdge,
} from './roomMapModel';
import { orientDoorwaysForPlacement } from './roomDiscoveryModel';
import type { BetrayalRoomFloor } from './scenarioConfig';

export type BetrayalRoomEnterEffect = 'mysticElevator';

export interface BetrayalRoomEnterEffectResult {
    kind: BetrayalRoomEnterEffect;
    playerId: string;
    roomId: string;
    roomName: string;
    rollTotal: number;
    dice: number[];
    destinationRoomId: string;
    destinationRoomName: string;
    destinationFloor: BetrayalRoomFloor;
}

function rollMysticElevatorWithDice(random: RandomFn): { total: number; dice: number[] } {
    const dice = [rollBetrayalPip(random), rollBetrayalPip(random)];
    return {
        total: dice.reduce((sum, pip) => sum + pip, 0),
        dice,
    };
}

function resolveMysticElevatorAllowedFloors(rollTotal: number): BetrayalRoomFloor[] {
    if (rollTotal >= 4) {
        return ['upper', 'ground', 'basement'];
    }
    if (rollTotal === 3) {
        return ['upper'];
    }
    if (rollTotal === 2) {
        return ['ground'];
    }
    return ['basement'];
}

export function resolveMysticElevatorDestination(
    core: BetrayalCore,
    rollTotal: number,
): BetrayalRoomNode | null {
    const allowedFloors = new Set(resolveMysticElevatorAllowedFloors(rollTotal));
    return core.rooms
        .filter((room) => room.state === 'unexplored' && allowedFloors.has(room.floor))
        .sort((left, right) => {
            const floorDelta = resolveMysticElevatorAllowedFloors(rollTotal).indexOf(left.floor)
                - resolveMysticElevatorAllowedFloors(rollTotal).indexOf(right.floor);
            if (floorDelta !== 0) {
                return floorDelta;
            }
            return left.id.localeCompare(right.id);
        })[0] ?? null;
}

export function resolveMysticElevatorEffect(
    core: BetrayalCore,
    random: RandomFn,
): BetrayalRoomEnterEffectResult | null {
    const currentRoom = core.rooms.find((room) => room.id === core.activeRoomId);
    if (!currentRoom || currentRoom.enterEffect !== 'mysticElevator') {
        return null;
    }
    const roll = rollMysticElevatorWithDice(random);
    const destination = resolveMysticElevatorDestination(core, roll.total);
    if (!destination) {
        return null;
    }
    return {
        kind: 'mysticElevator',
        playerId: core.currentExplorer.playerId,
        roomId: currentRoom.id,
        roomName: currentRoom.name,
        rollTotal: roll.total,
        dice: roll.dice,
        destinationRoomId: destination.id,
        destinationRoomName: destination.name,
        destinationFloor: destination.floor,
    };
}

function detachMysticElevator(
    rooms: BetrayalRoomNode[],
    elevatorRoomId: string,
): BetrayalRoomNode[] {
    return rooms.map((room) => {
        const nextRoom = cloneBetrayalRoom(room);
        if (nextRoom.id === elevatorRoomId) {
            return nextRoom;
        }
        nextRoom.connectedRoomIds = nextRoom.connectedRoomIds.filter((roomId) => roomId !== elevatorRoomId);
        nextRoom.doorways = nextRoom.doorways.map((doorway) => (
            doorway.connectsToRoomId === elevatorRoomId
                ? {
                    edge: doorway.edge,
                    leadsToFloor: doorway.leadsToFloor,
                    note: doorway.note,
                }
                : doorway
        ));
        return nextRoom;
    });
}

export function moveMysticElevatorRoom(
    rooms: BetrayalRoomNode[],
    effect: BetrayalRoomEnterEffectResult,
): BetrayalRoomNode[] {
    const destinationSlot = rooms.find((room) => room.id === effect.destinationRoomId);
    const elevator = rooms.find((room) => room.id === effect.roomId);
    if (!destinationSlot || !elevator) {
        return rooms;
    }
    const entryRoomId = destinationSlot.connectedRoomIds[0] ?? destinationSlot.doorways[0]?.connectsToRoomId;
    const entryRoom = entryRoomId ? rooms.find((room) => room.id === entryRoomId) : null;
    const entryEdge = entryRoom
        ? resolveDoorwayConnectionEdge(entryRoom, destinationSlot.id) ?? destinationSlot.entryEdge ?? destinationSlot.doorways[0]?.edge ?? 'west'
        : destinationSlot.entryEdge ?? destinationSlot.doorways[0]?.edge ?? 'west';
    const baseEdges = Array.from(new Set(elevator.doorways.map((doorway) => doorway.edge)));
    const oriented = orientDoorwaysForPlacement(baseEdges, entryEdge);
    const detachedRooms = detachMysticElevator(rooms, elevator.id)
        .filter((room) => room.id !== destinationSlot.id);

    return refreshExplorableRoomSlots(detachedRooms.map((room) => {
        if (room.id !== elevator.id) {
            return room;
        }
        return {
            ...room,
            floor: destinationSlot.floor,
            x: destinationSlot.x,
            y: destinationSlot.y,
            entryRoomId,
            entryEdge,
            orientationTurns: oriented.orientationTurns,
            doorways: [
                ...oriented.doorways,
                ...(entryRoomId
                    ? [{
                        edge: resolveOppositeRoomEdge(entryEdge),
                        connectsToRoomId: entryRoomId,
                    }]
                    : []),
            ],
            connectedRoomIds: entryRoomId ? [entryRoomId] : [],
        };
    }));
}
