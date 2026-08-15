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
 *    - base_miskatonic_university_base_pod: 密大基地 POD
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
 *    - base_miskatonic_university_base: 密大基地（经典版）
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
import { maybeResolveReactionQueue } from '../domain/reactionQueue';
import { getScoringSession } from '../domain/scoringSession';
import {
    expectNoPrompt,
    makePlayer,
    makeState,
    makeMatchState,
    makeBase,
    makeMinion,
    applyEvents,
    getFirstPrompt,
    getPromptOption,
    getPromptOptions,
    getPromptSourceId,
    getPromptsBySourceId,
    getSimpleChoicePrompt,
    respondToPrompt,
} from './helpers';
import { runCommand } from './testRunner';
// 确定性随机
const dummyRandom: RandomFn = {
    random: () => 0.5,
    d: (_max: number) => 1,
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
    const events = Array.isArray(result) ? result : (result as any)?.events ?? [];
    if (events.length > 0) {
        ms.core = applyEvents(ms.core, events as any);
    }
    // onPhaseEnter 返回 PhaseEnterResult.updatedState 而非变异 ms.sys
    // 将 updatedState 的 sys 同步回 ms，保持测试兼容
    if (result && !Array.isArray(result) && (result as PhaseEnterResult).updatedState) {
        ms.sys = (result as PhaseEnterResult).updatedState!.sys;
    }
    return result;
}

/** 调用 onPhaseExit('scoreBases')，返回事件列表 */
function callOnPhaseExitScoreBases(ms: MatchState<SmashUpCore>) {
    const allEvents: any[] = [];
    let result: ReturnType<NonNullable<typeof smashUpFlowHooks.onPhaseExit>> | undefined;

    for (let step = 0; step < 8; step += 1) {
        result = smashUpFlowHooks.onPhaseExit!({
            state: ms, from: 'scoreBases', to: 'draw',
            command: mockCommand, random: dummyRandom,
        });
        const events = Array.isArray(result) ? result : (result as PhaseExitResult).events ?? [];
        allEvents.push(...events);
        if (events.length > 0) {
            ms.core = applyEvents(ms.core, events as any);
        }
        // Fix 2 后 onPhaseExit 返回 PhaseExitResult.updatedState 而非变异 ms.sys
        // 将 updatedState 的 sys 同步回 ms，保持测试兼容
        if (!Array.isArray(result) && (result as PhaseExitResult).updatedState) {
            ms.sys = (result as PhaseExitResult).updatedState!.sys;
        }

        if (ms.sys.interaction?.current || (ms.sys.interaction?.queue?.length ?? 0) > 0) {
            break;
        }

        const currentStep = getScoringSession(ms)?.currentStep;
        const awaitingFormalCommit =
            currentStep === 'awaiting-before-scoring-reduce'
            || currentStep === 'awaiting-before-reaction-reduce'
            || currentStep === 'awaiting-before-response-window'
            || currentStep === 'awaiting-when-scoring-reduce'
            || currentStep === 'awaiting-when-reaction-reduce'
            || currentStep === 'awaiting-after-scoring-reduce'
            || currentStep === 'awaiting-after-reaction-reduce'
            || currentStep === 'awaiting-score-award-reduce';
        if (!awaitingFormalCommit) {
            break;
        }
    }

    return { events: allEvents, result };
}

/** 检查 Interaction 是否包含指定 sourceId */
function hasInteraction(ms: MatchState<SmashUpCore>, sourceId: string): boolean {
    return getPromptsBySourceId(ms, sourceId).length > 0;
}

function resolveReactionQueueTriggerForSourceDefId(
    initialState: MatchState<SmashUpCore>,
    sourceDefId: string,
    now: number,
): MatchState<SmashUpCore> {
    let state = initialState;

    for (let step = 0; step < 10; step += 1) {
        const prompt = getFirstPrompt(state);
        if (!prompt) {
            const rq = maybeResolveReactionQueue(state, dummyRandom, now + step);
            if (rq) {
                state = rq.state;
                continue;
            }
            return state;
        }

        if (getPromptSourceId(prompt) !== 'smashup_reaction_choose') {
            return state;
        }

        const triggersById = new Map((state.core.triggerQueue ?? []).map((trigger: any) => [trigger.id, trigger]));
        const options = getPromptOptions(prompt);
        const wanted = options.find((option: any) => {
            const triggerId = option?.value?.triggerId;
            const trigger = triggerId ? triggersById.get(triggerId) : undefined;
            return trigger?.sourceDefId === sourceDefId;
        });
        const fallback = options.find((option: any) => typeof option?.id === 'string' && option.id.startsWith('trigger:'))
            ?? options.find((option: any) => option?.value?.kind === 'trigger')
            ?? options[0];
        const chosen = wanted ?? fallback;
        if (!chosen) return state;

        const response = respondToPrompt(
            state,
            chosen.id,
            undefined,
            dummyRandom,
        );
        state = response.finalState;
    }

    return state;
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
        const { ms: resultMs2 } = executePlayMinion(ms, '0', 'minion-1', 0);
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

    it('修格斯打到疯人院后，自抽的疯狂卡应先进入手牌，再出现在疯人院选择里', () => {
        const core = makeState({
            bases: [makeBase({
                defId: 'base_the_asylum',
                minions: [makeMinion('support-1', 'support_minion', '0', 5)],
            })],
            players: {
                '0': makePlayer('0', { hand: [
                    { uid: 'shoggoth-1', defId: 'elder_thing_shoggoth_pod', type: 'minion', owner: '0' },
                ] }),
                '1': makePlayer('1'),
            },
            madnessDeck: [MADNESS_CARD_DEF_ID, MADNESS_CARD_DEF_ID, MADNESS_CARD_DEF_ID],
        });
        const ms = makeMatchState(core);
        const { ms: playedMs } = executePlayMinion(ms, '0', 'shoggoth-1', 0);

        const shoggothInteraction = getSimpleChoicePrompt(playedMs, 'elder_thing_shoggoth_pod');

        const yesOption = getPromptOption(shoggothInteraction, (option: any) => option.id === 'yes', 'Shoggoth yes option');
        expect(yesOption).toBeDefined();

        const response = respondToPrompt(playedMs, yesOption.id, '1', dummyRandom);

        expect(response.success).toBe(true);
        expect(response.finalState.core.players['0'].hand.filter((card: CardInstance) => card.defId === MADNESS_CARD_DEF_ID)).toHaveLength(2);

        const asylumInteraction = getSimpleChoicePrompt(response.finalState, 'base_the_asylum');

        const madnessOptions = getPromptOptions(asylumInteraction).filter((entry: any) => entry.value?.defId === MADNESS_CARD_DEF_ID);
        expect(madnessOptions).toHaveLength(2);
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
        const resolved = resolveReactionQueueTriggerForSourceDefId(resultMs4, 'base_innsmouth_base', 1);
        expect(hasInteraction(resolved, 'base_innsmouth_base_choose_player')).toBe(true);
    });

    it('线上反馈 69feca4b/69fecbb9：所有弃牌堆为空时不暴露印斯茅斯空触发', () => {
        const core = makeState({
            turnOrder: ['0', '1', '2'],
            bases: [makeBase('base_innsmouth_base')],
            players: {
                '0': makePlayer('0', {
                    hand: [
                        { uid: 'minion-1', defId: 'innsmouth_the_locals', type: 'minion', owner: '0' },
                    ],
                    discard: [],
                }),
                '1': makePlayer('1', { discard: [] }),
                '2': makePlayer('2', { discard: [] }),
            },
        });
        const ms = makeMatchState(core);
        const { ms: afterPlay } = executePlayMinion(ms, '0', 'minion-1', 0);

        expect((afterPlay.core.triggerQueue ?? []).some(trigger => trigger.sourceDefId === 'base_innsmouth_base')).toBe(false);
        expect(hasInteraction(afterPlay, 'smashup_reaction_choose')).toBe(false);

        const resolved = maybeResolveReactionQueue(afterPlay, dummyRandom, 1);
        if (resolved) {
            expectNoPrompt(resolved.state);
        }
    });
});

describe('集成: base_plateau_of_leng 伦格高地 (onMinionPlayed)', () => {
    it('手牌有同名随从 → 直接授予同名随从额度', () => {
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
        
        // 验证：应该授予了同名随从额度
        const player = resultMs5.core.players['0'];
        expect(player.baseLimitedMinionQuota).toBeDefined();
        expect(player.baseLimitedMinionQuota![0]).toBe(1);
        
        // 验证：额度限定为同名随从
        expect(player.baseLimitedSameNameRequired?.[0]).toBe(true);
        
        // 验证：保存了触发时的 defId
        expect(player.baseLimitedSameNameDefId?.[0]).toBe('test_minion');
    });

    it('额度应检查触发时的 defId，而非基地上的随从', () => {
        // 场景：打出 minion-1 → 触发能力 → minion-1 被消灭 → 打出 minion-2（同名）
        const core = makeState({
            bases: [makeBase('base_plateau_of_leng')],
            players: {
                '0': makePlayer('0', {
                    hand: [
                        { uid: 'minion-1', defId: 'test_minion', type: 'minion', owner: '0' },
                        { uid: 'minion-2', defId: 'test_minion', type: 'minion', owner: '0' },
                    ],
                    minionsPlayed: 0,
                    minionLimit: 1,
                }),
                '1': makePlayer('1'),
            },
        });
        const ms = makeMatchState(core);
        
        // 1. 打出第一个随从
        const { ms: ms1 } = executePlayMinion(ms, '0', 'minion-1', 0);
        
        // 验证：授予了额度
        expect(ms1.core.players['0'].baseLimitedMinionQuota![0]).toBe(1);
        expect(ms1.core.players['0'].baseLimitedSameNameDefId![0]).toBe('test_minion');
        
        // 2. 模拟第一个随从被消灭（直接修改状态）
        const coreAfterDestroy = {
            ...ms1.core,
            bases: [makeBase('base_plateau_of_leng')], // 基地上没有随从
        };
        const ms2 = { ...ms1, core: coreAfterDestroy };
        
        // 3. 尝试打出第二个同名随从（应该成功，因为检查的是 baseLimitedSameNameDefId）
        const { ms: ms3 } = executePlayMinion(ms2, '0', 'minion-2', 0);
        
        // 验证：第二个随从成功打出
        expect(ms3.core.bases[0].minions).toHaveLength(1);
        expect(ms3.core.bases[0].minions[0].uid).toBe('minion-2');
    });
});

describe('集成: base_land_of_balance 平衡之地 (onMinionPlayed)', () => {
    it('其他基地有己方随从 → Interaction 移动随从', () => {
        const core = makeState({
            bases: [
                makeBase('base_land_of_balance'),
                makeBase('test_base_2', [makeMinion('m-other', 'test_minion', '0', 3, { powerModifier: 0 })]),
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
            bases: [makeBase('base_rlyeh', [makeMinion('m1', 'test_minion', '0', 3, { powerModifier: 0 })])],
            players: { '0': makePlayer('0'), '1': makePlayer('1') },
        });
        const ms = makeStartTurnMS(core);
        callOnPhaseEnterStartTurn(ms);
        expect(hasInteraction(ms, 'base_rlyeh')).toBe(true);
    });

    it('基地无即将行动玩家的随从 → 无 Interaction', () => {
        const core = makeState({
            currentPlayerIndex: 1,
            bases: [makeBase('base_rlyeh', [makeMinion('m1', 'test_minion', '1', 3, { powerModifier: 0 })])],
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
                makeBase('test_base_2', [makeMinion('m1', 'test_minion', '1', 3, { powerModifier: 0 })]),
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
                makeBase('test_base_2', [makeMinion('m1', 'test_minion', '0', 3, { powerModifier: 0 })]),
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
            bases: [makeBase('base_cat_fanciers_alley', [makeMinion('m1', 'test_minion', '0', 3, { powerModifier: 0 })])],
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
        const resolved = resolveReactionQueueTriggerForSourceDefId(ms, 'base_ninja_dojo', 11);
        expect(hasInteraction(resolved, 'base_ninja_dojo')).toBe(true);
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
            bases: [
                makeBase('base_tortuga', [
                    makeMinion('m1', 'test_minion', '0', 21),
                    makeMinion('m2', 'test_minion', '1', 10),
                ]),
                makeBase('base_other', [
                    makeMinion('m3', 'test_minion', '1', 5), // 亚军在其他基地的随从
                ]),
            ],
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

describe('集成: base_laboratorium 实验工坊 (onMinionPlayed)', () => {
    it('线上反馈 69ff720c：普通随从首次打到实验工坊后应自动结算 +1 且不残留 triggerQueue', () => {
        const core = makeState({
            bases: [makeBase('base_laboratorium')],
            players: {
                '0': makePlayer('0', {
                    hand: [
                        { uid: 'hoverbot-1', defId: 'robot_hoverbot', type: 'minion', owner: '0' },
                    ],
                    minionsPlayedPerBase: { 0: 0 },
                }),
                '1': makePlayer('1'),
            },
        });
        const ms = makeMatchState(core);
        const { ms: resultMs } = executePlayMinion(ms, '0', 'hoverbot-1', 0);
        const hoverbot = resultMs.core.bases[0].minions.find(minion => minion.uid === 'hoverbot-1');

        expectNoPrompt(resultMs);
        expect(resultMs.core.triggerQueue).toBeUndefined();
        expect(hoverbot?.powerCounters ?? 0).toBe(1);
    });
});

describe('集成: base_miskatonic_university_base_pod 密大基地 POD (onMinionPlayed)', () => {
    it('首次打出随从到该基地且手牌有疯狂卡 → Interaction 返回疯狂卡/弃疯狂换额外行动', () => {
        const core = makeState({
            bases: [makeBase('base_miskatonic_university_base_pod')],
            madnessDeck: ['madness_0', 'madness_1'],
            players: {
                '0': makePlayer('0', { hand: [
                    { uid: 'minion-1', defId: 'test_minion', type: 'minion', owner: '0' },
                    { uid: 'mad-1', defId: MADNESS_CARD_DEF_ID, type: 'action', owner: '0' },
                ] }),
                '1': makePlayer('1'),
            },
        });
        const ms = makeMatchState(core);
        const { ms: resultMs } = executePlayMinion(ms, '0', 'minion-1', 0);
        expect(hasInteraction(resultMs, 'base_miskatonic_university_base_pod')).toBe(true);
    });
});

describe('集成: base_miskatonic_university_base 密大基地经典版 (afterScoring)', () => {
    it('基地计分后冠军有疯狂卡 → Interaction 连续返回疯狂卡到疯狂牌库', () => {
        const core = makeScoringCore('base_miskatonic_university_base', 24, {
            players: {
                '0': makePlayer('0', {
                    hand: [{ uid: 'mad-1', defId: MADNESS_CARD_DEF_ID, type: 'action', owner: '0' }],
                    discard: [{ uid: 'mad-2', defId: MADNESS_CARD_DEF_ID, type: 'action', owner: '0' }],
                }),
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
        const resolved = resolveReactionQueueTriggerForSourceDefId(ms, 'base_greenhouse', 21);
        expect(hasInteraction(resolved, 'base_greenhouse')).toBe(true);
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
