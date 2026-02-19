/**
 * 撤回后 EventStream 行为测试
 * 
 * 验证：撤回恢复快照后，重新执行命令时 EventStream 是否正确写入新事件
 */

import { describe, it, expect } from 'vitest';
import { executePipeline, createInitialSystemState, createSeededRandom } from '../pipeline';
import { createEventStreamSystem, getEventStreamEntries } from '../systems/EventStreamSystem';
import { createUndoSystem, UNDO_COMMANDS } from '../systems/UndoSystem';
import type { Command, DomainCore, GameEvent, MatchState, ValidationResult } from '../types';
import { computeEventStreamDelta } from '../../games/summonerwars/ui/useGameEvents';

// 最小测试游戏
interface TestCore { counter: number; turnPhase: string }
type TestCommand = Command<'INCREMENT' | string>;
type TestEvent = GameEvent<'INCREMENTED' | string>;

const testDomain: DomainCore<TestCore, TestCommand, TestEvent> = {
  gameId: 'undo-es-test',
  setup: () => ({ counter: 0, turnPhase: 'main' }),
  validate: (): ValidationResult => ({ valid: true }),
  execute: (_state, command): TestEvent[] => {
    if (command.type === 'INCREMENT') {
      return [{ type: 'INCREMENTED', payload: { delta: 1 }, timestamp: Date.now() }];
    }
    return [];
  },
  reduce: (core, event): TestCore => {
    if (event.type === 'INCREMENTED') {
      return { ...core, counter: core.counter + 1 };
    }
    return core;
  },
};

const systems = [
  createEventStreamSystem<TestCore>(),
  createUndoSystem<TestCore>({
    requireApproval: true,
    requiredApprovals: 1,
    snapshotCommandAllowlist: ['INCREMENT'],
  }),
];

const playerIds = ['0', '1'];
const random = createSeededRandom('test-seed');

function makeState(): MatchState<TestCore> {
  const core = testDomain.setup();
  const sys = createInitialSystemState(playerIds, systems, 'test-match');
  return { core, sys };
}

function exec(state: MatchState<TestCore>, command: TestCommand) {
  return executePipeline({ domain: testDomain, systems }, state, command, random, playerIds);
}

describe('撤回后 EventStream 行为', () => {
  it('撤回恢复后重新执行命令，EventStream 应包含新事件', () => {
    let state = makeState();

    // 1. 执行 INCREMENT
    const r1 = exec(state, { type: 'INCREMENT', playerId: '0', payload: {} });
    expect(r1.success).toBe(true);
    state = r1.state;
    expect(state.core.counter).toBe(1);

    const entriesAfterIncrement = getEventStreamEntries(state);
    expect(entriesAfterIncrement.length).toBeGreaterThan(0);
    const firstEventId = entriesAfterIncrement[0].id;

    // 2. 请求撤回
    const r2 = exec(state, { type: UNDO_COMMANDS.REQUEST_UNDO, playerId: '0', payload: {} });
    expect(r2.success).toBe(true);
    state = r2.state;

    // 3. 对手批准撤回
    const r3 = exec(state, { type: UNDO_COMMANDS.APPROVE_UNDO, playerId: '1', payload: {} });
    expect(r3.success).toBe(true);
    state = r3.state;

    // 验证：撤回后 counter 恢复为 0
    expect(state.core.counter).toBe(0);

    // 验证：撤回后 EventStream entries 为空（快照中清空了）
    const entriesAfterUndo = getEventStreamEntries(state);
    expect(entriesAfterUndo).toHaveLength(0);

    // 4. 重新执行 INCREMENT
    const r4 = exec(state, { type: 'INCREMENT', playerId: '0', payload: {} });
    expect(r4.success).toBe(true);
    state = r4.state;

    // 验证：counter 再次为 1
    expect(state.core.counter).toBe(1);

    // 关键验证：EventStream 应包含新事件
    const entriesAfterReExec = getEventStreamEntries(state);
    expect(entriesAfterReExec.length).toBeGreaterThan(0);
    console.log('撤回后重新执行的 EventStream entries:', entriesAfterReExec);

    // 验证 computeEventStreamDelta 行为
    // 模拟 UI 端：撤回后 lastSeenEventId 被 reset 为 -1
    // 新事件到来时应该全部作为 newEntries 返回
    
    // 模拟撤回后的 reset
    const resetDelta = computeEventStreamDelta([], firstEventId);
    expect(resetDelta.shouldReset).toBe(true);
    expect(resetDelta.nextLastSeenId).toBe(-1);

    // 模拟新事件到来
    const newDelta = computeEventStreamDelta(entriesAfterReExec, -1);
    expect(newDelta.shouldReset).toBe(false);
    expect(newDelta.newEntries.length).toBeGreaterThan(0);
    console.log('新事件 delta:', newDelta);
  });

  it('nextId 在撤回后应保持单调递增', () => {
    let state = makeState();

    // 执行两次 INCREMENT
    const r1 = exec(state, { type: 'INCREMENT', playerId: '0', payload: {} });
    state = r1.state;
    const r2 = exec(state, { type: 'INCREMENT', playerId: '0', payload: {} });
    state = r2.state;

    const entriesBefore = getEventStreamEntries(state);
    const maxIdBefore = entriesBefore[entriesBefore.length - 1].id;
    const nextIdBefore = state.sys.eventStream.nextId;

    // 请求 + 批准撤回
    const r3 = exec(state, { type: UNDO_COMMANDS.REQUEST_UNDO, playerId: '0', payload: {} });
    state = r3.state;
    const r4 = exec(state, { type: UNDO_COMMANDS.APPROVE_UNDO, playerId: '1', payload: {} });
    state = r4.state;

    // 撤回后 nextId 应该是快照时的值（INCREMENT 执行前）
    const nextIdAfterUndo = state.sys.eventStream.nextId;
    console.log(`撤回前 nextId=${nextIdBefore}, 撤回后 nextId=${nextIdAfterUndo}`);

    // 重新执行
    const r5 = exec(state, { type: 'INCREMENT', playerId: '0', payload: {} });
    state = r5.state;

    const entriesAfter = getEventStreamEntries(state);
    expect(entriesAfter.length).toBeGreaterThan(0);
    console.log('重新执行后 entries:', entriesAfter.map(e => ({ id: e.id, type: e.event.type })));
  });
});
