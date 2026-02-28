/**
 * 大杀四方 - 基地能力集成测试（完整链路）
 *
 * 验证三条触发路径的 matchState 传播完整性，防止 Interaction 类基地能力静默失败。
 * 每个使用 queueInteraction 的基地能力都有至少 1 条集成测试。
 *
 * 1. onMinionPlayed: reducer.execute() → triggerAllBaseAbilities → Interaction
 *    - base_haunted_house_al9000: 鬼屋
 *    - base_the_asylum: 疯人院
 *    - base_innsmouth_base: 印斯茅斯
 *    - base_plateau_of_leng: 伦格高原
 *    - base_land_of_balance: 平衡之地
 *
 * 2. onTurnStart: FlowHooks.onPhaseEnter('startTurn') → triggerAllBaseAbilities → Interaction
 *    - base_rlyeh: 拉莱耶
 *    - base_mushroom_kingdom: 蘑菇王国
 *    - base_cat_fanciers_alley: 诡猫巷
 *
 * 3. afterScoring: FlowHooks.onPhaseExit('scoreBases') → scoreOneBase → Interaction
 *    - base_ninja_dojo: 忍者道场
 *    - base_the_mothership: 母舰
 *    - base_pirate_cove: 海盗湾
 *    - base_tortuga: 托尔图加
 *    - base_wizard_academy: 巫师学院
 *    - base_miskatonic_university_base: 密大基地
 *    - base_greenhouse: 温室
 *    - base_inventors_salon: 发明家沙龙
 */

import { describe, expect, it, beforeAll } from 'vitest';
import { initAllAbilities, resetAbilityInit } from '../abilities';
import { clearRegistry } from '../domain/abilityRegistry';
import { clearBaseAbilityRegistry } from '../domain/baseAbilities';
import { clearInteractionHandlers } from '../domain/abilityInteractionHandlers';
import { smashUpFlowHooks } from '../domain/index';
import { SU_COMMANDS, SU_EVENTS, MADNESS_CARD_DEF_ID } from '../domain/types';
import type { SmashUpCore, SmashUpCommand, CardInstance } from '../domain/types';
import type { MatchState, RandomFn, Command } from '../../../engine/types';
import type { PhaseExitResult, PhaseEnterResult } from '../../../engine/systems/FlowSystem';
import {
    makePlayer,
    makeState,
    makeMatchState,
    makeBase,
    makeMinion,
    getInteractionsFromMS,
} from './helpers';
import { runCommand } from './testRunner';
// 确定性随机
const dummyRandom: RandomFn = {
    random: () => 0.5,
    d: (max: number) => 1,
    range: (min: number, _max: number) => min,
    shuffle: <T>(arr: T[]) => [...arr],
};

beforeAll(() => {
    clearRegistry();
    clearBaseAbilityRegistry();
    clearInteractionHandlers();
    resetAbilityInit();
    initAllAbilities();
});

// ============================================================================
// 辅助函数
// ============================================================================

const mockCommand: Command = { type: 'ADVANCE_PHASE', playerId: '0', payload: undefined } as any;

/** 构造 PLAY_MINION 命令并通过 pipeline 执行 */
function executePlayMinion(
    ms: MatchState<SmashUpCore>,
    playerId: string,
    cardUid: string,
    baseIndex: number,
): { events: any[]; ms: MatchState<SmashUpCore> } {
    const result = runCommand(ms, {
        type: SU_COMMANDS.PLAY_MINION,
        playerId,
        payload: { cardUid, baseIndex },
    } as SmashUpCommand, dummyRandom);
    return { events: result.events, ms: result.finalState };
}

/** 构造 onPhaseEnter('startTurn') 所需的 MatchState */
function makeStartTurnMS(core: SmashUpCore): MatchState<SmashUpCore> {
    return {
        core,
        sys: {
            phase: 'startTurn',
            responseWindow: { current: undefined },
            interaction: { current: undefined, queue: [] },
        },
    } as any;
}

/** 构造 onPhaseExit('scoreBases') 所需的 MatchState */
function makeScoreBasesMS(core: SmashUpCore): MatchState<SmashUpCore> {
    return {
        core,
        sys: {
            phase: 'scoreBases',
            responseWindow: { current: undefined },
            interaction: { current: undefined, queue: [] },
        },
    } as any;
}

/** 调用 onPhaseEnter('startTurn')，from='endTurn' */
function callOnPhaseEnterStartTurn(ms: MatchState<SmashUpCore>) {
    const result = smashUpFlowHooks.onPhaseEnter!({
        state: ms, from: 'endTurn', to: 'startTurn',
        command: mockCommand, random: dummyRandom,
    });
    // onPhaseEnter 返回 PhaseEnterResult.updatedState 而非变异 ms.sys
    // 将 updatedState 的 sys 同步回 ms，保持测试兼容
    if (result && !Array.isArray(result) && (result as PhaseEnterResult).updatedState) {
        ms.sys = (result as PhaseEnterResult).updatedState!.sys;
    }
    return result;
}

/** 调用 onPhaseExit('scoreBases')，返回事件列表 */
function callOnPhaseExitScoreBases(ms: MatchState<SmashUpCore>) {
    const result = smashUpFlowHooks.onPhaseExit!({
        state: ms, from: 'scoreBases', to: 'draw',
        command: mockCommand, random: dummyRandom,
    });
    const events = Array.isArray(result) ? result : (result as PhaseExitResult).events ?? [];
    // Fix 2 后 onPhaseExit 返回 PhaseExitResult.updatedState 而非变异 ms.sys
    // 将 updatedState 的 sys 同步回 ms，保持测试兼容
    if (!Array.isArray(result) && (result as PhaseExitResult).updatedState) {
        ms.sys = (result as PhaseExitResult).updatedState!.sys;
    }
    return { events, result };
}

/** 检查 Interaction 是否包含指定 sourceId */
function hasInteraction(ms: MatchState<SmashUpCore>, sourceId: string): boolean {
    return getInteractionsFromMS(ms).some(i => i.data?.sourceId === sourceId);
}


// ============================================================================
// 路径①: onMinionPlayed — reducer.execute() 完整链路
// ============================================================================

describe('集成: base_haunted_house_al9000 鬼屋 (onMinionPlayed)', () => {
    it('多张手牌 → Interaction 弃牌', () => {
        const core = makeState({
            bases: [makeBase('base_haunted_house_al9000')],
            players: {
                '0': makePlayer('0', { hand: [
                    { uid: 'minion-1', defId: 'test_minion', type: 'minion', owner: '0' },
                    { uid: 'h1', defId: 'test_a', type: 'action', owner: '0' },
                    { uid: 'h2', defId: 'test_b', type: 'action', owner: '0' },
                ] }),
                '1': makePlayer('1'),
            },
        });
        const ms = makeMatchState(core);
        const { ms: resultMs1 } = executePlayMinion(ms, '0', 'minion-1', 0);
        expect(hasInteraction(resultMs1, 'base_haunted_house_al9000')).toBe(true);
    });

    it('手牌只剩随从 → 打出后手牌为空，无需弃牌，无 Interaction', () => {
        const core = makeState({
            bases: [makeBase('base_haunted_house_al9000')],
            players: {
                '0': makePlayer('0', { hand: [
                    { uid: 'minion-1', defId: 'test_minion', type: 'minion', owner: '0' },
                ] }),
                '1': makePlayer('1'),
            },
        });
        const ms = makeMatchState(core);
        const { events, ms: resultMs2 } = executePlayMinion(ms, '0', 'minion-1', 0);
        // 打出唯一的随从后手牌为空，鬼屋能力无法弃牌
        expect(hasInteraction(resultMs2, 'base_haunted_house_al9000')).toBe(false);
    });
});

describe('集成: base_the_asylum 疯人院 (onMinionPlayed)', () => {
    it('手牌有疯狂卡 → Interaction 返回疯狂卡', () => {
        const core = makeState({
            bases: [makeBase('base_the_asylum')],
            players: {
                '0': makePlayer('0', { hand: [
                    { uid: 'minion-1', defId: 'test_minion', type: 'minion', owner: '0' },
                    { uid: 'mad-1', defId: MADNESS_CARD_DEF_ID, type: 'action', owner: '0' },
                ] }),
                '1': makePlayer('1'),
            },
            madnessDeck: ['madness_0'],
        });
        const ms = makeMatchState(core);
        const { ms: resultMs3 } = executePlayMinion(ms, '0', 'minion-1', 0);
        expect(hasInteraction(resultMs3, 'base_the_asylum')).toBe(true);
    });
});

describe('集成: base_innsmouth_base 印斯茅斯 (onMinionPlayed)', () => {
    it('弃牌堆有卡 → Interaction 选择卡牌入牌库底', () => {
        const core = makeState({
            bases: [makeBase('base_innsmouth_base')],
            players: {
                '0': makePlayer('0', { hand: [
                    { uid: 'minion-1', defId: 'test_minion', type: 'minion', owner: '0' },
                ] }),
                '1': makePlayer('1', { discard: [
                    { uid: 'd1', defId: 'test_discard', type: 'action', owner: '1' },
                ] }),
            },
        });
        const ms = makeMatchState(core);
        const { ms: resultMs4 } = executePlayMinion(ms, '0', 'minion-1', 0);
        expect(hasInteraction(resultMs4, 'base_innsmouth_base')).toBe(true);
    });
});

describe('集成: base_plateau_of_leng 伦格高原 (onMinionPlayed)', () => {
    it('手牌有同名随从 → Interaction 额外打出', () => {
        const core = makeState({
            bases: [makeBase('base_plateau_of_leng')],
            players: {
                '0': makePlayer('0', { hand: [
                    { uid: 'minion-1', defId: 'test_minion', type: 'minion', owner: '0' },
                    { uid: 'minion-2', defId: 'test_minion', type: 'minion', owner: '0' },
                ] }),
                '1': makePlayer('1'),
            },
        });
        const ms = makeMatchState(core);
        const { ms: resultMs5 } = executePlayMinion(ms, '0', 'minion-1', 0);
        expect(hasInteraction(resultMs5, 'base_plateau_of_leng')).toBe(true);
    });
});

describe('集成: base_land_of_balance 平衡之地 (onMinionPlayed)', () => {
    it('其他基地有己方随从 → Interaction 移动随从', () => {
        const core = makeState({
            bases: [
                makeBase('base_land_of_balance'),
                makeBase('test_base_2', [makeMinion('m-other', 'test_minion', '0', 3)]),
            ],
            players: {
                '0': makePlayer('0', { hand: [
                    { uid: 'minion-1', defId: 'test_minion', type: 'minion', owner: '0' },
                ] }),
                '1': makePlayer('1'),
            },
        });
        const ms = makeMatchState(core);
        const { ms: resultMs6 } = executePlayMinion(ms, '0', 'minion-1', 0);
        expect(hasInteraction(resultMs6, 'base_land_of_balance')).toBe(true);
    });
});


// ============================================================================
// 路径②: onTurnStart — FlowHooks.onPhaseEnter('startTurn') 完整链路
// 注意：from='endTurn' 时 nextPlayerId = turnOrder[(currentPlayerIndex+1) % length]
// currentPlayerIndex=1, turnOrder=['0','1'] → nextPlayerId='0'
// ============================================================================

describe('集成: base_rlyeh 拉莱耶 (onTurnStart)', () => {
    it('基地有即将行动玩家的随从 → Interaction 消灭随从获1VP', () => {
        const core = makeState({
            currentPlayerIndex: 1,
            bases: [makeBase('base_rlyeh', [makeMinion('m1', 'test_minion', '0', 3)])],
            players: { '0': makePlayer('0'), '1': makePlayer('1') },
        });
        const ms = makeStartTurnMS(core);
        callOnPhaseEnterStartTurn(ms);
        expect(hasInteraction(ms, 'base_rlyeh')).toBe(true);
    });

    it('基地无即将行动玩家的随从 → 无 Interaction', () => {
        const core = makeState({
            currentPlayerIndex: 1,
            bases: [makeBase('base_rlyeh', [makeMinion('m1', 'test_minion', '1', 3)])],
            players: { '0': makePlayer('0'), '1': makePlayer('1') },
        });
        const ms = makeStartTurnMS(core);
        callOnPhaseEnterStartTurn(ms);
        expect(hasInteraction(ms, 'base_rlyeh')).toBe(false);
    });
});

describe('集成: base_mushroom_kingdom 蘑菇王国 (onTurnStart)', () => {
    it('其他基地有对手随从 → Interaction 移动对手随从到蘑菇王国', () => {
        const core = makeState({
            currentPlayerIndex: 1,
            bases: [
                makeBase('base_mushroom_kingdom'),
                makeBase('test_base_2', [makeMinion('m1', 'test_minion', '1', 3)]),
            ],
            players: { '0': makePlayer('0'), '1': makePlayer('1') },
        });
        const ms = makeStartTurnMS(core);
        callOnPhaseEnterStartTurn(ms);
        expect(hasInteraction(ms, 'base_mushroom_kingdom')).toBe(true);
    });

    it('其他基地无对手随从 → 无 Interaction', () => {
        const core = makeState({
            currentPlayerIndex: 1,
            bases: [
                makeBase('base_mushroom_kingdom'),
                makeBase('test_base_2', [makeMinion('m1', 'test_minion', '0', 3)]),
            ],
            players: { '0': makePlayer('0'), '1': makePlayer('1') },
        });
        const ms = makeStartTurnMS(core);
        callOnPhaseEnterStartTurn(ms);
        expect(hasInteraction(ms, 'base_mushroom_kingdom')).toBe(false);
    });
});

describe('集成: base_cat_fanciers_alley 诡猫巷 (onTurnStart)', () => {
    it('基地有即将行动玩家的随从 → Interaction 消灭己方随从抽牌', () => {
        const core = makeState({
            currentPlayerIndex: 1,
            bases: [makeBase('base_cat_fanciers_alley', [makeMinion('m1', 'test_minion', '0', 3)])],
            players: {
                '0': makePlayer('0', { deck: [
                    { uid: 'deck-1', defId: 'test_card', type: 'action', owner: '0' },
                ] }),
                '1': makePlayer('1'),
            },
        });
        const ms = makeStartTurnMS(core);
        callOnPhaseEnterStartTurn(ms);
        expect(hasInteraction(ms, 'base_cat_fanciers_alley')).toBe(true);
    });
});


// ============================================================================
// 路径③: afterScoring — FlowHooks.onPhaseExit('scoreBases') → scoreOneBase 完整链路
// 需要基地力量达到 breakpoint 才会触发记分
// ============================================================================

/** 构造一个达到 breakpoint 的基地状态（单基地，玩家0为冠军） */
function makeScoringCore(baseDefId: string, breakpoint: number, extraOverrides?: Partial<SmashUpCore>): SmashUpCore {
    // 冠军力量 = breakpoint，亚军力量 = 5
    return makeState({
        bases: [makeBase(baseDefId, [
            makeMinion('m1', 'test_minion', '0', breakpoint),
            makeMinion('m2', 'test_minion', '1', 5),
        ])],
        baseDeck: ['base_central_brain'],
        players: {
            '0': makePlayer('0', {
                deck: [
                    { uid: 'deck-1', defId: 'test_card', type: 'minion', owner: '0' },
                    { uid: 'deck-2', defId: 'test_card', type: 'minion', owner: '0' },
                    { uid: 'deck-3', defId: 'test_card', type: 'minion', owner: '0' },
                ],
                discard: [
                    { uid: 'dis-1', defId: 'test_action', type: 'action', owner: '0' },
                ],
            }),
            '1': makePlayer('1'),
        },
        ...extraOverrides,
    });
}

describe('集成: base_ninja_dojo 忍者道场 (afterScoring)', () => {
    it('基地达标 → Interaction 冠军消灭随从', () => {
        const core = makeScoringCore('base_ninja_dojo', 18);
        const ms = makeScoreBasesMS(core);
        const { events } = callOnPhaseExitScoreBases(ms);
        expect(events.some(e => e.type === SU_EVENTS.BASE_SCORED)).toBe(true);
        expect(hasInteraction(ms, 'base_ninja_dojo')).toBe(true);
    });
});

describe('集成: base_the_mothership 母舰 (afterScoring)', () => {
    it('基地达标且冠军有力量≤3随从 → Interaction 收回随从', () => {
        // 母舰 breakpoint=20，冠军需要有力量≤3的随从在基地上
        const core = makeState({
            bases: [makeBase('base_the_mothership', [
                makeMinion('m1', 'test_minion', '0', 20),
                makeMinion('m-weak', 'test_minion', '0', 2),  // 力量≤3，可被收回
                makeMinion('m2', 'test_minion', '1', 5),
            ])],
            baseDeck: ['base_central_brain'],
            players: { '0': makePlayer('0'), '1': makePlayer('1') },
        });
        const ms = makeScoreBasesMS(core);
        callOnPhaseExitScoreBases(ms);
        expect(hasInteraction(ms, 'base_the_mothership')).toBe(true);
    });
});

describe('集成: base_pirate_cove 海盗湾 (afterScoring)', () => {
    it('基地达标且非冠军有随从 → Interaction 移动随从', () => {
        // 海盗湾 breakpoint=17，非冠军玩家可移动随从
        const core = makeState({
            bases: [
                makeBase('base_pirate_cove', [
                    makeMinion('m1', 'test_minion', '0', 17),
                    makeMinion('m2', 'test_minion', '1', 5),
                ]),
                makeBase('test_base_2'),
            ],
            baseDeck: ['base_central_brain'],
            players: { '0': makePlayer('0'), '1': makePlayer('1') },
        });
        const ms = makeScoreBasesMS(core);
        callOnPhaseExitScoreBases(ms);
        expect(hasInteraction(ms, 'base_pirate_cove')).toBe(true);
    });
});

describe('集成: base_tortuga 托尔图加 (afterScoring)', () => {
    it('基地达标且有亚军随从 → Interaction 亚军移动随从', () => {
        // 托尔图加 breakpoint=21，亚军可移动随从到替换基地
        const core = makeState({
            bases: [makeBase('base_tortuga', [
                makeMinion('m1', 'test_minion', '0', 21),
                makeMinion('m2', 'test_minion', '1', 10),
            ])],
            baseDeck: ['base_central_brain'],
            players: { '0': makePlayer('0'), '1': makePlayer('1') },
        });
        const ms = makeScoreBasesMS(core);
        callOnPhaseExitScoreBases(ms);
        expect(hasInteraction(ms, 'base_tortuga')).toBe(true);
    });
});

describe('集成: base_wizard_academy 巫师学院 (afterScoring)', () => {
    it('基地达标且基地牌库有牌 → Interaction 冠军排列基地牌库', () => {
        // 巫师学院 breakpoint=20
        const core = makeScoringCore('base_wizard_academy', 20, {
            baseDeck: ['base_central_brain', 'base_castle_blood', 'base_tar_pits'],
        });
        const ms = makeScoreBasesMS(core);
        callOnPhaseExitScoreBases(ms);
        expect(hasInteraction(ms, 'base_wizard_academy')).toBe(true);
    });
});

describe('集成: base_miskatonic_university_base 密大基地 (afterScoring)', () => {
    it('基地达标且有随从的玩家有疯狂卡 → Interaction 返回疯狂卡', () => {
        // 密大基地 breakpoint=24
        const core = makeState({
            bases: [makeBase('base_miskatonic_university_base', [
                makeMinion('m1', 'test_minion', '0', 24),
                makeMinion('m2', 'test_minion', '1', 5),
            ])],
            baseDeck: ['base_central_brain'],
            madnessDeck: ['madness_0', 'madness_1'],
            players: {
                '0': makePlayer('0', { hand: [
                    { uid: 'mad-1', defId: MADNESS_CARD_DEF_ID, type: 'action', owner: '0' },
                ] }),
                '1': makePlayer('1'),
            },
        });
        const ms = makeScoreBasesMS(core);
        callOnPhaseExitScoreBases(ms);
        expect(hasInteraction(ms, 'base_miskatonic_university_base')).toBe(true);
    });
});

describe('集成: base_greenhouse 温室 (afterScoring)', () => {
    it('基地达标且冠军牌库有随从 → Interaction 搜索牌库打出随从', () => {
        // 温室 breakpoint=24
        const core = makeScoringCore('base_greenhouse', 24);
        const ms = makeScoreBasesMS(core);
        callOnPhaseExitScoreBases(ms);
        expect(hasInteraction(ms, 'base_greenhouse')).toBe(true);
    });
});

describe('集成: base_inventors_salon 发明家沙龙 (afterScoring)', () => {
    it('基地达标且冠军弃牌堆有行动卡 → Interaction 取回行动卡', () => {
        // 发明家沙龙 breakpoint=22
        const core = makeScoringCore('base_inventors_salon', 22);
        const ms = makeScoreBasesMS(core);
        callOnPhaseExitScoreBases(ms);
        expect(hasInteraction(ms, 'base_inventors_salon')).toBe(true);
    });
});
