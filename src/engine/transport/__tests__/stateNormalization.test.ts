import { describe, expect, it } from 'vitest';
import type { MatchState } from '../../types';
import { resolveRuntimeSeatControllers } from '../stateNormalization';

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
