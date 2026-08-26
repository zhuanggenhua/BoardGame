/**
 * 测试 scoreBases 阶段的自动推进逻辑
 * 
 * 场景：
 * 1. 基地计分后有交互（如托尔图加 afterScoring）
 * 2. 交互解决后应该自动推进到 draw 阶段，不需要再次点击"结束回合"
 */

import { beforeEach, describe, it, expect } from 'vitest';
import { registerGameAiRuntime, resolveNextLocalAiAction } from '../../../engine/ai';
import { createSimpleChoice } from '../../../engine/systems/InteractionSystem';
import { resolveForceEndTurnForStalledAi } from '../../../engine/transport/onlineAiRecovery';
import { postProcessSystemEvents } from '../domain';
import { smashUpFlowHooks } from '../domain/index';
import { createSmashUpEventSystem } from '../domain/systems';
import { buildSmashUpAiLegalActions, smashUpAiRuntime } from '../ai';
import type { MatchState } from '../../../core/types';
import type { SmashUpCore, PlayerState, BaseInPlay, MinionOnBase } from '../types';
import { defaultTestRandom, runCommand } from './testRunner';
import { SU_COMMANDS } from '../domain/types';
import { SU_EVENT_TYPES } from '../domain/events';
import { initAllAbilities, resetAbilityInit } from '../abilities';
import { buildMinionTargetOptions, buildPlayerTargetOptions } from '../domain/abilityHelpers';
import { registerAbility } from '../domain/abilityRegistry';
import { buildReactionOptions, getSmashUpReactionSession, resolveSmashUpReactionChoice, startSmashUpReactionSession } from '../domain/reactionSession';
import { createScoringBaseRef, createScoringSession, setScoringSession } from '../domain/scoringSession';
import { registerTitanSpecialValidator } from '../domain/titanAbilityValidators';
import {
    expectNoPrompt,
    getPromptOption,
    getPromptSourceId,
    getRespondCommandOptionId,
    getSimpleChoicePrompt,
    respondCommand,
    withoutCurrentPrompt,
    withoutQueuedPrompts,
    withPromptResolutionFrameId,
} from './helpers';

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

function registerArcaneProtectorSpecialForTests() {
    registerAbility('wizards_arcane_protector', 'special', () => ({ events: [] }));
    registerTitanSpecialValidator('wizards_arcane_protector', ({ state, titan }) => {
        if (titan.location.zone !== 'setaside') return '该泰坦当前不在牌库旁';
        return (state.cardsPlayedThisTurn ?? 0) >= 5 ? null : '你本回合还没有打出 5 张牌';
    });
}

function createPersistedStaleReactionChoiceState(): MatchState<SmashUpCore> {
    const initialState = {
        core: makeMinimalCore({
            currentPlayerIndex: 0,
            bases: [makeBase('base_wizard_academy', [
                makeMinion('0', 'robot_hoverbot', 4),
            ])],
            scoringEligibleBaseIndices: [0],
        }),
        sys: {
            phase: 'scoreBases',
            interaction: { current: undefined, queue: [] },
            responseWindow: {
                current: {
                    id: 'reaction-window-stale',
                    windowType: 'afterScoring',
                    sourceId: 'smashup_reaction_choose',
                    responderQueue: ['0', '1'],
                    currentResponderIndex: 1,
                    passedPlayers: [],
                },
                history: [],
            },
            eventStream: { nextId: 1 },
        } as any,
    } as MatchState<SmashUpCore>;
    const baseRef = createScoringBaseRef(initialState.core, 0);
    if (!baseRef) {
        throw new Error('无法构造 persisted stale reaction 的 scoring base ref');
    }
    const scoringState = setScoringSession(initialState, {
        ...createScoringSession(initialState.core, [0]),
        currentBaseRef: baseRef,
        currentStep: 'awaiting-response-window',
    });
    const baseState = startSmashUpReactionSession(scoringState, {
        frameId: 'persisted-stale-reaction',
        frameKind: 'score-after',
        phase: 'optional',
        activePlayerId: '1',
        currentPlayerId: '0',
        consecutivePasses: 0,
        responseWindowType: 'afterScoring',
    });

    return {
        ...baseState,
        sys: {
            ...baseState.sys,
            interaction: {
                current: createSimpleChoice(
                    'persisted-stale-reaction-choice',
                    '1',
                    '选择一个反应动作',
                    [
                        {
                            id: 'source-titan_1_wizards_arcane_protector-action',
                            label: '奥术守护者 特殊能力',
                            displayMode: 'card',
                            value: {
                                fieldInteractionType: 'source-action',
                                fieldSourceType: 'titan',
                                sourceUid: 'titan_1_wizards_arcane_protector',
                                kind: 'activate_special',
                                playerId: '1',
                                titanUid: 'titan_1_wizards_arcane_protector',
                                baseIndex: 0,
                                sourceBaseIndex: 0,
                                fromBaseIndex: 0,
                            },
                        },
                        {
                            id: 'pass',
                            label: 'Pass',
                            displayMode: 'button',
                            value: { kind: 'pass' },
                        },
                    ],
                    {
                        sourceId: 'smashup_reaction_choose',
                        targetType: 'field-source-action',
                        responseValidationMode: 'live',
                    },
                ),
                queue: [],
            },
        } as any,
    };
}

const smashUpAiEngineConfig = {
    gameId: 'smashup',
    domain: {} as never,
    systems: [],
};

describe('scoreBases 阶段自动推进', () => {
    beforeEach(() => {
        resetAbilityInit();
    });

    it('startTurn 进入 playCards 时应清掉 _smashupStartTurnWindowActive，避免后续交互误漂回 startTurn', () => {
        const core = makeMinimalCore();
        const state: MatchState<SmashUpCore> = {
            core,
            sys: {
                phase: 'startTurn',
                interaction: { current: undefined, queue: [] },
                responseWindow: { current: undefined },
                _smashupStartTurnWindowActive: true,
            } as any,
        };

        const result = smashUpFlowHooks.onPhaseEnter?.({
            state,
            from: 'startTurn',
            to: 'playCards',
            command: { type: 'ADVANCE_PHASE', playerId: '0', payload: undefined, timestamp: 1000 } as any,
            random: defaultTestRandom,
            exitEvents: [],
        });

        expect(Array.isArray(result)).toBe(false);
        expect(result).toBeDefined();
        if (!result || Array.isArray(result) || !('updatedState' in result) || !result.updatedState) {
            throw new Error('缺少 updatedState');
        }

        expect((result.updatedState.sys as any)._smashupStartTurnWindowActive).toBeUndefined();
    });

    it('score-after 交互不应因残留的 _smashupStartTurnWindowActive 被误判回 startTurn', () => {
        const core = makeMinimalCore({
            bases: [
                makeBase('base_tortuga', [makeMinion('0', 'robot_hoverbot', 4)]),
                makeBase('base_secret_garden', [makeMinion('1', 'wizard_archmage', 4)]),
            ],
        });

        const state: MatchState<SmashUpCore> = {
            core,
            sys: {
                phase: 'scoreBases',
                interaction: {
                    current: withPromptResolutionFrameId(
                        createSimpleChoice(
                            'base_tortuga_1000',
                            '1',
                            '托尔图加：选择移动一个其他基地上的随从到替换基地',
                            [{
                                id: 'minion-0',
                                label: 'Wizard Archmage',
                                value: {
                                    minionUid: 'minion_1',
                                    minionDefId: 'wizard_archmage',
                                    fromBaseIndex: 1,
                                },
                                displayMode: 'card',
                            }] as any,
                            { sourceId: 'base_tortuga', targetType: 'minion' },
                        ),
                        'score-after:0:0',
                    ),
                    queue: [],
                },
                responseWindow: { current: undefined },
                _smashupStartTurnWindowActive: true,
                resolution: {
                    activeFrameId: 'score-after:0:0',
                    frames: [
                        {
                            id: 'smashup:score-bases',
                            kind: 'smashup:score-bases',
                            ownerGame: 'smashup',
                            ordering: 'explicit-order',
                            status: 'suspended',
                            step: 'awaiting-response-window',
                            phase: 'scoreBases',
                            phaseGate: 'block-advance-when-blocked',
                            blockedBy: { type: 'child-frame', id: 'score-after:0:0', reason: 'smashup:reaction:score-after' },
                        },
                        {
                            id: 'score-after:0:0',
                            kind: 'smashup:reaction:score-after',
                            ownerGame: 'smashup',
                            ordering: 'nested-body',
                            status: 'blocked',
                            step: 'mandatory',
                            phase: 'scoreBases',
                            phaseGate: 'block-advance-when-blocked',
                            blockedBy: { type: 'interaction', id: 'base_tortuga_1000', reason: 'simple-choice' },
                            metadata: {
                                smashupReactionSession: {
                                    frameId: 'score-after:0:0',
                                    frameKind: 'score-after',
                                    phase: 'mandatory',
                                    activePlayerId: '1',
                                    currentPlayerId: '0',
                                    consecutivePasses: 0,
                                    sourceBaseIndex: 0,
                                    responseWindowType: 'afterScoring',
                                },
                            },
                        },
                    ],
                },
            } as any,
        };

        const processed = postProcessSystemEvents(
            state.core,
            [],
            defaultTestRandom,
            state,
        );

        expect(processed.matchState?.sys.phase).toBe('scoreBases');
    });

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
    
    it('有 eligible 基地且 live ReactionSession 响应窗口仍打开时不应该自动推进', () => {
        // 创建一个基地达到临界点且 live ReactionSession 仍打开的状态
        // 这是真实场景：计分 frame 打开 Me First / After Scoring 响应轮，等待玩家响应
        const core = makeMinimalCore({
            bases: [makeBase('base_pirate_cove', [
                makeMinion('0', 'robot_hoverbot', 5), // 力量 5
            ])],
            scoringEligibleBaseIndices: [0], // 锁定的 eligible 基地列表
        });
        
        const baseState: MatchState<SmashUpCore> = {
            core,
            sys: {
                phase: 'scoreBases',
                flowHalted: false,
                interaction: { current: null, queue: [] },
            } as any,
        };
        const state = startSmashUpReactionSession(
            setScoringSession(baseState, {
                ...createScoringSession(core, [0]),
                currentBaseRef: createScoringBaseRef(core, 0),
                currentStep: 'awaiting-response-window',
            }),
            {
                frameId: 'score-before:0:auto-continue',
                frameKind: 'score-before',
                phase: 'optional',
                activePlayerId: '0',
                currentPlayerId: '0',
                consecutivePasses: 0,
                sourceBaseIndex: 0,
                responseWindowType: 'meFirst',
            },
        );
        
        // 调用 onAutoContinueCheck
        const result = smashUpFlowHooks.onAutoContinueCheck!({
            state,
            events: [],
            random: { next: () => 0.5 },
        });
        
        // 应该返回 undefined（不自动推进，因为 live ReactionSession 仍打开）
        expect(result).toBeUndefined();
    });

    it('线上反馈：score-after 空响应轮在后续恢复轮应自动收口', () => {
        const basePlayer: PlayerState = {
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
        const core = makeMinimalCore({
            currentPlayerIndex: 2,
            turnOrder: ['0', '1', '2'],
            players: {
                '0': basePlayer,
                '1': { ...basePlayer, id: '1', factionIds: ['pirate'] },
                '2': { ...basePlayer, id: '2', factionIds: ['wizard'] },
            },
            bases: [makeBase('base_pirate_cove', [
                makeMinion('2', 'robot_hoverbot', 5),
            ])],
            scoringEligibleBaseIndices: [0],
        });
        const baseState: MatchState<SmashUpCore> = {
            core,
            sys: {
                phase: 'scoreBases',
                interaction: { current: undefined, queue: [] },
                responseWindow: { current: undefined },
            } as any,
        };
        const scoringState = setScoringSession(baseState, {
            ...createScoringSession(core, [0]),
            currentBaseRef: createScoringBaseRef(core, 0),
            currentStep: 'awaiting-response-window',
        });
        const stalledState = startSmashUpReactionSession(scoringState, {
            frameId: 'score-after:0:0',
            frameKind: 'score-after',
            phase: 'optional',
            activePlayerId: '0',
            currentPlayerId: '2',
            consecutivePasses: 1,
            passedPlayerIds: ['2'],
            sourceBaseIndex: 0,
            responseWindowType: 'afterScoring',
        });

        expect(buildSmashUpAiLegalActions({
            playerId: '2',
            state: stalledState as any,
        })).toEqual([]);

        const system = createSmashUpEventSystem();
        const result = system.afterEvents?.({
            state: stalledState,
            events: [],
            random: defaultTestRandom,
            command: { type: 'ADVANCE_PHASE', playerId: '2', payload: {}, timestamp: 1 } as any,
            playerIds: ['0', '1', '2'],
            afterEventsRound: 0,
            pendingAfterEventsToReduceCount: 0,
            eventCommitEvidence: [],
        } as any);

        expect(result?.state).toBeDefined();
        expect(getSmashUpReactionSession(result!.state!)).toBeUndefined();
        expect(buildSmashUpAiLegalActions({
            playerId: '2',
            state: result!.state! as any,
        }).some(action => action.kind === 'advance-phase')).toBe(true);
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

    it('scoreBases 只剩空壳 legacy responseWindow 时，仍应自动推进', () => {
        const core = makeMinimalCore({
            bases: [makeBase('base_pirate_cove', [
                makeMinion('0', 'robot_hoverbot', 5),
            ])],
            scoringEligibleBaseIndices: [0],
        });

        const state: MatchState<SmashUpCore> = {
            core,
            sys: {
                phase: 'scoreBases',
                flowHalted: false,
                interaction: { current: null, queue: [] },
                responseWindow: {
                    current: {
                        id: 'legacy-window-empty-shell',
                        windowType: 'meFirst',
                        sourceId: 'legacy_me_first',
                        responderQueue: [],
                        currentResponderIndex: 0,
                        passedPlayers: [],
                    },
                    history: [],
                },
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

    it('interaction 仅以 isBlocked 形式存在时，AI 不应错误生成 advance-phase', () => {
        const state: MatchState<SmashUpCore> = {
            core: makeMinimalCore({
                bases: [makeBase('base_pirate_cove')],
            }),
            sys: {
                phase: 'playCards',
                interaction: {
                    current: null,
                    queue: [],
                    isBlocked: true,
                },
                responseWindow: {
                    current: null,
                },
            } as any,
        };

        const legalActions = buildSmashUpAiLegalActions({
            playerId: '0',
            state,
        });

        expect(legalActions.some((action) => action.kind === 'advance-phase')).toBe(false);
    });

    it('反馈 69beb069：基地已达 breakpoint 且当前玩家仍有额外随从额度时，ADVANCE_PHASE 仍应触发基地计分并完成收尾', () => {
        const initialState: MatchState<SmashUpCore> = {
            core: makeMinimalCore({
                currentPlayerIndex: 1,
                players: {
                    '0': {
                        ...makeMinimalCore().players['0'],
                        hand: [],
                        deck: [],
                        discard: [],
                        minionsPlayed: 4,
                        minionLimit: 4,
                        actionsPlayed: 1,
                        actionLimit: 1,
                        factionIds: ['innsmouth_pod', 'dinosaurs_pod'] as any,
                    } as any,
                    '1': {
                        ...makeMinimalCore().players['1'],
                        hand: [
                            { uid: 'warbot-in-hand', defId: 'robot_warbot', type: 'minion', owner: '1' },
                            { uid: 'scout-in-hand', defId: 'alien_scout', type: 'minion', owner: '1' },
                        ] as any,
                        deck: [],
                        discard: [],
                        minionsPlayed: 1,
                        minionLimit: 2,
                        actionsPlayed: 1,
                        actionLimit: 1,
                        factionIds: ['robot', 'alien'] as any,
                    } as any,
                } as any,
                bases: [
                    makeBase('base_the_homeworld', [
                        { ...makeMinion('1', 'robot_hoverbot', 3), uid: 'p1-hoverbot-a' },
                        { ...makeMinion('1', 'alien_invader', 3), uid: 'p1-invader' },
                        { ...makeMinion('1', 'alien_collector', 2), uid: 'p1-collector' },
                        { ...makeMinion('1', 'robot_zapbot', 2), uid: 'p1-zapbot' },
                        { ...makeMinion('1', 'robot_microbot_reclaimer', 1), uid: 'p1-reclaimer' },
                        { ...makeMinion('1', 'robot_hoverbot', 3), uid: 'p1-hoverbot-b' },
                        { ...makeMinion('0', 'dino_armor_stego_pod', 3), uid: 'p0-stego' },
                        { ...makeMinion('0', 'innsmouth_the_locals_pod', 2), uid: 'p0-local-a' },
                        { ...makeMinion('0', 'innsmouth_the_locals_pod', 2), uid: 'p0-local-b' },
                        { ...makeMinion('0', 'innsmouth_the_locals_pod', 2), uid: 'p0-local-c' },
                    ]),
                    makeBase('base_the_jungle'),
                ],
                baseDeck: ['base_haunted_house'],
            }),
            sys: {
                phase: 'playCards',
                turnNumber: 8,
                interaction: { current: null, queue: [] },
                responseWindow: { current: null, history: [] },
            } as any,
        };

        const legalActions = buildSmashUpAiLegalActions({
            playerId: '1',
            state: initialState as any,
        });
        expect(legalActions.some(action => action.kind === 'advance-phase')).toBe(true);

        const advanced = runCommand(initialState as any, {
            type: 'ADVANCE_PHASE',
            playerId: '1',
            payload: {},
            timestamp: 1,
        } as any);

        expect(advanced.success, advanced.error).toBe(true);
        expect(advanced.events.map(event => event.type)).toContain(SU_EVENT_TYPES.BASE_SCORED);
        expect(advanced.events.filter(event => event.type === SU_EVENT_TYPES.BASE_SCORED)).toHaveLength(1);
        expect(advanced.events.filter(event => event.type === SU_EVENT_TYPES.BASE_CLEARED)).toHaveLength(1);
        expect(advanced.events.filter(event => event.type === SU_EVENT_TYPES.BASE_REPLACED)).toHaveLength(1);
        expect((advanced.finalState.sys as any)._smashupPostScoringBaseRevealDelayUntil).toBeUndefined();
        expect(advanced.finalState.sys.phase).not.toBe('scoreBases');
        expect((advanced.finalState.sys as any).flowHalted).toBeFalsy();
        expect(advanced.finalState.core.bases[0]?.defId).toBe('base_haunted_house');
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

        expect(legalActions.some(action => action.kind === 'activate-special')).toBe(false);
        expect(legalActions.some(action => action.kind === 'advance-phase')).toBe(true);
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
                        { actorId: '0', kind: SU_EVENT_TYPES.CARDS_DISCARDED },
                        { actorId: '0', kind: SU_EVENT_TYPES.CARD_RECOVERED_FROM_DISCARD },
                        { actorId: '0', kind: SU_EVENT_TYPES.CARDS_DISCARDED },
                        { actorId: '0', kind: SU_EVENT_TYPES.CARD_RECOVERED_FROM_DISCARD },
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
            ...respondCommand('target-shinobi'),
            payload: {
                interactionId: 'wizard_sacrifice_hidden_choice',
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
        expect(['trigger-a', 'trigger-b']).toContain(
            getRespondCommandOptionId(resolution?.action.commands[0]),
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
        expect(getPromptSourceId(getSimpleChoicePrompt(played.finalState, 'robot_hoverbot'))).toBe('robot_hoverbot');

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

    it('smashup_reaction_choose 同时存在触发与高收益 afterScoring 响应牌时，AI 应优先打响应牌而不是盲选 trigger', async () => {
        registerGameAiRuntime(smashUpAiRuntime);

        const state: MatchState<SmashUpCore> = {
            core: makeMinimalCore({
                players: {
                    '0': {
                        ...makeMinimalCore().players['0'],
                        factionIds: ['giant_ants', 'aliens'] as any,
                        hand: [{
                            uid: 'c1',
                            defId: 'giant_ant_we_are_the_champions',
                            type: 'action',
                            owner: '0',
                        }] as any,
                    },
                    '1': {
                        ...makeMinimalCore().players['1'],
                        factionIds: ['ninja', 'robots'] as any,
                    },
                } as any,
                bases: [makeBase('base_the_jungle', [
                    {
                        ...makeMinion('0', 'alien_invader', 3),
                        uid: 'm1',
                        powerCounters: 7,
                    },
                    {
                        ...makeMinion('1', 'ninja_shinobi', 2),
                        uid: 'm2',
                        powerCounters: 2,
                    },
                ])],
                scoringEligibleBaseIndices: [0],
            }),
            sys: {
                phase: 'scoreBases',
                turnNumber: 1,
                interaction: {
                    current: {
                        id: 'reaction-choice-mixed-priority',
                        playerId: '0',
                        kind: 'simple-choice',
                        data: {
                            sourceId: 'smashup_reaction_choose',
                            options: [
                                {
                                    id: 'trigger-a',
                                    label: '先结算基地触发',
                                    displayMode: 'button',
                                    value: { kind: 'trigger', triggerId: 'afterScoring:base_tortuga:0:0' },
                                },
                                {
                                    id: 'play_action:c1:0',
                                    label: '我们乃最强 -> 基地 1',
                                    displayMode: 'card',
                                    value: {
                                        kind: 'play_action',
                                        playerId: '0',
                                        cardUid: 'c1',
                                        targetBaseIndex: 0,
                                    },
                                },
                                {
                                    id: 'pass',
                                    label: 'Pass',
                                    displayMode: 'button',
                                    value: { kind: 'pass' },
                                },
                            ],
                        },
                    },
                    queue: [],
                },
                responseWindow: {
                    current: {
                        id: 'afterscoring-window-mixed-priority',
                        windowType: 'afterScoring',
                        sourceId: 'smashup_reaction_choose',
                        responderQueue: ['0', '1'],
                        currentResponderIndex: 0,
                        passedPlayers: [],
                    },
                    history: [],
                },
                eventStream: { nextId: 1 },
            } as any,
        };

        const resolution = await resolveNextLocalAiAction({
            engineConfig: smashUpAiEngineConfig,
            state,
            matchId: 'smashup-reaction-choose-prefers-card-response',
            seatControllers: { '0': { type: 'local-ai' } },
        });

        expect(resolution?.playerId).toBe('0');
        expect(resolution?.action.kind).toBe('interaction-choice');
        expect((resolution?.action.commands[0]?.payload as { optionId?: string } | undefined)?.optionId)
            .toBe('play_action:c1:0');
    });

    it('smashup_reaction_choose 存在多个 trigger 时，AI 应按 live trigger 对当前计分的真实影响排序，而不是只看按钮顺序', async () => {
        registerGameAiRuntime(smashUpAiRuntime);

        const state: MatchState<SmashUpCore> = {
            core: makeMinimalCore({
                players: {
                    '0': {
                        ...makeMinimalCore().players['0'],
                        factionIds: ['pirate', 'wizard'] as any,
                    } as any,
                    '1': {
                        ...makeMinimalCore().players['1'],
                        factionIds: ['robot', 'zombie'] as any,
                    } as any,
                } as any,
                bases: [
                    makeBase('base_wizard_academy', [
                        {
                            ...makeMinion('0', 'wizard_apprentice', 2),
                            uid: 'quiet-base-minion',
                        },
                    ]),
                    makeBase('base_tortuga', [
                        {
                            ...makeMinion('0', 'pirate_first_mate', 3),
                            uid: 'scoring-base-ai-minion',
                            powerCounters: 4,
                        },
                        {
                            ...makeMinion('1', 'robot_hoverbot', 4),
                            uid: 'scoring-base-enemy-minion',
                        },
                    ]),
                ],
                scoringEligibleBaseIndices: [1],
                triggerQueue: [
                    {
                        id: 'afterScoring:quiet-base',
                        timing: 'afterScoring',
                        sourceDefId: 'wizard_apprentice',
                        sourceControllerId: '0',
                        sourceBaseIndex: 0,
                        mandatory: false,
                        resolutionClass: 'optional',
                        ownerPlayerId: '0',
                        witnessRequirement: 'inPlayAtTriggerTime',
                        witnessed: true,
                        baseIndex: 0,
                    },
                    {
                        id: 'afterScoring:scoring-base',
                        timing: 'afterScoring',
                        sourceDefId: 'pirate_first_mate',
                        sourceControllerId: '0',
                        sourceBaseIndex: 1,
                        mandatory: false,
                        resolutionClass: 'optional',
                        ownerPlayerId: '0',
                        witnessRequirement: 'inPlayAtTriggerTime',
                        witnessed: true,
                        baseIndex: 1,
                    },
                ] as any,
            }),
            sys: {
                phase: 'scoreBases',
                turnNumber: 1,
                interaction: {
                    current: {
                        id: 'reaction-choice-trigger-priority',
                        playerId: '0',
                        kind: 'simple-choice',
                        data: {
                            sourceId: 'smashup_reaction_choose',
                            options: [
                                {
                                    id: 'trigger-quiet-base',
                                    label: '先结算普通基地触发',
                                    displayMode: 'button',
                                    value: { kind: 'trigger', triggerId: 'afterScoring:quiet-base' },
                                },
                                {
                                    id: 'trigger-scoring-base',
                                    label: '先结算当前计分基地触发',
                                    displayMode: 'button',
                                    value: { kind: 'trigger', triggerId: 'afterScoring:scoring-base' },
                                },
                                {
                                    id: 'pass',
                                    label: 'Pass',
                                    displayMode: 'button',
                                    value: { kind: 'pass' },
                                },
                            ],
                        },
                    },
                    queue: [],
                },
                responseWindow: {
                    current: {
                        id: 'afterscoring-window-trigger-priority',
                        windowType: 'afterScoring',
                        sourceId: 'smashup_reaction_choose',
                        responderQueue: ['0', '1'],
                        currentResponderIndex: 0,
                        passedPlayers: [],
                    },
                    history: [],
                },
                eventStream: { nextId: 1 },
            } as any,
        };

        const resolution = await resolveNextLocalAiAction({
            engineConfig: smashUpAiEngineConfig,
            state,
            matchId: 'smashup-reaction-choose-prefers-live-scoring-trigger',
            seatControllers: { '0': { type: 'local-ai' } },
        });

        expect(resolution?.playerId).toBe('0');
        expect(resolution?.action.kind).toBe('interaction-choice');
        expect((resolution?.action.commands[0]?.payload as { optionId?: string } | undefined)?.optionId)
            .toBe('trigger-scoring-base');
    });

    it('smashup_reaction_choose 从持久化恢复后只剩失效 special 快照时，AI 应按 live session 直接选择 pass', async () => {
        registerGameAiRuntime(smashUpAiRuntime);
        registerArcaneProtectorSpecialForTests();

        const state = createPersistedStaleReactionChoiceState();
        const legalActions = buildSmashUpAiLegalActions({
            playerId: '1',
            state: state as any,
        });

        expect(legalActions).toHaveLength(1);
        expect(legalActions[0]?.kind).toBe('interaction-choice');
        expect((legalActions[0]?.commands[0]?.payload as { optionId?: string } | undefined)?.optionId).toBe('pass');

        const resolution = await resolveNextLocalAiAction({
            engineConfig: smashUpAiEngineConfig,
            state,
            matchId: 'smashup-persisted-stale-reaction-choice',
            seatControllers: { '1': { type: 'local-ai' } },
        });

        expect(resolution?.playerId).toBe('1');
        expect(resolution?.action.kind).toBe('interaction-choice');
        expect((resolution?.action.commands[0]?.payload as { optionId?: string } | undefined)?.optionId).toBe('pass');
    });

    it('smashup_reaction_choose 实时会话候选为空但快照仍有 pass 时，AI 应选择 pass 而不是应急取消', () => {
        const baseState: MatchState<SmashUpCore> = {
            core: makeMinimalCore({
                currentPlayerIndex: 0,
                turnOrder: ['0', '1', '2'],
            }),
            sys: {
                phase: 'scoreBases',
                interaction: { current: undefined, queue: [] },
                responseWindow: { history: [] },
                eventStream: { nextId: 1 },
            } as any,
        };
        const sessionState = startSmashUpReactionSession(baseState, {
            frameId: 'onMinionDiscardedFromBase:onMinionDiscardedFromBase:0_1_0',
            frameKind: 'score-after',
            phase: 'mandatory',
            activePlayerId: '1',
            currentPlayerId: '0',
            responseWindowType: 'afterScoring',
        });
        const state: MatchState<SmashUpCore> = {
            ...sessionState,
            sys: {
                ...sessionState.sys,
                interaction: {
                    current: createSimpleChoice(
                        'smashup_reaction_onMinionDiscardedFromBase:onMinionDiscardedFromBase:0_1_0',
                        '1',
                        '选择一个反应动作',
                        [
                            {
                                id: 'trigger:onMinionDiscardedFromBase:time_travelers_jumper_pod:onMinionDiscardedFromBase:0:0',
                                label: '跳跃者',
                                displayMode: 'button',
                                value: {
                                    kind: 'trigger',
                                    triggerId: 'onMinionDiscardedFromBase:time_travelers_jumper_pod:onMinionDiscardedFromBase:0:0',
                                },
                            },
                            {
                                id: 'pass',
                                label: 'Pass',
                                displayMode: 'button',
                                value: { kind: 'pass' },
                            },
                        ],
                        {
                            sourceId: 'smashup_reaction_choose',
                            targetType: 'field-source-action',
                            responseValidationMode: 'live',
                        },
                    ),
                    queue: [],
                },
            } as any,
        };

        const legalActions = buildSmashUpAiLegalActions({
            playerId: '1',
            state: state as any,
        });

        expect(legalActions).toHaveLength(1);
        expect(legalActions[0]?.kind).toBe('interaction-choice');
        expect((legalActions[0]?.commands[0]?.payload as { optionId?: string } | undefined)?.optionId).toBe('pass');
    });

    it('smashup_reaction_choose 响应持久化后的失效 special 快照时，应按当前 live 语义正规化并直接收口', () => {
        registerArcaneProtectorSpecialForTests();
        const state = createPersistedStaleReactionChoiceState();
        const runtimeState = withoutQueuedPrompts(withoutCurrentPrompt(state));

        const resolved = resolveSmashUpReactionChoice(runtimeState, defaultTestRandom, 7, {
            kind: 'activate_special',
            playerId: '1',
            titanUid: 'titan_1_wizards_arcane_protector',
            baseIndex: 0,
        });

        expect(getSmashUpReactionSession(resolved.state)).toBeUndefined();
        expectNoPrompt(resolved.state);
        expect(resolved.events).toHaveLength(0);
    });

    it('smashup_reaction_choose 不应暴露仅限 playCards 的重复泰坦 special 候选', () => {
        registerArcaneProtectorSpecialForTests();
        const initialState = {
            core: makeMinimalCore({
                players: {
                    '0': {
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
                    },
                    '1': {
                        id: '1',
                        factionIds: ['wizard'],
                        hand: [],
                        deck: [],
                        discard: [],
                        vp: 0,
                        minionsPlayed: 0,
                        minionLimit: 1,
                        actionsPlayed: 0,
                        actionLimit: 1,
                    },
                },
                bases: [makeBase('base_wizard_academy', [
                    makeMinion('1', 'wizard_apprentice', 2),
                ])],
                cardsPlayedThisTurn: 5,
                scoringEligibleBaseIndices: [0],
                titans: [
                    {
                        uid: 'titan_1_wizards_arcane_protector',
                        defId: 'wizards_arcane_protector',
                        faction: 'wizard',
                        ownerId: '1',
                        controllerId: '1',
                        powerCounters: 0,
                        talentUsed: false,
                        location: { zone: 'setaside' },
                    },
                    {
                        uid: 'titan_1_wizards_arcane_protector',
                        defId: 'wizards_arcane_protector',
                        faction: 'wizard',
                        ownerId: '1',
                        controllerId: '1',
                        powerCounters: 0,
                        talentUsed: false,
                        location: { zone: 'setaside' },
                    },
                ] as any,
            }),
            sys: {
                phase: 'scoreBases',
                interaction: { current: undefined, queue: [] },
                responseWindow: {
                    current: {
                        id: 'reaction-window-duplicate-titan',
                        windowType: 'afterScoring',
                        sourceId: 'smashup_reaction_choose',
                        responderQueue: ['0', '1'],
                        currentResponderIndex: 1,
                        passedPlayers: [],
                    },
                    history: [],
                },
                eventStream: { nextId: 1 },
            } as any,
        } as MatchState<SmashUpCore>;
        const baseRef = createScoringBaseRef(initialState.core, 0);
        if (!baseRef) {
            throw new Error('无法构造 duplicate titan reaction 的 scoring base ref');
        }
        const scoringState = setScoringSession(initialState, {
            ...createScoringSession(initialState.core, [0]),
            currentBaseRef: baseRef,
            currentStep: 'awaiting-response-window',
        });
        const state = startSmashUpReactionSession(scoringState, {
            frameId: 'duplicate-titan-reaction',
            frameKind: 'score-before',
            phase: 'optional',
            activePlayerId: '1',
            currentPlayerId: '0',
            consecutivePasses: 0,
            responseWindowType: 'afterScoring',
        });

        const session = getSmashUpReactionSession(state);
        expect(session).toBeDefined();

        const options = buildReactionOptions(state, session!, 7);
        const specialOptions = options.filter((option) =>
            option.value.kind === 'activate_special'
            && option.value.titanUid === 'titan_1_wizards_arcane_protector',
        );

        expect(specialOptions).toHaveLength(0);
        expect(options.filter((option) => option.value.kind === 'pass')).toHaveLength(1);
    });

    it('afterScoring 当前结算基地即使已不在 eligible 列表，live reaction 仍应暴露其 special', () => {
        registerGameAiRuntime(smashUpAiRuntime);
        initAllAbilities();

        const initialState = {
            core: makeMinimalCore({
                currentPlayerIndex: 1,
                players: {
                    '0': {
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
                    },
                    '1': {
                        id: '1',
                        factionIds: ['wizard'],
                        hand: [],
                        deck: [],
                        discard: [],
                        vp: 0,
                        minionsPlayed: 0,
                        minionLimit: 1,
                        actionsPlayed: 0,
                        actionLimit: 1,
                    },
                },
                bases: [
                    makeBase('base_wizard_academy', [{
                        uid: 'pink-1',
                        defId: 'mega_troopers_pink_trooper',
                        owner: '1',
                        controller: '1',
                        basePower: 3,
                        powerCounters: 0,
                        powerModifier: 0,
                        tempPowerModifier: 0,
                        talentUsed: false,
                        attachedActions: [],
                    }]),
                    makeBase('base_pirate_cove', [makeMinion('0', 'robot_hoverbot', 3)]),
                ],
                scoringEligibleBaseIndices: [1],
            }),
            sys: {
                phase: 'scoreBases',
                interaction: { current: undefined, queue: [] },
                responseWindow: {
                    current: {
                        id: 'reaction-window-current-base-not-eligible',
                        windowType: 'afterScoring',
                        sourceId: 'smashup_reaction_choose',
                        responderQueue: ['0', '1'],
                        currentResponderIndex: 1,
                        passedPlayers: [],
                    },
                    history: [],
                },
                eventStream: { nextId: 1 },
            } as any,
        } as MatchState<SmashUpCore>;
        const baseRef = createScoringBaseRef(initialState.core, 0);
        if (!baseRef) {
            throw new Error('无法构造 current-base-not-eligible reaction 的 scoring base ref');
        }
        const scoringState = setScoringSession(initialState, {
            ...createScoringSession(initialState.core, [0, 1]),
            currentBaseRef: baseRef,
            currentStep: 'awaiting-response-window',
        });
        const state = startSmashUpReactionSession(scoringState, {
            frameId: 'current-base-not-eligible-reaction',
            frameKind: 'score-after',
            phase: 'optional',
            activePlayerId: '1',
            currentPlayerId: '1',
            consecutivePasses: 0,
            responseWindowType: 'afterScoring',
        });

        const session = getSmashUpReactionSession(state);
        expect(session).toBeDefined();

        const options = buildReactionOptions(state, session!, 7);
        const specialOptions = options.filter((option) =>
            option.value.kind === 'activate_special'
            && option.value.minionUid === 'pink-1',
        );

        expect(specialOptions).toHaveLength(1);
        expect(specialOptions[0]?.value.baseIndex).toBe(0);
        expect(
            specialOptions.some((option) => option.value.baseIndex === 1),
        ).toBe(false);
    });

    it('wizards_arcane_protector 已进场后，afterScoring live 反应不应继续暴露其 special', async () => {
        registerGameAiRuntime(smashUpAiRuntime);
        initAllAbilities();
        registerArcaneProtectorSpecialForTests();

        const initialState = {
            core: makeMinimalCore({
                players: {
                    '0': {
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
                    },
                    '1': {
                        id: '1',
                        factionIds: ['wizard'],
                        hand: [],
                        deck: [],
                        discard: [],
                        vp: 0,
                        minionsPlayed: 0,
                        minionLimit: 1,
                        actionsPlayed: 0,
                        actionLimit: 1,
                    },
                },
                bases: [makeBase('base_wizard_academy', [
                    makeMinion('1', 'wizard_apprentice', 2),
                ])],
                cardsPlayedThisTurn: 5,
                scoringEligibleBaseIndices: [0],
                titans: [{
                    uid: 'titan_1_wizards_arcane_protector',
                    defId: 'wizards_arcane_protector',
                    faction: 'wizard',
                    ownerId: '1',
                    controllerId: '1',
                    powerCounters: 0,
                    talentUsed: false,
                    location: { zone: 'base', baseIndex: 0 },
                }] as any,
            }),
            sys: {
                phase: 'scoreBases',
                interaction: { current: undefined, queue: [] },
                responseWindow: {
                    current: {
                        id: 'reaction-window-live-titan-in-play',
                        windowType: 'afterScoring',
                        sourceId: 'smashup_reaction_choose',
                        responderQueue: ['0', '1'],
                        currentResponderIndex: 1,
                        passedPlayers: [],
                    },
                    history: [],
                },
                eventStream: { nextId: 1 },
            } as any,
        } as MatchState<SmashUpCore>;
        const baseRef = createScoringBaseRef(initialState.core, 0);
        if (!baseRef) {
            throw new Error('无法构造 live titan reaction 的 scoring base ref');
        }
        const scoringState = setScoringSession(initialState, {
            ...createScoringSession(initialState.core, [0]),
            currentBaseRef: baseRef,
            currentStep: 'awaiting-response-window',
        });
        const state = startSmashUpReactionSession(scoringState, {
            frameId: 'live-titan-in-play-reaction',
            frameKind: 'score-after',
            phase: 'optional',
            activePlayerId: '1',
            currentPlayerId: '0',
            consecutivePasses: 0,
            responseWindowType: 'afterScoring',
        });

        const session = getSmashUpReactionSession(state);
        expect(session).toBeDefined();

        const options = buildReactionOptions(state, session!, 7);
        expect(options.filter((option) => option.value.kind === 'activate_special')).toHaveLength(0);
        expect(options.filter((option) => option.value.kind === 'pass')).toHaveLength(1);

        const resolution = await resolveNextLocalAiAction({
            engineConfig: smashUpAiEngineConfig,
            state,
            matchId: 'smashup-live-titan-in-play-reaction',
            seatControllers: { '1': { type: 'local-ai' } },
        });

        expect(resolution?.playerId).toBe('1');
        expect(resolution?.action.kind).toBe('response-pass');
        expect(resolution?.action.commands[0]?.type).toBe(SU_COMMANDS.REACTION_PASS);
    });

    it('afterScoring live session 丢失镜像 responseWindow 后，AI 仍不应误暴露 advance-phase', () => {
        registerGameAiRuntime(smashUpAiRuntime);
        initAllAbilities();

        const initialState = {
            core: makeMinimalCore({
                currentPlayerIndex: 1,
                players: {
                    '0': {
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
                    },
                    '1': {
                        id: '1',
                        factionIds: ['wizard'],
                        hand: [],
                        deck: [],
                        discard: [],
                        vp: 0,
                        minionsPlayed: 0,
                        minionLimit: 1,
                        actionsPlayed: 0,
                        actionLimit: 1,
                    },
                },
                bases: [
                    makeBase('base_wizard_academy', [{
                        uid: 'pink-1',
                        defId: 'mega_troopers_pink_trooper',
                        owner: '1',
                        controller: '1',
                        basePower: 3,
                        powerCounters: 0,
                        powerModifier: 0,
                        tempPowerModifier: 0,
                        talentUsed: false,
                        attachedActions: [],
                    }]),
                    makeBase('base_pirate_cove', [makeMinion('0', 'robot_hoverbot', 3)]),
                ],
                scoringEligibleBaseIndices: [1],
            }),
            sys: {
                phase: 'scoreBases',
                interaction: { current: undefined, queue: [] },
                responseWindow: {
                    current: {
                        id: 'reaction-window-missing-mirror',
                        windowType: 'afterScoring',
                        sourceId: 'smashup_reaction_choose',
                        responderQueue: ['0', '1'],
                        currentResponderIndex: 1,
                        passedPlayers: [],
                    },
                    history: [],
                },
                eventStream: { nextId: 1 },
            } as any,
        } as MatchState<SmashUpCore>;
        const baseRef = createScoringBaseRef(initialState.core, 0);
        if (!baseRef) {
            throw new Error('无法构造 missing-mirror reaction 的 scoring base ref');
        }
        const scoringState = setScoringSession(initialState, {
            ...createScoringSession(initialState.core, [0, 1]),
            currentBaseRef: baseRef,
            currentStep: 'awaiting-response-window',
        });
        const sessionState = startSmashUpReactionSession(scoringState, {
            frameId: 'missing-mirror-reaction',
            frameKind: 'score-after',
            phase: 'optional',
            activePlayerId: '1',
            currentPlayerId: '1',
            consecutivePasses: 0,
            responseWindowType: 'afterScoring',
        });
        const state = {
            ...sessionState,
            sys: {
                ...sessionState.sys,
                interaction: { current: undefined, queue: [] },
                responseWindow: { current: undefined, history: [] },
            },
        } as MatchState<SmashUpCore>;

        const legalActions = buildSmashUpAiLegalActions({
            playerId: '1',
            state: state as any,
        });

        expect(legalActions.some((action) => action.kind === 'advance-phase')).toBe(false);
        const specialAction = legalActions.find((action) =>
            action.kind === 'activate-special'
            && (action.metadata as { minionUid?: string }).minionUid === 'pink-1',
        );
        expect(specialAction).toBeDefined();
        expect((specialAction?.metadata as { baseIndex?: number; scoringBase?: boolean })).toMatchObject({
            baseIndex: 0,
            scoringBase: true,
        });
    });

    it('afterScoring live session 丢失镜像且没有可用动作时，AI 也不能暴露 advance-phase', () => {
        const initialState = {
            core: makeMinimalCore({
                currentPlayerIndex: 1,
                bases: [
                    makeBase('base_pirate_cove', [
                        makeMinion('0', 'robot_hoverbot', 4),
                    ]),
                ],
                scoringEligibleBaseIndices: [0],
            }),
            sys: {
                phase: 'scoreBases',
                interaction: { current: undefined, queue: [] },
                responseWindow: {
                    current: {
                        id: 'reaction-window-missing-mirror-no-actions',
                        windowType: 'afterScoring',
                        sourceId: 'smashup_reaction_choose',
                        responderQueue: ['0', '1'],
                        currentResponderIndex: 1,
                        passedPlayers: [],
                    },
                    history: [],
                },
                eventStream: { nextId: 1 },
            } as any,
        } as MatchState<SmashUpCore>;
        const baseRef = createScoringBaseRef(initialState.core, 0);
        if (!baseRef) {
            throw new Error('无法构造 missing-mirror-no-actions reaction 的 scoring base ref');
        }
        const scoringState = setScoringSession(initialState, {
            ...createScoringSession(initialState.core, [0]),
            currentBaseRef: baseRef,
            currentStep: 'awaiting-response-window',
        });
        const sessionState = startSmashUpReactionSession(scoringState, {
            frameId: 'missing-mirror-no-actions-reaction',
            frameKind: 'score-after',
            phase: 'optional',
            activePlayerId: '1',
            currentPlayerId: '1',
            consecutivePasses: 0,
            responseWindowType: 'afterScoring',
        });
        const state = {
            ...sessionState,
            sys: {
                ...sessionState.sys,
                interaction: { current: undefined, queue: [] },
                responseWindow: { current: undefined, history: [] },
            },
        } as MatchState<SmashUpCore>;

        const legalActions = buildSmashUpAiLegalActions({
            playerId: '1',
            state: state as any,
        });

        expect(getSmashUpReactionSession(state)).toBeDefined();
        expect(legalActions.some((action) => action.kind === 'advance-phase')).toBe(false);
    });

    it('AI 在计分阶段仅存在 playCards-only 泰坦 special 时应暴露 advance-phase', () => {
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
        )).toBe(false);
        expect(legalActions.some(action => action.kind === 'advance-phase')).toBe(true);
    });

    it('AI 在计分阶段打出泰坦后，若已无后续 special，应恢复暴露 advance-phase 收口', () => {
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
                    location: { zone: 'base', baseIndex: 0 },
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

        expect(legalActions.some(action => action.kind === 'activate-special')).toBe(false);
        expect(legalActions.some(action => action.kind === 'advance-phase')).toBe(true);
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
                    makeMinion('0', 'robot_warbot', 20),
                    makeMinion('1', 'pirate_first_mate', 2),
                ]),
                makeBase('base_egg_chamber', [
                    makeMinion('0', 'robot_microbot_alpha', 9),
                    makeMinion('1', 'pirate_king', 8),
                ]),
            ],
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

        const choice = getSimpleChoicePrompt(updatedState, 'multi_base_scoring');
        expect(getPromptSourceId(choice)).toBe('multi_base_scoring');

        const option0 = getPromptOption(choice, (option: any) => option.value?.baseIndex === 0, 'base 0 scoring option');
        const option1 = getPromptOption(choice, (option: any) => option.value?.baseIndex === 1, 'base 1 scoring option');
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

    it('线上反馈 69ff0cd0：AI 出牌阶段无可用出牌时应自动结束阶段', async () => {
        registerGameAiRuntime(smashUpAiRuntime);

        const state: MatchState<SmashUpCore> = {
            core: makeMinimalCore({
                currentPlayerIndex: 1,
                turnOrder: ['0', '1', '2', '3'],
                players: {
                    '0': {
                        ...makeMinimalCore().players['0'],
                        factions: ['tricksters', 'aliens'],
                    },
                    '1': {
                        ...makeMinimalCore().players['1'],
                        factions: ['robots', 'elder_things'],
                        hand: [
                            { uid: 'c65', defId: 'elder_thing_mi_go', type: 'minion', owner: '1' },
                            { uid: 'c54', defId: 'robot_microbot_guard', type: 'minion', owner: '1' },
                            { uid: 'c51', defId: 'robot_microbot_reclaimer', type: 'minion', owner: '1' },
                            { uid: 'c52', defId: 'robot_microbot_reclaimer', type: 'minion', owner: '1' },
                            { uid: 'c66', defId: 'elder_thing_mi_go', type: 'minion', owner: '1' },
                            { uid: 'c58', defId: 'robot_microbot_fixer', type: 'minion', owner: '1' },
                            { uid: 'c68', defId: 'elder_thing_byakhee', type: 'minion', owner: '1' },
                            { uid: 'c62', defId: 'elder_thing_shoggoth', type: 'minion', owner: '1' },
                        ] as any,
                        discard: [
                            { uid: 'c60', defId: 'robot_tech_center', type: 'action', owner: '1' },
                            { uid: 'c57', defId: 'robot_microbot_fixer', type: 'minion', owner: '1' },
                        ] as any,
                        minionsPlayed: 2,
                        minionLimit: 2,
                        actionsPlayed: 0,
                        actionLimit: 1,
                    },
                    '2': {
                        ...makeMinimalCore().players['1'],
                        id: '2',
                        factions: ['killer_plants', 'steampunks'],
                    },
                    '3': {
                        ...makeMinimalCore().players['1'],
                        id: '3',
                        factions: ['wizards', 'zombies'],
                    },
                },
                bases: [
                    makeBase('base_the_factory', [
                        makeMinion('3', 'wizard_chronomage', 3),
                    ]),
                    makeBase('base_rhodes_plaza', [
                        makeMinion('0', 'alien_collector', 2),
                    ]),
                    makeBase('base_great_library', [
                        makeMinion('1', 'elder_thing_byakhee', 2),
                    ]),
                    makeBase('base_the_asylum', []),
                    makeBase('base_the_mothership', [
                        makeMinion('3', 'wizard_neophyte', 2),
                        makeMinion('1', 'robot_zapbot', 2),
                        makeMinion('1', 'elder_thing_byakhee', 2),
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
            playerId: '1',
            state: state as any,
        });

        expect(legalActions.some((action) => action.kind === 'play-minion')).toBe(false);
        expect(legalActions.some((action) => action.kind === 'advance-phase')).toBe(true);

        const resolution = await resolveNextLocalAiAction({
            engineConfig: smashUpAiEngineConfig,
            state: state as any,
            matchId: 'feedback-69ff0cd0-ai-stalled-playcards',
            seatControllers: { '1': { type: 'local-ai' } },
        });

        expect(resolution?.playerId).toBe('1');
        expect(resolution?.action.kind).toBe('advance-phase');
        expect(resolution?.action.commands).toEqual([
            { type: 'ADVANCE_PHASE', payload: {} },
        ]);
    });
});
