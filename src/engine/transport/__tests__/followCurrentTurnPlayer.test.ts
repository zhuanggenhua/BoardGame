import { describe, expect, it, vi } from 'vitest';
import type { MatchState } from '../../types';
import {
    resolveDefaultLocalPregameControlledPlayerId,
    resolveLocalPregameControlledPlayerId,
} from '../followCurrentTurnPlayer';

function buildFactionPregameState(overrides?: {
    hostStarted?: boolean;
    selectedFactions?: Record<string, string>;
    readyPlayers?: Record<string, boolean>;
    hostPlayerId?: string;
}): MatchState<unknown> {
    return {
        core: {
            hostPlayerId: overrides?.hostPlayerId ?? '0',
            hostStarted: overrides?.hostStarted ?? false,
            selectedFactions: overrides?.selectedFactions ?? {
                '0': 'unselected',
                '1': 'unselected',
            },
            readyPlayers: overrides?.readyPlayers ?? {
                '0': false,
                '1': false,
            },
        },
        sys: {
            phase: 'summon',
        },
    } as MatchState<unknown>;
}

function buildCharacterPregameState(overrides?: {
    selectedCharacters?: Record<string, string>;
    readyPlayers?: Record<string, boolean>;
}): MatchState<unknown> {
    return {
        core: {
            hostPlayerId: '0',
            hostStarted: false,
            selectedCharacters: overrides?.selectedCharacters ?? {
                '0': 'monk',
                '1': 'unselected',
            },
            readyPlayers: overrides?.readyPlayers ?? {
                '0': false,
                '1': false,
            },
        },
        sys: {
            phase: 'setup',
        },
    } as MatchState<unknown>;
}

describe('resolveDefaultLocalPregameControlledPlayerId', () => {
    it('未勾选手动赛前选择时，不接管 AI 座位', () => {
        expect(resolveDefaultLocalPregameControlledPlayerId({
            state: buildFactionPregameState(),
            localPlayerId: '0',
            seatControllers: {
                '0': { type: 'human' },
                '1': { type: 'local-ai' },
            },
        })).toBeNull();
    });

    it('标准阵营选择状态下，AI 未选择时优先接管该 AI', () => {
        expect(resolveDefaultLocalPregameControlledPlayerId({
            state: buildFactionPregameState(),
            localPlayerId: '0',
            seatControllers: {
                '0': { type: 'human' },
                '1': { type: 'local-ai', manualSetupSelection: true },
            },
        })).toBe('1');
    });

    it('AI 已选择但未准备时，继续接管该 AI 让玩家点准备', () => {
        expect(resolveDefaultLocalPregameControlledPlayerId({
            state: buildFactionPregameState({
                selectedFactions: {
                    '0': 'unselected',
                    '1': 'necromancer',
                },
                readyPlayers: {
                    '0': false,
                    '1': false,
                },
            }),
            localPlayerId: '0',
            seatControllers: {
                '0': { type: 'human' },
                '1': { type: 'remote-ai', providerId: 'astrbot', manualSetupSelection: true },
            },
        })).toBe('1');
    });

    it('所有手动 AI 都准备后，回到房主真人继续选择或开始', () => {
        expect(resolveDefaultLocalPregameControlledPlayerId({
            state: buildFactionPregameState({
                selectedFactions: {
                    '0': 'unselected',
                    '1': 'necromancer',
                },
                readyPlayers: {
                    '0': false,
                    '1': true,
                },
            }),
            localPlayerId: '0',
            seatControllers: {
                '0': { type: 'human' },
                '1': { type: 'local-ai', manualSetupSelection: true },
            },
        })).toBe('0');
    });

    it('标准角色选择状态同样支持旧 manualFactionSelection 别名', () => {
        expect(resolveDefaultLocalPregameControlledPlayerId({
            state: buildCharacterPregameState(),
            localPlayerId: '0',
            seatControllers: {
                '0': { type: 'human' },
                '1': { type: 'local-ai', manualFactionSelection: true },
            },
        })).toBe('1');
    });

    it('游戏开始后不再接管赛前座位', () => {
        expect(resolveDefaultLocalPregameControlledPlayerId({
            state: buildFactionPregameState({
                hostStarted: true,
                selectedFactions: {
                    '0': 'necromancer',
                    '1': 'trickster',
                },
                readyPlayers: {
                    '0': false,
                    '1': true,
                },
            }),
            localPlayerId: '0',
            seatControllers: {
                '0': { type: 'human' },
                '1': { type: 'local-ai', manualSetupSelection: true },
            },
        })).toBeNull();
    });

    it('非标准赛前状态不会被共享默认误接管', () => {
        expect(resolveDefaultLocalPregameControlledPlayerId({
            state: {
                core: {
                    factionSelection: {
                        playerSelections: {},
                    },
                    turnOrder: ['0', '1'],
                    currentPlayerIndex: 1,
                },
                sys: {
                    phase: 'factionSelect',
                },
            },
            localPlayerId: '0',
            seatControllers: {
                '0': { type: 'human' },
                '1': { type: 'local-ai', manualSetupSelection: true },
            },
        })).toBeNull();
    });
});

describe('resolveLocalPregameControlledPlayerId', () => {
    it('有游戏特化 resolver 时完全优先，不回落到共享默认', () => {
        const resolver = vi.fn(() => null);

        expect(resolveLocalPregameControlledPlayerId({
            state: buildFactionPregameState(),
            localPlayerId: '0',
            seatControllers: {
                '0': { type: 'human' },
                '1': { type: 'local-ai', manualSetupSelection: true },
            },
            resolver,
        })).toBeNull();

        expect(resolver).toHaveBeenCalledOnce();
    });
});
