import { describe, expect, it } from 'vitest';
import type { GameEvent, MatchState } from '../../../engine/types';
import { createEventStreamSystem } from '../../../engine/systems/EventStreamSystem';
import { projectBetrayalEventForPresentation } from '../eventStreamProjection';

const privateMarker = 'TEST_HIDDEN_MARKER';
const event = (type: string, payload: Record<string, unknown>): GameEvent => ({ type, timestamp: 1, payload, sourceCommandType: 'TEST_COMMAND' });

describe('山屋事件流公开投影', () => {
  it('保留必要移动字段，但移除未来牌序与私密 setup', () => {
    const projected = projectBetrayalEventForPresentation(event('ROOM_EXPLORED', {
      playerId: '0', roomId: 'room-1', deckKind: 'omen', hauntTriggered: false,
      mummyForcedOmenSearch: { shuffledOmenDeck: [privateMarker] },
    }));
    expect(projected).toEqual(event('ROOM_EXPLORED', { playerId: '0', roomId: 'room-1', deckKind: 'omen', hauntTriggered: false }));
    for (const type of ['EVENT_CHOICE_RESOLVED', 'EVENT_ROLL_FINALIZED', 'RABBIT_FOOT_USED', 'POSSESSION_USED', 'UNKNOWN_FUTURE_EVENT', 'constructor', '__proto__', 'toString']) {
      const output = projectBetrayalEventForPresentation(event(type, { dustSetup: privateMarker, uponReflectionSetup: privateMarker, eventRerollHaunt: privateMarker, arbitrary: privateMarker }));
      expect(JSON.stringify(output)).not.toContain(privateMarker);
    }
  });
  it('仅投影视图，保留事件游标且不修改权威状态', () => {
    const system = createEventStreamSystem({ projectEvent: projectBetrayalEventForPresentation });
    const state = { core: {}, sys: { eventStream: { nextId: 9, maxEntries: 200, entries: [
      { id: 8, event: event('EVENT_CHOICE_RESOLVED', { hauntTriggered: true, dustSetup: privateMarker }) },
    ] } } } as unknown as MatchState<unknown>;
    const view = system.playerView!(state, '1');
    expect(view.eventStream).toMatchObject({ nextId: 9, maxEntries: 200, entries: [{ id: 8, event: { payload: { hauntTriggered: true } } }] });
    expect(JSON.stringify(view)).not.toContain(privateMarker);
    expect(JSON.stringify(state)).toContain(privateMarker);
  });
});
