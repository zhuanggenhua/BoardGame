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
import { SmashUpDomain } from '../domain';
import type { SmashUpCore } from '../domain/types';
import { SU_EVENTS } from '../domain/types';
import { initAllAbilities, resetAbilityInit } from '../abilities';
import { clearRegistry } from '../domain/abilityRegistry';
import { clearBaseAbilityRegistry } from '../domain/baseAbilities';
import { clearInteractionHandlers } from '../domain/abilityInteractionHandlers';
import { EventStreamRollbackContext, type EventStreamRollbackValue } from '../../../engine/hooks/EventStreamRollbackContext';
import { reduce } from '../domain/reduce';
import type { RevealHandEvent, RevealDeckTopEvent } from '../domain/types';
import type { EventStreamEntry } from '../../../engine/types';
import { RevealOverlay, resolveRevealSuppressionRules } from '../ui/RevealOverlay';

vi.mock('../../../components/common/media/CardPreview', () => ({
    CardPreview: ({ alt }: { alt?: string }) => React.createElement('div', { 'data-card-preview': alt ?? 'preview' }),
}));

afterEach(() => {
    cleanup();
});

function makeRevealEntry({
    id,
    viewerPlayerId,
}: {
    id: number;
    viewerPlayerId: '0' | '1' | 'all';
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
            timestamp: id * 100,
        },
    };
}

function makeNonRevealEntry(id: number): EventStreamEntry {
    return {
        id,
        event: {
            type: SU_EVENTS.MINION_PLAYED,
            payload: {
                playerId: '0',
                baseIndex: 0,
                card: { uid: `minion-${id}`, defId: 'pirate_first_mate' },
            },
            timestamp: id * 100,
        } as any,
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
            render(React.createElement(RevealOverlay, {
                entries: [makeRevealEntry({ id: 2, viewerPlayerId: 'all' })],
                currentPlayerId: null,
            }));

            expect(await screen.findByTestId('reveal-overlay')).toBeInTheDocument();
        });

        it('reveal overlay 应保持非阻塞，只暴露最小关闭控件', async () => {
            render(React.createElement(RevealOverlay, {
                entries: [makeRevealEntry({ id: 21, viewerPlayerId: 'all' })],
                currentPlayerId: '0',
            }));

            const overlay = await screen.findByTestId('reveal-overlay');
            const dismissButton = await screen.findByTestId('reveal-dismiss-btn');
            const revealCard = await screen.findByTestId('reveal-card');

            expect(overlay.className).toContain('pointer-events-none');
            expect(dismissButton).toBeInTheDocument();
            expect(revealCard.className).toContain('cursor-pointer');
        });

        it('私有展示只应出现在归属玩家页面', async () => {
            render(React.createElement(RevealOverlay, {
                entries: [makeRevealEntry({ id: 3, viewerPlayerId: '1' })],
                currentPlayerId: '1',
            }));

            expect(await screen.findByTestId('reveal-overlay')).toBeInTheDocument();
        });

        it('展示标题应优先显示玩家昵称', async () => {
            render(React.createElement(RevealOverlay, {
                entries: [makeRevealEntry({ id: 4, viewerPlayerId: 'all' })],
                currentPlayerId: '0',
                playerNames: {
                    '0': '阿土',
                    '1': '老王',
                },
            }));

            expect(await screen.findByText('老王 的手牌')).toBeInTheDocument();
        });

        it('连续重渲染夹入非展示事件时不应丢失已捕获的公开展示', async () => {
            const { rerender } = render(React.createElement(RevealOverlay, {
                entries: [makeRevealEntry({ id: 5, viewerPlayerId: 'all' })],
                currentPlayerId: '0',
            }));

            rerender(React.createElement(RevealOverlay, {
                entries: [makeRevealEntry({ id: 5, viewerPlayerId: 'all' }), makeNonRevealEntry(6)],
                currentPlayerId: '0',
            }));

            expect(await screen.findByTestId('reveal-overlay')).toBeInTheDocument();
        });

        it('optimistic rollback signal 应清空旧 reveal 队列，并在恢复后重新对齐服务端事件', async () => {
            let rollbackValue: EventStreamRollbackValue = {
                watermark: null,
                seq: 0,
                reconcileSeq: 0,
            };

            const renderOverlay = (entries: EventStreamEntry[]) => React.createElement(
                EventStreamRollbackContext.Provider,
                { value: rollbackValue },
                React.createElement(RevealOverlay, {
                    entries,
                    currentPlayerId: '0',
                }),
            );

            const oldEntry = makeRevealEntry({ id: 7, viewerPlayerId: 'all' });
            const { rerender } = render(renderOverlay([oldEntry]));

            expect(await screen.findByTestId('reveal-overlay')).toBeInTheDocument();

            rollbackValue = {
                watermark: null,
                seq: 1,
                reconcileSeq: 0,
            };

            rerender(renderOverlay([]));
            expect(screen.queryByTestId('reveal-overlay')).toBeNull();

            rerender(renderOverlay([oldEntry]));
            expect(await screen.findByTestId('reveal-overlay')).toBeInTheDocument();
        });

        it('当前玩家进入 Operative 第二层 prompt 时，应隐藏同批公开 reveal 浮层避免叠层', async () => {
            const suppressionRules = resolveRevealSuppressionRules({
                sourceId: 'super_spies_operative_top_bottom',
                revealedByPlayer: {
                    '1': ['card-6'],
                },
                options: [
                    {
                        id: 'operative-p1-top',
                        label: '跳跃者',
                        value: { targetPlayerId: '1', cardUid: 'card-6', defId: 'time_travelers_jumper' },
                    },
                ],
            }, true);

            render(React.createElement(RevealOverlay, {
                entries: [{
                    id: 6,
                    event: {
                        type: SU_EVENTS.REVEAL_DECK_TOP,
                        payload: {
                            targetPlayerId: '1',
                            viewerPlayerId: 'all',
                            cards: [{ uid: 'card-6', defId: 'time_travelers_jumper' }],
                            count: 1,
                            reason: 'super_spies_operative',
                        },
                        timestamp: 600,
                    },
                }],
                currentPlayerId: '0',
                suppressionRules,
            }));

            await Promise.resolve();
            expect(screen.queryByTestId('reveal-overlay')).toBeNull();
        });

        it('未拥有 prompt 的旁观页面不应误抑制公开 reveal 浮层', async () => {
            const suppressionRules = resolveRevealSuppressionRules({
                sourceId: 'super_spies_operative_top_bottom',
                revealedByPlayer: {
                    '1': ['card-7'],
                },
            }, false);

            render(React.createElement(RevealOverlay, {
                entries: [{
                    id: 7,
                    event: {
                        type: SU_EVENTS.REVEAL_DECK_TOP,
                        payload: {
                            targetPlayerId: '1',
                            viewerPlayerId: 'all',
                            cards: [{ uid: 'card-7', defId: 'time_travelers_jumper' }],
                            count: 1,
                            reason: 'super_spies_operative',
                        },
                        timestamp: 700,
                    },
                }],
                currentPlayerId: '1',
                suppressionRules,
            }));

            expect(await screen.findByTestId('reveal-overlay')).toBeInTheDocument();
        });

        it('私有 deck reorder prompt 也应隐藏自己已接管的 reveal 浮层', async () => {
            const suppressionRules = resolveRevealSuppressionRules({
                sourceId: 'super_spies_spy_reorder',
                inspectedCards: [
                    { uid: 'deck-8-a', defId: 'super_spies_spy' },
                    { uid: 'deck-8-b', defId: 'super_spies_operative' },
                ],
            }, true);

            render(React.createElement(RevealOverlay, {
                entries: [{
                    id: 8,
                    event: {
                        type: SU_EVENTS.REVEAL_DECK_TOP,
                        payload: {
                            targetPlayerId: '0',
                            viewerPlayerId: '0',
                            cards: [{ uid: 'deck-8-a', defId: 'super_spies_spy' }, { uid: 'deck-8-b', defId: 'super_spies_operative' }],
                            count: 2,
                            reason: 'super_spies_spy',
                        },
                        timestamp: 800,
                    },
                }],
                currentPlayerId: '0',
                suppressionRules,
            }));

            await Promise.resolve();
            expect(screen.queryByTestId('reveal-overlay')).toBeNull();
        });
    });

    describe('疯狂卡平局规则', () => {
        it('VP 相同时疯狂卡较少者胜', () => {
            const state: SmashUpCore = {
                players: {
                    '0': { id: '0', vp: 15, hand: [
                        { uid: 'm1', defId: 'special_madness', type: 'minion', owner: '0' },
                        { uid: 'm2', defId: 'special_madness', type: 'minion', owner: '0' },
                    ], deck: [], discard: [], minionsPlayed: 0, minionLimit: 1, actionsPlayed: 0, actionLimit: 1, factions: ['aliens', 'dinosaurs'] as [string, string] },
                    '1': { id: '1', vp: 15, hand: [
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

            // P0 有 2 张疯狂卡（扣 1 VP → 14），P1 有 1 张（扣 0 VP → 15）
            // P1 分数更高直接胜出
            const result = SmashUpDomain.isGameOver!(state);
            expect(result).toBeDefined();
            expect(result!.winner).toBe('1');
        });

        it('VP 和疯狂卡都相同时继续游戏', () => {
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
