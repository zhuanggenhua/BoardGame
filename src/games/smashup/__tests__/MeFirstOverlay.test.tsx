import React from 'react';
import { fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { MeFirstOverlay } from '../ui/MeFirstOverlay';
import type { MatchState } from '../../../engine/types';
import type { SmashUpCore } from '../domain/types';
import { INTERACTION_COMMANDS } from '../../../engine/systems/InteractionSystem';

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

    it('当前响应者页面应显示让过按钮', () => {
        const state = createState();

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
        expect(screen.getByText('计分后响应')).toBeInTheDocument();
        expect(screen.getByTestId('me-first-progress')).toBeInTheDocument();
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

    it('smashup_reaction_choose 作为计分响应承载时仍应显示中间弹窗', () => {
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
        expect(screen.getByText('计分后响应')).toBeInTheDocument();
        expect(screen.getByTestId('me-first-pass-button')).toBeInTheDocument();
    });

    it('统一响应交互存在 pass 选项时，中间让过按钮应响应当前交互而不是发送旧 RESPONSE_PASS', () => {
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

        fireEvent.click(screen.getByTestId('me-first-pass-button'));

        expect(onSelectCard).toHaveBeenCalledWith(null);
        expect(dispatch).toHaveBeenCalledWith(INTERACTION_COMMANDS.RESPOND, {
            interactionId: 'reaction-choose',
            optionId: 'pass',
        });
        expect(dispatch).not.toHaveBeenCalledWith('RESPONSE_PASS');
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
