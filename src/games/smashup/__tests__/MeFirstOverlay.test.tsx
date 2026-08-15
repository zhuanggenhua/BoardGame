import React from 'react';
import { fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { MeFirstOverlay } from '../ui/MeFirstOverlay';
import type { MatchState } from '../../../engine/types';
import { SU_COMMANDS, type SmashUpCore } from '../domain/types';
vi.mock('react-i18next', () => ({
    useTranslation: () => ({
        t: (key: string, options?: { defaultValue?: string; player?: string }) => {
            if (options?.defaultValue) {
                return options.defaultValue.replace('{{player}}', options.player ?? '');
            }
            return key;
        },
    }),
    initReactI18next: {
        type: '3rdParty',
        init: vi.fn(),
    },
}));

function createState(overrides?: Partial<MatchState<SmashUpCore>>): MatchState<SmashUpCore> {
    return {
        core: {
            players: {
                '0': {
                    id: '0',
                    vp: 0,
                    hand: [],
                    deck: [],
                    discard: [],
                    factions: [],
                    minionsPlayed: 0,
                    minionLimit: 1,
                    actionsPlayed: 0,
                    actionLimit: 1,
                },
                '1': {
                    id: '1',
                    vp: 0,
                    hand: [],
                    deck: [],
                    discard: [],
                    factions: [],
                    minionsPlayed: 0,
                    minionLimit: 1,
                    actionsPlayed: 0,
                    actionLimit: 1,
                },
            },
            turnOrder: ['0', '1'],
            currentPlayerIndex: 0,
            bases: [],
            baseDeck: [],
            baseDiscard: [],
            turnNumber: 1,
            nextUid: 1,
        } as SmashUpCore,
        sys: {
            phase: 'scoreBases',
            interaction: { current: undefined, queue: [] },
            responseWindow: {
                current: {
                    id: 'rw-1',
                    windowType: 'afterScoring',
                    sourceId: 'smashup_reaction_choose',
                    responderQueue: ['0', '1'],
                    currentResponderIndex: 0,
                    passedPlayers: [],
                },
            },
            resolution: {
                activeFrameId: 'frame-1',
                frames: [{
                    id: 'frame-1',
                    kind: 'smashup:reaction:score-after',
                    ownerGame: 'smashup',
                    ownerSystem: 'smashup-reaction',
                    ownerToken: 'smashup:reaction:frame-1',
                    ordering: 'responder-round',
                    status: 'running',
                    step: 'optional',
                    phase: 'scoreBases',
                    phaseGate: 'block-advance-when-blocked',
                    metadata: {
                        smashupReactionSession: {
                            frameId: 'frame-1',
                            frameKind: 'score-after',
                            phase: 'optional',
                            activePlayerId: '0',
                            currentPlayerId: '0',
                            consecutivePasses: 0,
                            responseWindowType: 'afterScoring',
                        },
                    },
                }],
            },
        },
        ...(overrides ?? {}),
    } as MatchState<SmashUpCore>;
}

function createVisibleMeFirstState(): MatchState<SmashUpCore> {
    const base = createState();
    return createState({
        core: {
            ...base.core,
            bases: [{
                defId: 'base_pirate_cove',
                minions: [{
                    uid: 'host-minion-1',
                    defId: 'dino_war_raptor',
                    controller: '0',
                    owner: '0',
                    basePower: 2,
                    powerCounters: 1,
                    powerModifier: 0,
                    tempPowerModifier: 0,
                    talentUsed: false,
                    attachedActions: [],
                }],
                ongoingActions: [],
            }],
            players: {
                ...base.core.players,
                '0': {
                    ...base.core.players['0'],
                    hand: [{
                        uid: 'before-card-1',
                        defId: 'pirate_full_sail',
                        type: 'action',
                        owner: '0',
                    }],
                },
            },
        },
        sys: {
            ...base.sys,
            responseWindow: {
                current: {
                    ...base.sys.responseWindow!.current!,
                    windowType: 'meFirst',
                },
            },
            resolution: {
                activeFrameId: 'frame-1',
                frames: [{
                    ...(base.sys.resolution!.frames![0] as any),
                    kind: 'smashup:reaction:score-before',
                    step: 'optional',
                    metadata: {
                        smashupReactionSession: {
                            frameId: 'frame-1',
                            frameKind: 'score-before',
                            phase: 'optional',
                            activePlayerId: '0',
                            currentPlayerId: '0',
                            consecutivePasses: 0,
                            responseWindowType: 'meFirst',
                            sourceBaseIndex: 0,
                        },
                    },
                }],
            },
        },
    });
}

describe('SmashUp MeFirstOverlay regressions', () => {
    afterEach(() => {
        vi.clearAllMocks();
    });

    it('non-owner 页面只显示等待文案，不暴露让过按钮', () => {
        const base = createState();
        const state = createState({
            sys: {
                ...base.sys,
                responseWindow: {
                    current: {
                        ...base.sys.responseWindow!.current!,
                        responderQueue: ['0', '1'],
                        currentResponderIndex: 1,
                        passedPlayers: [],
                    },
                },
                resolution: {
                    activeFrameId: 'frame-1',
                    frames: [{
                        ...(base.sys.resolution!.frames![0] as any),
                        metadata: {
                            smashupReactionSession: {
                                frameId: 'frame-1',
                                frameKind: 'score-after',
                                phase: 'optional',
                                activePlayerId: '1',
                                currentPlayerId: '1',
                                consecutivePasses: 0,
                                responseWindowType: 'afterScoring',
                            },
                        },
                    }],
                },
            },
        });

        render(
            <MeFirstOverlay
                G={state}
                dispatch={vi.fn()}
                playerID="0"
                pendingCard={null}
                onSelectCard={vi.fn()}
                playerNames={{ '0': 'Host', '1': 'Guest' }}
            />,
        );

        expect(screen.getByTestId('me-first-overlay')).toBeInTheDocument();
        expect(screen.getByTestId('me-first-waiting-shell')).toBeInTheDocument();
        expect(screen.getByTestId('me-first-status')).toHaveTextContent('正在等待 Guest 响应...');
        expect(screen.queryByText('计分后响应')).not.toBeInTheDocument();
        expect(screen.queryByTestId('me-first-pass-button')).not.toBeInTheDocument();
        expect(screen.queryByTestId('me-first-progress')).not.toBeInTheDocument();
    });

    it('当前响应者确实有可打响应牌时，应显示让过按钮', () => {
        const base = createState();
        const state = createState({
            core: {
                ...base.core,
                bases: [{
                    defId: 'base_pirate_cove',
                    minions: [{
                        uid: 'host-minion-1',
                        defId: 'dino_war_raptor',
                        controller: '0',
                        owner: '0',
                        basePower: 2,
                        powerCounters: 1,
                        powerModifier: 0,
                        tempPowerModifier: 0,
                        talentUsed: false,
                        attachedActions: [],
                    }],
                    ongoingActions: [],
                }],
                players: {
                    ...base.core.players,
                    '0': {
                        ...base.core.players['0'],
                        hand: [{
                            uid: 'before-card-1',
                            defId: 'pirate_full_sail',
                            type: 'action',
                            owner: '0',
                        }],
                    },
                },
            },
            sys: {
                ...base.sys,
                responseWindow: {
                    current: {
                        ...base.sys.responseWindow!.current!,
                        windowType: 'meFirst',
                    },
                },
                resolution: {
                    activeFrameId: 'frame-1',
                    frames: [{
                        ...(base.sys.resolution!.frames![0] as any),
                        kind: 'smashup:reaction:score-before',
                        step: 'optional',
                        metadata: {
                            smashupReactionSession: {
                                frameId: 'frame-1',
                                frameKind: 'score-before',
                                phase: 'optional',
                                activePlayerId: '0',
                                currentPlayerId: '0',
                                consecutivePasses: 0,
                                responseWindowType: 'meFirst',
                                sourceBaseIndex: 0,
                            },
                        },
                    }],
                },
            },
        });

        render(
            <MeFirstOverlay
                G={state}
                dispatch={vi.fn()}
                playerID="0"
                pendingCard={null}
                onSelectCard={vi.fn()}
                playerNames={{ '0': 'Host', '1': 'Guest' }}
            />,
        );

        expect(screen.getByTestId('me-first-overlay')).toBeInTheDocument();
        expect(screen.queryByTestId('me-first-waiting-shell')).not.toBeInTheDocument();
        expect(screen.getByTestId('me-first-pass-button')).toBeInTheDocument();
        expect(screen.getByText('Me First!')).toBeInTheDocument();
        expect(screen.getByTestId('me-first-progress')).toBeInTheDocument();
    });

    it('点击让过时应发 Smash Up 专用 reaction pass，不再发通用 RESPONSE_PASS', () => {
        const dispatch = vi.fn();
        const onSelectCard = vi.fn();

        render(
            <MeFirstOverlay
                G={createVisibleMeFirstState()}
                dispatch={dispatch}
                playerID="0"
                pendingCard={null}
                onSelectCard={onSelectCard}
                playerNames={{ '0': 'Host', '1': 'Guest' }}
            />,
        );

        fireEvent.click(screen.getByTestId('me-first-pass-button'));

        expect(onSelectCard).toHaveBeenCalledWith(null);
        expect(dispatch).toHaveBeenCalledWith(SU_COMMANDS.REACTION_PASS);
        expect(dispatch).not.toHaveBeenCalledWith('RESPONSE_PASS');
    });

    it('已有真实交互时应隐藏，避免与场景操作叠层', () => {
        const base = createState();
        const state = createState({
            sys: {
                ...base.sys,
                interaction: {
                    current: {
                        id: 'guest-private-prompt',
                        kind: 'simple-choice',
                        playerId: '0',
                        data: {
                            sourceId: 'test-visible-interaction',
                            title: '测试交互',
                            options: [{ id: 'ok', label: '确定', value: { ok: true } }],
                        },
                    },
                    queue: [],
                },
            },
        });

        render(
            <MeFirstOverlay
                G={state}
                dispatch={vi.fn()}
                playerID="0"
                pendingCard={null}
                onSelectCard={vi.fn()}
                playerNames={{ '0': 'Host', '1': 'Guest' }}
            />,
        );

        expect(screen.queryByTestId('me-first-overlay')).not.toBeInTheDocument();
    });

    it('统一响应交互已承接当前玩家操作时，应完全隐藏中间弹窗，避免双主交互', () => {
        const base = createState();
        const state = createState({
            sys: {
                ...base.sys,
                responseWindow: {
                    current: {
                        ...base.sys.responseWindow!.current!,
                        currentResponderIndex: 0,
                        passedPlayers: [],
                    },
                },
                interaction: {
                    current: {
                        id: 'reaction-choose',
                        kind: 'simple-choice',
                        playerId: '0',
                        data: {
                            sourceId: 'smashup_reaction_choose',
                            title: '选择一个响应动作',
                            options: [
                                { id: 'play', label: '打出卡牌', value: { kind: 'play_action', cardUid: 'card-1' } },
                                { id: 'pass', label: '让过', value: { kind: 'pass' } },
                            ],
                        },
                    },
                    queue: [],
                },
            },
        });

        render(
            <MeFirstOverlay
                G={state}
                dispatch={vi.fn()}
                playerID="0"
                pendingCard={null}
                onSelectCard={vi.fn()}
                playerNames={{ '0': 'Host', '1': 'Guest' }}
            />,
        );

        expect(screen.queryByTestId('me-first-overlay')).not.toBeInTheDocument();
    });

    it('统一响应交互存在 pass 选项时，中间层不应再暴露自己的让过按钮', () => {
        const base = createState();
        const state = createState({
            sys: {
                ...base.sys,
                interaction: {
                    current: {
                        id: 'reaction-choose',
                        kind: 'simple-choice',
                        playerId: '0',
                        data: {
                            sourceId: 'smashup_reaction_choose',
                            title: '选择一个响应动作',
                            options: [
                                { id: 'play', label: '打出卡牌', value: { kind: 'play_action', cardUid: 'card-1' } },
                                { id: 'pass', label: '让过', value: { kind: 'pass' } },
                            ],
                        },
                    },
                    queue: [],
                },
            },
        });
        const dispatch = vi.fn();
        const onSelectCard = vi.fn();

        render(
            <MeFirstOverlay
                G={state}
                dispatch={dispatch}
                playerID="0"
                pendingCard={null}
                onSelectCard={onSelectCard}
                playerNames={{ '0': 'Host', '1': 'Guest' }}
            />,
        );

        expect(screen.queryByTestId('me-first-overlay')).not.toBeInTheDocument();
        expect(onSelectCard).not.toHaveBeenCalled();
        expect(dispatch).not.toHaveBeenCalled();
    });

    it('统一响应交互只剩紧急跳过时，中间层也不应再出现第二个让过入口', () => {
        const base = createState();
        const state = createState({
            sys: {
                ...base.sys,
                interaction: {
                    current: {
                        id: 'reaction-choose',
                        kind: 'simple-choice',
                        playerId: '0',
                        data: {
                            sourceId: 'smashup_reaction_choose',
                            title: '选择一个响应动作',
                            options: [
                                {
                                    id: '__emergency_skip__',
                                    label: '跳过（当前无可执行选项）',
                                    value: { __emergency_skip__: true, __emergency_skip_reason__: 'empty-options' },
                                },
                            ],
                        },
                    },
                    queue: [],
                },
            },
        });
        const dispatch = vi.fn();

        render(
            <MeFirstOverlay
                G={state}
                dispatch={dispatch}
                playerID="0"
                pendingCard={null}
                onSelectCard={vi.fn()}
                playerNames={{ '0': 'Host', '1': 'Guest' }}
            />,
        );

        expect(screen.queryByTestId('me-first-overlay')).not.toBeInTheDocument();
        expect(dispatch).not.toHaveBeenCalled();
    });

    it('统一响应交互已有 live optionsGenerator 时，中间层仍应完全退场', () => {
        const base = createState();
        const state = createState({
            sys: {
                ...base.sys,
                interaction: {
                    current: {
                        id: 'reaction-choose',
                        kind: 'simple-choice',
                        playerId: '0',
                        data: {
                            sourceId: 'smashup_reaction_choose',
                            title: '选择一个响应动作',
                            options: [
                                { id: 'stale-pass', label: '旧让过', value: { kind: 'pass' } },
                            ],
                            optionsGenerator: () => [
                                { id: 'play-live', label: '打出当前卡牌', value: { kind: 'play_action', cardUid: 'card-live' } },
                                { id: 'live-pass', label: '当前让过', value: { kind: 'pass' } },
                            ],
                        },
                    },
                    queue: [],
                },
            },
        });
        const dispatch = vi.fn();

        render(
            <MeFirstOverlay
                G={state}
                dispatch={dispatch}
                playerID="0"
                pendingCard={null}
                onSelectCard={vi.fn()}
                playerNames={{ '0': 'Host', '1': 'Guest' }}
            />,
        );

        expect(screen.queryByTestId('me-first-overlay')).not.toBeInTheDocument();
        expect(dispatch).not.toHaveBeenCalled();
    });

    it('mandatory 统一响应交互存在时，中间层也必须退场，不能和真实交互并列', () => {
        const base = createState();
        const state = createState({
            sys: {
                ...base.sys,
                responseWindow: {
                    current: {
                        ...base.sys.responseWindow!.current!,
                        currentResponderIndex: 0,
                        passedPlayers: [],
                    },
                },
                resolution: {
                    activeFrameId: 'frame-1',
                    frames: [{
                        ...(base.sys.resolution!.frames![0] as any),
                        step: 'mandatory',
                        metadata: {
                            smashupReactionSession: {
                                frameId: 'frame-1',
                                frameKind: 'score-after',
                                phase: 'mandatory',
                                activePlayerId: '0',
                                currentPlayerId: '0',
                                consecutivePasses: 0,
                                responseWindowType: 'afterScoring',
                            },
                        },
                    }],
                },
                interaction: {
                    current: {
                        id: 'reaction-choose',
                        kind: 'simple-choice',
                        playerId: '0',
                        data: {
                            sourceId: 'smashup_reaction_choose',
                            title: '选择一个响应动作',
                            options: [
                                { id: 'trigger-a', label: '基地效果', value: { kind: 'trigger', triggerId: 'trigger-a' } },
                                { id: 'trigger-b', label: '大副效果', value: { kind: 'trigger', triggerId: 'trigger-b' } },
                            ],
                        },
                    },
                    queue: [],
                },
            },
        });

        render(
            <MeFirstOverlay
                G={state}
                dispatch={vi.fn()}
                playerID="0"
                pendingCard={null}
                onSelectCard={vi.fn()}
                playerNames={{ '0': 'Host', '1': 'Guest' }}
            />,
        );

        expect(screen.queryByTestId('me-first-overlay')).not.toBeInTheDocument();
    });

    it('afterScoring 强制二选一且没有可打响应牌时，不应弹出让过窗', () => {
        const base = createState();
        const state = createState({
            sys: {
                ...base.sys,
                responseWindow: {
                    current: {
                        ...base.sys.responseWindow!.current!,
                        currentResponderIndex: 0,
                        passedPlayers: [],
                    },
                },
                resolution: {
                    activeFrameId: 'frame-1',
                    frames: [{
                        ...(base.sys.resolution!.frames![0] as any),
                        step: 'mandatory',
                        metadata: {
                            smashupReactionSession: {
                                frameId: 'frame-1',
                                frameKind: 'score-after',
                                phase: 'mandatory',
                                activePlayerId: '0',
                                currentPlayerId: '0',
                                consecutivePasses: 0,
                                responseWindowType: 'afterScoring',
                            },
                        },
                    }],
                },
            },
        });

        render(
            <MeFirstOverlay
                G={state}
                dispatch={vi.fn()}
                playerID="0"
                pendingCard={null}
                onSelectCard={vi.fn()}
                playerNames={{ '0': 'Host', '1': 'Guest' }}
            />,
        );

        expect(screen.queryByTestId('me-first-overlay')).not.toBeInTheDocument();
    });

    it('hides when response window is locked by another hidden interaction', () => {
        const state = createState({
            sys: {
                ...createState().sys,
                responseWindow: {
                    current: {
                        ...createState().sys.responseWindow!.current!,
                        pendingInteractionId: 'guest-private-prompt',
                    },
                },
            },
        });

        render(
            <MeFirstOverlay
                G={state}
                dispatch={vi.fn()}
                playerID="0"
                pendingCard={null}
                onSelectCard={vi.fn()}
                playerNames={{ '0': 'Host', '1': 'Guest' }}
            />,
        );

        expect(screen.queryByTestId('me-first-overlay')).not.toBeInTheDocument();
    });
});
