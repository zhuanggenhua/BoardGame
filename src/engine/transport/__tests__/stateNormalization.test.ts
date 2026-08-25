import { describe, expect, it } from 'vitest';
import type { MatchState } from '../../types';
import {
    isPersistedLocalStateCompatible,
    resolveRuntimeSeatControllers,
} from '../stateNormalization';

describe('resolveRuntimeSeatControllers', () => {
    it('当前状态里的座位控制权应覆盖创建时残留的 AI 配置', () => {
        const state = {
            core: {
                seatControllers: {
                    '0': { type: 'human' },
                    '1': { type: 'human' },
                },
            },
            sys: {},
        } as MatchState<unknown>;

        const resolved = resolveRuntimeSeatControllers({
            state,
            seatControllers: {
                '0': { type: 'human' },
                '1': { type: 'local-ai' },
            },
        });

        expect(resolved).toEqual({
            '0': { type: 'human' },
            '1': { type: 'human' },
        });
    });
});

describe('isPersistedLocalStateCompatible', () => {
    it('接受用 core.playerIds 声明玩家身份的本地教程快照', () => {
        const state = {
            core: {
                playerIds: ['0', '1', '2'],
                currentPlayer: '0',
            },
            sys: {
                tutorial: {
                    active: true,
                    manifestId: 'basic-opening',
                    stepIndex: 1,
                    step: { id: 'hand-limit' },
                    steps: [{ id: 'welcome' }, { id: 'hand-limit' }],
                },
            },
        } as unknown as MatchState<unknown>;

        expect(isPersistedLocalStateCompatible({
            state,
            expectedPlayerIds: ['0', '1', '2'],
        })).toBe(true);
    });

    it('拒绝 core.playerIds 与当前本地人数不一致的快照', () => {
        const state = {
            core: {
                playerIds: ['0', '1', '2'],
                currentPlayer: '0',
            },
            sys: {},
        } as unknown as MatchState<unknown>;

        expect(isPersistedLocalStateCompatible({
            state,
            expectedPlayerIds: ['0', '1'],
        })).toBe(false);
    });
});
