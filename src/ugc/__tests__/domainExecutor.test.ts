import { describe, it, expect } from 'vitest';
import { RuntimeDomainExecutor } from '../runtime/domainExecutor';

const domainCode = `const domain = {
  gameId: 'deterministic-demo',
  setup(playerIds, random) {
    const players = Object.fromEntries(playerIds.map(id => [id, {
      resources: {},
      handCount: 0,
      deckCount: 0,
      discardCount: 0,
      statusEffects: {},
    }]));
    return {
      phase: 'play',
      activePlayerId: playerIds[0] || 'player-1',
      turnNumber: 1,
      players,
      publicZones: {
        seedValue: random.d(6),
      },
    };
  },
  validate() {
    return { valid: true };
  },
  execute(_state, _command, random) {
    return [{ type: 'ROLLED', payload: { value: random.d(6) } }];
  },
  reduce(state, _event) {
    return state;
  },
};`;

const permissionDomainCode = `const domain = {
  gameId: 'permission-demo',
  setup(playerIds) {
    const value = Math.random();
    return {
      phase: 'play',
      activePlayerId: playerIds[0] || 'player-1',
      turnNumber: 1,
      players: {},
      publicZones: { value },
    };
  },
  validate() { return { valid: true }; },
  execute() { return []; },
  reduce(state) { return state; },
};`;

const nonSerializableDomainCode = `const domain = {
  gameId: 'contract-demo',
  setup(playerIds) {
    return {
      phase: 'play',
      activePlayerId: playerIds[0] || 'player-1',
      turnNumber: 1,
      players: {},
      publicZones: {},
    };
  },
  validate() { return { valid: true }; },
  execute() { return [{ type: 'BAD', payload: { value: BigInt(1) } }]; },
  reduce(state) { return state; },
};`;

describe('RuntimeDomainExecutor', () => {
  it('setup 在相同随机种子下应保持确定性', async () => {
    const executor = new RuntimeDomainExecutor({ timeoutMs: 200 });
    const loadResult = await executor.loadCode(domainCode);
    expect(loadResult.success).toBe(true);

    const first = await executor.setup(['player-1', 'player-2'], 42);
    const second = await executor.setup(['player-1', 'player-2'], 42);

    expect(first.success).toBe(true);
    expect(second.success).toBe(true);
    expect(first.result).toEqual(second.result);
  });

  it('execute 在相同随机种子下应输出一致事件', async () => {
    const executor = new RuntimeDomainExecutor({ timeoutMs: 200 });
    const loadResult = await executor.loadCode(domainCode);
    expect(loadResult.success).toBe(true);

    const setupResult = await executor.setup(['player-1'], 99);
    expect(setupResult.success).toBe(true);

    const state = setupResult.result!;
    const command = { type: 'ROLL', playerId: 'player-1', payload: {} };

    const first = await executor.execute(state, command, 100);
    const second = await executor.execute(state, command, 100);

    expect(first.success).toBe(true);
    expect(second.success).toBe(true);
    expect(first.result).toEqual(second.result);
  });

  it('禁止使用 Math.random', async () => {
    const executor = new RuntimeDomainExecutor({ timeoutMs: 200 });
    const loadResult = await executor.loadCode(permissionDomainCode);
    expect(loadResult.success).toBe(true);

    const setupResult = await executor.setup(['player-1'], 1);
    expect(setupResult.success).toBe(false);
    expect(setupResult.errorType).toBe('permission');
    expect(setupResult.errorStage).toBe('setup');
  });

  it('事件不可序列化时应返回 contract 错误', async () => {
    const executor = new RuntimeDomainExecutor({ timeoutMs: 200 });
    const loadResult = await executor.loadCode(nonSerializableDomainCode);
    expect(loadResult.success).toBe(true);

    const setupResult = await executor.setup(['player-1'], 1);
    expect(setupResult.success).toBe(true);

    const state = setupResult.result!;
    const command = { type: 'RUN', playerId: 'player-1', payload: {} };
    const result = await executor.execute(state, command, 2);
    expect(result.success).toBe(false);
    expect(result.errorType).toBe('contract');
    expect(result.errorStage).toBe('execute');
  });
});
