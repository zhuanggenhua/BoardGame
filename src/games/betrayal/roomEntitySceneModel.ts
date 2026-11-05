import { ROOM_TILE_SIZE } from './roomMapModel';

export interface RoomEntitySlot {
    x: number;
    y: number;
    size: number;
}

/** Stable identity ordering, shared by Pixi artwork and accessible interaction targets.
 * Over-capacity clusters extend vertically rather than hiding pieces or shrinking their hit areas.
 */
export function resolveRoomEntitySlots(entityIds: readonly string[]): ReadonlyMap<string, RoomEntitySlot> {
    const ids = [...new Set(entityIds)].sort((left, right) => left.localeCompare(right, undefined, { numeric: true }));
    if (!ids.length) return new Map();
    const columns = Math.min(3, Math.ceil(Math.sqrt(ids.length)));
    const rows = Math.ceil(ids.length / columns);
    const gap = 5;
    const size = Math.max(44, Math.min(76 - ids.length * 2, (156 - gap * (columns - 1)) / columns));
    const height = rows * size + (rows - 1) * gap;
    return new Map(ids.map((id, index) => {
        const row = Math.floor(index / columns);
        const itemsInRow = Math.min(columns, ids.length - row * columns);
        const rowWidth = itemsInRow * size + (itemsInRow - 1) * gap;
        return [id, {
            x: (ROOM_TILE_SIZE - rowWidth) / 2 + (index % columns) * (size + gap),
            y: (ROOM_TILE_SIZE - height) / 2 + row * (size + gap),
            size,
        }];
    }));
}

export const EXPLORER_TOKEN_SILHOUETTE = [
    { x: 0.5, y: 0 }, { x: 0.96, y: 0.3 }, { x: 0.82, y: 1 },
    { x: 0.18, y: 1 }, { x: 0.04, y: 0.3 },
] as const;

export const MONSTER_TOKEN_SILHOUETTE = Array.from({ length: 32 }, (_, index) => ({
    x: 0.5 + Math.cos(index * Math.PI / 16) * 0.5,
    y: 0.5 + Math.sin(index * Math.PI / 16) * 0.5,
}));

export const MONSTER_SQUARE_SILHOUETTE = [
    { x: 0.14, y: 0 }, { x: 0.86, y: 0 }, { x: 1, y: 0.14 }, { x: 1, y: 0.86 },
    { x: 0.86, y: 1 }, { x: 0.14, y: 1 }, { x: 0, y: 0.86 }, { x: 0, y: 0.14 },
] as const;
