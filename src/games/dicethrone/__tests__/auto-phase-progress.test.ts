import { describe, expect, it } from 'vitest';
import { diceThroneFlowHooks } from '../domain/flowHooks';
import { TOKEN_IDS } from '../domain/ids';
import type { DiceThroneCore } from '../domain/types';
import { createHeroMatchup, fixedRandom } from './test-utils';

describe('DiceThrone 开局自动推进门禁', () => {
    it('普通英雄进入 upkeep 后应继续自动推进', () => {
        const state = createHeroMatchup('monk', 'pyromancer')(['0', '1'], fixedRandom);

        const auto = diceThroneFlowHooks.onAutoContinueCheck?.({
            state: { ...state, sys: { ...state.sys, phase: 'upkeep' } },
            events: [{
                type: 'SYS_PHASE_CHANGED',
                payload: { from: 'discard', to: 'upkeep' },
            }],
        } as Parameters<NonNullable<typeof diceThroneFlowHooks.onAutoContinueCheck>>[0]);

        expect(auto).toEqual({ autoContinue: true, playerId: '0' });
    });

    it('普通英雄进入 income 后应继续自动推进', () => {
        const state = createHeroMatchup('monk', 'pyromancer')(['0', '1'], fixedRandom);

        const auto = diceThroneFlowHooks.onAutoContinueCheck?.({
            state: { ...state, sys: { ...state.sys, phase: 'income' } },
            events: [{
                type: 'SYS_PHASE_CHANGED',
                payload: { from: 'upkeep', to: 'income' },
            }],
        } as Parameters<NonNullable<typeof diceThroneFlowHooks.onAutoContinueCheck>>[0]);

        expect(auto).toEqual({ autoContinue: true, playerId: '0' });
    });

    it('工匠在 upkeep 有可点纳米机器人时应停住等待玩家', () => {
        const state = createHeroMatchup('artificer', 'monk')(['0', '1'], fixedRandom);
        state.core.activePlayerId = '0';
        state.core.players['0'].tokens[TOKEN_IDS.SYNTH] = 2;
        state.core.players['0'].artificerBotState = {
            ...(state.core.players['0'].artificerBotState ?? {}),
            [TOKEN_IDS.NANOBOT]: {
                built: true,
                upgraded: false,
                activationsUsedThisTurn: 0,
            },
        } as DiceThroneCore['players'][string]['artificerBotState'];

        const auto = diceThroneFlowHooks.onAutoContinueCheck?.({
            state: { ...state, sys: { ...state.sys, phase: 'upkeep' } },
            events: [{
                type: 'SYS_PHASE_CHANGED',
                payload: { from: 'discard', to: 'upkeep' },
            }],
        } as Parameters<NonNullable<typeof diceThroneFlowHooks.onAutoContinueCheck>>[0]);

        expect(auto).toBeUndefined();
    });
});
