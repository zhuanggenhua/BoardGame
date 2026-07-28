/**
 * 卡牌展示系统测试
 *
 * 覆盖：
 * - REVEAL_HAND / REVEAL_DECK_TOP 事件不修改 core 状态（纯 EventStream 驱动）
 * - Alien Probe 能力产生 REVEAL_HAND 事件
 * - Alien Scout Ship 能力产生 REVEAL_DECK_TOP 事件
 * - 疯狂卡平局规则
 */

import React from 'react';
import { cleanup, render, screen } from '@testing-library/react';
import { describe, it, expect, beforeAll, afterEach, vi } from 'vitest';
import { GameTestRunner } from '../../../engine/testing';
import { SmashUpDomain } from '../domain';
import type { SmashUpCore, SmashUpCommand, SmashUpEvent } from '../domain/types';
import { SU_COMMANDS, SU_EVENTS } from '../domain/types';
import { createFlowSystem, createBaseSystems } from '../../../engine';
import { smashUpFlowHooks } from '../domain/index';
import { initAllAbilities, resetAbilityInit } from '../abilities';
import { clearRegistry } from '../domain/abilityRegistry';
import { clearBaseAbilityRegistry } from '../domain/baseAbilities';
import { clearInteractionHandlers } from '../domain/abilityInteractionHandlers';
import { createSmashUpEventSystem } from '../domain/systems';
import { SMASHUP_FACTION_IDS } from '../domain/ids';
import { reduce } from '../domain/reduce';
import type { RevealHandEvent, RevealDeckTopEvent } from '../domain/types';
import type { EventStreamEntry } from '../../../engine/types';
import { RevealOverlay, resolveRevealSuppressionRules } from '../ui/RevealOverlay';

vi.mock('react-i18next', () => ({
    useTranslation: () => ({
        t: (key: string, options?: { defaultValue?: string; player?: string }) => {
            if (options?.defaultValue) {
                return options.defaultValue.replace('{{player}}', options.player ?? '');
            }
            if (key === 'ui.reveal_hand_title') {
                return `${options?.player ?? ''} 的手牌`;
            }
            if (key === 'ui.reveal_deck_top_title') {
                return `${options?.player ?? ''} 的牌库顶`;
            }
            if (key === 'ui.close') {
                return '关闭';
            }
            if (key === 'ui.reveal_dismiss_hint') {
                return '点击继续';
            }
            return key;
        },
    }),
    initReactI18next: {
        type: '3rdParty',
        init: vi.fn(),
    },
}));

vi.mock('../../../components/common/media/CardPreview', () => ({
    CardPreview: ({ alt, className, style }: { alt?: string; className?: string; style?: React.CSSProperties }) => (
        React.createElement('div', { 'data-card-preview': alt ?? 'preview', className, style })
    ),
}));

afterEach(() => {
    cleanup();
});

const PLAYER_IDS = ['0', '1'];

function createRunner() {
    return new GameTestRunner<SmashUpCore, SmashUpCommand, SmashUpEvent>({
        domain: SmashUpDomain,
        systems: [
            createFlowSystem<SmashUpCore>({ hooks: smashUpFlowHooks }),
            ...createBaseSystems<SmashUpCore>(),
            createSmashUpEventSystem(),
        ],
        playerIds: PLAYER_IDS,
    });
}

const DRAFT_COMMANDS = [
    { type: SU_COMMANDS.SELECT_FACTION, playerId: '0', payload: { factionId: SMASHUP_FACTION_IDS.ALIENS } },
    { type: SU_COMMANDS.SELECT_FACTION, playerId: '1', payload: { factionId: SMASHUP_FACTION_IDS.PIRATES } },
    { type: SU_COMMANDS.SELECT_FACTION, playerId: '1', payload: { factionId: SMASHUP_FACTION_IDS.NINJAS } },
    { type: SU_COMMANDS.SELECT_FACTION, playerId: '0', payload: { factionId: SMASHUP_FACTION_IDS.DINOSAURS } },
] as SmashUpCommand[];

function makeRevealEntry({
    id,
    viewerPlayerId,
    timestamp,
}: {
    id: number;
    viewerPlayerId: '0' | '1' | 'all';
    timestamp?: number;
}): EventStreamEntry {
    return {
        id,
        event: {
            type: SU_EVENTS.REVEAL_HAND,
            payload: {
                targetPlayerId: '1',
                viewerPlayerId,
                cards: [{ uid: `card-${id}`, defId: 'pirate_first_mate' }],
                reason: 'test_reveal_visibility',
            },
            timestamp: timestamp ?? id * 100,
        },
    };
}

function makeRevealDeckTopEntry({
    id,
    viewerPlayerId,
    reason,
    cards,
}: {
    id: number;
    viewerPlayerId: '0' | '1' | 'all';
    reason: string;
    cards: { uid: string; defId: string }[];
}): EventStreamEntry {
    return {
        id,
        event: {
            type: SU_EVENTS.REVEAL_DECK_TOP,
            payload: {
                targetPlayerId: '0',
                viewerPlayerId,
                cards,
                count: cards.length,
                reason,
            },
            timestamp: id * 100,
        },
    };
}

describe('卡牌展示系统', () => {
    beforeAll(() => {
        clearRegistry();
        clearBaseAbilityRegistry();
        clearInteractionHandlers();
        resetAbilityInit();
        initAllAbilities();
    });

    describe('Reducer: REVEAL 事件不修改 core 状态（纯 EventStream 驱动）', () => {
        it('REVEAL_HAND 事件不写入 core', () => {
            const baseState: SmashUpCore = {
                players: {
                    '0': { id: '0', vp: 0, hand: [], deck: [], discard: [], minionsPlayed: 0, minionLimit: 1, actionsPlayed: 0, actionLimit: 1, factions: ['aliens', 'dinosaurs'] as [string, string] },
                    '1': { id: '1', vp: 0, hand: [], deck: [], discard: [], minionsPlayed: 0, minionLimit: 1, actionsPlayed: 0, actionLimit: 1, factions: ['pirates', 'ninjas'] as [string, string] },
                },
                turnOrder: ['0', '1'],
                currentPlayerIndex: 0,
                bases: [],
                baseDeck: [],
                turnNumber: 1,
                nextUid: 1,
            };

            const event: RevealHandEvent = {
                type: SU_EVENTS.REVEAL_HAND,
                payload: {
                    targetPlayerId: '1',
                    viewerPlayerId: '0',
                    cards: [{ uid: 'c1', defId: 'pirate_first_mate' }, { uid: 'c2', defId: 'ninja_tiger_assassin' }],
                    reason: 'alien_probe',
                },
                timestamp: 100,
            };

            const newState = reduce(baseState, event);
            // 展示事件不再写入 core，状态不变
            expect(newState).toBe(baseState);
        });

        it('REVEAL_DECK_TOP 事件不写入 core', () => {
            const baseState: SmashUpCore = {
                players: {
                    '0': { id: '0', vp: 0, hand: [], deck: [], discard: [], minionsPlayed: 0, minionLimit: 1, actionsPlayed: 0, actionLimit: 1, factions: ['aliens', 'dinosaurs'] as [string, string] },
                    '1': { id: '1', vp: 0, hand: [], deck: [], discard: [], minionsPlayed: 0, minionLimit: 1, actionsPlayed: 0, actionLimit: 1, factions: ['pirates', 'ninjas'] as [string, string] },
                },
                turnOrder: ['0', '1'],
                currentPlayerIndex: 0,
                bases: [],
                baseDeck: [],
                turnNumber: 1,
                nextUid: 1,
            };

            const event: RevealDeckTopEvent = {
                type: SU_EVENTS.REVEAL_DECK_TOP,
                payload: {
                    targetPlayerId: '1',
                    viewerPlayerId: '0',
                    cards: [{ uid: 'c10', defId: 'pirate_saucy_wench' }],
                    count: 1,
                    reason: 'alien_probe',
                },
                timestamp: 200,
            };

            const newState = reduce(baseState, event);
            expect(newState).toBe(baseState);
        });
    });

    describe('RevealOverlay 可见性归属', () => {
        it('联机页没有 playerID 时，不应看到私有展示', async () => {
            render(React.createElement(RevealOverlay, {
                entries: [makeRevealEntry({ id: 1, viewerPlayerId: '1' })],
                currentPlayerId: null,
            }));

            await Promise.resolve();
            expect(screen.queryByTestId('reveal-overlay')).toBeNull();
        });

        it('公开展示在没有 playerID 的页面也应可见', async () => {
            const { rerender } = render(React.createElement(RevealOverlay, {
                entries: [],
                currentPlayerId: null,
            }));

            rerender(React.createElement(RevealOverlay, {
                entries: [makeRevealEntry({ id: 2, viewerPlayerId: 'all' })],
                currentPlayerId: null,
            }));

            expect(await screen.findByTestId('reveal-overlay')).toBeInTheDocument();
        });

        it('私有展示只应出现在归属玩家页面', async () => {
            const { rerender } = render(React.createElement(RevealOverlay, {
                entries: [],
                currentPlayerId: '1',
            }));

            rerender(React.createElement(RevealOverlay, {
                entries: [makeRevealEntry({ id: 3, viewerPlayerId: '1' })],
                currentPlayerId: '1',
            }));

            expect(await screen.findByTestId('reveal-overlay')).toBeInTheDocument();
        });

        it('展示标题应优先显示玩家昵称', async () => {
            const playerNames = {
                '0': '阿土',
                '1': '老王',
            };
            const { rerender } = render(React.createElement(RevealOverlay, {
                entries: [],
                currentPlayerId: '0',
                playerNames,
            }));

            rerender(React.createElement(RevealOverlay, {
                entries: [makeRevealEntry({ id: 4, viewerPlayerId: 'all' })],
                currentPlayerId: '0',
                playerNames,
            }));

            expect(await screen.findByText('老王 的手牌')).toBeInTheDocument();
        });

        it('揭示卡片应有显式高度，避免旧 WebView 下只剩横条', async () => {
            const { rerender } = render(React.createElement(RevealOverlay, {
                entries: [],
                currentPlayerId: '0',
            }));

            rerender(React.createElement(RevealOverlay, {
                entries: [makeRevealEntry({ id: 5, viewerPlayerId: 'all' })],
                currentPlayerId: '0',
            }));

            expect(await screen.findByTestId('reveal-overlay')).toBeInTheDocument();
            const preview = document.querySelector<HTMLElement>('[data-card-preview]');
            expect(preview?.style.width).toBe('8.5vw');
            expect(preview?.style.height).toContain('vw');
        });

        it('页面挂载时已有的历史展示不应自动盖住牌桌，后续新展示应可见', async () => {
            const { rerender } = render(React.createElement(RevealOverlay, {
                entries: [makeRevealEntry({ id: 6, viewerPlayerId: 'all', timestamp: 1000 })],
                currentPlayerId: '0',
            }));

            await Promise.resolve();
            expect(screen.queryByTestId('reveal-overlay')).toBeNull();

            rerender(React.createElement(RevealOverlay, {
                entries: [
                    makeRevealEntry({ id: 6, viewerPlayerId: 'all', timestamp: 1000 }),
                    makeRevealEntry({ id: 7, viewerPlayerId: 'all' }),
                ],
                currentPlayerId: '0',
            }));

            expect(await screen.findByTestId('reveal-overlay')).toBeInTheDocument();
        });

        it('猴子见猴子做 prompt 应生成同批顶五展示的 suppression 规则', () => {
            expect(resolveRevealSuppressionRules({
                sourceId: 'cyborg_apes_monkey_see_monkey_do_choose',
                inspectedUids: ['deck-a', 'deck-b', 'deck-c'],
            }, true)).toEqual([{
                sourceId: 'cyborg_apes_monkey_see_monkey_do_choose',
                reason: 'cyborg_apes_monkey_see_monkey_do',
                cardUids: ['deck-a', 'deck-b', 'deck-c'],
            }]);
        });

        it('被当前 prompt 接管的猴子见猴子做顶五展示不应残留或在 prompt 结束后重播', async () => {
            const entries = [makeRevealDeckTopEntry({
                id: 6,
                viewerPlayerId: 'all',
                reason: 'cyborg_apes_monkey_see_monkey_do',
                cards: [
                    { uid: 'deck-a', defId: 'going_bananas' },
                    { uid: 'deck-b', defId: 'juiced_up' },
                    { uid: 'deck-c', defId: 'monkey_on_your_back' },
                ],
            })];
            const suppressionRules = [{
                sourceId: 'cyborg_apes_monkey_see_monkey_do_choose',
                reason: 'cyborg_apes_monkey_see_monkey_do',
                cardUids: ['deck-a', 'deck-b', 'deck-c'],
            }];

            const { rerender } = render(React.createElement(RevealOverlay, {
                entries,
                currentPlayerId: '0',
                suppressionRules,
            }));

            await Promise.resolve();
            expect(screen.queryByTestId('reveal-overlay')).toBeNull();

            rerender(React.createElement(RevealOverlay, {
                entries,
                currentPlayerId: '0',
                suppressionRules: [],
            }));

            await Promise.resolve();
            expect(screen.queryByTestId('reveal-overlay')).toBeNull();
        });
    });

    describe('疯狂卡平局规则', () => {
        it('原始独占领先触发终局后，最终分相同时疯狂卡较少者胜', () => {
            const state: SmashUpCore = {
                players: {
                    '0': { id: '0', vp: 15, hand: [
                        { uid: 'm1', defId: 'special_madness', type: 'minion', owner: '0' },
                        { uid: 'm2', defId: 'special_madness', type: 'minion', owner: '0' },
                    ], deck: [], discard: [], minionsPlayed: 0, minionLimit: 1, actionsPlayed: 0, actionLimit: 1, factions: ['aliens', 'dinosaurs'] as [string, string] },
                    '1': { id: '1', vp: 14, hand: [
                        { uid: 'm3', defId: 'special_madness', type: 'minion', owner: '1' },
                    ], deck: [], discard: [], minionsPlayed: 0, minionLimit: 1, actionsPlayed: 0, actionLimit: 1, factions: ['pirates', 'ninjas'] as [string, string] },
                },
                turnOrder: ['0', '1'],
                currentPlayerIndex: 0,
                bases: [],
                baseDeck: [],
                turnNumber: 5,
                nextUid: 100,
                madnessDeck: [],
            };

            // P0 原始 15 且独占领先，触发终局；P0 扣 1 后与 P1 同为 14，
            // P1 疯狂卡更少，因此由 P1 获胜。
            const result = SmashUpDomain.isGameOver!(state);
            expect(result).toBeDefined();
            expect(result!.winner).toBe('1');
            expect(result!.scores).toMatchObject({ '0': 14, '1': 14 });
        });

        it('原始不足 15 的玩家可在疯狂卡扣分后击败原始领先者', () => {
            const state: SmashUpCore = {
                players: {
                    '0': { id: '0', vp: 15, hand: [
                        { uid: 'm1', defId: 'special_madness', type: 'minion', owner: '0' },
                        { uid: 'm2', defId: 'special_madness', type: 'minion', owner: '0' },
                        { uid: 'm3', defId: 'special_madness', type: 'minion', owner: '0' },
                        { uid: 'm4', defId: 'special_madness', type: 'minion', owner: '0' },
                    ], deck: [], discard: [], minionsPlayed: 0, minionLimit: 1, actionsPlayed: 0, actionLimit: 1, factions: ['aliens', 'dinosaurs'] as [string, string] },
                    '1': { id: '1', vp: 14, hand: [], deck: [], discard: [], minionsPlayed: 0, minionLimit: 1, actionsPlayed: 0, actionLimit: 1, factions: ['pirates', 'ninjas'] as [string, string] },
                },
                turnOrder: ['0', '1'],
                currentPlayerIndex: 0,
                bases: [],
                baseDeck: [],
                turnNumber: 5,
                nextUid: 100,
                madnessDeck: [],
            };

            const result = SmashUpDomain.isGameOver!(state);
            expect(result).toBeDefined();
            expect(result!.winner).toBe('1');
            expect(result!.scores).toMatchObject({ '0': 13, '1': 14 });
        });

        it('疯狂卡修正后完全同分且疯狂卡同样少时共享胜利', () => {
            const state: SmashUpCore = {
                players: {
                    '0': { id: '0', vp: 15, hand: [
                        { uid: 'm1', defId: 'special_madness', type: 'minion', owner: '0' },
                        { uid: 'm2', defId: 'special_madness', type: 'minion', owner: '0' },
                        { uid: 'm3', defId: 'special_madness', type: 'minion', owner: '0' },
                        { uid: 'm4', defId: 'special_madness', type: 'minion', owner: '0' },
                    ], deck: [], discard: [], minionsPlayed: 0, minionLimit: 1, actionsPlayed: 0, actionLimit: 1, factions: ['aliens', 'dinosaurs'] as [string, string] },
                    '1': { id: '1', vp: 13, hand: [], deck: [], discard: [], minionsPlayed: 0, minionLimit: 1, actionsPlayed: 0, actionLimit: 1, factions: ['pirates', 'ninjas'] as [string, string] },
                    '2': { id: '2', vp: 13, hand: [], deck: [], discard: [], minionsPlayed: 0, minionLimit: 1, actionsPlayed: 0, actionLimit: 1, factions: ['wizards', 'zombies'] as [string, string] },
                },
                turnOrder: ['0', '1', '2'],
                currentPlayerIndex: 0,
                bases: [],
                baseDeck: [],
                turnNumber: 5,
                nextUid: 100,
                madnessDeck: [],
            };

            const result = SmashUpDomain.isGameOver!(state);
            expect(result).toBeDefined();
            expect(result!.winner).toBe('1');
            expect(result!.winners).toEqual(['1', '2']);
            expect(result!.scores).toMatchObject({ '0': 13, '1': 13, '2': 13 });
        });

        it('原始最高 VP 没有独占领先时继续游戏', () => {
            const state: SmashUpCore = {
                players: {
                    '0': { id: '0', vp: 15, hand: [
                        { uid: 'm1', defId: 'special_madness', type: 'minion', owner: '0' },
                    ], deck: [], discard: [], minionsPlayed: 0, minionLimit: 1, actionsPlayed: 0, actionLimit: 1, factions: ['aliens', 'dinosaurs'] as [string, string] },
                    '1': { id: '1', vp: 15, hand: [
                        { uid: 'm2', defId: 'special_madness', type: 'minion', owner: '1' },
                    ], deck: [], discard: [], minionsPlayed: 0, minionLimit: 1, actionsPlayed: 0, actionLimit: 1, factions: ['pirates', 'ninjas'] as [string, string] },
                },
                turnOrder: ['0', '1'],
                currentPlayerIndex: 0,
                bases: [],
                baseDeck: [],
                turnNumber: 5,
                nextUid: 100,
                madnessDeck: [],
            };

            const result = SmashUpDomain.isGameOver!(state);
            expect(result).toBeUndefined();
        });

        it('无克苏鲁扩展时不使用疯狂卡平局规则', () => {
            const state: SmashUpCore = {
                players: {
                    '0': { id: '0', vp: 15, hand: [], deck: [], discard: [], minionsPlayed: 0, minionLimit: 1, actionsPlayed: 0, actionLimit: 1, factions: ['aliens', 'dinosaurs'] as [string, string] },
                    '1': { id: '1', vp: 15, hand: [], deck: [], discard: [], minionsPlayed: 0, minionLimit: 1, actionsPlayed: 0, actionLimit: 1, factions: ['pirates', 'ninjas'] as [string, string] },
                },
                turnOrder: ['0', '1'],
                currentPlayerIndex: 0,
                bases: [],
                baseDeck: [],
                turnNumber: 5,
                nextUid: 100,
            };

            const result = SmashUpDomain.isGameOver!(state);
            expect(result).toBeUndefined();
        });
    });
});
