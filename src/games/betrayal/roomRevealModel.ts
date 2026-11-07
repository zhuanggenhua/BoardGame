import type { ValidationResult } from '../../engine/types';
import type { BetrayalCore, BetrayalRoomDrawResolution } from './game';
import type { BetrayalCommandMap } from './commandTypes';
import { canUseHolySymbolForDiscovery } from './possessionActionReadModel';
import {
  applyRoomDrawResolutionToCore, cloneRoomDrawResolution, cloneRoomTemplate,
  groupRoomDiscoveryDeckByFloor, resolveCurrentRoomDiscoveryDeck, roomDiscoveryDeckMatchesFloorPools, resolveLegacyRoomDiscoveryEntries,
  resolveExplorableRoomSlots, resolveRoomDraw, resolveRoomPlacementContext,
  type ResolvedRoomDraw,
} from './roomDiscoveryModel';

export interface BetrayalPendingRoomPlacement {
  playerId: string;
  roomId: string;
  draw: ResolvedRoomDraw;
  usedHolySymbol: boolean;
}
export interface BetrayalRoomRevealedPayload {
  playerId: string;
  roomId: string;
  draw: ResolvedRoomDraw;
  usedHolySymbol: boolean;
}
export function clonePendingRoomPlacement(pending: BetrayalPendingRoomPlacement): BetrayalPendingRoomPlacement {
  return { ...pending, draw: {
    ...pending.draw,
    roomTemplate: pending.draw.roomTemplate ? cloneRoomTemplate(pending.draw.roomTemplate) : null,
    skippedRoomTemplate: pending.draw.skippedRoomTemplate ? cloneRoomTemplate(pending.draw.skippedRoomTemplate) : null,
    resolution: cloneRoomDrawResolution(pending.draw.resolution),
  } };
}

function resolveRevealDeck(core: BetrayalCore) {
  if (core.roomDiscoveryDeck?.length && roomDiscoveryDeckMatchesFloorPools(core)) return resolveCurrentRoomDiscoveryDeck(core);
  return (['ground', 'upper', 'basement'] as const).flatMap(floor => resolveLegacyRoomDiscoveryEntries(core, floor));
}

// Normalize legacy floor pools once at the authoritative reveal boundary. The
// existing draw/geometry algorithms remain the sole owners of legal placement.
export function resolveRoomReveal(core: BetrayalCore, playerId: string, payload: BetrayalCommandMap['REVEAL_ROOM']): BetrayalRoomRevealedPayload | null {
  const slot = resolveExplorableRoomSlots(core).find(room => room.id === payload.roomId);
  if (!slot) return null;
  const deck = resolveRevealDeck(core);
  const source = { ...core, pendingRoomPlacement: null, roomDiscoveryDeck: deck, roomDiscoveryOrderByFloor: groupRoomDiscoveryDeckByFloor(deck) };
  const draw = resolveRoomDraw(source, slot.floor, { placement: resolveRoomPlacementContext(core, slot) });
  if (payload.useHolySymbol && core.pendingRoomPlacement?.draw.roomTemplate) {
    const previous = core.pendingRoomPlacement.draw.roomTemplate;
    draw.skippedRoomTemplate = cloneRoomTemplate(previous);
    draw.resolution.buriedRoomTiles.unshift({ floor: slot.floor, name: previous.name, visualId: previous.visualId, reason: 'holySymbol' });
  }
  return { playerId, roomId: slot.id, draw, usedHolySymbol: payload.useHolySymbol === true };
}

export function validateRoomReveal(core: BetrayalCore, playerId: string, payload: BetrayalCommandMap['REVEAL_ROOM']): ValidationResult {
  if (payload.useHolySymbol !== undefined && typeof payload.useHolySymbol !== 'boolean') return { valid: false, error: '圣符选择格式无效。' };
  const pending = core.pendingRoomPlacement;
  if (pending) {
    if (pending.playerId !== playerId || pending.roomId !== payload.roomId) return { valid: false, error: '请先完成已揭示房间的放置，不能换门。' };
    if (payload.useHolySymbol && !canUseHolySymbolForDiscovery(core)) return { valid: false, error: '当前探索者不能使用圣符替换发现板块。' };
    if (!payload.useHolySymbol || pending.usedHolySymbol) return { valid: false, error: '已揭示房间不能取消或重复翻牌。' };
    if (!resolveRoomReveal(core, playerId, payload)?.draw.roomTemplate) return { valid: false, error: '该区域没有可替换的房间，请放置当前板块。' };
  } else if (payload.useHolySymbol) {
    return { valid: false, error: '请先揭示房间，再决定是否使用圣符。' };
  }
  return resolveExplorableRoomSlots(core).some(room => room.id === payload.roomId)
    ? { valid: true } : { valid: false, error: '指定房间不是当前开放门位。' };
}

export function applyRoomReveal(core: BetrayalCore, payload: BetrayalRoomRevealedPayload): BetrayalCore {
  core.roomDiscoveryDeck = resolveRevealDeck(core);
  core.roomDiscoveryOrderByFloor = groupRoomDiscoveryDeckByFloor(core.roomDiscoveryDeck);
  const previous = core.pendingRoomPlacement;
  applyRoomDrawResolutionToCore(core, payload.draw.resolution);
  // A Holy Symbol replacement draws from the remaining stack before burying
  // the first face-up tile, so it cannot immediately redraw that same tile.
  if (payload.usedHolySymbol && previous?.draw.roomTemplate) {
    core.roomDiscoveryDeck.push({ floor: previous.draw.resolution.requestedFloor, room: cloneRoomTemplate(previous.draw.roomTemplate) });
    core.roomDiscoveryOrderByFloor = groupRoomDiscoveryDeckByFloor(core.roomDiscoveryDeck);
  }
  core.roomRevealSequence = (core.roomRevealSequence ?? 0) + 1;
  core.pendingRoomPlacement = payload.draw.roomTemplate ? clonePendingRoomPlacement(payload) : null;
  return core;
}

export function resolvePublicRoomCounts(core: BetrayalCore) {
  if (core.roomDiscoveryCountsByFloor) return core.roomDiscoveryCountsByFloor;
  const deck = resolveRevealDeck(core);
  return { ground: deck.filter(entry => entry.floor === 'ground').length, upper: deck.filter(entry => entry.floor === 'upper').length, basement: deck.filter(entry => entry.floor === 'basement').length };
}

function publicResolution(resolution: BetrayalRoomDrawResolution): BetrayalRoomDrawResolution {
  return { ...cloneRoomDrawResolution(resolution), buriedRoomTiles: resolution.buriedRoomTiles.filter(room => room.reason !== 'areaMismatch').map(room => ({ ...room })) };
}
export function projectRoomRevealState(core: BetrayalCore): BetrayalCore {
  const pending = core.pendingRoomPlacement ? clonePendingRoomPlacement(core.pendingRoomPlacement) : null;
  if (pending) pending.draw.resolution = publicResolution(pending.draw.resolution);
  return {
    ...core, roomDiscoveryCountsByFloor: resolvePublicRoomCounts(core), roomDiscoveryDeck: [], roomDiscoveryOrderByFloor: { ground: [], upper: [], basement: [] },
    pendingRoomPlacement: pending,
    buriedRoomTiles: core.buriedRoomTiles.filter(room => room.reason !== 'areaMismatch').map(room => ({ ...room })),
    latestRoomDrawResolution: core.latestRoomDrawResolution ? publicResolution(core.latestRoomDrawResolution) : null,
  };
}
