import PF from 'pathfinding';
import { BETRAYAL_DISCOVERY_POOLS } from '../../../src/games/betrayal/scenarioConfig';
import { BETRAYAL_ROOM_TILE_VISUALS } from '../../../src/games/betrayal/roomAtlas';

export const TILE = 4.6;
export const RADIUS = 0.29;
const directions = ['north', 'west', 'south', 'east'];
const offsets = [[0, -1], [-1, 0], [0, 1], [1, 0]];
type Room = { tile: number; x: number; z: number; turns?: number };
type FurnitureKind = 'table' | 'desk' | 'chair' | 'shelf';
export type Obstacle = { x: number; z: number; w: number; d: number; kind?: FurnitureKind };
export type Blocker = { x: number; z: number; radius: number };
export type Edge = { room: number; side: number; open: boolean; connected: boolean; neighbor: number };

function rotateDoorway(doorway: string, turns: number) {
  const index = directions.indexOf(doorway);
  if (index < 0) return doorway;
  return directions[(index + turns + directions.length) % directions.length];
}

function addBlocker(matrix: number[][], world: (index: number) => number, obstacle: Obstacle | Blocker) {
  const extraPadding = 'radius' in obstacle ? obstacle.radius * 0.12 : RADIUS * 0.12;
  const halfW = 'radius' in obstacle ? obstacle.radius + RADIUS : obstacle.w / 2 + RADIUS;
  const halfD = 'radius' in obstacle ? obstacle.radius + RADIUS : obstacle.d / 2 + RADIUS;
  for (let z = 0; z < matrix.length; z++) for (let x = 0; x < matrix[z].length; x++) {
    const px = world(x), pz = world(z);
    if (Math.abs(px - obstacle.x) <= halfW + extraPadding && Math.abs(pz - obstacle.z) <= halfD + extraPadding) {
      matrix[z][x] = 1;
    }
  }
}

export function layout(rooms: Room[]) {
  const templates = Object.values(BETRAYAL_DISCOVERY_POOLS.roomDiscoveryByFloor).flat();
  const doors = rooms.map(room => {
    const template = templates.find(t => {
      const visual = BETRAYAL_ROOM_TILE_VISUALS[t.visualId as keyof typeof BETRAYAL_ROOM_TILE_VISUALS];
      return visual?.image === 'betrayal/rooms/room-front-atlas' && visual.frameIndex === room.tile;
    });
    if (!template) throw new Error(`Missing room door source: ${room.tile}`);
    return (template.doorways as readonly string[]).map(doorway => rotateDoorway(doorway, room.turns ?? 0));
  });
  const edges: Edge[] = [];
  const obstacles: Obstacle[] = [];
  rooms.forEach((room, index) => offsets.forEach(([dx, dz], side) => {
    const neighbor = rooms.findIndex(r => r.x === room.x + dx && r.z === room.z + dz);
    if (neighbor >= 0 && neighbor < index) return;
    const open = doors[index].includes(directions[side]) && (neighbor < 0 || doors[neighbor].includes(directions[(side + 2) % 4]));
    edges.push({ room: index, side, open, connected: open && neighbor >= 0, neighbor });
    const cx = (room.x + dx / 2) * TILE, cz = (room.z + dz / 2) * TILE;
    if (!open || neighbor < 0) obstacles.push({ x: cx, z: cz, w: dx ? 0.2 : TILE, d: dz ? 0.2 : TILE });
    else for (const sign of [-1, 1]) obstacles.push({ x: cx + (dz ? sign * 1.47 : 0), z: cz + (dx ? sign * 1.47 : 0), w: dx ? 0.2 : 1.66, d: dz ? 0.2 : 1.66 });
  }));
  const furniture: Obstacle[] = [];
  const addFurniture = (roomIndex: number, x: number, z: number, w: number, d: number, kind: FurnitureKind) => {
    furniture.push({ x: rooms[roomIndex].x * TILE + x, z: rooms[roomIndex].z * TILE + z, w, d, kind });
  };
  addFurniture(2, 1.05, 1.05, 1.35, 0.75, 'table');
  addFurniture(2, 0.2, 1.05, 0.35, 0.38, 'chair');
  addFurniture(2, 1.9, 1.05, 0.35, 0.38, 'chair');
  addFurniture(2, 0.75, 1.75, 0.35, 0.38, 'chair');
  addFurniture(2, 1.35, 1.75, 0.35, 0.38, 'chair');
  addFurniture(5, 0.9, -0.2, 1.05, 0.85, 'desk');
  addFurniture(5, 0.05, -0.15, 0.36, 0.38, 'chair');
  addFurniture(5, -1.2, -1.75, 1.5, 0.45, 'shelf');
  obstacles.push(...furniture);
  const step = TILE / 24, origin = -TILE * 4, size = 192;
  const world = (i: number) => origin + i * step;
  const cell = (v: number) => Math.round((v - origin) / step);
  const matrix = Array.from({ length: size }, (_, z) => Array.from({ length: size }, (_, x) => {
    const px = world(x), pz = world(z);
    const inside = rooms.some(r => Math.abs(px - r.x * TILE) <= TILE / 2 && Math.abs(pz - r.z * TILE) <= TILE / 2);
    return !inside || obstacles.some(o => Math.abs(px - o.x) <= o.w / 2 + RADIUS && Math.abs(pz - o.z) <= o.d / 2 + RADIUS) ? 1 : 0;
  }));
  const hasRoomAt = (x: number, z: number) => rooms.some(room => room.x === x && room.z === z);
  const isStaticWalkable = (point: { x: number; z: number }) => {
    const x = cell(point.x), z = cell(point.z);
    return x >= 0 && z >= 0 && x < size && z < size && matrix[z][x] === 0;
  };
  const canStand = (point: { x: number; z: number }, blockers: Blocker[] = []) => {
    if (!isStaticWalkable(point)) return false;
    return blockers.every(blocker => Math.hypot(point.x - blocker.x, point.z - blocker.z) > blocker.radius + RADIUS + 0.08);
  };
  function path(from: { x: number; z: number }, to: { x: number; z: number }, blockers: Blocker[] = []) {
    const workingMatrix = matrix.map(row => row.slice());
    for (const blocker of blockers) addBlocker(workingMatrix, world, blocker);
    const grid = new PF.Grid(workingMatrix);
    const sx = cell(from.x), sz = cell(from.z), ex = cell(to.x), ez = cell(to.z);
    if (!grid.isWalkableAt(sx, sz) || !grid.isWalkableAt(ex, ez)) return [];
    return new PF.AStarFinder({ allowDiagonal: false }).findPath(sx, sz, ex, ez, grid).map(([x, z]: number[]) => ({ x: world(x), z: world(z) }));
  }
  return { doors, edges, furniture, hasRoomAt, canStand, path };
}
