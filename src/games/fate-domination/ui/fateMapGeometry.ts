import type { FateDominationCore, LocationId } from '../domain/types';

export const FATE_MAP_ROOMS: Record<LocationId, { x: number; y: number; w: number; h: number; pawnX: number; pawnY: number }> = {
  workshop: { x: 397, y: 30, w: 1036, h: 359, pawnX: 1158, pawnY: 166 },
  miyama: { x: 397, y: 410, w: 1036, h: 357, pawnX: 1358, pawnY: 548 },
  shinto: { x: 397, y: 790, w: 1036, h: 357, pawnX: 1358, pawnY: 923 },
  recon: { x: 34, y: 788, w: 344, h: 358, pawnX: 212, pawnY: 958 },
};

export const FATE_DEPLOYMENT_SLOTS: Partial<Record<LocationId, readonly { x: number; y: number; w: number; h: number; pawnX: number; pawnY: number }[]>> = {
  workshop: [
    { x: 1010, y: 119, w: 199, h: 94, pawnX: 1163, pawnY: 166 }, { x: 1216, y: 119, w: 199, h: 94, pawnX: 1368, pawnY: 166 },
    { x: 1010, y: 218, w: 199, h: 94, pawnX: 1163, pawnY: 265 }, { x: 1216, y: 218, w: 199, h: 94, pawnX: 1368, pawnY: 265 },
  ],
  miyama: [{ x: 1216, y: 500, w: 199, h: 96, pawnX: 1367, pawnY: 547 }, { x: 1216, y: 598, w: 199, h: 95, pawnX: 1367, pawnY: 643 }],
  shinto: [{ x: 1216, y: 880, w: 199, h: 96, pawnX: 1367, pawnY: 926 }, { x: 1216, y: 977, w: 199, h: 96, pawnX: 1367, pawnY: 1023 }],
};

/** 地图棋子和战斗演出共用同一份地点、部署槽及自由站位坐标。 */
export function fatePawnPosition(core: FateDominationCore, locationId: LocationId, playerId: string) {
  const room = FATE_MAP_ROOMS[locationId];
  const slot = core.players[playerId].deploymentSlot;
  const anchor = slot !== null ? FATE_DEPLOYMENT_SLOTS[locationId]?.[slot] : undefined;
  const unbonused = core.battlefield[locationId].playerIds.filter(id => core.players[id].deploymentSlot === null);
  const index = Math.max(0, unbonused.indexOf(playerId));
  return {
    x: anchor?.pawnX ?? (locationId === 'recon' ? room.pawnX : 1150 - (index % 2) * 90),
    y: anchor?.pawnY ?? (locationId === 'recon' ? room.pawnY : room.y + 90 + Math.floor(index / 2) * 90),
  };
}
