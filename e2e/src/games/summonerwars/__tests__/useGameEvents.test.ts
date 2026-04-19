/**
 * 召唤师战争 - useGameEvents 辅助函数测试
 */

import { describe, it, expect } from 'vitest';
import type { EventStreamEntry, GameEvent } from '../../../engine/types';
import { computeEventStreamDelta } from '../ui/useGameEvents';

function makeEntry(id: number): EventStreamEntry {
  const event: GameEvent = { type: 'TEST_EVENT', payload: {}, timestamp: id };
  return { id, event };
}

describe('computeEventStreamDelta', () => {
  it('事件流为空时，重置 lastSeenEventId', () => {
    const result = computeEventStreamDelta([], 3);
    expect(result).toEqual({
      newEntries: [],
      nextLastSeenId: -1,
      shouldReset: true,
    });
  });

  it('事件流为空且未消费过，保持不重置', () => {
    const result = computeEventStreamDelta([], -1);
    expect(result).toEqual({
      newEntries: [],
      nextLastSeenId: -1,
      shouldReset: false,
    });
  });

  it('事件流回滚时，返回全量并触发重置', () => {
    const entries = [makeEntry(2), makeEntry(3)];
    const result = computeEventStreamDelta(entries, 10);
    expect(result).toEqual({
      newEntries: entries,
      nextLastSeenId: 3,
      shouldReset: true,
    });
  });

  it('事件流正常递增时，只返回新增部分', () => {
    const entries = [makeEntry(1), makeEntry(2), makeEntry(3)];
    const result = computeEventStreamDelta(entries, 2);
    expect(result).toEqual({
      newEntries: [entries[2]],
      nextLastSeenId: 3,
      shouldReset: false,
    });
  });

  it('首次消费时返回全量，并更新 lastSeenEventId', () => {
    const entries = [makeEntry(5), makeEntry(6)];
    const result = computeEventStreamDelta(entries, -1);
    expect(result).toEqual({
      newEntries: entries,
      nextLastSeenId: 6,
      shouldReset: false,
    });
  });
});
