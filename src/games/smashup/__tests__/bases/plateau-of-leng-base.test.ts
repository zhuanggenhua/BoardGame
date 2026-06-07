import { beforeAll, describe, expect, it } from 'vitest';
import { initAllAbilities } from '../../abilities';
import { triggerBaseAbility } from '../../domain/baseAbilities';
import type { BaseAbilityContext } from '../../domain/baseAbilities';
import {
    makeBase,
    makeCard,
    makeMatchState,
    makePlayer,
    makeState,
    triggerBaseAbilityWithMS,
} from '../helpers';

beforeAll(() => {
    initAllAbilities();
});

function makeCtx(overrides: Partial<BaseAbilityContext>): BaseAbilityContext {
    const state = overrides.state ?? makeState();
    return {
        state,
        matchState: makeMatchState(state),
        baseIndex: 0,
        baseDefId: 'test_base',
        playerId: '0',
        now: 1000,
        ...overrides,
    };
}

describe('base_plateau_of_leng: 冷原高地 - 打同名随从', () => {
    it('在非行动阶段会把额外分支标为 immediate', () => {
        const core = makeState({
            bases: [makeBase('base_plateau_of_leng')],
            players: {
                '0': makePlayer('0', {
                    minionsPlayedPerBase: { 0: 1 },
                }),
                '1': makePlayer('1'),
            },
        });
        const ms = makeMatchState(core);
        ms.sys.phase = 'startTurn';

        const result = triggerBaseAbilityWithMS('base_plateau_of_leng', 'onMinionPlayed', makeCtx({
            state: core,
            matchState: ms,
            baseDefId: 'base_plateau_of_leng',
            baseIndex: 0,
            minionUid: 'm1',
            minionDefId: 'alien_collector',
        }));

        expect((result.events[0] as any).payload.playTiming).toBe('immediate');
    });

    it('首次打出时直接授予同名随从额度', () => {
        const result = triggerBaseAbilityWithMS('base_plateau_of_leng', 'onMinionPlayed', makeCtx({
            state: makeState({
                bases: [makeBase('base_plateau_of_leng')],
                players: {
                    '0': makePlayer('0', {
                        hand: [makeCard('h1', 'alien_collector', 'minion', '0')],
                        minionsPlayedPerBase: { 0: 1 },
                    }),
                    '1': makePlayer('1'),
                },
            }),
            baseDefId: 'base_plateau_of_leng',
            baseIndex: 0,
            minionUid: 'm1',
            minionDefId: 'alien_collector',
        }));

        expect(result.events).toHaveLength(1);
        expect(result.events[0].type).toBe('su:limit_modified');
        expect(result.events[0].payload).toMatchObject({
            playerId: '0',
            limitType: 'minion',
            delta: 1,
            reason: 'base_plateau_of_leng',
            restrictToBase: 0,
            sameNameOnly: true,
            sameNameDefId: 'alien_collector',
        });
    });

    it('非首次打出时不触发（即使手牌有同名随从）', () => {
        const { events } = triggerBaseAbility('base_plateau_of_leng', 'onMinionPlayed', makeCtx({
            state: makeState({
                bases: [makeBase('base_plateau_of_leng')],
                players: {
                    '0': makePlayer('0', {
                        hand: [makeCard('h1', 'alien_collector', 'minion', '0')],
                        minionsPlayedPerBase: { 0: 2 },
                    }),
                    '1': makePlayer('1'),
                },
            }),
            baseDefId: 'base_plateau_of_leng',
            baseIndex: 0,
            minionUid: 'm2',
            minionDefId: 'alien_collector',
        }));

        expect(events).toHaveLength(0);
    });

    it('首次打出时授予额度（无论手牌是否有同名随从）', () => {
        const { events } = triggerBaseAbility('base_plateau_of_leng', 'onMinionPlayed', makeCtx({
            state: makeState({
                bases: [makeBase('base_plateau_of_leng')],
                players: {
                    '0': makePlayer('0', {
                        hand: [makeCard('h1', 'alien_invader', 'minion', '0')],
                        minionsPlayedPerBase: { 0: 1 },
                    }),
                    '1': makePlayer('1'),
                },
            }),
            baseDefId: 'base_plateau_of_leng',
            baseIndex: 0,
            minionUid: 'm1',
            minionDefId: 'alien_collector',
        }));

        expect(events).toHaveLength(1);
        expect(events[0].type).toBe('su:limit_modified');
        expect(events[0].payload).toMatchObject({
            playerId: '0',
            limitType: 'minion',
            delta: 1,
            reason: 'base_plateau_of_leng',
            restrictToBase: 0,
            sameNameOnly: true,
            sameNameDefId: 'alien_collector',
        });
    });

    it('跨玩家回合：每个玩家首次打出时都应触发', () => {
        const result = triggerBaseAbilityWithMS('base_plateau_of_leng', 'onMinionPlayed', makeCtx({
            state: makeState({
                bases: [makeBase('base_plateau_of_leng')],
                currentPlayerIndex: 2,
                players: {
                    '0': makePlayer('0'),
                    '1': makePlayer('1', {
                        hand: [makeCard('h1', 'innsmouth_the_locals', 'minion', '1')],
                        minionsPlayedPerBase: { 0: 1 },
                    }),
                    '2': makePlayer('2'),
                },
            }),
            baseDefId: 'base_plateau_of_leng',
            baseIndex: 0,
            playerId: '1',
            minionUid: 'm1',
            minionDefId: 'innsmouth_the_locals',
        }));

        expect(result.events).toHaveLength(1);
        expect(result.events[0].type).toBe('su:limit_modified');
        expect(result.events[0].payload).toMatchObject({
            playerId: '1',
            limitType: 'minion',
            delta: 1,
            reason: 'base_plateau_of_leng',
            restrictToBase: 0,
            sameNameOnly: true,
            sameNameDefId: 'innsmouth_the_locals',
        });
    });

    it('额度应保存触发时的 defId（用于验证层检查）', () => {
        const result = triggerBaseAbilityWithMS('base_plateau_of_leng', 'onMinionPlayed', makeCtx({
            state: makeState({
                bases: [makeBase('base_plateau_of_leng')],
                players: {
                    '0': makePlayer('0', {
                        minionsPlayedPerBase: { 0: 1 },
                    }),
                    '1': makePlayer('1'),
                },
            }),
            baseDefId: 'base_plateau_of_leng',
            baseIndex: 0,
            minionUid: 'm1',
            minionDefId: 'alien_collector',
        }));

        expect(result.events[0].payload).toMatchObject({
            sameNameDefId: 'alien_collector',
        });
    });
});
