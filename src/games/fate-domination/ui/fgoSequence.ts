import type { EventStreamEntry } from '../../../engine/types';
import type { FateDominationCore, LocationId, LocationResolvedEvent } from '../domain/types';
import { loadedFgoCharacter, loadedFgoNoble } from '../fgo-runtime/fgoPreload';
import { fatePawnPosition } from './fateMapGeometry';

export type FgoActor = { playerId: string; servantId: string; role: 'attack' | 'damage'; lane: number; targetLane: number; facing: 'left' | 'right' };
export type FgoSequence = { id: number; kind: 'battle'; locationId: LocationId; laneCount: number; actors: FgoActor[] } | { id: number; kind: 'noble' };

/** 临时表现只消费已经确认的事件；未就绪的素材在事件发生时直接跳过。 */
export function fateFgoSequenceFor(entry: EventStreamEntry, core: FateDominationCore): FgoSequence | undefined {
  if (entry.event.type !== 'LOCATION_RESOLVED') return;
  const { locationId, results } = (entry.event as LocationResolvedEvent).payload;
  if (locationId === 'recon' || results.length < 2) return;
  const highest = Math.max(...results.map(result => result.power));
  if (!results.some(result => result.power < highest)) return;
  // 站位来自地图棋子坐标，胜负只决定动作；隐藏身份也保留其公共位置。
  const positions = results.map((result, order) => ({ result, order, position: fatePawnPosition(core, locationId, result.playerId) }))
    .sort((a, b) => a.position.x - b.position.x || a.position.y - b.position.y || a.order - b.order);
  const actors = positions.flatMap(({ result }, lane) => {
    const player = core.players[result.playerId];
    if (!player?.isRevealed || !loadedFgoCharacter(player.servantId)) return [];
    const role = result.status === 'representative-win' ? 'attack' as const : 'damage' as const;
    const targetLane = positions.reduce((closest, candidate, index) => {
      const candidateRole = candidate.result.status === 'representative-win' ? 'attack' : 'damage';
      return candidateRole !== role && (closest < 0 || Math.abs(index - lane) < Math.abs(closest - lane)) ? index : closest;
    }, -1);
    return [{ playerId: result.playerId, servantId: player.servantId, role, lane, targetLane,
      facing: targetLane < lane ? 'left' as const : 'right' as const }];
  });
  return actors.length ? { id: entry.id, kind: 'battle', locationId, laneCount: positions.length, actors } : undefined;
}

export function fateFgoSequencesFor(entry: EventStreamEntry, core: FateDominationCore): FgoSequence[] {
  if (entry.event.type !== 'LOCATION_RESOLVED') return [];
  const payload = (entry.event as LocationResolvedEvent).payload;
  const noble: FgoSequence[] = loadedFgoNoble()
    ? (payload.noblePlayerIds ?? []).map(() => ({ id: entry.id, kind: 'noble' as const })) : [];
  const battle = fateFgoSequenceFor(entry, core);
  return battle ? [...noble, battle] : noble;
}
