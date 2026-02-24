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
  }) {
    const onStateUpdate = overrides?.onStateUpdate ?? vi.fn();
    const client = new GameTransportClient({
      server: '',
      matchID: 'test-match',
      playerID: '0',
      credentials: 'test-cred',
      onStateUpdate: onStateUpdate as never,
    });
    client.connect();
    // 手动触发 connect 事件（mock 的 io() 不会自动触发）
    mockSocket.simulateEvent('connect');
    return { client, onStateUpdate };
  }

  /** 模拟服务端发送 state:sync 全量同步 */
  function simulateSync(state: unknown, matchPlayers = [{ id: 0 }]) {
    mockSocket.simulateEvent('state:sync', 'test-match', state, matchPlayers, { seed: 'abc', cursor: 0 });
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
   * Property 4: StateID 连续性校验
   * 当 stateID 不连续（meta.stateID !== lastReceivedStateID + 1 且 lastReceivedStateID !== null）时，
   * 客户端应丢弃 patch（不更新本地状态）并触发 resync。
   */
  describe('Property 4: StateID Continuity', () => {
    beforeEach(() => {
      mockSocket = new MockClientSocket();
    });

    it('discards patch and triggers resync when stateID is not continuous', () => {
      fc.assert(
        fc.property(
          fc.integer({ min: 1, max: 100 }),  // lastReceivedStateID
          fc.integer({ min: 2, max: 50 }),    // gap（保证 != 1，产生不连续）
          (lastId, gap) => {
            // 每次迭代重置 mock socket
            mockSocket = new MockClientSocket();
            const onStateUpdate = vi.fn();
            const { client } = createConnectedClient({ onStateUpdate });

            // 建立初始状态：通过 state:sync + state:update 设置 lastReceivedStateID
            const initialState = { core: { turn: 0 } };
            simulateSync(initialState);
            simulateUpdate(initialState, { stateID: lastId, randomCursor: 0 });
            onStateUpdate.mockClear();
            mockSocket.clearEmitted();

            // 发送不连续的 stateID（跳过 gap 个版本）
            const discontinuousId = lastId + gap + 1; // 保证 != lastId + 1
            const patches: Operation[] = [{ op: 'replace', path: '/core/turn', value: 1 }];
            simulatePatch(patches, { stateID: discontinuousId, randomCursor: 1 });

            // 验证：onStateUpdate 不应被调用（patch 被丢弃）
            expect(onStateUpdate).not.toHaveBeenCalled();

            // 验证：应触发 resync（emit sync 事件）
            const syncEmits = mockSocket.findEmitted('sync');
            expect(syncEmits.length).toBeGreaterThan(0);

            // 验证：本地状态未变化
            expect(client.latestState).toEqual(initialState);

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
   * 成功处理 state:update / state:patch 后，_lastReceivedStateID 更新为事件的 stateID。
   * state:sync 后重置为 null。
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
          simulateSync(baseState);

          // 追踪预期的 lastReceivedStateID
          let expectedLastID: number | null = null;
          let currentState = baseState;

          // sync 后 expectedLastID = null
          // 已经 simulateSync 了，所以 expectedLastID = null

          for (const event of events) {
            if (event.type === 'sync') {
              simulateSync(currentState);
              expectedLastID = null;
            } else if (event.type === 'update') {
              const newState = { core: { v: event.stateID } };
              simulateUpdate(newState, { stateID: event.stateID, randomCursor: 0 });
              currentState = newState;
              expectedLastID = event.stateID;
            } else {
              // patch：需要连续的 stateID 才能成功
              const nextID: number = expectedLastID === null ? event.stateID : expectedLastID + 1;
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
            const verifyID = expectedLastID === null ? 42 : expectedLastID + 1;
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
  });
});
