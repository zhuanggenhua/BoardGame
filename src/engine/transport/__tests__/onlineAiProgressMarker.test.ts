import { describe, expect, it } from 'vitest';
import { buildAiProgressMarker } from '../onlineAiRecovery';
import { createOnlineAiRecoveryState } from './helpers/serverTestHarness';

describe('buildAiProgressMarker（响应窗口语义指纹）', () => {
    it('响应窗口 id 变化不应被视为进展', () => {
        const baseState = createOnlineAiRecoveryState({
            responseWindow: {
                current: {
                    id: 'rw-1',
                    windowType: 'afterRollConfirmed',
                    responderQueue: ['1'],
                    currentResponderIndex: 0,
                    passedPlayers: [],
                },
            },
        });
        const reopenedState = {
            ...baseState,
            G: {
                ...baseState.G,
                sys: {
                    ...baseState.G.sys,
                    responseWindow: {
                        current: {
                            id: 'rw-2',
                            windowType: 'afterRollConfirmed',
                            responderQueue: ['1'],
                            currentResponderIndex: 0,
                            passedPlayers: [],
                        },
                    },
                },
            },
        };

        expect(buildAiProgressMarker(baseState.G as any))
            .toBe(buildAiProgressMarker(reopenedState.G as any));
    });

    it('同一 interaction id 下如果选项签名变化，应被视为进展', () => {
        const baseState = createOnlineAiRecoveryState({
            interaction: {
                current: {
                    id: 'reaction-choice-1',
                    kind: 'simple-choice',
                    playerId: '1',
                    data: {
                        sourceId: 'smashup_reaction_choose',
                        options: [
                            { id: 'trigger-a', label: 'A', value: { kind: 'trigger', triggerId: 'a' } },
                            { id: 'pass', label: 'Pass', value: { kind: 'pass' } },
                        ],
                    },
                },
                queue: [],
                isBlocked: false,
            },
            responseWindow: {
                current: {
                    id: 'reaction-window-1',
                    windowType: 'afterScoring',
                    sourceId: 'smashup_reaction_choose',
                    responderQueue: ['1'],
                    currentResponderIndex: 0,
                    passedPlayers: [],
                },
            },
        });
        const progressedState = {
            ...baseState,
            G: {
                ...baseState.G,
                sys: {
                    ...baseState.G.sys,
                    interaction: {
                        current: {
                            id: 'reaction-choice-1',
                            kind: 'simple-choice',
                            playerId: '1',
                            data: {
                                sourceId: 'smashup_reaction_choose',
                                options: [
                                    { id: 'trigger-b', label: 'B', value: { kind: 'trigger', triggerId: 'b' } },
                                    { id: 'pass', label: 'Pass', value: { kind: 'pass' } },
                                ],
                            },
                        },
                        queue: [],
                        isBlocked: false,
                    },
                },
            },
        };

        expect(buildAiProgressMarker(baseState.G as any))
            .not.toBe(buildAiProgressMarker(progressedState.G as any));
    });

    it('decisionEpoch 变化时，即使交互与响应窗口指纹不变，也应被视为进展', () => {
        const baseState = createOnlineAiRecoveryState({
            decisionEpoch: 11,
            interaction: {
                current: {
                    id: 'reaction-choice-1',
                    kind: 'simple-choice',
                    playerId: '1',
                    data: {
                        sourceId: 'smashup_reaction_choose',
                        options: [
                            { id: 'trigger-a', label: 'A', value: { kind: 'trigger', triggerId: 'a' } },
                            { id: 'pass', label: 'Pass', value: { kind: 'pass' } },
                        ],
                    },
                },
                queue: [],
                isBlocked: false,
            },
            responseWindow: {
                current: {
                    id: 'reaction-window-1',
                    windowType: 'afterScoring',
                    sourceId: 'smashup_reaction_choose',
                    responderQueue: ['1'],
                    currentResponderIndex: 0,
                    passedPlayers: [],
                },
            },
        });
        const progressedState = {
            ...baseState,
            G: {
                ...baseState.G,
                sys: {
                    ...baseState.G.sys,
                    decisionEpoch: 12,
                },
            },
        };

        expect(buildAiProgressMarker(baseState.G as any))
            .not.toBe(buildAiProgressMarker(progressedState.G as any));
    });

    it('SmashUp factionSelect 同一玩家连续选派系时，playerSelections/takenFactions 变化也应被视为进展', () => {
        const baseState = createOnlineAiRecoveryState({
            activePlayerId: '3',
            phase: 'factionSelect',
        });
        (baseState.G as any).core.factionSelection = {
            takenFactions: ['aliens', 'pirates', 'robots'],
            playerSelections: {
                '0': ['aliens'],
                '1': ['pirates'],
                '2': ['robots'],
                '3': [],
            },
        };

        const progressedState = {
            ...baseState,
            G: {
                ...baseState.G,
                core: {
                    ...(baseState.G as any).core,
                    factionSelection: {
                        takenFactions: ['aliens', 'pirates', 'robots', 'wizards'],
                        playerSelections: {
                            '0': ['aliens'],
                            '1': ['pirates'],
                            '2': ['robots'],
                            '3': ['wizards'],
                        },
                    },
                },
            },
        };

        expect(buildAiProgressMarker(baseState.G as any))
            .not.toBe(buildAiProgressMarker(progressedState.G as any));
    });

    it('公开开局阶段的准备状态变化应被视为进展', () => {
        const baseState = createOnlineAiRecoveryState({
            activePlayerId: '0',
            phase: 'summon',
        });
        (baseState.G as any).core.hostStarted = false;
        (baseState.G as any).core.selectedFactions = {
            '0': 'necromancer',
            '1': 'frost',
        };
        (baseState.G as any).core.readyPlayers = {
            '0': false,
            '1': false,
        };

        const progressedState = {
            ...baseState,
            G: {
                ...baseState.G,
                core: {
                    ...(baseState.G as any).core,
                    readyPlayers: {
                        '0': false,
                        '1': true,
                    },
                },
            },
        };

        expect(buildAiProgressMarker(baseState.G as any))
            .not.toBe(buildAiProgressMarker(progressedState.G as any));
    });
});
