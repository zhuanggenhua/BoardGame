/**
 * 大法师 (Archmage) E2E 测试
 *
 * 验证两类规则：
 * 1. 自己的出牌阶段获得的 extra action 可以 bank 在本阶段内使用。
 * 2. "On your turn" 的 ongoing extra action 只在 play cards phase 生效，不应在 start turn 弹立即使用。
 */

import { describe, expect, it, beforeAll } from 'vitest';
import { GameTestRunner } from '../../../engine/testing';
import { SmashUpDomain } from '../domain';
import { smashUpFlowHooks } from '../domain/index';
import { createFlowSystem, createBaseSystems } from '../../../engine';
import { createSmashUpEventSystem } from '../domain/systems';
import type { SmashUpCore, SmashUpCommand, SmashUpEvent } from '../domain/types';
import { SU_COMMANDS } from '../domain/types';
import { FLOW_COMMANDS } from '../../../engine/systems/FlowSystem';
import { initAllAbilities } from '../abilities';
import type { MatchState } from '../../../engine/types';
import { createInitialSystemState } from '../../../engine/pipeline';
import { makeMinion, makePlayer, makeState, makeBase, makeCard } from './helpers';

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

describe('大法师 E2E: 回合开始额外行动', () => {
    it('P0 控制大法师时，P0 进入 playCards 后直接获得本阶段额外战术，不弹立即使用', () => {
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
        expect(result.finalState.sys.phase).toBe('playCards');
        expect(result.finalState.core.players['0'].actionLimit).toBe(2);
        expect(result.finalState.sys.interaction.current).toBeUndefined();
    });

    it('大法师的额外战术不会在 startTurn 形成待处理交互', () => {
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
            name: '大法师 E2E - phase 2 banked extra',
            commands: [
                { type: FLOW_COMMANDS.ADVANCE_PHASE, playerId: '1', payload: undefined },
            ] as any[],
        });

        expect(result.finalState.core.currentPlayerIndex).toBe(0);
        expect(result.finalState.sys.phase).toBe('playCards');
        expect(result.finalState.core.players['0'].actionLimit).toBe(2);
        expect(result.finalState.sys.interaction.current).toBeUndefined();
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

    it('在名人堂打出大法师时，应自动结算无冲突 trigger 而不是弹排序交互', () => {
        const archmageCard = makeCard('am-card', 'wizard_archmage', 'minion', '0');

        const core = makeState({
            currentPlayerIndex: 0,
            turnNumber: 1,
            players: {
                '0': makePlayer('0', { hand: [archmageCard] }),
                '1': makePlayer('1'),
            },
            bases: [
                makeBase('base_hall_of_fame', []),
            ],
        });

        const runner = createCustomRunner(makeFullMatchState(core));
        const result = runner.run({
            name: '大法师 E2E - 名人堂自动收口',
            commands: [
                { type: SU_COMMANDS.PLAY_MINION, playerId: '0', payload: { cardUid: 'am-card', baseIndex: 0 } },
            ] as any[],
        });

        expect(result.steps[0]?.success).toBe(true);
        expect(result.finalState.sys.interaction.current).toBeUndefined();
        expect(result.finalState.core.players['0'].actionLimit).toBe(2);
        const archmage = result.finalState.core.bases[0].minions.find(minion => minion.defId === 'wizard_archmage');
        expect(archmage?.tempPowerModifier ?? 0).toBe(2);
    });
});

describe('隐蔽迷雾 E2E: 进入 playCards 的额外随从', () => {
    it('P0 拥有隐蔽迷雾时，进入 playCards 后获得基地限定额外随从，不弹立即使用', () => {
        const core = makeState({
            currentPlayerIndex: 1,
            turnNumber: 1,
            players: {
                '0': makePlayer('0'),
                '1': makePlayer('1'),
            },
            bases: [
                makeBase({
                    defId: 'base_tar_pits',
                    ongoingActions: [{ uid: 'mist-1', defId: 'trickster_enshrouding_mist', ownerId: '0' } as any],
                }),
            ],
        });

        const runner = createCustomRunner(makeFullMatchState(core));
        const result = runner.run({
            name: '隐蔽迷雾 E2E - P1 结束回合后 P0 进入 playCards',
            commands: [
                { type: FLOW_COMMANDS.ADVANCE_PHASE, playerId: '1', payload: undefined },
            ] as any[],
        });

        expect(result.finalState.core.currentPlayerIndex).toBe(0);
        expect(result.finalState.sys.phase).toBe('playCards');
        expect(result.finalState.core.players['0'].baseLimitedMinionQuota?.[0]).toBe(1);
        expect(result.finalState.sys.interaction.current).toBeUndefined();
    });
});

describe('神秘花园 E2E: 进入 playCards 的额外随从', () => {
    it('P0 在神秘花园有己方随从时，进入 playCards 后获得基地限定额外随从，不在 startTurn 预发', () => {
        const core = makeState({
            currentPlayerIndex: 1,
            turnNumber: 1,
            players: {
                '0': makePlayer('0'),
                '1': makePlayer('1'),
            },
            bases: [
                makeBase('base_secret_garden', [makeMinion('sg-m1', 'robot_microbot_alpha', '0', 1)]),
            ],
        });

        const runner = createCustomRunner(makeFullMatchState(core));
        const result = runner.run({
            name: '神秘花园 E2E - P1 结束回合后 P0 进入 playCards',
            commands: [
                { type: FLOW_COMMANDS.ADVANCE_PHASE, playerId: '1', payload: undefined },
            ] as any[],
        });

        expect(result.finalState.core.currentPlayerIndex).toBe(0);
        expect(result.finalState.sys.phase).toBe('playCards');
        expect(result.finalState.core.players['0'].baseLimitedMinionQuota?.[0]).toBe(1);
        expect(result.finalState.sys.interaction.current).toBeUndefined();
    });
});
