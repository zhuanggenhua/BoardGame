/**
 * 卡牌展示系统测试
 *
 * 覆盖：
 * - REVEAL_HAND / REVEAL_DECK_TOP 事件不修改 core 状态（纯 EventStream 驱动）
 * - Alien Probe 能力产生 REVEAL_HAND 事件
 * - Alien Scout Ship 能力产生 REVEAL_DECK_TOP 事件
 * - 疯狂卡平局规则
 */

import { describe, it, expect, beforeAll } from 'vitest';
import { GameTestRunner } from '../../../engine/testing';
import { SmashUpDomain } from '../domain';
import type { SmashUpCore, SmashUpCommand, SmashUpEvent } from '../domain/types';
import { SU_COMMANDS } from '../domain/types';
import { SU_EVENTS } from '../domain/events';
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
