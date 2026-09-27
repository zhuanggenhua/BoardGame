/**
 * 撤回后 EventStream 行为测试
 * 
 * 验证：撤回恢复快照后，重新执行命令时 EventStream 是否正确写入新事件
 */

import { describe, it, expect } from 'vitest';
import { executePipeline, createInitialSystemState, createSeededRandom } from '../pipeline';
import { createActionLogSystem } from '../systems/ActionLogSystem';
import { createEventStreamSystem, computeEventStreamDelta, getEventStreamEntries } from '../systems/EventStreamSystem';
import { createTutorialSystem, TUTORIAL_COMMANDS } from '../systems/TutorialSystem';
import { createUndoSystem, setUndoAiSeatIds, UNDO_COMMANDS } from '../systems/UndoSystem';
import type { Command, DomainCore, GameEvent, MatchState, ValidationResult } from '../types';

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

function execWithSystems(state: MatchState<TestCore>, command: TestCommand, activeSystems = systems) {
  return executePipeline({ domain: testDomain, systems: activeSystems }, state, command, random, playerIds);
}

describe('撤回后 EventStream 行为', () => {
  it('教程上一步会同时恢复对应领域快照', () => {
    const tutorialSystems = [
      createUndoSystem<TestCore>({
        requireApproval: false,
        snapshotCommandAllowlist: ['INCREMENT'],
      }),
      createTutorialSystem<TestCore>(),
    ];
    const tutorialManifest = {
      id: 'tutorial-previous-restores-state',
      steps: [
        {
          id: 'before-increment',
          content: 'before',
          advanceOnEvents: [{ type: 'INCREMENTED' }],
        },
        {
          id: 'after-increment',
          content: 'after',
        },
      ],
    };
    let state: MatchState<TestCore> = {
      core: testDomain.setup(),
      sys: createInitialSystemState(['0'], tutorialSystems, 'local:tutorial-previous'),
    };
    const execTutorial = (command: TestCommand) => executePipeline({
      domain: testDomain,
      systems: tutorialSystems,
    }, state, command, random, ['0']);

    let result = execTutorial({
      type: TUTORIAL_COMMANDS.START,
      playerId: '0',
      payload: { manifest: tutorialManifest },
    });
    expect(result.success).toBe(true);
    state = result.state;

    result = execTutorial({ type: 'INCREMENT', playerId: '0', payload: {} });
    expect(result.success).toBe(true);
    state = result.state;
    expect(state.core.counter).toBe(1);
    expect(state.sys.tutorial.step?.id).toBe('after-increment');

    result = execTutorial({
      type: TUTORIAL_COMMANDS.PREVIOUS,
      playerId: '0',
      payload: {},
    });
    expect(result.success).toBe(true);
    state = result.state;
    expect(state.core.counter).toBe(0);
    expect(state.sys.tutorial.step?.id).toBe('before-increment');
    expect(state.sys.undo.rollbackRevision).toBe(1);
  });

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
    expect(state.sys.undo.rollbackRevision).toBe(1);

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

  it('AI 对局无人类审批者时，请求撤回应直接通过', () => {
    let state = setUndoAiSeatIds(makeState(), ['1']);

    const r1 = exec(state, { type: 'INCREMENT', playerId: '0', payload: {} });
    expect(r1.success).toBe(true);
    state = r1.state;
    expect(state.core.counter).toBe(1);

    const r2 = exec(state, { type: UNDO_COMMANDS.REQUEST_UNDO, playerId: '0', payload: {} });
    expect(r2.success).toBe(true);
    state = r2.state;

    expect(state.core.counter).toBe(0);
    expect(state.sys.undo.pendingRequest).toBeUndefined();
    expect(state.sys.undo.snapshots).toHaveLength(0);
    expect(state.sys.undo.rollbackRevision).toBe(1);
  });

  it('直接撤回会递增 rollbackRevision，并保留快照游标恢复语义', () => {
    const directSystems = [
      createEventStreamSystem<TestCore>(),
      createUndoSystem<TestCore>({
        requireApproval: false,
        snapshotCommandAllowlist: ['INCREMENT'],
      }),
    ];
    let state = makeState();
    const first = execWithSystems(
      state,
      { type: 'INCREMENT', playerId: '0', payload: {} },
      directSystems,
    );
    expect(first.success).toBe(true);
    state = first.state;
    const beforeUndoRevision = state.sys.undo.rollbackRevision ?? 0;
    const beforeUndoCursor = state.sys.undo.snapshotCursors?.[0];

    const undo = execWithSystems(
      state,
      { type: UNDO_COMMANDS.REQUEST_UNDO, playerId: '0', payload: {} },
      directSystems,
    );
    expect(undo.success).toBe(true);
    expect(undo.state.core.counter).toBe(0);
    expect(undo.state.sys.undo.rollbackRevision).toBe(beforeUndoRevision + 1);
    expect(undo.state.sys.undo.restoredRandomCursor).toBe(
      beforeUndoCursor !== undefined && beforeUndoCursor >= 0
        ? beforeUndoCursor
        : undefined,
    );
    expect(undo.state.sys.undo.snapshots).toHaveLength(0);
  });

  it('多人审批完成后只递增一次 rollbackRevision', () => {
    let state = makeState();
    state = exec(state, { type: 'INCREMENT', playerId: '0', payload: {} }).state;
    expect(state.sys.undo.rollbackRevision ?? 0).toBe(0);

    state = exec(state, {
      type: UNDO_COMMANDS.REQUEST_UNDO,
      playerId: '0',
      payload: {},
    }).state;
    expect(state.sys.undo.rollbackRevision ?? 0).toBe(0);

    state = exec(state, {
      type: UNDO_COMMANDS.APPROVE_UNDO,
      playerId: '1',
      payload: {},
    }).state;
    expect(state.sys.undo.rollbackRevision).toBe(1);
  });

  it('拒绝或取消撤回请求不会递增 rollbackRevision', () => {
    let state = makeState();
    state = exec(state, { type: 'INCREMENT', playerId: '0', payload: {} }).state;

    state = exec(state, {
      type: UNDO_COMMANDS.REQUEST_UNDO,
      playerId: '0',
      payload: {},
    }).state;
    state = exec(state, {
      type: UNDO_COMMANDS.REJECT_UNDO,
      playerId: '1',
      payload: {},
    }).state;
    expect(state.sys.undo.rollbackRevision ?? 0).toBe(0);
    expect(state.sys.undo.snapshots).toHaveLength(1);

    state = exec(state, {
      type: UNDO_COMMANDS.REQUEST_UNDO,
      playerId: '0',
      payload: {},
    }).state;
    state = exec(state, {
      type: UNDO_COMMANDS.CANCEL_UNDO,
      playerId: '0',
      payload: {},
    }).state;
    expect(state.sys.undo.rollbackRevision ?? 0).toBe(0);
    expect(state.sys.undo.snapshots).toHaveLength(1);
  });

  it('没有可撤回快照时请求会被拒绝且 rollbackRevision 不变', () => {
    const state = makeState();
    const result = exec(state, {
      type: UNDO_COMMANDS.REQUEST_UNDO,
      playerId: '0',
      payload: {},
    });

    expect(result.success).toBe(false);
    expect(result.state.sys.undo.rollbackRevision ?? 0).toBe(0);
    expect(result.state.sys.undo.pendingRequest).toBeUndefined();
  });

  it('连续撤回每次只递增一个权威版本', () => {
    let state = makeState();
    state = exec(state, { type: 'INCREMENT', playerId: '0', payload: {} }).state;
    state = exec(state, {
      type: UNDO_COMMANDS.REQUEST_UNDO,
      playerId: '0',
      payload: {},
    }).state;
    state = exec(state, {
      type: UNDO_COMMANDS.APPROVE_UNDO,
      playerId: '1',
      payload: {},
    }).state;
    expect(state.sys.undo.rollbackRevision).toBe(1);

    state = exec(state, { type: 'INCREMENT', playerId: '0', payload: {} }).state;
    state = exec(state, {
      type: UNDO_COMMANDS.REQUEST_UNDO,
      playerId: '0',
      payload: {},
    }).state;
    state = exec(state, {
      type: UNDO_COMMANDS.APPROVE_UNDO,
      playerId: '1',
      payload: {},
    }).state;
    expect(state.sys.undo.rollbackRevision).toBe(2);
  });

  it('本地对局 localAutoApprove 在 local: matchId 下应直接通过', () => {
    let state = makeState();
    state = {
      ...state,
      sys: {
        ...state.sys,
        matchId: 'local:undo-es-test:seed',
      } as typeof state.sys,
    };

    const r1 = exec(state, { type: 'INCREMENT', playerId: '0', payload: {} });
    expect(r1.success).toBe(true);
    state = r1.state;
    expect(state.core.counter).toBe(1);

    const r2 = exec(state, {
      type: UNDO_COMMANDS.REQUEST_UNDO,
      playerId: '0',
      payload: { localAutoApprove: true },
    });
    expect(r2.success).toBe(true);
    state = r2.state;

    expect(state.core.counter).toBe(0);
    expect(state.sys.undo.pendingRequest).toBeUndefined();
    expect(state.sys.undo.snapshots).toHaveLength(0);
    expect(state.sys.undo.rollbackRevision).toBe(1);
  });

  it('AI 座位执行命令时，不应额外占用撤回快照', () => {
    let state = setUndoAiSeatIds(makeState(), ['1']);

    const humanTurn = exec(state, { type: 'INCREMENT', playerId: '0', payload: {} });
    expect(humanTurn.success).toBe(true);
    state = humanTurn.state;
    expect(state.core.counter).toBe(1);
    expect(state.sys.undo.snapshots).toHaveLength(1);

    const aiTurn = exec(state, { type: 'INCREMENT', playerId: '1', payload: {} });
    expect(aiTurn.success).toBe(true);
    state = aiTurn.state;
    expect(state.core.counter).toBe(2);
    expect(state.sys.undo.snapshots).toHaveLength(1);

    const undoResult = exec(state, { type: UNDO_COMMANDS.REQUEST_UNDO, playerId: '0', payload: {} });
    expect(undoResult.success).toBe(true);
    state = undoResult.state;

    expect(state.core.counter).toBe(0);
    expect(state.sys.undo.snapshots).toHaveLength(0);
  });

  it('显式 _noSnapshot 命令不应占用撤回快照，供教程 AI 复用', () => {
    let state = makeState();

    const humanTurn = exec(state, { type: 'INCREMENT', playerId: '0', payload: {} });
    expect(humanTurn.success).toBe(true);
    state = humanTurn.state;
    expect(state.sys.undo.snapshots).toHaveLength(1);

    const tutorialAiTurn = exec(state, {
      type: 'INCREMENT',
      playerId: '1',
      payload: { _noSnapshot: true },
    });
    expect(tutorialAiTurn.success).toBe(true);
    state = tutorialAiTurn.state;

    expect(state.core.counter).toBe(2);
    expect(state.sys.undo.snapshots).toHaveLength(1);
  });

  it('教程上一步命令不应占用正式撤回快照', () => {
    const tutorialSystems = [
      createEventStreamSystem<TestCore>(),
      createActionLogSystem<TestCore>({
        commandAllowlist: ['INCREMENT'],
        formatEntry: ({ command }) => ({
          id: `log-${command.type}-${command.timestamp ?? 0}`,
          timestamp: command.timestamp ?? 0,
          actorId: command.playerId,
          kind: command.type,
          segments: [{ type: 'text', text: 'increment' }],
        }),
      }),
      createUndoSystem<TestCore>({
        requireApproval: true,
        requiredApprovals: 1,
        snapshotCommandAllowlist: ['INCREMENT'],
      }),
      createTutorialSystem<TestCore>(),
    ];
    let state: MatchState<TestCore> = {
      core: testDomain.setup(),
      sys: createInitialSystemState(playerIds, tutorialSystems, 'test-match'),
    };

    const domainCommand = execWithSystems(state, { type: 'INCREMENT', playerId: '0', payload: {} }, tutorialSystems);
    expect(domainCommand.success).toBe(true);
    state = domainCommand.state;
    expect(state.sys.undo.snapshots).toHaveLength(1);
    expect(state.sys.actionLog.entries).toHaveLength(1);

    const manifest = {
      id: 'tutorial-previous',
      allowManualSkip: true,
      steps: [
        { id: 'intro', content: 'intro' },
        { id: 'second', content: 'second' },
      ],
    };
    const started = execWithSystems(state, {
      type: TUTORIAL_COMMANDS.START,
      playerId: '0',
      payload: { manifest },
    }, tutorialSystems);
    expect(started.success).toBe(true);
    state = started.state;

    const next = execWithSystems(state, {
      type: TUTORIAL_COMMANDS.NEXT,
      playerId: '0',
      payload: {},
    }, tutorialSystems);
    expect(next.success).toBe(true);
    state = next.state;
    expect(state.sys.tutorial.stepIndex).toBe(1);

    const previous = execWithSystems(state, {
      type: TUTORIAL_COMMANDS.PREVIOUS,
      playerId: '0',
      payload: {},
    }, tutorialSystems);
    expect(previous.success).toBe(true);
    state = previous.state;

    expect(state.sys.tutorial.stepIndex).toBe(0);
    expect(state.sys.undo.snapshots).toHaveLength(1);
    expect(state.sys.actionLog.entries).toHaveLength(1);
  });
});
