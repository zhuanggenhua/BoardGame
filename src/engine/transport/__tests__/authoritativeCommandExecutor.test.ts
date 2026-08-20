import { describe, expect, it } from 'vitest';
import type { Command, DomainCore, GameEvent, MatchState, RandomFn } from '../../types';
import { createInitialSystemState } from '../../pipeline';
import { INTERACTION_COMMANDS } from '../../systems/InteractionSystem';
import type { GameEngineConfig } from '../engineConfig';
import { AuthoritativeCommandExecutor } from '../authoritativeCommandExecutor';

type TestCore = {
    count: number;
};

type TestEvent = GameEvent<'COUNTED', { amount: number }>;

const random: RandomFn = {
    random: () => 0,
    d: () => 1,
    range: (min) => min,
    shuffle: (array) => [...array],
};

function createState(core: TestCore = { count: 0 }): MatchState<TestCore> {
    return {
        core,
        sys: createInitialSystemState(['0', '1'], []),
    };
}

function createConfig(domain: DomainCore<TestCore, Command, TestEvent>): GameEngineConfig {
    return {
        gameId: 'executor-test',
        domain,
        systems: [],
    };
}

const baseDomain: DomainCore<TestCore, Command, TestEvent> = {
    gameId: 'executor-test',
    setup: () => ({ count: 0 }),
    validate: (_state, command) => (
        command.type === 'INVALID'
            ? { valid: false, error: 'invalid_command' }
            : { valid: true }
    ),
    execute: (_state, command) => {
        if (command.type === 'THROW') {
            throw new Error('boom');
        }
        return [{
            type: 'COUNTED',
            payload: { amount: Number((command.payload as { amount?: number }).amount ?? 1) },
            timestamp: 1,
        }];
    },
    reduce: (core, event) => ({
        count: core.count + event.payload.amount,
    }),
};

describe('AuthoritativeCommandExecutor', () => {
    it('通过统一管线执行成功命令并返回权威状态和事件', () => {
        const executor = new AuthoritativeCommandExecutor(() => 100);
        const result = executor.execute({
            engineConfig: createConfig(baseDomain),
            state: createState(),
            random,
            playerIds: ['0', '1'],
            playerId: '0',
            commandType: 'ADD',
            payload: { amount: 2 },
            seatControllerType: 'human',
            preCommandSeatView: createState(),
        });

        expect(result.success).toBe(true);
        if (!result.success) return;
        expect(result.command).toMatchObject({
            type: 'ADD',
            playerId: '0',
            payload: { amount: 2 },
            timestamp: 100,
        });
        expect(result.state.core.count).toBe(2);
        expect(result.events).toHaveLength(1);
    });

    it('把领域拒绝规范化为 domain-rejected，不把失败伪装成成功', () => {
        const executor = new AuthoritativeCommandExecutor(() => 100);
        const result = executor.execute({
            engineConfig: createConfig(baseDomain),
            state: createState(),
            random,
            playerIds: ['0', '1'],
            playerId: '0',
            commandType: 'INVALID',
            payload: {},
            seatControllerType: 'human',
            preCommandSeatView: createState(),
        });

        expect(result.success).toBe(false);
        if (result.success) return;
        expect(result.kind).toBe('domain-rejected');
        expect(result.failureReason).toBe('invalid_command');
    });

    it('把 pipeline 异常规范化为 pipeline-exception 并保留原始错误', () => {
        const executor = new AuthoritativeCommandExecutor(() => 100);
        const result = executor.execute({
            engineConfig: createConfig(baseDomain),
            state: createState(),
            random,
            playerIds: ['0', '1'],
            playerId: '0',
            commandType: 'THROW',
            payload: {},
            seatControllerType: 'human',
            preCommandSeatView: createState(),
        });

        expect(result.success).toBe(false);
        if (result.success) return;
        expect(result.kind).toBe('pipeline-exception');
        expect(result.failureReason).toBe('pipeline_error: boom');
        expect(result.error.message).toBe('boom');
    });

    it('AI emergency skip RESPOND 进入权威管线前翻译为 CANCEL', () => {
        const executor = new AuthoritativeCommandExecutor(() => 100);
        const preCommandSeatView = createState();
        preCommandSeatView.sys.interaction.current = {
            id: 'interaction-1',
            kind: 'simple-choice',
            playerId: '1',
            prompt: 'skip',
            data: {
                options: [{
                    id: '__emergency_skip__',
                    label: 'Skip',
                    value: {
                        __emergency_skip__: true,
                        __emergency_skip_reason__: 'empty-options',
                    },
                }],
            },
        };

        const result = executor.execute({
            engineConfig: createConfig(baseDomain),
            state: createState(),
            random,
            playerIds: ['0', '1'],
            playerId: '1',
            commandType: INTERACTION_COMMANDS.RESPOND,
            payload: {
                interactionId: 'interaction-1',
                optionId: '__emergency_skip__',
            },
            seatControllerType: 'local-ai',
            preCommandSeatView,
        });

        expect(result.success).toBe(true);
        if (!result.success) return;
        expect(result.command.type).toBe(INTERACTION_COMMANDS.CANCEL);
        expect(result.command.payload).toMatchObject({
            interactionId: 'interaction-1',
            reason: 'empty-options',
        });
    });
});
