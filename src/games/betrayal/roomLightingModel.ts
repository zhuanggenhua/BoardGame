import type { MapSceneSprite } from '../../engine/mapRenderer/types';

export const ROOM_LIGHTING_TRANSITION_MS = 700;
export const ROOM_LIGHTING_FEATHER = 14;
export const ROOM_LIGHTING_PADDING = 64;

/** A cached alpha mask, in the same world coordinates as the room sprites. */
export function drawRoomLightingMask(
    context: CanvasRenderingContext2D,
    rooms: readonly MapSceneSprite[],
    width: number,
    height: number,
    resolution: number,
) {
    const padding = ROOM_LIGHTING_PADDING;
    context.setTransform(resolution, 0, 0, resolution, padding * resolution, padding * resolution);
    context.clearRect(-padding, -padding, width + padding * 2, height + padding * 2);
    context.globalCompositeOperation = 'source-over';
    context.fillStyle = 'rgba(3, 17, 13, 0.78)';
    context.fillRect(-padding, -padding, width + padding * 2, height + padding * 2);
    // destination-out unions overlapping room openings, avoiding doubled or inverted holes.
    context.globalCompositeOperation = 'destination-out';
    context.filter = `blur(${ROOM_LIGHTING_FEATHER * resolution}px)`;
    context.fillStyle = '#000';
    for (const room of rooms) {
        context.save();
        context.translate(room.x + room.width / 2, room.y + room.height / 2);
        context.rotate(room.rotation ?? 0);
        context.fillRect(-room.width / 2 - 3, -room.height / 2 - 3, room.width + 6, room.height + 6);
        context.restore();
    }
    context.filter = 'none';
    context.globalCompositeOperation = 'source-over';
}

export function roomLightingResolution(width: number, height: number) {
    return Math.min(1, 2048 / Math.max(width + ROOM_LIGHTING_PADDING * 2, height + ROOM_LIGHTING_PADDING * 2));
}
