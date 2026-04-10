/**
 * 大法师 (Archmage) E2E 测试
 *
 * 验证两类规则：
 * 1. 自己的出牌阶段获得的 extra action 可以 bank 在本阶段内使用。
 * 2. 回合开始阶段获得的 extra action 必须立刻打出或放弃，不能带到出牌阶段。
 */

import { describe, expect, it, beforeAll } from 'vitest';
import { GameTestRunner } from '../../../engine/testing';
import { SmashUpDomain } from '../domain';
import { smashUpFlowHooks } from '../domain/index';
import { createFlowSystem, createBaseSystems } from '../../../engine';
import { createSmashUpEventSystem } from '../domain/systems';
import type { SmashUpCore, SmashUpCommand, SmashUpEvent } from '../domain/types';
import { SU_COMMANDS, SU_EVENTS } from '../domain/types';
import { FLOW_COMMANDS } from '../../../engine/systems/FlowSystem';
import { initAllAbilities } from '../abilities';
import type { MatchState } from '../../../engine/types';
import { createInitialSystemState } from '../../../engine/pipeline';
import { makeMinion, makePlayer, makeState, makeBase, makeCard } from './helpers';
import { runCommand } from './testRunner';

const PLAYER_IDS = ['0', '1'];

beforeAll(() => {
    initAllAbilities();
});

function createCustomRunner(customState: MatchState<SmashUpCore>) {
    const systems = [
        createFlowSystem<SmashUpCore>({ hooks: smashUpFlowHooks }),
        ...createBaseSystems<SmashUpCore>(),
        createSmashUpEventSystem(),
    ];
    return new GameTestRunner<SmashUpCore, SmashUpCommand, SmashUpEvent>({
        domain: SmashUpDomain,
        systems,
        playerIds: PLAYER_IDS,
        setup: () => customState,
        silent: true,
    });
}

function makeFullMatchState(core: SmashUpCore): MatchState<SmashUpCore> {
    const systems = [
        createFlowSystem<SmashUpCore>({ hooks: smashUpFlowHooks }),
        ...createBaseSystems<SmashUpCore>(),
        createSmashUpEventSystem(),
    ];
    const sys = createInitialSystemState(PLAYER_IDS, systems);
    return { core, sys: { ...sys, phase: 'playCards' } } as MatchState<SmashUpCore>;
}

function skipAllCurrentInteractions(state: MatchState<SmashUpCore>, playerId: string): MatchState<SmashUpCore> {
    let nextState = state;
    for (let i = 0; i < 5 && nextState.sys.interaction.current; i += 1) {
        const result = runCommand(nextState, {
            type: 'SYS_INTERACTION_RESPOND',
            playerId,
            payload: { optionId: 'skip' },
        } as any);
        expect(result.success).toBe(true);
        nextState = result.finalState;
    }
    return nextState;
}

describe('大法师 E2E: 回合开始额外行动', () => {
    it('P0 控制大法师时，P0 回合开始获得必须立即处理的额外战术', () => {
        const archmage = makeMinion('am-1', 'wizard_archmage', '0', 4, { powerModifier: 0 });

        const core = makeState({
            currentPlayerIndex: 1,
            turnNumber: 1,
            players: {
                '0': makePlayer('0'),
                '1': makePlayer('1'),
            },
            bases: [
                makeBase('base_tar_pits', [archmage]),
            ],
        });

        const runner = createCustomRunner(makeFullMatchState(core));
        const result = runner.run({
            name: '大法师 E2E - P1 结束回合后 P0 开始',
            commands: [
                { type: FLOW_COMMANDS.ADVANCE_PHASE, playerId: '1', payload: undefined },
            ] as any[],
        });

        expect(result.finalState.core.currentPlayerIndex).toBe(0);
        expect(result.finalState.sys.phase).toBe('startTurn');
        expect(result.finalState.core.players['0'].actionLimit).toBe(1);

        const currentInteraction = result.finalState.sys.interaction.current as any;
        expect(currentInteraction).toBeDefined();
        expect(currentInteraction?.data?.sourceId).toBe('smashup_immediate_extra_action');

        const extraContext = currentInteraction?.data?.continuationContext?.extra;
        expect(extraContext?.playerId).toBe('0');
        expect(extraContext?.limitType).toBe('action');
        expect(extraContext?.delta).toBe(1);
        expect(extraContext?.playTiming).toBe('immediate');
    });

    it('放弃 start turn 的额外战术后，不会把额度继承到 playCards', () => {
        const archmage = makeMinion('am-1', 'wizard_archmage', '0', 4, { powerModifier: 0 });

        const core = makeState({
            currentPlayerIndex: 1,
            turnNumber: 1,
            players: {
                '0': makePlayer('0'),
                '1': makePlayer('1'),
            },
            bases: [
                makeBase('base_tar_pits', [archmage]),
            ],
        });

        const runner = createCustomRunner(makeFullMatchState(core));
        const startTurnResult = runner.run({
            name: '大法师 E2E - startTurn immediate extra',
            commands: [
                { type: FLOW_COMMANDS.ADVANCE_PHASE, playerId: '1', payload: undefined },
            ] as any[],
        });

        const finalState = skipAllCurrentInteractions(startTurnResult.finalState, '0');

        expect(finalState.core.currentPlayerIndex).toBe(0);
        expect(finalState.sys.phase).toBe('playCards');
        expect(finalState.core.players['0'].actionLimit).toBe(1);
        expect(finalState.sys.interaction.current).toBeUndefined();
    });

    it('P1 控制大法师，P0 回合开始时不触发', () => {
        const archmage = makeMinion('am-1', 'wizard_archmage', '1', 4, { powerModifier: 0 });

        const core = makeState({
            currentPlayerIndex: 1,
            turnNumber: 1,
            players: {
                '0': makePlayer('0'),
                '1': makePlayer('1'),
            },
            bases: [
                makeBase('base_tar_pits', [archmage]),
            ],
        });

        const runner = createCustomRunner(makeFullMatchState(core));
        const result = runner.run({
            name: '大法师 E2E - P1 控制，P0 回合不触发',
            commands: [
                { type: FLOW_COMMANDS.ADVANCE_PHASE, playerId: '1', payload: undefined },
            ] as any[],
        });

        expect(result.finalState.sys.phase).toBe('playCards');
        expect(result.finalState.core.currentPlayerIndex).toBe(0);
        expect(result.finalState.core.players['0'].actionLimit).toBe(1);
        expect(result.finalState.sys.interaction.current).toBeUndefined();
    });

    it('P0 控制大法师，P1 回合开始时不触发', () => {
        const archmage = makeMinion('am-1', 'wizard_archmage', '0', 4, { powerModifier: 0 });

        const core = makeState({
            currentPlayerIndex: 0,
            turnNumber: 1,
            players: {
                '0': makePlayer('0'),
                '1': makePlayer('1'),
            },
            bases: [
                makeBase('base_tar_pits', [archmage]),
            ],
        });

        const runner = createCustomRunner(makeFullMatchState(core));
        const result = runner.run({
            name: '大法师 E2E - P0 控制，P1 回合不触发',
            commands: [
                { type: FLOW_COMMANDS.ADVANCE_PHASE, playerId: '0', payload: undefined },
            ] as any[],
        });

        expect(result.finalState.sys.phase).toBe('playCards');
        expect(result.finalState.core.currentPlayerIndex).toBe(1);
        expect(result.finalState.core.players['1'].actionLimit).toBe(1);
        expect(result.finalState.sys.interaction.current).toBeUndefined();
    });
});

describe('大法师 E2E: 打出当回合额外行动', () => {
    it('打出大法师当回合仍可获得 banked 额外行动', () => {
        const archmageCard = makeCard('am-card', 'wizard_archmage', 'minion', '0');

        const core = makeState({
            currentPlayerIndex: 0,
            turnNumber: 1,
            players: {
                '0': makePlayer('0', { hand: [archmageCard] }),
                '1': makePlayer('1'),
            },
            bases: [
                makeBase('base_tar_pits', []),
            ],
        });

        const runner = createCustomRunner(makeFullMatchState(core));
        const result = runner.run({
            name: '大法师 E2E - 打出当回合获得额外行动',
            commands: [
                { type: SU_COMMANDS.PLAY_MINION, playerId: '0', payload: { cardUid: 'am-card', baseIndex: 0 } },
            ] as any[],
        });

        expect(result.steps[0]?.success).toBe(true);
        expect(result.finalState.core.players['0'].actionLimit).toBe(2);
        expect(result.finalState.sys.phase).toBe('playCards');

        expect(result.finalState.sys.interaction.current).toBeUndefined();
    });
});
