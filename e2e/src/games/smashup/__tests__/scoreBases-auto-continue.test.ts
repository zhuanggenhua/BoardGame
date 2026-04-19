/**
 * 测试 scoreBases 阶段的自动推进逻辑
 * 
 * 场景：
 * 1. 基地计分后有交互（如托尔图加 afterScoring）
 * 2. 交互解决后应该自动推进到 draw 阶段，不需要再次点击"结束回合"
 */

import { describe, it, expect } from 'vitest';
import { registerGameAiRuntime, resolveNextLocalAiAction } from '../../../engine/ai';
import { asSimpleChoice } from '../../../engine/systems/InteractionSystem';
import { resolveForceEndTurnForStalledAi } from '../../../engine/transport/onlineAiRecovery';
import { smashUpFlowHooks } from '../domain/index';
import { buildSmashUpAiLegalActions, smashUpAiRuntime } from '../ai';
import type { MatchState } from '../../../core/types';
import type { SmashUpCore, PlayerState, BaseInPlay, MinionOnBase } from '../types';
import { defaultTestRandom, runCommand } from './testRunner';
import { SU_COMMANDS } from '../domain/types';
import { SU_EVENTS } from '../domain/events';
import { initAllAbilities } from '../abilities';
import { buildMinionTargetOptions, buildPlayerTargetOptions } from '../domain/abilityHelpers';

/** 构造最小 SmashUpCore 用于测试 */
function makeMinimalCore(overrides: Partial<SmashUpCore> = {}): SmashUpCore {
    const defaultPlayer: PlayerState = {
        id: '0',
        factionIds: ['robot'],
        hand: [],
        deck: [],
        discard: [],
        vp: 0,
        minionsPlayed: 0,
        minionLimit: 1,
        actionsPlayed: 0,
        actionLimit: 1,
    };
    
    return {
        turnOrder: ['0', '1'],
        currentPlayerIndex: 0,
        turnNumber: 1,
        players: {
            '0': defaultPlayer,
            '1': { ...defaultPlayer, id: '1', factionIds: ['pirate'] },
        },
        bases: [],
        baseDeck: [],
        nextUid: 1000,
        ...overrides,
    };
}

/** 构造基地 */
function makeBase(defId: string, minions: MinionOnBase[] = []): BaseInPlay {
    return {
        defId,
        minions,
        ongoingActions: [],
    };
}

/** 构造随从 */
function makeMinion(owner: string, defId: string, power: number): MinionOnBase {
    return {
        uid: `minion_${Math.random()}`,
        defId,
        owner,
        controller: owner,
        basePower: power,
        powerCounters: 0,
        powerModifier: 0,
        tempPowerModifier: 0,
        talentUsed: false,
        attachedActions: [],
    };
}

function buildPortalOrderOptions(cards: Array<{ uid: string; defId: string }>) {
    return cards.map((card, index) => ({
        id: `card-${index}`,
        label: card.defId,
        value: { cardUid: card.uid, defId: card.defId },
        displayMode: 'card',
        _source: 'static',
    }));
}

function buildTriggerChoiceOptions(triggerIds: string[]) {
    return triggerIds.map((triggerId, index) => ({
        id: `trigger-${index}`,
        label: `先结算 ${triggerId}`,
        displayMode: 'button',
        value: { triggerId },
    }));
}

const smashUpAiEngineConfig = {
    gameId: 'smashup',
    domain: {} as never,
    systems: [],
};

describe('scoreBases 阶段自动推进', () => {
    it('交互解决后应该自动推进到 draw 阶段', () => {
        // 创建一个基地达到临界点的状态
        const core = makeMinimalCore({
            bases: [makeBase('base_pirate_cove', [
                makeMinion('0', 'robot_hoverbot', 5), // 力量 5
            ])],
        });
        
        // 模拟 flowHalted=true 且交互已解决的状态
        const state: MatchState<SmashUpCore> = {
            core,
            sys: {
                phase: 'scoreBases',
                flowHalted: true, // 上一轮 onPhaseExit 返回了 halt
                interaction: { current: null, queue: [] }, // 交互已解决
            } as any,
        };
        
        // 调用 onAutoContinueCheck
        const result = smashUpFlowHooks.onAutoContinueCheck!({
            state,
            events: [],
            random: { next: () => 0.5 },
        });
        
        // 应该返回 autoContinue=true
        expect(result).toBeDefined();
        expect(result?.autoContinue).toBe(true);
        expect(result?.playerId).toBe('0');
    });
    
    it('没有 eligible 基地时应该自动推进', () => {
        // 创建一个没有基地达到临界点的状态
        const core = makeMinimalCore({
            bases: [makeBase('base_pirate_cove', [
                makeMinion('0', 'robot_hoverbot', 2), // 力量 2，未达到临界点
            ])],
        });
        
        const state: MatchState<SmashUpCore> = {
            core,
            sys: {
                phase: 'scoreBases',
                flowHalted: false,
                interaction: { current: null, queue: [] },
            } as any,
        };
        
        // 调用 onAutoContinueCheck
        const result = smashUpFlowHooks.onAutoContinueCheck!({
            state,
            events: [],
            random: { next: () => 0.5 },
        });
        
        // 应该返回 autoContinue=true
        expect(result).toBeDefined();
        expect(result?.autoContinue).toBe(true);
    });
    
    it('有 eligible 基地且响应窗口仍打开时不应该自动推进', () => {
        // 创建一个基地达到临界点且响应窗口仍打开的状态
        // 这是真实场景：onPhaseEnter 打开了响应窗口，等待玩家响应
        const core = makeMinimalCore({
            bases: [makeBase('base_pirate_cove', [
                makeMinion('0', 'robot_hoverbot', 5), // 力量 5
            ])],
            scoringEligibleBaseIndices: [0], // 锁定的 eligible 基地列表
        });
        
        const state: MatchState<SmashUpCore> = {
            core,
            sys: {
                phase: 'scoreBases',
                flowHalted: false,
                interaction: { current: null, queue: [] },
                responseWindow: {
                    current: {
                        windowId: 'meFirst_scoreBases_1',
                        responderQueue: ['0', '1'],
                        windowType: 'meFirst',
                        sourceId: 'scoreBases',
                    },
                    history: [],
                },
            } as any,
        };
        
        // 调用 onAutoContinueCheck
        const result = smashUpFlowHooks.onAutoContinueCheck!({
            state,
            events: [],
            random: { next: () => 0.5 },
        });
        
        // 应该返回 undefined（不自动推进，因为响应窗口仍打开）
        expect(result).toBeUndefined();
    });
    
    it('有交互时不应该自动推进', () => {
        // 创建一个有交互的状态（如海盗王 beforeScoring 移动确认）
        const core = makeMinimalCore({
            bases: [makeBase('base_pirate_cove', [
                makeMinion('0', 'robot_hoverbot', 5),
            ])],
        });
        
        const state: MatchState<SmashUpCore> = {
            core,
            sys: {
                phase: 'scoreBases',
                flowHalted: true,
                interaction: {
                    current: {
                        id: 'test_interaction',
                        playerId: '0',
                        type: 'simple-choice',
                        data: { title: '测试交互', options: [] },
                    },
                    queue: [],
                },
            } as any,
        };
        
        // 调用 onAutoContinueCheck
        const result = smashUpFlowHooks.onAutoContinueCheck!({
            state,
            events: [],
            random: { next: () => 0.5 },
        });
        
        // 应该返回 undefined（不自动推进，因为有交互）
        expect(result).toBeUndefined();
    });
    
    it('响应窗口关闭后应该自动推进触发计分', () => {
        // 创建一个响应窗口已关闭的状态（所有玩家都 PASS 了）
        // 这是真实场景：onPhaseEnter 打开了响应窗口，所有玩家 PASS 后窗口关闭
        const core = makeMinimalCore({
            bases: [makeBase('base_pirate_cove', [
                makeMinion('0', 'robot_hoverbot', 5), // 力量 5
            ])],
            scoringEligibleBaseIndices: [0], // 锁定的 eligible 基地列表
        });
        
        const state: MatchState<SmashUpCore> = {
            core,
            sys: {
                phase: 'scoreBases',
                flowHalted: false,
                interaction: { current: null, queue: [] },
                responseWindow: { current: null, history: [] }, // 窗口已关闭
            } as any,
        };
        
        // 调用 onAutoContinueCheck
        const result = smashUpFlowHooks.onAutoContinueCheck!({
            state,
            events: [],
            random: { next: () => 0.5 },
        });
        
        // 应该返回 autoContinue=true（响应窗口关闭，触发计分）
        expect(result).toBeDefined();
        expect(result?.autoContinue).toBe(true);
        expect(result?.playerId).toBe('0');
    });

    it('达标基地上只有触发式侏儒 POD beforeScoring 时仍应自动推进', () => {
        const core = makeMinimalCore({
            bases: [makeBase('base_pirate_cove', [
                makeMinion('0', 'trickster_gnome_pod', 3),
                makeMinion('0', 'robot_hoverbot', 4),
                makeMinion('1', 'robot_microbot_guard', 3),
            ])],
            scoringEligibleBaseIndices: [0],
        });

        const state: MatchState<SmashUpCore> = {
            core,
            sys: {
                phase: 'scoreBases',
                flowHalted: false,
                interaction: { current: null, queue: [] },
                responseWindow: { current: null, history: [] },
            } as any,
        };

        const result = smashUpFlowHooks.onAutoContinueCheck!({
            state,
            events: [],
            random: { next: () => 0.5 },
        });

        expect(result).toBeDefined();
        expect(result?.autoContinue).toBe(true);
        expect(result?.playerId).toBe('0');
    });

    it('AI 在计分阶段遇到触发式侏儒 POD beforeScoring 时不应伪造手动 special', () => {
        const state: MatchState<SmashUpCore> = {
            core: makeMinimalCore({
                bases: [makeBase('base_pirate_cove', [
                    makeMinion('0', 'trickster_gnome_pod', 3),
                    makeMinion('0', 'robot_hoverbot', 4),
                    makeMinion('1', 'robot_microbot_guard', 3),
                ])],
                scoringEligibleBaseIndices: [0],
            }),
            sys: {
                phase: 'scoreBases',
                flowHalted: false,
                interaction: { current: null, queue: [] },
                responseWindow: { current: null, history: [] },
            } as any,
        };

        const legalActions = buildSmashUpAiLegalActions({
            playerId: '0',
            state: state as any,
        });

        expect(legalActions.some(action => action.kind === 'activate-special')).toBe(true);
        expect(legalActions.some(action => action.kind === 'advance-phase')).toBe(false);
    });

    it('AI 在 optional multi 交互中应保留空选动作，避免 special 链卡死', () => {
        const state: MatchState<SmashUpCore> = {
            core: makeMinimalCore(),
            sys: {
                phase: 'playCards',
                flowHalted: false,
                interaction: {
                    current: {
                        id: 'miskatonic_field_trip_optional',
                        playerId: '0',
                        kind: 'simple-choice',
                        data: {
                            sourceId: 'miskatonic_field_trip',
                            options: [
                                { id: 'card-1', label: '选择 h1', value: { cardUid: 'h1' } },
                                { id: 'card-2', label: '选择 h2', value: { cardUid: 'h2' } },
                            ],
                            multi: { min: 0, max: 2 },
                        },
                    },
                    queue: [],
                },
                responseWindow: { current: null, history: [] },
            } as any,
        };

        const legalActions = buildSmashUpAiLegalActions({
            playerId: '0',
            state: state as any,
        });

        const emptySelection = legalActions.find(action =>
            action.kind === 'interaction-choice'
            && (action.commands[0] as any)?.payload?.optionIds
            && Array.isArray((action.commands[0] as any).payload.optionIds)
            && (action.commands[0] as any).payload.optionIds.length === 0,
        );

        expect(emptySelection).toBeDefined();
        expect(emptySelection?.label).toContain('不选择');
    });

    it('optional multi 交互若显式提供 skip 按钮，AI 不应再额外生成空选择或 skip+卡牌混合动作', () => {
        const state: MatchState<SmashUpCore> = {
            core: makeMinimalCore(),
            sys: {
                phase: 'playCards',
                flowHalted: false,
                interaction: {
                    current: {
                        id: 'optional-multi-with-skip',
                        playerId: '0',
                        kind: 'simple-choice',
                        data: {
                            sourceId: 'cthulhu_it_begins_again',
                            options: [
                                { id: 'card-1', label: '选择 a1', value: { cardUid: 'a1', defId: 'cthulhu_madness' } },
                                { id: 'skip', label: '跳过', value: { skip: true }, displayMode: 'button' as const },
                            ],
                            multi: { min: 0, max: 1 },
                        },
                    },
                    queue: [],
                },
                responseWindow: { current: null, history: [] },
            } as any,
        };

        const legalActions = buildSmashUpAiLegalActions({
            playerId: '0',
            state: state as any,
        });

        const emptySelections = legalActions.filter(action =>
            action.kind === 'interaction-choice'
            && Array.isArray((action.commands[0] as any)?.payload?.optionIds)
            && (action.commands[0] as any).payload.optionIds.length === 0,
        );
        const hybridSkipCombos = legalActions.filter(action =>
            action.kind === 'interaction-choice'
            && Array.isArray((action.commands[0] as any)?.payload?.optionIds)
            && (action.commands[0] as any).payload.optionIds.includes('skip')
            && (action.commands[0] as any).payload.optionIds.length > 1,
        );

        expect(emptySelections).toHaveLength(0);
        expect(hybridSkipCombos).toHaveLength(0);
        expect(legalActions.some(action => (action.commands[0] as any)?.payload?.optionId === 'skip')).toBe(true);
        expect(legalActions.some(action => (action.commands[0] as any)?.payload?.optionId === 'card-1')).toBe(true);
    });

    it('required 动态交互在刷新后无合法选项时，AI 仍应拿到紧急跳过动作', () => {
        const state: MatchState<SmashUpCore> = {
            core: makeMinimalCore(),
            sys: {
                phase: 'playCards',
                flowHalted: false,
                interaction: {
                    current: {
                        id: 'required-empty-live',
                        playerId: '0',
                        kind: 'simple-choice',
                        data: {
                            sourceId: 'alien_probe',
                            options: [
                                { id: 'stale-card', label: '过期手牌', value: { cardUid: 'stale-card', defId: 'pirate_first_mate' } },
                            ],
                            autoRefresh: 'hand',
                            responseValidationMode: 'live',
                        },
                    },
                    queue: [],
                },
                responseWindow: { current: null, history: [] },
            } as any,
        };

        const legalActions = buildSmashUpAiLegalActions({
            playerId: '0',
            state: state as any,
        });

        const emergencyAction = legalActions.find((action) =>
            action.kind === 'interaction-choice'
            && (action.commands[0] as any)?.payload?.optionId === '__emergency_skip__',
        );

        expect(emergencyAction).toBeDefined();
    });

    it('Smash Up 若未来回归出弃牌↔回收交替循环，watchdog 也应在本游戏阶段识别为 action-loop', () => {
        const state: MatchState<SmashUpCore> = {
            core: makeMinimalCore({
                currentPlayerIndex: 0,
            }),
            sys: {
                phase: 'draw',
                turnNumber: 3,
                interaction: { current: undefined, queue: [] },
                responseWindow: { current: undefined },
                actionLog: {
                    entries: [
                        { actorId: '0', kind: SU_EVENTS['su:cards_discarded'].type },
                        { actorId: '0', kind: SU_EVENTS['su:card_recovered_from_discard'].type },
                        { actorId: '0', kind: SU_EVENTS['su:cards_discarded'].type },
                        { actorId: '0', kind: SU_EVENTS['su:card_recovered_from_discard'].type },
                    ],
                },
            } as any,
        };

        const candidate = resolveForceEndTurnForStalledAi({
            sharedState: state,
            seatControllers: {
                '0': { type: 'local-ai' },
                '1': { type: 'human' },
            },
            seatStates: {},
        });

        expect(candidate?.reason).toBe('active-turn');
        expect(candidate?.playerId).toBe('0');
        expect(candidate?.resolution.action.commands).toEqual([
            { type: 'ADVANCE_PHASE', payload: {} },
        ]);
    });

    it('AI 对 exact-multi 交互应枚举所有合法组合，而不是总拿前两个', () => {
        const state: MatchState<SmashUpCore> = {
            core: makeMinimalCore(),
            sys: {
                phase: 'playCards',
                flowHalted: false,
                interaction: {
                    current: {
                        id: 'elder-thing-pod-destroy',
                        playerId: '0',
                        kind: 'simple-choice',
                        data: {
                            sourceId: 'elder_thing_elder_thing_pod_destroy',
                            options: [
                                { id: 'm1', label: '随从 1', value: { minionUid: 'm1' } },
                                { id: 'm2', label: '随从 2', value: { minionUid: 'm2' } },
                                { id: 'm3', label: '随从 3', value: { minionUid: 'm3' } },
                            ],
                            multi: { min: 2, max: 2 },
                        },
                    },
                    queue: [],
                },
                responseWindow: { current: null, history: [] },
            } as any,
        };

        const legalActions = buildSmashUpAiLegalActions({
            playerId: '0',
            state: state as any,
        });

        const comboPayloads = legalActions
            .filter((action) => action.kind === 'interaction-choice')
            .map((action) => ((action.commands[0] as any)?.payload?.optionIds ?? []).join(','))
            .sort();

        expect(comboPayloads).toEqual(['m1,m2', 'm1,m3', 'm2,m3']);
    });

    it('在线隐藏交互只对 AI seat 可见时，Smash Up AI 仍应生成 simple-choice 响应', async () => {
        registerGameAiRuntime(smashUpAiRuntime);

        const filteredHumanState: MatchState<SmashUpCore> = {
            core: makeMinimalCore({
                currentPlayerIndex: 0,
                players: {
                    '0': {
                        ...makeMinimalCore().players['0'],
                    },
                    '1': {
                        ...makeMinimalCore().players['1'],
                    },
                },
            }),
            sys: {
                phase: 'playCards',
                turnNumber: 1,
                interaction: {
                    current: undefined,
                    queue: [],
                    isBlocked: true,
                },
                responseWindow: { current: null, history: [] },
                eventStream: { nextId: 22 },
            } as any,
        };

        const aiSeatVisibleState: MatchState<SmashUpCore> = {
            core: makeMinimalCore({
                currentPlayerIndex: 0,
                players: {
                    '0': {
                        ...makeMinimalCore().players['0'],
                    },
                    '1': {
                        ...makeMinimalCore().players['1'],
                        hand: [
                            { uid: 'c54', defId: 'wizard_summon', type: 'action', owner: '1' },
                            { uid: 'c70', defId: 'ninja_acolyte', type: 'minion', owner: '1' },
                        ],
                        discard: [
                            { uid: 'c58', defId: 'wizard_sacrifice', type: 'action', owner: '1' },
                        ],
                        factions: ['wizards', 'ninjas'],
                        minionsPlayed: 1,
                        actionsPlayed: 1,
                    },
                },
                bases: [makeBase('base_temple_of_goju', [{
                    uid: 'c66',
                    defId: 'ninja_shinobi',
                    controller: '1',
                    owner: '1',
                    basePower: 3,
                    powerCounters: 0,
                    powerModifier: 0,
                    tempPowerModifier: 0,
                    talentUsed: false,
                    playedThisTurn: true,
                    attachedActions: [],
                } as MinionOnBase])],
            }),
            sys: {
                phase: 'playCards',
                turnNumber: 1,
                interaction: {
                    current: {
                        id: 'wizard_sacrifice_hidden_choice',
                        playerId: '1',
                        kind: 'simple-choice',
                        data: {
                            sourceId: 'wizard_sacrifice',
                            options: [{
                                id: 'target-shinobi',
                                label: '影舞者',
                                value: { minionUid: 'c66', baseIndex: 0 },
                            }],
                        },
                    },
                    queue: [],
                },
                responseWindow: { current: null, history: [] },
                eventStream: { nextId: 22 },
            } as any,
        };

        const withoutSeatSpecificState = await resolveNextLocalAiAction({
            engineConfig: smashUpAiEngineConfig,
            state: filteredHumanState,
            matchId: 'smashup-hidden-choice-regression',
            seatControllers: { '1': { type: 'local-ai' } },
        });

        expect(withoutSeatSpecificState).toBeNull();

        const withSeatSpecificState = await resolveNextLocalAiAction({
            engineConfig: smashUpAiEngineConfig,
            state: filteredHumanState,
            matchId: 'smashup-hidden-choice-regression',
            seatControllers: { '1': { type: 'local-ai' } },
            visibleStateResolver: (playerId) => (playerId === '1' ? aiSeatVisibleState : undefined),
        });

        expect(withSeatSpecificState?.playerId).toBe('1');
        expect(withSeatSpecificState?.action.kind).toBe('interaction-choice');
        expect(withSeatSpecificState?.action.commands).toEqual([{
            type: 'SYS_INTERACTION_RESPOND',
            payload: {
                optionId: 'target-shinobi',
            },
        }]);
        expect((withSeatSpecificState?.action as any)?.metadata?.optionValue).toEqual({ minionUid: 'c66', baseIndex: 0 });
    });

    it('afterScoring 响应窗口与 reaction queue 主动选择并存时，AI 应优先响应当前交互而不是窗口动作', async () => {
        registerGameAiRuntime(smashUpAiRuntime);

        const state: MatchState<SmashUpCore> = {
            core: makeMinimalCore({
                currentPlayerIndex: 1,
                players: {
                    '0': {
                        ...makeMinimalCore().players['0'],
                    },
                    '1': {
                        ...makeMinimalCore().players['1'],
                        hand: [
                            { uid: 'c54', defId: 'wizard_summon', type: 'action', owner: '1' },
                            { uid: 'c70', defId: 'ninja_acolyte', type: 'minion', owner: '1' },
                        ],
                        factions: ['wizards', 'ninjas'],
                    },
                },
            }),
            sys: {
                phase: 'scoreBases',
                turnNumber: 1,
                interaction: {
                    current: {
                        id: 'reaction-order-choice',
                        playerId: '1',
                        kind: 'simple-choice',
                        data: {
                            sourceId: 'smashup_reaction_choose',
                            options: [
                                {
                                    id: 'trigger-a',
                                    label: '先结算触发 A',
                                    displayMode: 'button',
                                    value: { triggerId: 'afterScoring:base_a:1:0' },
                                },
                                {
                                    id: 'trigger-b',
                                    label: '先结算触发 B',
                                    displayMode: 'button',
                                    value: { triggerId: 'afterScoring:base_b:1:0' },
                                },
                            ],
                        },
                    },
                    queue: [],
                },
                responseWindow: {
                    current: {
                        id: 'afterscoring-window',
                        windowType: 'afterScoring',
                        responderQueue: ['1'],
                        currentResponderIndex: 0,
                        passedPlayers: [],
                    },
                    history: [],
                },
                eventStream: { nextId: 30 },
            } as any,
        };

        const legalActions = buildSmashUpAiLegalActions({
            playerId: '1',
            state,
        });

        expect(legalActions.length).toBeGreaterThan(0);
        expect(legalActions.every((action) => action.kind === 'interaction-choice')).toBe(true);
        expect(legalActions.some((action) => action.kind === 'response-pass')).toBe(false);

        const resolution = await resolveNextLocalAiAction({
            engineConfig: smashUpAiEngineConfig,
            state,
            matchId: 'smashup-reaction-queue-ai-regression',
            seatControllers: { '1': { type: 'local-ai' } },
        });

        expect(resolution?.playerId).toBe('1');
        expect(resolution?.action.kind).toBe('interaction-choice');
        expect(resolution?.action.commands[0]?.type).toBe('SYS_INTERACTION_RESPOND');
        expect(['trigger-a', 'trigger-b']).toContain(
            (resolution?.action.commands[0]?.payload as { optionId?: string } | undefined)?.optionId,
        );
    });

    it('链式 simple-choice 在前一步改变 remaining 后，AI 应基于刷新后的候选继续选择，而不是重复选过期项', async () => {
        registerGameAiRuntime(smashUpAiRuntime);

        const orderedCards = [
            { uid: 'deck-a1', defId: 'test_action_1' },
            { uid: 'deck-a2', defId: 'test_action_2' },
            { uid: 'deck-a3', defId: 'test_action_3' },
        ];

        const staleOptions = buildPortalOrderOptions(orderedCards);
        const stateStep1: MatchState<SmashUpCore> = {
            core: makeMinimalCore({
                players: {
                    '0': {
                        ...makeMinimalCore().players['0'],
                        deck: orderedCards.map((card) => ({
                            uid: card.uid,
                            defId: card.defId,
                            type: 'action',
                            owner: '0',
                        })),
                        factions: ['wizards', 'pirates'] as any,
                    } as any,
                    '1': {
                        ...makeMinimalCore().players['1'],
                    } as any,
                } as any,
            }),
            sys: {
                phase: 'playCards',
                turnNumber: 1,
                interaction: {
                    current: {
                        id: 'wizard-portal-order-step-1',
                        playerId: '0',
                        kind: 'simple-choice',
                        data: {
                            sourceId: 'wizard_portal_order',
                            options: staleOptions,
                            continuationContext: {
                                remaining: orderedCards,
                                ordered: [],
                            },
                            optionsGenerator: (_nextState: MatchState<SmashUpCore>, data: any) =>
                                buildPortalOrderOptions(data?.continuationContext?.remaining ?? []),
                        },
                    },
                    queue: [],
                },
                responseWindow: { current: null, history: [] },
            } as any,
        };

        const firstResolution = await resolveNextLocalAiAction({
            engineConfig: smashUpAiEngineConfig,
            state: stateStep1,
            matchId: 'smashup-portal-ai-chain-step1',
            seatControllers: { '0': { type: 'local-ai' } },
        });

        expect(firstResolution?.playerId).toBe('0');
        expect(firstResolution?.action.kind).toBe('interaction-choice');
        expect(((firstResolution?.action as any)?.metadata?.optionValue as any)?.cardUid).toBe('deck-a1');

        const stateStep2: MatchState<SmashUpCore> = {
            ...stateStep1,
            sys: {
                ...stateStep1.sys,
                interaction: {
                    current: {
                        id: 'wizard-portal-order-step-2',
                        playerId: '0',
                        kind: 'simple-choice',
                        data: {
                            sourceId: 'wizard_portal_order',
                            options: staleOptions,
                            continuationContext: {
                                remaining: orderedCards.slice(1),
                                ordered: [orderedCards[0]],
                            },
                            optionsGenerator: (_nextState: MatchState<SmashUpCore>, data: any) =>
                                buildPortalOrderOptions(data?.continuationContext?.remaining ?? []),
                        },
                    },
                    queue: [],
                },
                responseWindow: { current: null, history: [] },
            } as any,
        };

        const secondLegalActions = buildSmashUpAiLegalActions({
            playerId: '0',
            state: stateStep2,
        });
        const secondActionTargets = secondLegalActions.map((action) => {
            return (action as any)?.metadata?.optionValue?.cardUid as string | undefined;
        });
        expect(secondActionTargets).toEqual(['deck-a2', 'deck-a3']);

        const secondResolution = await resolveNextLocalAiAction({
            engineConfig: smashUpAiEngineConfig,
            state: stateStep2,
            matchId: 'smashup-portal-ai-chain-step2',
            seatControllers: { '0': { type: 'local-ai' } },
        });

        const secondOptionValue = (secondResolution?.action as any)?.metadata?.optionValue as any;
        expect(secondResolution?.playerId).toBe('0');
        expect(secondResolution?.action.kind).toBe('interaction-choice');
        expect(secondOptionValue?.cardUid).toBe('deck-a2');
        expect(secondOptionValue?.cardUid).not.toBe('deck-a1');
    });

    it('responseWindow 穿插三段主动选择链时，AI 应持续消费当前交互，并在 remaining 刷新后继续推进', async () => {
        registerGameAiRuntime(smashUpAiRuntime);

        const orderedCards = [
            { uid: 'deck-a1', defId: 'test_action_1' },
            { uid: 'deck-a2', defId: 'test_action_2' },
            { uid: 'deck-a3', defId: 'test_action_3' },
        ];

        const staleOptions = buildPortalOrderOptions(orderedCards);
        const responseWindow = {
            current: {
                id: 'afterscoring-window',
                windowType: 'afterScoring',
                responderQueue: ['0'],
                currentResponderIndex: 0,
                passedPlayers: [],
            },
            history: [],
        };
        const baseCore = makeMinimalCore({
            currentPlayerIndex: 0,
            players: {
                '0': {
                    ...makeMinimalCore().players['0'],
                    deck: orderedCards.map((card) => ({
                        uid: card.uid,
                        defId: card.defId,
                        type: 'action',
                        owner: '0',
                    })),
                    factions: ['wizards', 'pirates'] as any,
                } as any,
                '1': {
                    ...makeMinimalCore().players['1'],
                } as any,
            } as any,
        });

        const step0State: MatchState<SmashUpCore> = {
            core: baseCore,
            sys: {
                phase: 'scoreBases',
                turnNumber: 1,
                interaction: {
                    current: {
                        id: 'reaction-order-step-0',
                        playerId: '0',
                        kind: 'simple-choice',
                        data: {
                            sourceId: 'smashup_reaction_choose',
                            options: buildTriggerChoiceOptions([
                                'wizard_portal_order',
                                'base_tortuga',
                            ]),
                        },
                    },
                    queue: [],
                },
                responseWindow,
            } as any,
        };

        const step0Resolution = await resolveNextLocalAiAction({
            engineConfig: smashUpAiEngineConfig,
            state: step0State,
            matchId: 'smashup-mixed-chain-step0',
            seatControllers: { '0': { type: 'local-ai' } },
        });
        expect(step0Resolution?.playerId).toBe('0');
        expect(step0Resolution?.action.kind).toBe('interaction-choice');
        expect((step0Resolution?.action.commands[0]?.payload as { optionId?: string } | undefined)?.optionId).toBe('trigger-0');

        const step1State: MatchState<SmashUpCore> = {
            core: baseCore,
            sys: {
                phase: 'scoreBases',
                turnNumber: 1,
                interaction: {
                    current: {
                        id: 'wizard-portal-order-step-1',
                        playerId: '0',
                        kind: 'simple-choice',
                        data: {
                            sourceId: 'wizard_portal_order',
                            options: staleOptions,
                            continuationContext: {
                                remaining: orderedCards,
                                ordered: [],
                            },
                            optionsGenerator: (_nextState: MatchState<SmashUpCore>, data: any) =>
                                buildPortalOrderOptions(data?.continuationContext?.remaining ?? []),
                        },
                    },
                    queue: [],
                },
                responseWindow,
            } as any,
        };

        const step1Resolution = await resolveNextLocalAiAction({
            engineConfig: smashUpAiEngineConfig,
            state: step1State,
            matchId: 'smashup-mixed-chain-step1',
            seatControllers: { '0': { type: 'local-ai' } },
        });
        expect(step1Resolution?.playerId).toBe('0');
        expect(step1Resolution?.action.kind).toBe('interaction-choice');
        expect(((step1Resolution?.action as any)?.metadata?.optionValue as any)?.cardUid).toBe('deck-a1');

        const step2State: MatchState<SmashUpCore> = {
            core: baseCore,
            sys: {
                phase: 'scoreBases',
                turnNumber: 1,
                interaction: {
                    current: {
                        id: 'wizard-portal-order-step-2',
                        playerId: '0',
                        kind: 'simple-choice',
                        data: {
                            sourceId: 'wizard_portal_order',
                            options: staleOptions,
                            continuationContext: {
                                remaining: orderedCards.slice(1),
                                ordered: [orderedCards[0]],
                            },
                            optionsGenerator: (_nextState: MatchState<SmashUpCore>, data: any) =>
                                buildPortalOrderOptions(data?.continuationContext?.remaining ?? []),
                        },
                    },
                    queue: [],
                },
                responseWindow,
            } as any,
        };

        const step2LegalActions = buildSmashUpAiLegalActions({
            playerId: '0',
            state: step2State,
        });
        expect(step2LegalActions.every((action) => action.kind === 'interaction-choice')).toBe(true);
        expect(step2LegalActions.map((action) => (action as any)?.metadata?.optionValue?.cardUid)).toEqual(['deck-a2', 'deck-a3']);

        const step2Resolution = await resolveNextLocalAiAction({
            engineConfig: smashUpAiEngineConfig,
            state: step2State,
            matchId: 'smashup-mixed-chain-step2',
            seatControllers: { '0': { type: 'local-ai' } },
        });
        expect(step2Resolution?.playerId).toBe('0');
        expect(step2Resolution?.action.kind).toBe('interaction-choice');
        expect(((step2Resolution?.action as any)?.metadata?.optionValue as any)?.cardUid).toBe('deck-a2');

        const step3State: MatchState<SmashUpCore> = {
            core: baseCore,
            sys: {
                phase: 'scoreBases',
                turnNumber: 1,
                interaction: {
                    current: {
                        id: 'reaction-order-step-3',
                        playerId: '0',
                        kind: 'simple-choice',
                        data: {
                            sourceId: 'smashup_reaction_choose',
                            options: buildTriggerChoiceOptions([
                                'pirate_first_mate_choose_base',
                                'base_tortuga',
                            ]),
                        },
                    },
                    queue: [],
                },
                responseWindow,
            } as any,
        };

        const step3Resolution = await resolveNextLocalAiAction({
            engineConfig: smashUpAiEngineConfig,
            state: step3State,
            matchId: 'smashup-mixed-chain-step3',
            seatControllers: { '0': { type: 'local-ai' } },
        });
        expect(step3Resolution?.playerId).toBe('0');
        expect(step3Resolution?.action.kind).toBe('interaction-choice');
        expect((step3Resolution?.action.commands[0]?.payload as { optionId?: string } | undefined)?.optionId).toBe('trigger-0');
    });

    it('盘旋机器人揭示的牌已不再位于牌库顶时，AI 应只保留 skip，不再尝试 stale play', async () => {
        registerGameAiRuntime(smashUpAiRuntime);
        initAllAbilities();

        const initialState: MatchState<SmashUpCore> = {
            core: makeMinimalCore({
                players: {
                    '0': {
                        ...makeMinimalCore().players['0'],
                        hand: [{
                            uid: 'hoverbot-1',
                            defId: 'robot_hoverbot',
                            type: 'minion',
                            owner: '0',
                        }] as any,
                        deck: [
                            {
                                uid: 'hoverbot-2',
                                defId: 'robot_hoverbot',
                                type: 'minion',
                                owner: '0',
                            },
                            {
                                uid: 'zapbot-1',
                                defId: 'robot_zapbot',
                                type: 'minion',
                                owner: '0',
                            },
                        ] as any,
                        factions: ['robots', 'wizards'] as any,
                    } as any,
                    '1': {
                        ...makeMinimalCore().players['1'],
                    } as any,
                } as any,
                bases: [makeBase('base_great_library', [])],
            }),
            sys: {
                phase: 'playCards',
                turnNumber: 1,
                interaction: { current: null, queue: [] },
                responseWindow: { current: null, history: [] },
            } as any,
        };

        const played = runCommand(initialState as any, {
            type: SU_COMMANDS.PLAY_MINION,
            playerId: '0',
            payload: { cardUid: 'hoverbot-1', baseIndex: 0 },
            timestamp: 1,
        } as any);

        expect(played.success).toBe(true);
        expect((played.finalState.sys.interaction?.current?.data as any)?.sourceId).toBe('robot_hoverbot');

        const staleTopState: MatchState<SmashUpCore> = {
            ...played.finalState,
            core: {
                ...played.finalState.core,
                players: {
                    ...played.finalState.core.players,
                    '0': {
                        ...played.finalState.core.players['0'],
                        deck: [{
                            uid: 'zapbot-1',
                            defId: 'robot_zapbot',
                            type: 'minion',
                            owner: '0',
                        }] as any,
                    },
                },
            },
        };

        const legalActions = buildSmashUpAiLegalActions({
            playerId: '0',
            state: staleTopState as any,
        });

        expect(legalActions).toHaveLength(1);
        expect(legalActions[0]?.kind).toBe('interaction-choice');
        expect((legalActions[0]?.commands[0]?.payload as { optionId?: string } | undefined)?.optionId).toBe('skip');

        const resolution = await resolveNextLocalAiAction({
            engineConfig: smashUpAiEngineConfig,
            state: staleTopState as any,
            matchId: 'smashup-hoverbot-stale-top-ai',
            seatControllers: { '0': { type: 'local-ai' } },
        });

        expect(resolution?.playerId).toBe('0');
        expect(resolution?.action.kind).toBe('interaction-choice');
        expect((resolution?.action.commands[0]?.payload as { optionId?: string } | undefined)?.optionId).toBe('skip');
    });

    it('AI 在计分阶段仅存在可激活的泰坦 special 时也不应暴露 advance-phase', () => {
        const state: MatchState<SmashUpCore> = {
            core: makeMinimalCore({
                bases: [makeBase('base_pirate_cove', [
                    makeMinion('0', 'robot_hoverbot', 4),
                    makeMinion('0', 'robot_microbot_alpha', 2),
                    makeMinion('0', 'robot_microbot_beta', 2),
                    makeMinion('1', 'pirate_first_mate', 3),
                ])],
                scoringEligibleBaseIndices: [0],
                titans: [{
                    uid: 't-megabot-setaside',
                    defId: 'mega_troopers_megabot',
                    faction: 'mega_troopers',
                    ownerId: '0',
                    controllerId: '0',
                    powerCounters: 0,
                    talentUsed: false,
                    location: { zone: 'setaside' },
                }] as any,
            }),
            sys: {
                phase: 'scoreBases',
                flowHalted: false,
                interaction: { current: null, queue: [] },
                responseWindow: { current: null, history: [] },
            } as any,
        };

        const legalActions = buildSmashUpAiLegalActions({
            playerId: '0',
            state: state as any,
        });

        expect(legalActions.some(action =>
            action.kind === 'activate-special'
            && (action.metadata as any)?.titanUid === 't-megabot-setaside',
        )).toBe(true);
        expect(legalActions.some(action => action.kind === 'advance-phase')).toBe(false);
    });

    it('buff 型随从目标交互应透传 AI hints，且 AI 优先选择己方随从', async () => {
        registerGameAiRuntime(smashUpAiRuntime);

        const ownMinion: MinionOnBase = {
            ...makeMinion('0', 'robot_microbot_alpha', 2),
            uid: 'own-buff-target',
        };
        const enemyMinion: MinionOnBase = {
            ...makeMinion('1', 'pirate_first_mate', 3),
            uid: 'enemy-buff-target',
        };

        const core = makeMinimalCore({
            bases: [makeBase('base_pirate_cove', [ownMinion, enemyMinion])],
        });

        const state: MatchState<SmashUpCore> = {
            core,
            sys: {
                phase: 'playCards',
                turnNumber: 1,
                interaction: {
                    current: {
                        id: 'buff-target-choice',
                        playerId: '0',
                        kind: 'simple-choice',
                        data: {
                            sourceId: 'werewolves_great_wolf_spirit_talent',
                            options: buildMinionTargetOptions([
                                { uid: ownMinion.uid, defId: ownMinion.defId, baseIndex: 0, label: '己方随从' },
                                { uid: enemyMinion.uid, defId: enemyMinion.defId, baseIndex: 0, label: '敌方随从' },
                            ], {
                                state: core,
                                sourcePlayerId: '0',
                                effectType: 'buff',
                            }),
                            targetType: 'minion',
                        },
                    },
                    queue: [],
                },
                responseWindow: { current: null, history: [] },
            } as any,
        };

        const legalActions = buildSmashUpAiLegalActions({
            playerId: '0',
            state: state as any,
        });

        expect(legalActions).toHaveLength(2);
        const ownAction = legalActions.find(action =>
            (action.metadata as { optionValue?: { minionUid?: string } })?.optionValue?.minionUid === ownMinion.uid,
        );
        const enemyAction = legalActions.find(action =>
            (action.metadata as { optionValue?: { minionUid?: string } })?.optionValue?.minionUid === enemyMinion.uid,
        );

        expect(ownAction?.aiHints?.[0]).toMatchObject({
            relationToActor: 'self',
            effectIntent: 'buff',
            targetKind: 'minion',
            targetControllerId: '0',
        });
        expect(enemyAction?.aiHints?.[0]).toMatchObject({
            relationToActor: 'enemy',
            effectIntent: 'buff',
            targetKind: 'minion',
            targetControllerId: '1',
        });

        const resolution = await resolveNextLocalAiAction({
            engineConfig: smashUpAiEngineConfig,
            state: state as any,
            matchId: 'smashup-buff-target-ai',
            seatControllers: { '0': { type: 'local-ai' } },
        });

        expect(resolution?.playerId).toBe('0');
        expect(resolution?.action.kind).toBe('interaction-choice');
        expect((resolution?.action.commands[0]?.payload as { optionId?: string } | undefined)?.optionId)
            .toBe(ownAction?.metadata?.optionId);
    });

    it('inspect 型玩家目标交互应透传 AI hints，且 AI 优先查看敌方信息', async () => {
        registerGameAiRuntime(smashUpAiRuntime);

        const state: MatchState<SmashUpCore> = {
            core: makeMinimalCore(),
            sys: {
                phase: 'playCards',
                turnNumber: 1,
                interaction: {
                    current: {
                        id: 'inspect-player-choice',
                        playerId: '0',
                        kind: 'simple-choice',
                        data: {
                            sourceId: 'alien_probe_choose_target',
                            options: buildPlayerTargetOptions(
                                [
                                    {
                                        id: 'inspect-self',
                                        label: '查看自己',
                                        targetPlayerId: '0',
                                    },
                                    {
                                        id: 'inspect-enemy',
                                        label: '查看对手',
                                        targetPlayerId: '1',
                                    },
                                ],
                                {
                                    sourcePlayerId: '0',
                                    effectIntent: 'inspect',
                                },
                            ),
                            targetType: 'player',
                        },
                    },
                    queue: [],
                },
                responseWindow: { current: null, history: [] },
            } as any,
        };

        const legalActions = buildSmashUpAiLegalActions({
            playerId: '0',
            state: state as any,
        });

        expect(legalActions).toHaveLength(2);
        const selfAction = legalActions.find(action =>
            (action.metadata as { optionValue?: { targetPlayerId?: string } })?.optionValue?.targetPlayerId === '0',
        );
        const enemyAction = legalActions.find(action =>
            (action.metadata as { optionValue?: { targetPlayerId?: string } })?.optionValue?.targetPlayerId === '1',
        );

        expect(selfAction?.aiHints?.[0]).toMatchObject({
            relationToActor: 'self',
            effectIntent: 'inspect',
            targetKind: 'player',
            targetPlayerId: '0',
        });
        expect(enemyAction?.aiHints?.[0]).toMatchObject({
            relationToActor: 'enemy',
            effectIntent: 'inspect',
            targetKind: 'player',
            targetPlayerId: '1',
        });

        const resolution = await resolveNextLocalAiAction({
            engineConfig: smashUpAiEngineConfig,
            state: state as any,
            matchId: 'smashup-inspect-player-target-ai',
            seatControllers: { '0': { type: 'local-ai' } },
        });

        expect(resolution?.playerId).toBe('0');
        expect(resolution?.action.kind).toBe('interaction-choice');
        expect((resolution?.action.commands[0]?.payload as { optionId?: string } | undefined)?.optionId)
            .toBe(enemyAction?.metadata?.optionId);
    });

    it('multi_base_scoring 交互应注入基地评分 hints，且 AI 优先选择收益更高的基地', async () => {
        registerGameAiRuntime(smashUpAiRuntime);

        const core = makeMinimalCore({
            bases: [
                makeBase('base_pirate_cove', [
                    makeMinion('0', 'robot_warbot', 4),
                    makeMinion('1', 'pirate_first_mate', 2),
                ]),
                makeBase('base_egg_chamber', [
                    makeMinion('0', 'robot_microbot_alpha', 1),
                    makeMinion('1', 'pirate_king', 5),
                ]),
            ],
            scoringEligibleBaseIndices: [0, 1],
        });

        const state: MatchState<SmashUpCore> = {
            core,
            sys: {
                phase: 'scoreBases',
                turnNumber: 1,
                interaction: { current: null, queue: [] },
                responseWindow: { current: null, history: [] },
                flowHalted: false,
            } as any,
        };

        const exitResult = smashUpFlowHooks.onPhaseExit?.({
            state,
            from: 'scoreBases',
            command: { type: 'ADVANCE_PHASE', playerId: '0', payload: {}, timestamp: 1 } as any,
            random: defaultTestRandom,
        });

        const updatedState = Array.isArray(exitResult)
            ? state
            : ((exitResult as { updatedState?: MatchState<SmashUpCore> } | undefined)?.updatedState ?? state);

        const choice = asSimpleChoice(updatedState.sys.interaction?.current);
        expect(choice?.sourceId).toBe('multi_base_scoring');

        const option0 = choice?.options.find((option: any) => option.value?.baseIndex === 0);
        const option1 = choice?.options.find((option: any) => option.value?.baseIndex === 1);
        expect(option0?._ai).toBeDefined();
        expect(option1?._ai).toBeDefined();
        expect((option0?._ai?.estimatedSwing ?? 0)).toBeGreaterThan(option1?._ai?.estimatedSwing ?? 0);

        const resolution = await resolveNextLocalAiAction({
            engineConfig: smashUpAiEngineConfig,
            state: updatedState as any,
            matchId: 'smashup-ai-multi-base-scoring',
            seatControllers: { '0': { type: 'local-ai' } },
        });

        expect(resolution?.playerId).toBe('0');
        expect(resolution?.action.kind).toBe('interaction-choice');
        expect((resolution?.action.commands[0]?.payload as { optionId?: string } | undefined)?.optionId)
            .toBe(option0?.id);
    });

    it('两个基地都接近爆点时，AI 应优先把随从投到自己能拿第一的基地', async () => {
        registerGameAiRuntime(smashUpAiRuntime);

        const state: MatchState<SmashUpCore> = {
            core: makeMinimalCore({
                players: {
                    '0': {
                        ...makeMinimalCore().players['0'],
                        factionIds: ['robot', 'pirate'],
                        hand: [{
                            uid: 'warbot-hand',
                            defId: 'robot_warbot',
                            type: 'minion',
                            owner: '0',
                        }] as any,
                    },
                    '1': {
                        ...makeMinimalCore().players['1'],
                        factionIds: ['pirate', 'robot'],
                    },
                },
                bases: [
                    makeBase('base_pirate_cove', [
                        makeMinion('0', 'robot_microbot_alpha', 1),
                        makeMinion('1', 'pirate_king', 5),
                        makeMinion('1', 'pirate_buccaneer', 4),
                        makeMinion('1', 'robot_warbot', 4),
                    ]),
                    makeBase('base_egg_chamber', [
                        makeMinion('0', 'pirate_king', 5),
                        makeMinion('0', 'pirate_buccaneer', 4),
                        makeMinion('1', 'robot_warbot', 4),
                    ]),
                ],
            }),
            sys: {
                phase: 'playCards',
                flowHalted: false,
                interaction: { current: null, queue: [] },
                responseWindow: { current: null, history: [] },
            } as any,
        };

        const legalActions = buildSmashUpAiLegalActions({
            playerId: '0',
            state: state as any,
        });

        const playMinionActions = legalActions.filter((action) => action.kind === 'play-minion');
        expect(playMinionActions).toHaveLength(2);
        expect((playMinionActions[0]?.commands[0]?.payload as { baseIndex?: number } | undefined)?.baseIndex).toBe(0);
        expect((playMinionActions[1]?.commands[0]?.payload as { baseIndex?: number } | undefined)?.baseIndex).toBe(1);

        const resolution = await resolveNextLocalAiAction({
            engineConfig: smashUpAiEngineConfig,
            state: state as any,
            matchId: 'smashup-ai-prefers-winning-base',
            seatControllers: { '0': { type: 'local-ai' } },
        });

        expect(resolution?.playerId).toBe('0');
        expect(resolution?.action.kind).toBe('play-minion');
        expect((resolution?.action.commands[0]?.payload as { baseIndex?: number } | undefined)?.baseIndex).toBe(1);
    });

    it('两个基地同样快到爆点但只有一个仍可争第一时，AI 应优先经营可争夺的基地', async () => {
        registerGameAiRuntime(smashUpAiRuntime);

        const state: MatchState<SmashUpCore> = {
            core: makeMinimalCore({
                players: {
                    '0': {
                        ...makeMinimalCore().players['0'],
                        factionIds: ['robot', 'pirate'],
                        hand: [{
                            uid: 'hoverbot-hand',
                            defId: 'robot_hoverbot',
                            type: 'minion',
                            owner: '0',
                        }] as any,
                    },
                    '1': {
                        ...makeMinimalCore().players['1'],
                        factionIds: ['pirate', 'robot'],
                    },
                },
                bases: [
                    makeBase('base_pirate_cove', [
                        makeMinion('0', 'robot_microbot_alpha', 1),
                        makeMinion('1', 'pirate_king', 5),
                        makeMinion('1', 'pirate_buccaneer', 4),
                        makeMinion('1', 'pirate_first_mate', 3),
                    ]),
                    makeBase('base_egg_chamber', [
                        makeMinion('0', 'pirate_king', 5),
                        makeMinion('0', 'pirate_buccaneer', 4),
                        makeMinion('1', 'robot_warbot', 4),
                    ]),
                ],
            }),
            sys: {
                phase: 'playCards',
                flowHalted: false,
                interaction: { current: null, queue: [] },
                responseWindow: { current: null, history: [] },
            } as any,
        };

        const resolution = await resolveNextLocalAiAction({
            engineConfig: smashUpAiEngineConfig,
            state: state as any,
            matchId: 'smashup-ai-prefers-contestable-base',
            seatControllers: { '0': { type: 'local-ai' } },
        });

        expect(resolution?.playerId).toBe('0');
        expect(resolution?.action.kind).toBe('play-minion');
        expect((resolution?.action.commands[0]?.payload as { baseIndex?: number } | undefined)?.baseIndex).toBe(1);
    });
});
