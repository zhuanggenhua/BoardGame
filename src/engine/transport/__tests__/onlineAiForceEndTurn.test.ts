import { describe, expect, it } from 'vitest';
import { resolveForceEndTurnForStalledAi } from '../onlineAiRecovery';
import smashUpEngineConfig from '../../../games/smashup/game';
import diceThroneEngineConfig from '../../../games/dicethrone/game';
import { createOnlineAiRecoveryState } from './helpers/serverTestHarness';

describe('resolveForceEndTurnForStalledAi（action-loop）', () => {
    it('重复交替动作循环应触发 action-loop 兜底', () => {
        const sharedState = createOnlineAiRecoveryState({
            activePlayerId: '1',
            phase: 'main1',
        }).G as any;

        sharedState.sys = {
            ...sharedState.sys,
            actionLog: {
                maxEntries: 50,
                entries: [
                    { actorId: '1', kind: 'DISCARD_CARD' },
                    { actorId: '1', kind: 'UNDO_SELL_CARD' },
                    { actorId: '1', kind: 'DISCARD_CARD' },
                    { actorId: '1', kind: 'UNDO_SELL_CARD' },
                ],
            },
        };

        const candidate = resolveForceEndTurnForStalledAi({
            sharedState,
            seatControllers: {
                '0': { type: 'human' },
                '1': { type: 'local-ai' },
            },
            seatStates: {},
            engineConfig: smashUpEngineConfig,
            gameId: 'smashup',
        });

        expect(candidate?.reason).toBe('active-turn');
        expect(candidate?.resolution.action.commands[0]?.type).toBe('ADVANCE_PHASE');
    });

    it('visible simple-choice 若存在 smashup reaction pass 选项，应优先 force pass 而不是 cancel', () => {
        const sharedState = createOnlineAiRecoveryState({
            activePlayerId: '1',
            phase: 'scoreBases',
            interaction: {
                current: {
                    id: 'reaction-order-choice',
                    kind: 'simple-choice',
                    playerId: '1',
                    data: {
                        sourceId: 'smashup_reaction_choose',
                        title: '选择一个反应动作',
                        options: [
                            {
                                id: 'trigger-a',
                                label: '先结算触发 A',
                                value: { kind: 'trigger', triggerId: 'afterScoring:base_a:1:0' },
                            },
                            {
                                id: 'pass',
                                label: 'Pass',
                                value: { kind: 'pass' },
                            },
                        ],
                    },
                },
                queue: [],
                isBlocked: false,
            },
        }).G as any;

        const candidate = resolveForceEndTurnForStalledAi({
            sharedState,
            seatControllers: {
                '0': { type: 'human' },
                '1': { type: 'local-ai' },
            },
            seatStates: {},
            engineConfig: smashUpEngineConfig,
            gameId: 'smashup',
        });

        expect(candidate?.reason).toBe('visible-interaction');
        expect(candidate?.requiresConfirmedAdvancePhase).toBe(true);
        expect(candidate?.resolution.action.commands[0]).toEqual({
            type: 'SYS_INTERACTION_RESPOND',
            payload: { interactionId: 'reaction-order-choice', optionId: 'pass' },
        });
    });

    it('smashup mandatory reaction ordering falls back to first trigger instead of cancel', () => {
        const sharedState = createOnlineAiRecoveryState({
            activePlayerId: '1',
            phase: 'scoreBases',
            interaction: {
                current: {
                    id: 'mandatory-reaction-order-choice',
                    kind: 'simple-choice',
                    playerId: '1',
                    data: {
                        sourceId: 'smashup_reaction_choose',
                        title: '??????????',
                        options: [
                            {
                                id: 'trigger-base-arena',
                                label: '???',
                                value: { kind: 'trigger', triggerId: 'trigger:onMinionPlayed:base_arena:1777092533686:0' },
                            },
                            {
                                id: 'trigger-wizard-archmage',
                                label: '???',
                                value: { kind: 'trigger', triggerId: 'trigger:onMinionPlayed:wizard_archmage:1777092533686:0' },
                            },
                        ],
                    },
                },
                queue: [],
                isBlocked: false,
            },
        }).G as any;

        const candidate = resolveForceEndTurnForStalledAi({
            sharedState,
            seatControllers: {
                '0': { type: 'human' },
                '1': { type: 'local-ai' },
            },
            seatStates: {},
            engineConfig: smashUpEngineConfig,
            gameId: 'smashup',
        });

        expect(candidate?.reason).toBe('visible-interaction');
        expect(candidate?.requiresConfirmedAdvancePhase).toBe(true);
        expect(candidate?.resolution.action.commands[0]).toEqual({
            type: 'SYS_INTERACTION_RESPOND',
            payload: { interactionId: 'mandatory-reaction-order-choice', optionId: 'trigger-base-arena' },
        });
    });

    it('DiceThrone targetingRoll 应标记为 legal-only，而不是裸 ADVANCE_PHASE 兜底', () => {
        const sharedState = createOnlineAiRecoveryState({
            activePlayerId: '1',
            phase: 'targetingRoll',
        }).G as any;

        sharedState.core = {
            ...sharedState.core,
            rollCount: 0,
            rollConfirmed: false,
        };

        const candidate = resolveForceEndTurnForStalledAi({
            sharedState,
            seatControllers: {
                '0': { type: 'human' },
                '1': { type: 'local-ai' },
            },
            seatStates: {},
            engineConfig: diceThroneEngineConfig,
            gameId: 'dicethrone',
        });

        expect(candidate?.reason).toBe('active-turn-legal-only');
        expect(candidate?.legalActionOnly).toBe(true);
        expect(candidate?.resolution.action.commands).toEqual([]);
    });

    it('DiceThrone afterRollConfirmed 当前响应者为 human 且当前回合属于 AI 时，自动 watchdog 不应代替真人强关响应窗口', () => {
        const sharedState = {
            core: {
                activePlayerId: '3',
                currentPlayerIndex: 3,
                turnOrder: ['0', '1', '2', '3'],
            },
            sys: {
                phase: 'offensiveRoll',
                turnNumber: 8,
                eventStream: { nextId: 42 },
                interaction: {
                    current: undefined,
                    queue: [],
                    isBlocked: false,
                },
                responseWindow: {
                    current: {
                        id: 'rw-after-roll-human-1',
                        sourceId: 'attack-roll-1',
                        windowType: 'afterRollConfirmed',
                        responderQueue: ['0'],
                        currentResponderIndex: 0,
                    },
                },
            },
        } as any;

        const candidate = resolveForceEndTurnForStalledAi({
            sharedState,
            seatControllers: {
                '0': { type: 'human' },
                '1': { type: 'local-ai' },
                '2': { type: 'local-ai' },
                '3': { type: 'local-ai' },
            },
            seatStates: {},
        });

        expect(candidate).toBeNull();
    });

    it('DiceThrone afterCardPlayed 存在 pendingInteractionId 锁时，应优先检查 hidden interaction 而不是退成 RESPONSE_PASS', () => {
        const sharedState = createOnlineAiRecoveryState({
            activePlayerId: '0',
            phase: 'main1',
            interaction: {
                current: undefined,
                queue: [],
                isBlocked: false,
            },
                responseWindow: {
                    current: {
                        id: 'rw-after-card-hidden-1',
                        sourceId: 'action-poison-tip',
                        windowType: 'afterCardPlayed',
                        responderQueue: ['1'],
                        currentResponderIndex: 0,
                        passedPlayers: [],
                        pendingInteractionId: 'card-bye-bye-1777601349600',
                    },
                },
            }).G as any;

        const seatState = createOnlineAiRecoveryState({
            activePlayerId: '0',
            phase: 'main1',
            interaction: {
                current: {
                    id: 'card-bye-bye-1777601349600',
                    kind: 'simple-choice',
                    playerId: '1',
                    data: {
                        sourceId: 'card-bye-bye',
                        title: '选择要移除的状态效果',
                        options: [
                            { id: 'skip', label: '跳过', value: { skip: true } },
                        ],
                    },
                },
                queue: [],
                isBlocked: false,
            },
            responseWindow: sharedState.sys.responseWindow,
        }).G as any;

        const candidate = resolveForceEndTurnForStalledAi({
            sharedState,
            seatControllers: {
                '0': { type: 'human' },
                '1': { type: 'local-ai' },
            },
            seatStates: {
                '1': seatState,
            },
        });

        expect(candidate?.reason).toBe('hidden-interaction');
        expect(candidate?.requiresConfirmedAdvancePhase).toBe(true);
        expect(candidate?.resolution.action.commands[0]).toEqual({
            type: 'SYS_INTERACTION_RESPOND',
            payload: { interactionId: 'card-bye-bye-1777601349600', optionId: 'skip' },
        });
    });

    it('DiceThrone response window 仍被 pendingInteractionId 锁住且没有私有交互时，应强制关窗而不是退成 RESPONSE_PASS', () => {
        const sharedState = createOnlineAiRecoveryState({
            activePlayerId: '1',
            phase: 'defensiveRoll',
            interaction: {
                current: undefined,
                queue: [],
                isBlocked: false,
            },
            responseWindow: {
                current: {
                    id: 'after-attack-resolved-window-locked-1',
                    windowType: 'afterAttackResolved',
                    sourceId: 'barbarian-rage',
                    responderQueue: ['1'],
                    currentResponderIndex: 0,
                    pendingInteractionId: 'dt-hidden-after-attack-choice',
                },
            },
        }).G as any;

        const candidate = resolveForceEndTurnForStalledAi({
            sharedState,
            seatControllers: {
                '0': { type: 'human' },
                '1': { type: 'local-ai' },
            },
            seatStates: {},
        });

        expect(candidate?.reason).toBe('response-window');
        expect(candidate?.requiresConfirmedAdvancePhase).toBe(true);
        expect(candidate?.resolution.action.commands[0]).toEqual({
            type: 'SYS_RESPONSE_WINDOW_FORCE_CLOSE',
            payload: {},
        });
        expect(candidate?.resolution.action.commands.some((command) => command.type === 'RESPONSE_PASS')).toBe(false);
    });

    it('DiceThrone afterAttackResolved 未显式暴露 pendingInteractionId，但当前响应者 seat view 已有私有交互时，也应优先检查 hidden interaction', () => {
        const sharedState = createOnlineAiRecoveryState({
            activePlayerId: '1',
            phase: 'defensiveRoll',
            interaction: {
                current: undefined,
                queue: [],
                isBlocked: false,
            },
            responseWindow: {
                current: {
                    id: 'after-attack-resolved-window-1',
                    windowType: 'afterAttackResolved',
                    sourceId: 'barbarian-rage',
                    responderQueue: ['1'],
                    currentResponderIndex: 0,
                },
            },
        }).G as any;

        const seatState = createOnlineAiRecoveryState({
            activePlayerId: '1',
            phase: 'defensiveRoll',
            interaction: {
                current: {
                    id: 'dt-hidden-after-attack-choice',
                    kind: 'simple-choice',
                    playerId: '1',
                    data: {
                        sourceId: 'barbarian-rage',
                        title: '选择攻击后的额外效果',
                        options: [
                            { id: 'skip', label: '跳过', value: { skip: true } },
                        ],
                    },
                },
                queue: [],
                isBlocked: false,
            },
            responseWindow: sharedState.sys.responseWindow,
        }).G as any;

        const candidate = resolveForceEndTurnForStalledAi({
            sharedState,
            seatControllers: {
                '0': { type: 'human' },
                '1': { type: 'local-ai' },
            },
            seatStates: {
                '1': seatState,
            },
        });

        expect(candidate?.reason).toBe('hidden-interaction');
        expect(candidate?.requiresConfirmedAdvancePhase).toBe(true);
        expect(candidate?.resolution.action.commands[0]).toEqual({
            type: 'SYS_INTERACTION_RESPOND',
            payload: { interactionId: 'dt-hidden-after-attack-choice', optionId: 'skip' },
        });
    });

    it('DiceThrone 非战斗阶段遗留 displayOnly 奖励骰时，应直接代 AI 收口而不是放任残留', () => {
        const sharedState = createOnlineAiRecoveryState({
            activePlayerId: '0',
            phase: 'main1',
            interaction: {
                current: undefined,
                queue: [],
                isBlocked: false,
            },
            responseWindow: {
                current: undefined,
            },
        }).G as any;

        sharedState.core = {
            ...sharedState.core,
            pendingAttack: undefined,
            pendingBonusDiceSettlement: {
                id: 'bounty-hunter-display-1',
                attackerId: '1',
                displayOnly: true,
                dice: [{ index: 0, value: 6 }],
            },
        };

        const candidate = resolveForceEndTurnForStalledAi({
            sharedState,
            seatControllers: {
                '0': { type: 'human' },
                '1': { type: 'local-ai' },
            },
            seatStates: {},
            engineConfig: diceThroneEngineConfig,
            gameId: 'dicethrone',
        });

        expect(candidate?.reason).toBe('seat-legal-only');
        expect(candidate?.playerId).toBe('1');
        expect(candidate?.fingerprintHint).toContain('display-only-bonus:1:main1:bounty-hunter-display-1');
        expect(candidate?.resolution.action.commands).toEqual([
            { type: 'CONFIRM_ROLL', payload: {} },
        ]);
    });

    it('summonerwars pregame 中 AI 已选阵营且已 ready、仅等待 human host 时，不应误判为 active-turn-legal-only', () => {
        const sharedState = {
            core: {
                activePlayerId: '1',
                currentPlayerIndex: 1,
                turnOrder: ['0', '1'],
                hostStarted: false,
                hostPlayerId: '0',
                selectedFactions: {
                    '0': 'unselected',
                    '1': 'trickster',
                },
                readyPlayers: {
                    '0': false,
                    '1': true,
                },
            },
            sys: {
                phase: 'summon',
                turnNumber: 0,
                eventStream: { nextId: 1 },
                interaction: {
                    current: undefined,
                    queue: [],
                    isBlocked: false,
                },
                responseWindow: {
                    current: undefined,
                },
            },
        } as any;

        const candidate = resolveForceEndTurnForStalledAi({
            sharedState,
            seatControllers: {
                '0': { type: 'human' },
                '1': { type: 'local-ai' },
            },
            seatStates: {},
            gameId: 'summonerwars',
        });

        expect(candidate).toBeNull();
    });
});
