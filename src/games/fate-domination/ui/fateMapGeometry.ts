import type { FateDominationCore, LocationId } from '../domain/types';
import { fateOccupiedDeploymentSlots } from '../domain/deployment';

const SHINTO_FIRST_FREE_ROW = 124;

// H 区是从下向上计数的四列十行。中心取自 1927×1179 正式运行棋盘。
const VICTORY_COLUMNS = [1512, 1624, 1735, 1846];
const VICTORY_ROWS = [1091, 979, 868, 757, 645, 533, 421, 309, 198, 86];

export function fateVictoryTrackPosition(victoryPoints: number) {
    if (!Number.isInteger(victoryPoints) || victoryPoints < 0 || victoryPoints >= VICTORY_COLUMNS.length * VICTORY_ROWS.length) return undefined;
    return { x: VICTORY_COLUMNS[Math.floor(victoryPoints / VICTORY_ROWS.length)], y: VICTORY_ROWS[victoryPoints % VICTORY_ROWS.length] };
}

export const FATE_MAP_ROOMS: Record<LocationId, { x: number; y: number; w: number; h: number; pawnX: number; pawnY: number }> = {
  workshop: { x: 397, y: 30, w: 1036, h: 359, pawnX: 900, pawnY: 178 },
  miyama: { x: 397, y: 410, w: 1036, h: 357, pawnX: 1358, pawnY: 548 },
  shinto: { x: 397, y: 790, w: 1036, h: 357, pawnX: 1358, pawnY: 923 },
  recon: { x: 34, y: 788, w: 344, h: 358, pawnX: 272, pawnY: 1116 },
};

export const FATE_DEPLOYMENT_SLOTS: Partial<Record<LocationId, readonly { x: number; y: number; w: number; h: number; pawnX: number; pawnY: number }[]>> = {
  workshop: [
    { x: 1010, y: 119, w: 199, h: 94, pawnX: 1163, pawnY: 166 }, { x: 1216, y: 119, w: 199, h: 94, pawnX: 1368, pawnY: 166 },
    { x: 1010, y: 218, w: 199, h: 94, pawnX: 1163, pawnY: 265 }, { x: 1216, y: 218, w: 199, h: 94, pawnX: 1368, pawnY: 265 },
  ],
  miyama: [{ x: 1216, y: 500, w: 199, h: 96, pawnX: 1367, pawnY: 547 }, { x: 1216, y: 598, w: 199, h: 95, pawnX: 1367, pawnY: 643 }],
  shinto: [{ x: 1216, y: 880, w: 199, h: 96, pawnX: 1367, pawnY: 926 }, { x: 1216, y: 977, w: 199, h: 96, pawnX: 1367, pawnY: 1023 }],
};

/** 残留牌借用空阵地的棋子位置，保留点位左边的地利数值。 */
export function fateFieldAttackSlotBounds(locationId: LocationId) {
  return (FATE_DEPLOYMENT_SLOTS[locationId] ?? []).map(slot => ({ x: slot.pawnX - 28, y: slot.y + 3, w: 56, h: 90 }));
}

export function fateFieldAttackSlots(core: FateDominationCore, locationId: LocationId, protectedSlots: readonly (number | null)[]) {
  const reserved = new Set(protectedSlots);
  for (const playerId of core.battlefield[locationId].playerIds) {
    for (const slot of fateOccupiedDeploymentSlots(core.players[playerId])) reserved.add(slot);
  }
  return fateFieldAttackSlotBounds(locationId).flatMap((bounds, index) => reserved.has(index) ? [] : [{ ...bounds, index }]);
}

/** 地利都被占用时，牌留在战场内，并为新都第一排普通棋子留出空间。 */
export function fateFieldAttackFallbackBounds(locationId: LocationId, index: number) {
    const room = FATE_MAP_ROOMS[locationId];
    const offset = locationId === 'shinto' ? SHINTO_FIRST_FREE_ROW + 56 : 74;
    return { left: room.x + 700 - index * 95, top: room.y + offset, width: 88 };
}

/** 地图棋子和战斗演出共用同一份地点、部署槽及自由站位坐标。 */
export function fatePawnPosition(core: FateDominationCore, locationId: LocationId, playerId: string) {
  const room = FATE_MAP_ROOMS[locationId];
  const slot = core.players[playerId].deploymentSlot;
  const anchor = slot !== null ? FATE_DEPLOYMENT_SLOTS[locationId]?.[slot] : undefined;
  if (anchor) return { x: anchor.pawnX, y: anchor.pawnY };
  if (locationId === 'recon') return { x: room.pawnX, y: room.pawnY };
  const unbonused = core.battlefield[locationId].playerIds.filter(id => core.players[id].deploymentSlot === null);
  const index = Math.max(0, unbonused.indexOf(playerId));
  // 工房的自由站位避开印刷魔力点，保留部署与效果移动的视觉差别。
  const rowOffset = locationId === 'shinto' ? SHINTO_FIRST_FREE_ROW : 90;
  const origin = locationId === 'workshop' ? { x: room.pawnX, y: room.pawnY } : { x: 1150, y: room.y + rowOffset };
  return {
    x: origin.x - (index % 2) * 90,
    y: origin.y + Math.floor(index / 2) * 90,
  };
}
