import { describe, it, expect } from 'vitest';
import { resolvePlayerContext } from '../utils/resolvePlayerContext';

describe('resolvePlayerContext', () => {
  it('使用 items 派生 playerIds 并解析当前/下一位玩家', () => {
    const items = [
      { id: 'p1', name: '玩家1' },
      { id: 'p2', name: '玩家2' },
      { id: 'p3', name: '玩家3' },
    ];

    const current = resolvePlayerContext({ items, currentPlayerId: 'p2' });
    expect(current.playerIds).toEqual(['p1', 'p2', 'p3']);
    expect(current.currentPlayerIndex).toBe(1);
    expect(current.resolvedPlayerId).toBe('p2');
    expect(current.resolvedPlayer).toEqual(items[1]);

    const next = resolvePlayerContext({ items, currentPlayerId: 'p2', playerRef: 'next' });
    expect(next.resolvedPlayerId).toBe('p3');

    const wrap = resolvePlayerContext({ items, currentPlayerId: 'p3', playerRef: 'next' });
    expect(wrap.resolvedPlayerId).toBe('p1');
  });

  it('支持 self/other 语义化定位', () => {
    const items = [
      { id: 'a', name: '玩家A' },
      { id: 'b', name: '玩家B' },
    ];

    const self = resolvePlayerContext({ items, currentPlayerId: 'a', playerRef: 'self' });
    expect(self.resolvedPlayerId).toBe('a');

    const other = resolvePlayerContext({ items, currentPlayerId: 'a', playerRef: 'other' });
    expect(other.resolvedPlayerId).toBe('b');
  });

  it('支持 offset/index/id 与自定义 ID 字段', () => {
    const items = [
      { pid: 'a', name: '玩家A' },
      { pid: 'b', name: '玩家B' },
    ];

    const offset = resolvePlayerContext({
      items,
      currentPlayerId: 'a',
      playerRef: 'offset',
      offset: -1,
      idField: 'pid',
    });
    expect(offset.resolvedPlayerId).toBe('b');

    const byIndex = resolvePlayerContext({
      items,
      playerRef: 'index',
      index: 0,
      idField: 'pid',
    });
    expect(byIndex.resolvedPlayerId).toBe('a');

    const byId = resolvePlayerContext({
      items,
      playerRef: 'id',
      playerRefId: 'b',
      idField: 'pid',
    });
    expect(byId.resolvedPlayerId).toBe('b');
    expect(byId.resolvedPlayer).toEqual(items[1]);
  });

  it('优先使用传入的 playerIds 列表', () => {
    const items = [{ id: 'ignored' }];
    const ctx = resolvePlayerContext({
      items,
      playerIds: ['u1', 'u2'],
      currentPlayerId: 'u2',
      playerRef: 'prev',
    });
    expect(ctx.playerIds).toEqual(['u1', 'u2']);
    expect(ctx.resolvedPlayerId).toBe('u1');
  });
});
