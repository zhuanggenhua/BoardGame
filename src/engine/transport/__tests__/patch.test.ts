import fc from 'fast-check';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { computeDiff, applyPatches } from '../patch';
import type { Operation } from 'fast-json-patch';
import { GameTransportClient } from '../client';

// ============================================================================
// Mock socket.io-client 和 msgpack parser（用于客户端测试）
// ============================================================================

type EventHandler = (...args: unknown[]) => void;

/** 模拟 socket.io 客户端 socket，用于测试 GameTransportClient */
class MockClientSocket {
  private handlers = new Map<string, EventHandler[]>();
  readonly emitted: Array<{ event: string; args: unknown[] }> = [];
  connected = false;
  io = { on: vi.fn() };

  on(event: string, handler: EventHandler) {
    const list = this.handlers.get(event) ?? [];
    list.push(handler);
    this.handlers.set(event, list);
    return this;
  }

  once(event: string, handler: EventHandler) {
    return this.on(event, handler);
  }

  off(_event?: string, _handler?: EventHandler) { return this; }

  emit(event: string, ...args: unknown[]) {
    this.emitted.push({ event, args });
    return this;
  }

  removeAllListeners() {
    this.handlers.clear();
    return this;
  }

  disconnect() { this.connected = false; return this; }
  connect() { this.connected = true; return this; }

  /** 测试辅助：模拟服务端发送事件 */
  simulateEvent(event: string, ...args: unknown[]) {
    const handlers = this.handlers.get(event) ?? [];
    for (const h of handlers) h(...args);
  }

  /** 测试辅助：查找已发送的事件 */
  findEmitted(event: string) {
    return this.emitted.filter(e => e.event === event);
  }

  /** 测试辅助：清空已发送事件记录 */
  clearEmitted() { this.emitted.length = 0; }
}

let mockSocket: MockClientSocket;

vi.mock('socket.io-client', () => ({
  io: (..._args: unknown[]) => {
    mockSocket.connected = true;
    return mockSocket;
  },
}));

vi.mock('socket.io-msgpack-parser', () => ({ default: {} }));

// ViewState 生成器：生成随机的游戏状态对象
const viewStateArb = fc.record({
  core: fc.record({
    players: fc.dictionary(
      fc.constantFrom('0', '1', '2', '3'),
      fc.record({
        hp: fc.integer({ min: 0, max: 100 }),
        hand: fc.array(fc.record({ uid: fc.uuid(), defId: fc.string() }), { maxLength: 10 }),
        resources: fc.dictionary(fc.string({ minLength: 1, maxLength: 5 }), fc.integer({ min: 0, max: 20 })),
      }),
    ),
    turnNumber: fc.nat({ max: 200 }),
    currentPlayer: fc.constantFrom('0', '1'),
  }),
  sys: fc.record({
    phase: fc.constantFrom('draw', 'main', 'combat', 'end'),
    interaction: fc.option(fc.record({ id: fc.string(), playerId: fc.string() })),
    eventStream: fc.record({
      entries: fc.array(fc.record({ id: fc.nat(), type: fc.string(), data: fc.anything() }), { maxLength: 20 }),
      nextId: fc.nat(),
    }),
  }),
});

describe('Feature: incremental-state-sync', () => {
  /**
   * **Validates: Requirements 12.1**
   *
   * Property 1: JSON Patch Round-Trip 正确性
   */
  describe('Property 1: JSON Patch Round-Trip', () => {
    it('compare → applyPatch round-trip produces deeply equal result', () => {
      fc.assert(
        fc.property(viewStateArb, viewStateArb, (oldState, newState) => {
          const diff = computeDiff(oldState, newState);
          if (diff.type === 'patch' && diff.patches && diff.patches.length > 0) {
            const result = applyPatches(oldState, diff.patches);
            expect(result.success).toBe(true);
            expect(result.state).toEqual(newState);
          }
        }),
        { numRuns: 100 },
      );
    });
  });

  /**
   * **Validates: Requirements 2.3, 2.4, 3.2**
   *
   * Property 3: 推送决策正确性
   */
  describe('Property 3: Dispatch Decision', () => {
    it('returns correct type based on patch size ratio', () => {
      fc.assert(
        fc.property(viewStateArb, viewStateArb, (oldState, newState) => {
          const diff = computeDiff(oldState, newState);
          if (diff.type === 'patch') {
            expect(diff.patches).toBeDefined();
            if (diff.patches!.length > 0) {
              const patchSize = JSON.stringify(diff.patches).length;
              const fullSize = JSON.stringify(newState).length;
              expect(patchSize).toBeLessThan(fullSize * 0.8);
            }
          } else {
            expect(diff.fallbackReason).toBeDefined();
          }
        }),
        { numRuns: 100 },
      );
    });

    it('returns type full when patch size exceeds threshold', () => {
      const oldState = { a: 1 };
      const newState = { a: 2, b: 3, c: 4 };
      const diff = computeDiff(oldState, newState, 0.01);
      expect(diff.type).toBe('full');
      expect(diff.fallbackReason).toContain('patch_size_ratio');
    });

    it('returns empty patches when states are equal', () => {
      const state = { a: 1, b: { c: 2 } };
      const diff = computeDiff(state, JSON.parse(JSON.stringify(state)));
      expect(diff.type).toBe('patch');
      expect(diff.patches).toEqual([]);
    });

    it('returns type full on exception', () => {
      const trap = new Proxy({}, {
        ownKeys() { throw new Error('simulated_compare_failure'); },
        getOwnPropertyDescriptor() { throw new Error('simulated_compare_failure'); },
      });
      const diff = computeDiff(trap, { a: 2 });
      expect(diff.type).toBe('full');
      expect(diff.fallbackReason).toContain('diff_error');
    });
  });

  /**
   * **Validates: Requirements 4.3, 7.1**
   *
   * Property 8: 增量同步透明性
   */
  describe('Property 8: Patch Transparency', () => {
    it('restored state via patch equals newState directly', () => {
      fc.assert(
        fc.property(viewStateArb, viewStateArb, (oldState, newState) => {
          const diff = computeDiff(oldState, newState);
          if (diff.type === 'patch' && diff.patches && diff.patches.length > 0) {
            const result = applyPatches(oldState, diff.patches);
            expect(result.success).toBe(true);
            expect(result.state).toEqual(newState);
          } else if (diff.type === 'patch' && diff.patches?.length === 0) {
            expect(oldState).toEqual(newState);
          }
        }),
        { numRuns: 100 },
      );
    });
  });

  // ========================================================================
  // 边界单元测试
  // ========================================================================

  describe('Edge cases: computeDiff', () => {
    const NO_SIZE_LIMIT = Infinity;

    it('handles deeply nested state changes', () => {
      const old = { a: { b: { c: { d: 1 } } } };
      const next = { a: { b: { c: { d: 2 } } } };
      const diff = computeDiff(old, next, NO_SIZE_LIMIT);
      expect(diff.type).toBe('patch');
      expect(diff.patches!.length).toBeGreaterThan(0);
    });

    it('handles array element changes', () => {
      const old = { items: [1, 2, 3] };
      const next = { items: [1, 4, 3] };
      const diff = computeDiff(old, next, NO_SIZE_LIMIT);
      expect(diff.type).toBe('patch');
      const result = applyPatches(old, diff.patches!);
      expect(result.success).toBe(true);
      expect(result.state).toEqual(next);
    });

    it('handles property addition and removal', () => {
      const old = { a: 1, b: 2 } as Record<string, unknown>;
      const next = { a: 1, c: 3 } as Record<string, unknown>;
      const diff = computeDiff(old, next, NO_SIZE_LIMIT);
      expect(diff.type).toBe('patch');
      const result = applyPatches(old, diff.patches!);
      expect(result.success).toBe(true);
      expect(result.state).toEqual(next);
    });
  });

  describe('Edge cases: applyPatches', () => {
    it('fails on invalid patch operation (wrong path)', () => {
      const base = { a: 1 };
      const invalidPatches = [{ op: 'replace' as const, path: '/nonexistent/deep/path', value: 42 }];
      const result = applyPatches(base, invalidPatches);
      expect(result.success).toBe(false);
      expect(result.error).toBeDefined();
    });

    it('fails on test operation mismatch', () => {
      const base = { a: 1 };
      const patches = [{ op: 'test' as const, path: '/a', value: 999 }];
      const result = applyPatches(base, patches);
      expect(result.success).toBe(false);
    });

    it('does not mutate the original base state', () => {
      const base = { a: 1, b: { c: 2 } };
      const baseCopy = JSON.parse(JSON.stringify(base));
      const patches = [{ op: 'replace' as const, path: '/a', value: 99 }];
      applyPatches(base, patches);
      expect(base).toEqual(baseCopy);
    });

    it('handles empty patches array', () => {
      const base = { a: 1 };
      const result = applyPatches(base, []);
      expect(result.success).toBe(true);
      expect(result.state).toEqual(base);
    });
  });

  // ========================================================================
  // 客户端测试：需要 mock socket.io-client
  // ========================================================================

  // 辅助函数：创建 GameTransportClient 并触发连接
  function createConnectedClient(overrides?: {
    onStateUpdate?: (...args: unknown[]) => void;
    onPlayerConnectionChange?: (playerID: string, connected: boolean) => void;
  }) {
    const onStateUpdate = overrides?.onStateUpdate ?? vi.fn();
    const client = new GameTransportClient({
      server: '',
      matchID: 'test-match',
      playerID: '0',
      credentials: 'test-cred',
      onStateUpdate: onStateUpdate as never,
      onPlayerConnectionChange: overrides?.onPlayerConnectionChange,
    });
    client.connect();
    // 手动触发 connect 事件（mock 的 io() 不会自动触发）
    mockSocket.simulateEvent('connect');
    return { client, onStateUpdate };
  }

  /** 模拟服务端发送 state:sync 全量同步 */
  function simulateSync(state: unknown, matchPlayers = [{ id: 0 }], stateID = 0) {
    mockSocket.simulateEvent(
      'state:sync',
      'test-match',
      state,
      matchPlayers,
      { seed: 'abc', cursor: 0 },
      { stateID },
    );
  }

  /** 模拟服务端发送 state:update 全量更新 */
  function simulateUpdate(state: unknown, meta: { stateID: number; randomCursor: number; lastCommandPlayerId?: string }, matchPlayers = [{ id: 0 }]) {
    mockSocket.simulateEvent('state:update', 'test-match', state, matchPlayers, meta);
  }

  /** 模拟服务端发送 state:patch 增量更新 */
  function simulatePatch(patches: Operation[], meta: { stateID: number; randomCursor: number; lastCommandPlayerId?: string }, matchPlayers = [{ id: 0 }]) {
    mockSocket.simulateEvent('state:patch', 'test-match', patches, matchPlayers, meta);
  }

  /**
   * **Validates: Requirements 6.2, 6.3**
   *
   * Property 4: StateID 可见性间隙
   * 投影视图可能跳过全局 stateID；只要 patch 可应用，客户端应继续处理，避免无谓全量同步。
   */
  describe('Property 4: StateID Continuity', () => {
    beforeEach(() => {
      mockSocket = new MockClientSocket();
    });

    it('applies patch without resync when stateID has a visibility gap', () => {
      fc.assert(
        fc.property(
          fc.integer({ min: 1, max: 100 }),  // lastReceivedStateID
          fc.integer({ min: 2, max: 50 }),    // gap（保证 != 1，产生不连续）
          (lastId, gap) => {
            // 每次迭代重置 mock socket
            mockSocket = new MockClientSocket();
            const onStateUpdate = vi.fn();
            const { client } = createConnectedClient({ onStateUpdate });

            // 建立初始状态：sync 后立即建立 stateID 基线
            const initialState = { core: { turn: 0 } };
            simulateSync(initialState, [{ id: 0 }], lastId);
            onStateUpdate.mockClear();
            mockSocket.clearEmitted();

            // 发送不连续的 stateID（跳过 gap 个版本）
            const discontinuousId = lastId + gap + 1; // 保证 != lastId + 1
            const patches: Operation[] = [{ op: 'replace', path: '/core/turn', value: 1 }];
            simulatePatch(patches, { stateID: discontinuousId, randomCursor: 1 });

            // 验证：patch 仍应交给上层
            expect(onStateUpdate).toHaveBeenCalledTimes(1);

            // 验证：不应因合法可见性间隙触发 resync
            const syncEmits = mockSocket.findEmitted('sync');
            expect(syncEmits.length).toBe(0);

            // 验证：本地状态已应用 patch
            expect(client.latestState).toEqual({ core: { turn: 1 } });

            client.disconnect();
          },
        ),
        { numRuns: 100 },
      );
    });
  });

  /**
   * **Validates: Requirements 6.4, 6.5**
   *
   * Property 5: StateID 追踪一致性
   * 成功处理 state:sync / state:update / state:patch 后，_lastReceivedStateID 更新为事件的 stateID。
   */
  describe('Property 5: StateID Tracking', () => {
    beforeEach(() => {
      mockSocket = new MockClientSocket();
    });

    // 事件类型生成器
    const eventTypeArb = fc.constantFrom('sync', 'update', 'patch') as fc.Arbitrary<'sync' | 'update' | 'patch'>;
    const eventSequenceArb = fc.array(
      fc.record({
        type: eventTypeArb,
        stateID: fc.integer({ min: 1, max: 1000 }),
      }),
      { minLength: 1, maxLength: 20 },
    );

    it('tracks stateID correctly across sync/update/patch events', () => {
      fc.assert(
        fc.property(eventSequenceArb, (events) => {
          mockSocket = new MockClientSocket();
          const onStateUpdate = vi.fn();
          const { client } = createConnectedClient({ onStateUpdate });

          // 先建立初始状态
          const baseState = { core: { v: 0 } };
          simulateSync(baseState, [{ id: 0 }], 0);

          // 追踪预期的 lastReceivedStateID
          let expectedLastID: number | null = 0;
          let currentState = baseState;

          for (const event of events) {
            if (event.type === 'sync') {
              simulateSync(currentState, [{ id: 0 }], event.stateID);
              expectedLastID = event.stateID;
            } else if (event.type === 'update') {
              const newState = { core: { v: event.stateID } };
              simulateUpdate(newState, { stateID: event.stateID, randomCursor: 0 });
              currentState = newState;
              expectedLastID = event.stateID;
            } else {
              // patch：需要连续的 stateID 才能成功
              const nextID: number = (expectedLastID ?? 0) + 1;
              const newState = { core: { v: nextID } };
              const diff = computeDiff(currentState, newState);
              if (diff.type === 'patch' && diff.patches) {
                simulatePatch(diff.patches, { stateID: nextID, randomCursor: 0 });
                currentState = newState;
                expectedLastID = nextID;
              }
            }
          }

          // 验证最终的 lastReceivedStateID
          // 通过发送一个连续的 patch 来间接验证：
          // 如果 expectedLastID 非 null，发送 stateID = expectedLastID + 1 的 patch 应成功
          // 如果 expectedLastID 为 null，发送任意 stateID 的 patch 应成功（null 时不校验连续性）
          onStateUpdate.mockClear();
          mockSocket.clearEmitted();

          const verifyState = { core: { v: 999 } };
          const verifyDiff = computeDiff(currentState, verifyState);
          if (verifyDiff.type === 'patch' && verifyDiff.patches && verifyDiff.patches.length > 0) {
            const verifyID = (expectedLastID ?? 0) + 1;
            simulatePatch(verifyDiff.patches, { stateID: verifyID, randomCursor: 0 });
            // 应成功处理（不触发 resync）
            expect(onStateUpdate).toHaveBeenCalled();
            const syncEmits = mockSocket.findEmitted('sync');
            expect(syncEmits.length).toBe(0);
          }

          client.disconnect();
        }),
        { numRuns: 100 },
      );
    });
  });

  // ========================================================================
  // 客户端单元测试 (Task 6.6)
  // ========================================================================

  describe('Client unit tests', () => {
    beforeEach(() => {
      mockSocket = new MockClientSocket();
    });

    afterEach(() => {
      vi.useRealTimers();
    });

    /**
     * 需求 5.2：sync 后旧 patch 不得污染新基线
     */
    it('rejects stale patch after sync establishes a fresh stateID baseline', () => {
      const onStateUpdate = vi.fn();
      const { client } = createConnectedClient({ onStateUpdate });

      const syncedState = { core: { hp: 100, hand: ['fresh'] } };
      simulateSync(syncedState, [{ id: 0 }], 10);
      onStateUpdate.mockClear();
      mockSocket.clearEmitted();

      const stalePatches: Operation[] = [{ op: 'replace', path: '/core/hp', value: 1 }];
      simulatePatch(stalePatches, { stateID: 7, randomCursor: 0 });

      expect(onStateUpdate).not.toHaveBeenCalled();
      expect(mockSocket.findEmitted('sync').length).toBeGreaterThan(0);
      expect(client.latestState).toEqual(syncedState);

      client.disconnect();
    });

    /**
     * 需求 5.3：patch 应用失败触发 resync
     */
    it('patch application failure triggers resync', () => {
      const onStateUpdate = vi.fn();
      const { client } = createConnectedClient({ onStateUpdate });

      // 建立初始状态
      simulateSync({ core: { hp: 100 } });
      simulateUpdate({ core: { hp: 100 } }, { stateID: 1, randomCursor: 0 });
      onStateUpdate.mockClear();
      mockSocket.clearEmitted();

      // 发送无效 patch（路径不存在，applyPatches 会失败）
      const badPatches: Operation[] = [
        { op: 'replace', path: '/nonexistent/deep/field', value: 42 },
      ];
      simulatePatch(badPatches, { stateID: 2, randomCursor: 1 });

      // 验证：onStateUpdate 不应被调用
      expect(onStateUpdate).not.toHaveBeenCalled();

      // 验证：应触发 resync
      const syncEmits = mockSocket.findEmitted('sync');
      expect(syncEmits.length).toBeGreaterThan(0);

      client.disconnect();
    });

    it('player connection events update cached match player presence', () => {
      const onPlayerConnectionChange = vi.fn();
      const { client } = createConnectedClient({ onPlayerConnectionChange });
      simulateSync(
        { core: { hp: 100 } },
        [
          { id: 0, name: 'Host', isConnected: true },
          { id: 1, name: 'Guest', isConnected: true },
        ],
        1,
      );

      mockSocket.simulateEvent('player:disconnected', 'test-match', '1');

      expect(client.matchPlayers).toEqual([
        { id: 0, name: 'Host', isConnected: true },
        { id: 1, name: 'Guest', isConnected: false },
      ]);
      expect(onPlayerConnectionChange).toHaveBeenCalledWith('1', false);

      mockSocket.simulateEvent('player:connected', 'test-match', '1');

      expect(client.matchPlayers).toEqual([
        { id: 0, name: 'Host', isConnected: true },
        { id: 1, name: 'Guest', isConnected: true },
      ]);
      expect(onPlayerConnectionChange).toHaveBeenCalledWith('1', true);

      client.disconnect();
    });

    it('terminal match_not_found error stops sync timeout retries and tears down socket', () => {
      vi.useFakeTimers();
      const onError = vi.fn();
      const onConnectionChange = vi.fn();
      const client = new GameTransportClient({
        server: '',
        matchID: 'test-match',
        playerID: '0',
        credentials: 'test-cred',
        onError,
        onConnectionChange,
      });

      client.connect();
      mockSocket.simulateEvent('connect');
      const syncCountBeforeError = mockSocket.findEmitted('sync').length;
      expect(syncCountBeforeError).toBeGreaterThan(0);

      mockSocket.simulateEvent('error', 'test-match', 'match_not_found');
      expect(onError).toHaveBeenCalledWith('match_not_found');
      expect(client.connectionState).toBe('disconnected');
      expect(client.getSocket()).toBeNull();

      vi.advanceTimersByTime(30000);
      const syncCountAfterAdvance = mockSocket.findEmitted('sync').length;
      expect(syncCountAfterAdvance).toBe(syncCountBeforeError);
    });

    /**
     * 需求 5.4：resync 后恢复增量同步
     */
    it('resync recovery restores incremental sync', () => {
      const onStateUpdate = vi.fn();
      const { client } = createConnectedClient({ onStateUpdate });

      // 建立初始状态
      const state1 = { core: { hp: 100 } };
      simulateSync(state1);
      simulateUpdate(state1, { stateID: 1, randomCursor: 0 });
      onStateUpdate.mockClear();

      // 触发 patch 失败 → resync
      const badPatches: Operation[] = [
        { op: 'replace', path: '/nonexistent/path', value: 0 },
      ];
      simulatePatch(badPatches, { stateID: 2, randomCursor: 1 });
      expect(onStateUpdate).not.toHaveBeenCalled();

      // 模拟 resync 完成：服务端返回 state:sync
      const state2 = { core: { hp: 80, mana: 50, armor: 30, name: 'player1', level: 10 } };
      simulateSync(state2);
      onStateUpdate.mockClear();
      mockSocket.clearEmitted();

      // resync 后，增量同步应恢复正常
      // 发送 state:update 建立新的 stateID 基线
      simulateUpdate(state2, { stateID: 5, randomCursor: 2 });
      onStateUpdate.mockClear();
      mockSocket.clearEmitted();

      // 发送连续的 patch（stateID = 6），应成功处理
      const state3 = { core: { hp: 70, mana: 50, armor: 30, name: 'player1', level: 10 } };
      const diff = computeDiff(state2, state3, Infinity);
      expect(diff.type).toBe('patch');
      simulatePatch(diff.patches!, { stateID: 6, randomCursor: 3 });

      // 验证：patch 成功应用，onStateUpdate 被调用
      expect(onStateUpdate).toHaveBeenCalledTimes(1);
      expect(client.latestState).toEqual(state3);

      // 验证：没有触发额外的 resync
      const syncEmits = mockSocket.findEmitted('sync');
      expect(syncEmits.length).toBe(0);

      client.disconnect();
    });

    it('manual resync on connected socket should emit sync immediately', () => {
      const onDebugEvent = vi.fn();
      const client = new GameTransportClient({
        server: '',
        matchID: 'test-match',
        playerID: '0',
        credentials: 'test-cred',
        onDebugEvent,
      });

      client.connect();
      mockSocket.simulateEvent('connect');
      mockSocket.clearEmitted();

      client.resync();

      expect(mockSocket.findEmitted('sync')).toEqual([
        {
          event: 'sync',
          args: ['test-match', '0', 'test-cred'],
        },
      ]);
      expect(onDebugEvent).toHaveBeenCalledWith(expect.objectContaining({
        stage: 'sync-requested',
        reason: 'manual-resync',
      }));

      client.disconnect();
    });

    it('恢复可见时应强制刷新正在进行中的同步，避免等待旧同步超时', () => {
      const onDebugEvent = vi.fn();
      const visibleClient = new GameTransportClient({
        server: '',
        matchID: 'test-match',
        playerID: '0',
        credentials: 'test-cred',
        onDebugEvent,
      });
      visibleClient.connect();
      mockSocket.simulateEvent('connect');
      simulateSync({ core: { hp: 100 } }, [{ id: 0 }], 7);
      mockSocket.clearEmitted();

      visibleClient.resync();
      expect(mockSocket.findEmitted('sync')).toHaveLength(1);

      visibleClient.resync({ force: true });
      expect(mockSocket.findEmitted('sync')).toHaveLength(2);
      expect(onDebugEvent).toHaveBeenCalledWith(expect.objectContaining({
        stage: 'sync-requested',
        reason: 'forced-manual-resync',
      }));

      visibleClient.disconnect();
    });

    it('manual resync on disconnected socket should request reconnect instead of emitting sync', () => {
      const onDebugEvent = vi.fn();
      const client = new GameTransportClient({
        server: '',
        matchID: 'test-match',
        playerID: '0',
        credentials: 'test-cred',
        onDebugEvent,
      });

      client.connect();
      mockSocket.simulateEvent('connect');
      mockSocket.clearEmitted();
      mockSocket.connected = false;

      client.resync();

      expect(mockSocket.findEmitted('sync')).toEqual([]);
      expect(mockSocket.connected).toBe(true);
      expect(onDebugEvent).toHaveBeenCalledWith(expect.objectContaining({
        stage: 'reconnect-requested',
        reason: 'manual-resync-disconnected',
      }));

      client.disconnect();
    });

    it('applies compare-roll interaction patches on contestant baseline without forcing resync', () => {
      const onStateUpdate = vi.fn();
      const { client } = createConnectedClient({ onStateUpdate });

      const compareRollBaseState = {
        core: {
          currentPlayer: '0',
          padding: Array.from({ length: 160 }, (_value, index) => `pad-${index}`),
        },
        sys: {
          phase: 'main',
          turnNumber: 1,
          interaction: {
            current: {
              id: 'compare-roll-visible-base',
              kind: 'compare-roll-choice',
              playerId: '0',
              data: {
                title: '对比掷骰',
                sourceId: 'duel-base',
                contestants: [
                  { playerId: '0', label: 'P0', roll: 6 },
                  { playerId: '1', label: 'P1', roll: 2 },
                ],
                options: [
                  { id: 'resolve', label: '继续', value: { kind: 'confirm' } },
                ],
              },
            },
            queue: [],
            isBlocked: true,
          },
        },
      };
      const compareRollNextState = {
        core: {
          currentPlayer: '0',
          padding: Array.from({ length: 160 }, (_value, index) => `pad-${index}`),
        },
        sys: {
          phase: 'main',
          turnNumber: 1,
          interaction: {
            current: {
              id: 'compare-roll-visible-next',
              kind: 'compare-roll-choice',
              playerId: '0',
              data: {
                title: '第二次对比掷骰',
                sourceId: 'duel-next',
                contestants: [
                  { playerId: '0', label: 'P0', roll: 1 },
                  { playerId: '1', label: 'P1', roll: 5 },
                ],
                options: [
                  { id: 'resolve-next', label: '继续', value: { kind: 'confirm-next' } },
                ],
              },
            },
            queue: [],
            isBlocked: true,
          },
        },
      };

      simulateSync(compareRollBaseState, [{ id: 0 }, { id: 1 }], 0);
      onStateUpdate.mockClear();
      mockSocket.clearEmitted();

      const diff = computeDiff(compareRollBaseState, compareRollNextState, Infinity);
      expect(diff.type).toBe('patch');
      expect(diff.patches).toBeDefined();
      expect(diff.patches!.some((patch) => patch.path?.startsWith('/sys/interaction/current/'))).toBe(true);

      simulatePatch(diff.patches!, { stateID: 1, randomCursor: 0 }, [{ id: 0 }, { id: 1 }]);

      expect(onStateUpdate).toHaveBeenCalledTimes(1);
      expect(client.latestState).toEqual(compareRollNextState);
      expect(mockSocket.findEmitted('sync').length).toBe(0);

      client.disconnect();
    });

    /**
     * 需求 8.2：batch:confirmed 返回全量状态
     *
     * batch:confirmed 事件由 sendBatch 的一次性监听器处理，
     * 返回全量权威状态给 onConfirmed 回调。
     */
    it('batch:confirmed returns full state via callback', () => {
      const { client } = createConnectedClient();

      // 建立初始状态
      simulateSync({ core: { hp: 100 } });

      const confirmedState = { core: { hp: 90 } };
      const onConfirmed = vi.fn();
      const onRejected = vi.fn();

      // 发送批次命令
      client.sendBatch('batch-1', [{ type: 'attack', payload: {} }], onConfirmed, onRejected);

      // 模拟服务端确认
      mockSocket.simulateEvent('batch:confirmed', 'test-match', 'batch-1', confirmedState);

      // 验证：onConfirmed 收到全量状态
      expect(onConfirmed).toHaveBeenCalledWith(confirmedState);
      expect(onRejected).not.toHaveBeenCalled();

      client.disconnect();
    });

    it('sendBatch includes expectedStateID precondition after sync', () => {
      const { client } = createConnectedClient();

      simulateSync({ core: { hp: 100 } }, [{ id: 0 }], 7);
      mockSocket.clearEmitted();

      client.sendBatch('batch-expected-state', [{ type: 'attack', payload: {} }]);

      const batchEmits = mockSocket.findEmitted('batch');
      expect(batchEmits).toHaveLength(1);
      expect(batchEmits[0]?.args[0]).toBe('test-match');
      expect(batchEmits[0]?.args[1]).toBe('batch-expected-state');
      expect(batchEmits[0]?.args[4]).toEqual({ expectedStateID: 7 });

      client.disconnect();
    });

    it('sendCommand includes expectedStateID precondition after sync', () => {
      const { client } = createConnectedClient();

      simulateSync({ core: { hp: 100 } }, [{ id: 0 }], 7);
      mockSocket.clearEmitted();

      client.sendCommand('attack', { target: '1' });

      const commandEmits = mockSocket.findEmitted('command');
      expect(commandEmits).toHaveLength(1);
      expect(commandEmits[0]?.args[4]).toEqual({ expectedStateID: 7 });

      client.disconnect();
    });

    it('sendCommand permits an optimistic chain to provide the next expected stateID', () => {
      const { client } = createConnectedClient();

      simulateSync({ core: { hp: 100 } }, [{ id: 0 }], 7);
      mockSocket.clearEmitted();

      client.sendCommand('ADVANCE_PHASE', {}, { expectedStateID: 8 });

      const commandEmits = mockSocket.findEmitted('command');
      expect(commandEmits).toHaveLength(1);
      expect(commandEmits[0]?.args[4]).toEqual({ expectedStateID: 8 });

      client.disconnect();
    });

    it('在线 AI 命令应携带尝试编号和最近同步现场', () => {
      const { client } = createConnectedClient();

      simulateSync({ core: { turn: 0 } }, [{ id: 0 }], 7);
      mockSocket.clearEmitted();

      client.sendCommand('attack', { target: '1' }, { onlineAiAttemptKey: 'ai-attempt-1' });

      const command = mockSocket.findEmitted('command')[0];
      expect(command?.args[4]).toEqual(expect.objectContaining({
        expectedStateID: 7,
        onlineAiAttemptKey: 'ai-attempt-1',
        clientTransport: expect.objectContaining({
          lastStateEventKind: 'sync',
          lastStateEventStateID: 7,
          syncInFlight: false,
          lastPatchIssue: null,
        }),
      }));

      client.disconnect();
    });

    it('补丁断档后重新同步，下一次 AI 命令应保留补丁断档证据', () => {
      const { client } = createConnectedClient();

      simulateSync({ core: { turn: 0 } }, [{ id: 0 }], 7);
      simulatePatch(
        [{ op: 'replace', path: '/core/turn', value: 1 }],
        { stateID: 9, randomCursor: 1 },
      );
      simulateSync({ core: { turn: 1 } }, [{ id: 0 }], 9);
      mockSocket.clearEmitted();

      client.sendCommand('attack', { target: '1' }, { onlineAiAttemptKey: 'ai-attempt-after-gap' });

      const command = mockSocket.findEmitted('command')[0];
      expect(command?.args[4]).toEqual(expect.objectContaining({
        clientTransport: expect.objectContaining({
          lastStateEventKind: 'sync',
          lastStateEventStateID: 9,
          lastPatchIssue: expect.objectContaining({
            kind: 'discontinuity',
            expectedStateID: 8,
            receivedStateID: 9,
          }),
        }),
      }));

      client.disconnect();
    });

    it.each(['stale_state', 'player_mismatch'])('command rejection %s triggers resync and blocks commands until the new state arrives', (reason) => {
      const onError = vi.fn();
      const client = new GameTransportClient({
        server: '',
        matchID: 'test-match',
        playerID: '0',
        credentials: 'test-cred',
        onError,
      });
      client.connect();
      mockSocket.simulateEvent('connect');
      simulateSync({ core: { turn: 0 } }, [{ id: 0 }], 7);
      mockSocket.clearEmitted();

      expect(client.sendCommand('attack', { target: '1' })).toBe(true);
      expect(mockSocket.findEmitted('command')).toHaveLength(1);

      mockSocket.simulateEvent('error', 'test-match', reason);
      expect(onError).toHaveBeenCalledWith(reason);
      expect(mockSocket.findEmitted('sync')).toHaveLength(1);
      // 上层 recovery 也会调用 resync，但不能重复发送第二个同步请求。
      client.resync();
      expect(mockSocket.findEmitted('sync')).toHaveLength(1);

      // 全量同步尚未回来时，不能继续发送仍基于旧 stateID 的命令。
      expect(client.sendCommand('defend', { target: '1' })).toBe(false);
      expect(mockSocket.findEmitted('command')).toHaveLength(1);

      // 收到新权威状态后才恢复发送，并使用新的 stateID。
      simulateSync({ core: { turn: 1 } }, [{ id: 0 }], 9);
      expect(client.sendCommand('defend', { target: '1' })).toBe(true);
      const commandEmits = mockSocket.findEmitted('command');
      expect(commandEmits).toHaveLength(2);
      expect(commandEmits[1]?.args[4]).toEqual({ expectedStateID: 9 });

      client.disconnect();
    });

    /**
     * 需求 8.3：回滚广播全量 state:update
     *
     * 当服务端回滚时，通过 state:update 广播全量状态。
     * 客户端应正确接收并替换本地状态。
     */
    it('rollback broadcasts full state:update that replaces local state', () => {
      const onStateUpdate = vi.fn();
      const { client } = createConnectedClient({ onStateUpdate });

      // 建立初始状态
      simulateSync({ core: { hp: 100 } });
      simulateUpdate({ core: { hp: 100 } }, { stateID: 1, randomCursor: 0 });
      onStateUpdate.mockClear();

      // 模拟回滚：服务端发送全量 state:update（回退到之前的状态）
      const rollbackState = { core: { hp: 100, rolled_back: true } };
      simulateUpdate(rollbackState, { stateID: 2, randomCursor: 1 });

      // 验证：onStateUpdate 收到全量回滚状态
      expect(onStateUpdate).toHaveBeenCalledTimes(1);
      expect(onStateUpdate).toHaveBeenCalledWith(
        rollbackState,
        [{ id: 0 }],
        { stateID: 2, randomCursor: 1 },
      );

      // 验证：本地状态被全量替换
      expect(client.latestState).toEqual(rollbackState);

      client.disconnect();
    });
  });

  // ========================================================================
  // 回归测试：undefined key 导致 replace vs add 不一致
  // ========================================================================

  /**
   * 回归测试：服务端缓存含 undefined key 时，JSON Patch 生成 replace 而非 add，
   * 导致客户端 patch 应用失败（OPERATION_PATH_UNRESOLVABLE）。
   *
   * 根因：JS 对象 { key: undefined } 经 JSON 序列化后 key 被剥离，
   * 但 fast-json-patch 的 compare 会将 { key: undefined } → { key: value } 视为 replace，
   * 而客户端（经 socket.io JSON 传输）的状态中不存在该 key，导致 replace 路径不可达。
   *
   * 修复：服务端缓存写入时使用 JSON.parse(JSON.stringify()) 消除 undefined key。
   */
  describe('Regression: undefined key causes replace vs add mismatch', () => {
    it('computeDiff generates "add" (not "replace") when old state has undefined key stripped by JSON round-trip', () => {
      // 模拟 reducer 返回 { ...state, taijiGainedThisTurn: undefined }
      const serverOldState = { core: { hp: 100, taijiGainedThisTurn: undefined as unknown } };
      // 经 JSON round-trip 后 undefined key 被剥离（模拟服务端缓存修复后的行为）
      const cachedOldState = JSON.parse(JSON.stringify(serverOldState));
      expect(cachedOldState).toEqual({ core: { hp: 100 } }); // undefined key 已消除

      // 新状态中该 key 有值
      const newState = { core: { hp: 100, taijiGainedThisTurn: 3 } };

      // 修复后：diff 应生成 "add" 而非 "replace"
      const diff = computeDiff(cachedOldState, newState, Infinity);
      expect(diff.type).toBe('patch');
      expect(diff.patches).toBeDefined();
      const taijiPatch = diff.patches!.find(p => p.path === '/core/taijiGainedThisTurn');
      expect(taijiPatch).toBeDefined();
      expect(taijiPatch!.op).toBe('add'); // 关键断言：必须是 add，不是 replace

      // 客户端应用 patch 应成功
      const clientState = { core: { hp: 100 } }; // 客户端也没有该 key
      const result = applyPatches(clientState, diff.patches!);
      expect(result.success).toBe(true);
      expect(result.state).toEqual(newState);
    });

    it('without JSON round-trip fix, compare generates "replace" that fails on client', () => {
      // 演示未修复时的问题：直接用含 undefined key 的对象做 diff
      const oldWithUndefined = { core: { hp: 100, taijiGainedThisTurn: undefined as unknown } };
      const newState = { core: { hp: 100, taijiGainedThisTurn: 3 } };

      const diff = computeDiff(oldWithUndefined, newState, Infinity);
      expect(diff.type).toBe('patch');
      const taijiPatch = diff.patches!.find(p => p.path === '/core/taijiGainedThisTurn');
      expect(taijiPatch).toBeDefined();
      // 未修复时 compare 生成 replace（因为 key 存在于 old 中）
      expect(taijiPatch!.op).toBe('replace');

      // 客户端没有该 key → replace 失败
      const clientState = { core: { hp: 100 } };
      const result = applyPatches(clientState, diff.patches!);
      expect(result.success).toBe(false); // 证明问题存在
    });

    it('function-valued multistep interaction fields must be stripped before transport diff, otherwise add patch loses value over the wire', () => {
      const cachedTransportState = {
        sys: {
          interaction: {
            current: {
              kind: 'multistep-choice',
              data: {
                meta: {
                  dtType: 'modifyDie',
                  selectCount: 2,
                },
              },
            },
          },
        },
      };

      const rawServerState = {
        sys: {
          interaction: {
            current: {
              kind: 'multistep-choice',
              data: {
                meta: {
                  dtType: 'modifyDie',
                  selectCount: 2,
                },
                localReducer: () => null,
                toCommands: () => [],
              },
            },
          },
        },
      };

      const unsafeDiff = computeDiff(cachedTransportState, rawServerState, Infinity);
      expect(unsafeDiff.type).toBe('patch');
      const localReducerPatch = unsafeDiff.patches!.find((patch) => patch.path === '/sys/interaction/current/data/localReducer');
      expect(localReducerPatch).toBeDefined();
      expect(localReducerPatch!.op).toBe('add');
      expect(typeof (localReducerPatch as Operation & { value?: unknown }).value).toBe('function');

      const wireSafeUnsafePatches = JSON.parse(JSON.stringify(unsafeDiff.patches));
      const degradedPatch = wireSafeUnsafePatches.find((patch: Operation) => patch.path === '/sys/interaction/current/data/localReducer') as Operation | undefined;
      expect(degradedPatch).toEqual({
        op: 'add',
        path: '/sys/interaction/current/data/localReducer',
      });

      const failedApply = applyPatches(cachedTransportState, wireSafeUnsafePatches as Operation[]);
      expect(failedApply.success).toBe(false);
      expect(failedApply.error).toContain('OPERATION_VALUE_REQUIRED');

      const sanitizedTransportState = JSON.parse(JSON.stringify(rawServerState));
      const safeDiff = computeDiff(cachedTransportState, sanitizedTransportState, Infinity);
      expect(safeDiff.type).toBe('patch');
      expect(safeDiff.patches?.some((patch) => patch.path === '/sys/interaction/current/data/localReducer')).toBe(false);
      expect(safeDiff.patches?.some((patch) => patch.path === '/sys/interaction/current/data/toCommands')).toBe(false);

      const safeApply = applyPatches(cachedTransportState, safeDiff.patches ?? []);
      expect(safeApply.success).toBe(true);
      expect(safeApply.state).toEqual(sanitizedTransportState);
    });
  });

  // ========================================================================
  // Property 10: 回滚后缓存基准修正 (Task 7.2)
  // ========================================================================

  /**
   * **Validates: Requirements 7.3**
   *
   * Property 10: 回滚后缓存基准修正
   * 乐观引擎回滚后，_latestState 被更新为权威状态，
   * 确保后续 patch 应用基准正确。
   */
  describe('Property 10: Rollback Cache Correction', () => {
    beforeEach(() => {
      mockSocket = new MockClientSocket();
    });

    it('updateLatestState corrects patch base after rollback', () => {
      fc.assert(
        fc.property(viewStateArb, viewStateArb, (initialState, rollbackState) => {
          mockSocket = new MockClientSocket();
          const onStateUpdate = vi.fn();
          const { client } = createConnectedClient({ onStateUpdate });

          // 建立初始状态
          simulateSync(initialState);
          simulateUpdate(initialState, { stateID: 1, randomCursor: 0 });

          // 模拟回滚：GameProvider 调用 updateLatestState 回写权威状态
          client.updateLatestState(rollbackState);

          // 验证：latestState 已更新为回滚后的权威状态
          expect(client.latestState).toEqual(rollbackState);

          // 验证：后续 patch 基于新的权威状态正确应用
          onStateUpdate.mockClear();
          mockSocket.clearEmitted();

          // 使用 JSON round-trip 安全的状态作为 patch 目标
          // （applyPatches 内部使用 JSON.parse(JSON.stringify()) 深拷贝，undefined → null）
          const safeRollback = JSON.parse(JSON.stringify(rollbackState));
          const nextState = { ...safeRollback, _patched: true };
          const diff = computeDiff(safeRollback, nextState, Infinity);
          if (diff.type === 'patch' && diff.patches && diff.patches.length > 0) {
            simulatePatch(diff.patches, { stateID: 2, randomCursor: 1 });
            // patch 应成功应用
            expect(onStateUpdate).toHaveBeenCalled();
            expect(client.latestState).toEqual(nextState);
            // 不应触发 resync
            expect(mockSocket.findEmitted('sync').length).toBe(0);
          }

          client.disconnect();
        }),
        { numRuns: 100 },
      );
    });

    it('resyncs when patch base is polluted by render-only filtered state', () => {
      const onStateUpdate = vi.fn();
      const { client } = createConnectedClient({ onStateUpdate });

      const authoritativeState = {
        core: { hp: 10 },
        sys: { eventStream: { entries: [{ id: 1, type: 'damage' }], nextId: 2 } },
      };
      simulateSync(authoritativeState);
      simulateUpdate(authoritativeState, { stateID: 1, randomCursor: 0 });

      onStateUpdate.mockClear();
      mockSocket.clearEmitted();

      const renderFilteredState = {
        core: { hp: 10 },
        sys: { eventStream: { entries: [], nextId: 2 } },
      };
      client.updateLatestState(renderFilteredState);

      const nextAuthoritativeState = {
        core: { hp: 8 },
        sys: { eventStream: { entries: [{ id: 1, type: 'damage' }, { id: 2, type: 'hp-changed' }], nextId: 3 } },
      };
      const diff = computeDiff(authoritativeState, nextAuthoritativeState, Infinity);
      expect(diff.type).toBe('patch');
      expect(diff.patches).toBeDefined();
      expect(diff.patches!.length).toBeGreaterThan(0);

      simulatePatch(diff.patches!, { stateID: 2, randomCursor: 0 });

      expect(onStateUpdate).not.toHaveBeenCalled();
      expect(mockSocket.findEmitted('sync').length).toBeGreaterThan(0);
      expect(client.latestState).toEqual(renderFilteredState);

      client.disconnect();
    });

    it('resyncs when render-only filtered state strips owner-only queued prompts from patch base', () => {
      const onStateUpdate = vi.fn();
      const { client } = createConnectedClient({ onStateUpdate });

      const authoritativeState = {
        core: { hp: 10 },
        sys: {
          interaction: {
            current: undefined,
            queue: [
              {
                id: 'owner-only-queued-a',
                kind: 'simple-choice',
                playerId: '0',
                data: {
                  title: '继续选择要弃掉的手牌',
                  sourceId: 'super_spies_secret_agent_discard_queue',
                  targetType: 'hand',
                  options: [{ id: 'hand-a', label: '手牌 A', value: { cardUid: 'hand-a' } }],
                },
              },
            ],
            isBlocked: false,
          },
          eventStream: { entries: [], nextId: 1 },
        },
      };
      simulateSync(authoritativeState);
      simulateUpdate(authoritativeState, { stateID: 1, randomCursor: 0 });

      onStateUpdate.mockClear();
      mockSocket.clearEmitted();

      const renderFilteredState = {
        core: { hp: 10 },
        sys: {
          interaction: {
            current: undefined,
            queue: [],
            isBlocked: false,
          },
          eventStream: { entries: [], nextId: 1 },
        },
      };
      client.updateLatestState(renderFilteredState);

      const nextAuthoritativeState = {
        core: { hp: 10 },
        sys: {
          interaction: {
            current: undefined,
            queue: [
              {
                id: 'owner-only-queued-a',
                kind: 'simple-choice',
                playerId: '0',
                data: {
                  title: '继续选择要弃掉的手牌',
                  sourceId: 'super_spies_secret_agent_discard_queue',
                  targetType: 'hand',
                  options: [{ id: 'hand-a', label: '手牌 A', value: { cardUid: 'hand-a' } }],
                },
              },
              {
                id: 'owner-only-queued-b',
                kind: 'simple-choice',
                playerId: '0',
                data: {
                  title: '继续选择另一张手牌',
                  sourceId: 'super_spies_secret_agent_discard_queue',
                  targetType: 'hand',
                  options: [{ id: 'hand-b', label: '手牌 B', value: { cardUid: 'hand-b' } }],
                },
              },
            ],
            isBlocked: false,
          },
          eventStream: { entries: [], nextId: 1 },
        },
      };
      const diff = computeDiff(authoritativeState, nextAuthoritativeState, Infinity);
      expect(diff.type).toBe('patch');
      expect(diff.patches).toBeDefined();
      expect(diff.patches!.some((patch) => patch.path === '/sys/interaction/queue/1')).toBe(true);

      simulatePatch(diff.patches!, { stateID: 2, randomCursor: 0 });

      expect(onStateUpdate).not.toHaveBeenCalled();
      expect(mockSocket.findEmitted('sync').length).toBeGreaterThan(0);
      expect(client.latestState).toEqual(renderFilteredState);

      client.disconnect();
    });

    it('resyncs when render-only filtered state strips owner-only current prompt from patch base', () => {
      const onStateUpdate = vi.fn();
      const { client } = createConnectedClient({ onStateUpdate });

      const authoritativeState = {
        core: { hp: 10 },
        sys: {
          interaction: {
            current: {
              id: 'owner-only-current-a',
              kind: 'simple-choice',
              playerId: '0',
              data: {
                title: '选择要弃掉的随从',
                sourceId: 'super_spies_the_spy_who_ditched_me_discard',
                targetType: 'minion',
                options: [{ id: 'minion-a', label: '随从 A', value: { minionUid: 'minion-a' } }],
              },
            },
            queue: [],
            isBlocked: false,
          },
          eventStream: { entries: [], nextId: 1 },
        },
      };
      simulateSync(authoritativeState);
      simulateUpdate(authoritativeState, { stateID: 1, randomCursor: 0 });

      onStateUpdate.mockClear();
      mockSocket.clearEmitted();

      const renderFilteredState = {
        core: { hp: 10 },
        sys: {
          interaction: {
            current: undefined,
            queue: [],
            isBlocked: false,
          },
          eventStream: { entries: [], nextId: 1 },
        },
      };
      client.updateLatestState(renderFilteredState);

      const nextAuthoritativeState = {
        core: { hp: 10 },
        sys: {
          interaction: {
            current: {
              id: 'owner-only-current-b',
              kind: 'simple-choice',
              playerId: '0',
              data: {
                title: '继续选择要弃掉的随从',
                sourceId: 'super_spies_the_spy_who_ditched_me_discard',
                targetType: 'minion',
                options: [{ id: 'minion-b', label: '随从 B', value: { minionUid: 'minion-b' } }],
              },
            },
            queue: [],
            isBlocked: false,
          },
          eventStream: { entries: [], nextId: 1 },
        },
      };
      const diff = computeDiff(authoritativeState, nextAuthoritativeState, Infinity);
      expect(diff.type).toBe('patch');
      expect(diff.patches).toBeDefined();
      expect(diff.patches!.some((patch) => patch.path === '/sys/interaction/current/id')).toBe(true);

      simulatePatch(diff.patches!, { stateID: 2, randomCursor: 0 });

      expect(onStateUpdate).not.toHaveBeenCalled();
      expect(mockSocket.findEmitted('sync').length).toBeGreaterThan(0);
      expect(client.latestState).toEqual(renderFilteredState);

      client.disconnect();
    });

    it('applies authoritative isBlocked close patch when a hidden owner-only blocker is released', () => {
      const onStateUpdate = vi.fn();
      const { client } = createConnectedClient({ onStateUpdate });

      const authoritativeBlockedState = {
        core: { hp: 10 },
        sys: {
          interaction: {
            current: undefined,
            queue: [],
            isBlocked: true,
          },
          eventStream: { entries: [], nextId: 1 },
        },
      };
      simulateSync(authoritativeBlockedState);
      simulateUpdate(authoritativeBlockedState, { stateID: 1, randomCursor: 0 });

      onStateUpdate.mockClear();
      mockSocket.clearEmitted();

      const nextAuthoritativeState = {
        core: { hp: 11 },
        sys: {
          interaction: {
            current: undefined,
            queue: [],
            isBlocked: false,
          },
          eventStream: { entries: [], nextId: 2 },
        },
      };
      const diff = computeDiff(authoritativeBlockedState, nextAuthoritativeState, Infinity);
      expect(diff.type).toBe('patch');
      expect(diff.patches).toBeDefined();
      expect(diff.patches!.some((patch) => patch.path === '/sys/interaction/isBlocked')).toBe(true);

      simulatePatch(diff.patches!, { stateID: 2, randomCursor: 0 });

      expect(onStateUpdate).toHaveBeenCalledTimes(1);
      expect(onStateUpdate).toHaveBeenCalledWith(
        expect.objectContaining({
          core: { hp: 11 },
          sys: expect.objectContaining({
            interaction: expect.objectContaining({
              isBlocked: false,
            }),
            eventStream: expect.objectContaining({
              nextId: 2,
            }),
          }),
        }),
        expect.any(Array),
        { stateID: 2, randomCursor: 0 },
      );
      expect(mockSocket.findEmitted('sync')).toHaveLength(0);
      expect(client.latestState).toEqual(nextAuthoritativeState);

      client.disconnect();
    });

    it('applies authoritative hidden-blocked patch that removes a stale visible current prompt', () => {
      const onStateUpdate = vi.fn();
      const { client } = createConnectedClient({ onStateUpdate });

      const visiblePromptState = {
        core: { hp: 10 },
        sys: {
          interaction: {
            current: {
              id: 'shared-visible-current-a',
              kind: 'simple-choice',
              playerId: '1',
              data: {
                title: '等待另一位玩家确认',
                sourceId: 'shared-visible-step',
                targetType: 'button',
                options: [{ id: 'confirm', label: '确认', value: { confirm: true } }],
              },
            },
            queue: [],
            isBlocked: false,
          },
          eventStream: { entries: [], nextId: 1 },
        },
      };
      simulateSync(visiblePromptState);
      simulateUpdate(visiblePromptState, { stateID: 1, randomCursor: 0 });

      onStateUpdate.mockClear();
      mockSocket.clearEmitted();

      const hiddenBlockedState = {
        core: { hp: 11 },
        sys: {
          interaction: {
            current: undefined,
            queue: [],
            isBlocked: true,
          },
          eventStream: { entries: [], nextId: 2 },
        },
      };
      const diff = computeDiff(visiblePromptState, hiddenBlockedState, Infinity);
      expect(diff.type).toBe('patch');
      expect(diff.patches).toBeDefined();
      expect(diff.patches!.some((patch) => patch.path === '/sys/interaction/current')).toBe(true);
      expect(diff.patches!.some((patch) => patch.path === '/sys/interaction/isBlocked')).toBe(true);

      simulatePatch(diff.patches!, { stateID: 2, randomCursor: 0 });

      expect(onStateUpdate).toHaveBeenCalledTimes(1);
      expect(onStateUpdate).toHaveBeenCalledWith(
        expect.objectContaining({
          core: { hp: 11 },
          sys: expect.objectContaining({
            interaction: expect.objectContaining({
              isBlocked: true,
            }),
            eventStream: expect.objectContaining({
              nextId: 2,
            }),
          }),
        }),
        expect.any(Array),
        { stateID: 2, randomCursor: 0 },
      );
      expect(mockSocket.findEmitted('sync')).toHaveLength(0);
      expect(client.latestState).toEqual(hiddenBlockedState);

      client.disconnect();
    });

    it('resyncs when batch-confirmed stripEventStream state pollutes patch base', () => {
      const onStateUpdate = vi.fn();
      const { client } = createConnectedClient({ onStateUpdate });

      const authoritativeStateAfterFirstAction = {
        core: { hp: 10, readyPlayers: { '1': true } },
        sys: {
          eventStream: {
            entries: [{ id: 1, type: 'SELECT_CHARACTER' }],
            nextId: 2,
          },
        },
      };
      simulateSync(authoritativeStateAfterFirstAction);
      simulateUpdate(authoritativeStateAfterFirstAction, { stateID: 1, randomCursor: 0 });

      onStateUpdate.mockClear();
      mockSocket.clearEmitted();

      // 模拟 batch:confirmed 返回的 stripEventStream 权威态：
      // nextId 已推进，但 entries 被裁剪为空。
      const strippedBatchConfirmedState = {
        core: { hp: 10, readyPlayers: { '1': true } },
        sys: {
          eventStream: {
            entries: [],
            nextId: 2,
          },
        },
      };
      client.updateLatestState(strippedBatchConfirmedState);

      const authoritativeStateAfterSecondAction = {
        core: { hp: 10, readyPlayers: { '1': true, '0': true } },
        sys: {
          eventStream: {
            entries: [
              { id: 1, type: 'SELECT_CHARACTER' },
              { id: 2, type: 'PLAYER_READY' },
            ],
            nextId: 3,
          },
        },
      };
      const diff = computeDiff(authoritativeStateAfterFirstAction, authoritativeStateAfterSecondAction, Infinity);
      expect(diff.type).toBe('patch');
      expect(diff.patches).toBeDefined();
      expect(diff.patches!.some((patch) => patch.path === '/sys/eventStream/entries/1')).toBe(true);

      simulatePatch(diff.patches!, { stateID: 2, randomCursor: 0 });

      expect(onStateUpdate).not.toHaveBeenCalled();
      expect(mockSocket.findEmitted('sync').length).toBeGreaterThan(0);
      expect(client.latestState).toEqual(strippedBatchConfirmedState);

      client.disconnect();
    });
  });
});
