import { describe, expect, it } from 'vitest';

import { createInitialSystemState, createSeededRandom, executePipeline } from '../pipeline';
import { createUndoSystem, UNDO_COMMANDS } from '../systems/UndoSystem';
import type { Command, DomainCore, GameEvent, MatchState } from '../types';

interface TestCore {
    value: number;
}

type TestCommand = Command<'NOOP' | 'INVALID' | 'SYS_REQUEST_UNDO', Record<string, never>>;
type TestEvent = GameEvent<'NOOP', Record<string, never>>;

const domain: DomainCore<TestCore, TestCommand, TestEvent> = {
    gameId: 'pipeline-state-revision-test',
    setup: () => ({ value: 0 }),
    validate: (_state, command) => command.type === 'INVALID'
        ? { valid: false, error: 'invalid' }
        : { valid: true },
    execute: () => [],
    reduce: (core) => core,
};

const createState = (): MatchState<TestCore> => ({
    core: { value: 0 },
    sys: createInitialSystemState(['0'], [], 'revision-test'),
});

describe('pipeline state revision', () => {
    it('从 0 开始，只在成功处理命令后递增且与 decisionEpoch 分开', () => {
        const initial = createState();
        expect(initial.sys.revision).toBe(0);
        expect(initial.sys.decisionEpoch).toBe(0);

        const first = executePipeline(
            { domain, systems: [] },
            initial,
            { type: 'NOOP', playerId: '0', payload: {}, timestamp: 1 },
            createSeededRandom('revision-test'),
            ['0'],
        );

        expect(first.success).toBe(true);
        expect(first.state.sys.revision).toBe(1);
        expect(first.state.sys.decisionEpoch).toBe(0);

        const rejected = executePipeline(
            { domain, systems: [] },
            first.state,
            { type: 'INVALID', playerId: '0', payload: {}, timestamp: 2 },
            createSeededRandom('revision-test'),
            ['0'],
        );

        expect(rejected.success).toBe(false);
        expect(rejected.state.sys.revision).toBe(1);
    });

    it('撤销后 revision 仍从命令前的当前版本递增，不随恢复快照回退', () => {
        const systems = [createUndoSystem<TestCore>({
            requireApproval: false,
            snapshotCommandAllowlist: ['NOOP'],
        })];
        const initial: MatchState<TestCore> = {
            core: { value: 0 },
            sys: createInitialSystemState(['0'], systems, 'revision-test-undo'),
        };
        const first = executePipeline(
            { domain, systems },
            initial,
            { type: 'NOOP', playerId: '0', payload: {}, timestamp: 1 },
            createSeededRandom('revision-test'),
            ['0'],
        );
        expect(first.success).toBe(true);
        expect(first.state.sys.revision).toBe(1);
        expect(first.state.sys.undo.snapshots).toHaveLength(1);

        const undone = executePipeline(
            { domain, systems },
            first.state,
            { type: UNDO_COMMANDS.REQUEST_UNDO, playerId: '0', payload: {}, timestamp: 2 },
            createSeededRandom('revision-test'),
            ['0'],
        );

        expect(undone.success).toBe(true);
        expect(undone.state.core.value).toBe(0);
        expect(undone.state.sys.revision).toBe(2);
        expect(undone.state.sys.undo.rollbackRevision).toBe(1);
        expect(undone.state.sys.undo.snapshots).toHaveLength(0);
    });
});
