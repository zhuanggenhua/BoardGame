/**
 * D1 审计：alien_crop_circles（麦田怪圈）范围限定审计
 * 
 * 验证维度：
 * - D1：实体筛选范围语义（单个基地，非全局）
 * - D5：交互语义完整性（强制效果，返回所有随从）
 * - D37：交互选项动态刷新（框架层自动处理）
 * 
 * 卡牌描述（Wiki）：
 * "Choose a base. Return each minion on that base to its owner's hand."
 * 中文："选择一个基地。将该基地上的每个随从返回其拥有者手牌。"
 * 
 * 关键语义：
 * - "一个基地"（a base）→ 单个基地选择，非全局
 * - "每个随从"（each minion）→ 强制效果，返回所有随从
 * - "该基地上的"（on that base）→ 范围限定为所选基地
 */

import { describe, it, expect, beforeAll } from 'vitest';
import { GameTestRunner } from '../../../engine/testing/GameTestRunner';
import { SmashUpDomain } from '../domain';
import { smashUpFlowHooks } from '../domain/index';
import { createFlowSystem, createBaseSystems } from '../../../engine';
import type { SmashUpCore, SmashUpCommand, SmashUpEvent } from '../domain/types';
import { SU_COMMANDS } from '../domain/commands';
import { SU_EVENTS } from '../domain/events';
import { initAllAbilities } from '../abilities';

const PLAYER_IDS = ['0', '1'];

beforeAll(() => {
    initAllAbilities();
});

function createRunner() {
    return new GameTestRunner<SmashUpCore, SmashUpCommand, SmashUpEvent>({
        domain: SmashUpDomain,
        systems: [
            createFlowSystem<SmashUpCore>({ hooks: smashUpFlowHooks }),
            ...createBaseSystems<SmashUpCore>(),
        ],
        playerIds: PLAYER_IDS,
        silent: true,
    });
}

describe('D1 审计：alien_crop_circles 范围限定', () => {
    it('D1：只从所选基地返回随从，其他基地不受影响', () => {
        const runner = createRunner();
        
        // 初始状态：3 个基地，每个基地有不同玩家的随从
        runner.patchState({
            core: {
                players: {
                    '0': {
                        id: '0',
                        vp: 0,
                        hand: [
                            { uid: 'crop-circles', defId: 'alien_crop_circles', type: 'action', owner: '0' },
                        ],
                        deck: [],
                        discard: [],
                        minionsPlayed: 0,
                        minionLimit: 1,
                        actionsPlayed: 0,
                        actionLimit: 1,
                        factions: ['aliens', 'pirates'] as [string, string],
                    },
                    '1': {
                        id: '1',
                        vp: 0,
                        hand: [],
                        deck: [],
                        discard: [],
                        minionsPlayed: 0,
                        minionLimit: 1,
                        actionsPlayed: 0,
                        actionLimit: 1,
                        factions: ['ninjas', 'robots'] as [string, string],
                    },
                },
                bases: [
                    {
                        defId: 'base_the_homeworld',
                        breakpoint: 20,
                        vp: [4, 2, 1],
                        minions: [
                            { uid: 'base0-m1', defId: 'alien_invader', type: 'minion', owner: '0', controller: '0', power: 3 },
                            { uid: 'base0-m2', defId: 'ninja_shinobi', type: 'minion', owner: '1', controller: '1', power: 3 },
                        ],
                        ongoingActions: [],
                    },
                    {
                        defId: 'base_the_jungle_oasis',
                        breakpoint: 18,
                        vp: [4, 2, 1],
                        minions: [
                            { uid: 'base1-m1', defId: 'pirate_buccaneer', type: 'minion', owner: '0', controller: '0', power: 2 },
                            { uid: 'base1-m2', defId: 'robot_microbot', type: 'minion', owner: '1', controller: '1', power: 1 },
                        ],
                        ongoingActions: [],
                    },
                    {
                        defId: 'base_the_tar_pits',
                        breakpoint: 16,
                        vp: [3, 2, 1],
                        minions: [
                            { uid: 'base2-m1', defId: 'alien_scout', type: 'minion', owner: '0', controller: '0', power: 2 },
                        ],
                        ongoingActions: [],
                    },
                ],
                baseDeck: ['base_the_temple_of_goju'],
                currentPlayerIndex: 0,
                turnOrder: PLAYER_IDS,
                turnNumber: 1,
            },
            sys: {
                phase: 'playCards',
            },
        });

        // Step 1: 打出麦田怪圈
        const r1 = runner.dispatch(SU_COMMANDS.PLAY_ACTION, {
            playerId: '0',
            cardUid: 'crop-circles',
        });

        expect(r1.success).toBe(true);
        expect(r1.finalState.sys.interaction.current).toBeDefined();
        expect(r1.finalState.sys.interaction.current?.data.sourceId).toBe('alien_crop_circles');
        
        // 验证交互选项：应该有 3 个基地可选（所有基地都有随从）
        const options = r1.finalState.sys.interaction.current?.data.options ?? [];
        expect(options).toHaveLength(3);

        // Step 2: 选择基地 1（The Jungle Oasis）
        const r2 = runner.dispatch(SU_COMMANDS.RESOLVE_INTERACTION, {
            playerId: '0',
            value: { baseIndex: 1 },
        });

        expect(r2.success).toBe(true);
        
        // 验证事件：应该产生 2 个 MINION_RETURNED 事件（基地 1 有 2 个随从）
        const returnedEvents = r2.events.filter(e => e.type === SU_EVENTS.MINION_RETURNED);
        expect(returnedEvents).toHaveLength(2);
        
        // 验证返回的随从 UID
        const returnedUids = returnedEvents.map(e => (e as any).payload.minionUid);
        expect(returnedUids).toContain('base1-m1'); // P0 的海盗
        expect(returnedUids).toContain('base1-m2'); // P1 的机器人
        
        // 验证所有事件的 fromBaseIndex 都是 1
        returnedEvents.forEach(e => {
            expect((e as any).payload.fromBaseIndex).toBe(1);
        });

        // D1 核心验证：其他基地的随从不受影响
        const finalState = r2.finalState;
        
        // 基地 0 的随从仍在场上
        expect(finalState.core.bases[0].minions).toHaveLength(2);
        expect(finalState.core.bases[0].minions.map(m => m.uid)).toEqual(['base0-m1', 'base0-m2']);
        
        // 基地 1 的随从已被返回（清空）
        expect(finalState.core.bases[1].minions).toHaveLength(0);
        
        // 基地 2 的随从仍在场上
        expect(finalState.core.bases[2].minions).toHaveLength(1);
        expect(finalState.core.bases[2].minions[0].uid).toBe('base2-m1');
        
        // 验证随从返回到正确的玩家手牌
        const p0Hand = finalState.core.players['0'].hand;
        const p1Hand = finalState.core.players['1'].hand;
        
        expect(p0Hand.some(c => c.uid === 'base1-m1')).toBe(true); // P0 的海盗返回 P0 手牌
        expect(p1Hand.some(c => c.uid === 'base1-m2')).toBe(true); // P1 的机器人返回 P1 手牌
    });

    it('D5：强制效果，返回所选基地的所有随从（无需多选交互）', () => {
        const runner = createRunner();
        
        // 初始状态：1 个基地有 4 个随从
        runner.patchState({
            core: {
                players: {
                    '0': {
                        id: '0',
                        vp: 0,
                        hand: [
                            { uid: 'crop-circles', defId: 'alien_crop_circles', type: 'action', owner: '0' },
                        ],
                        deck: [],
                        discard: [],
                        minionsPlayed: 0,
                        minionLimit: 1,
                        actionsPlayed: 0,
                        actionLimit: 1,
                        factions: ['aliens', 'pirates'] as [string, string],
                    },
                    '1': {
                        id: '1',
                        vp: 0,
                        hand: [],
                        deck: [],
                        discard: [],
                        minionsPlayed: 0,
                        minionLimit: 1,
                        actionsPlayed: 0,
                        actionLimit: 1,
                        factions: ['ninjas', 'robots'] as [string, string],
                    },
                },
                bases: [
                    {
                        defId: 'base_the_homeworld',
                        breakpoint: 20,
                        vp: [4, 2, 1],
                        minions: [
                            { uid: 'm1', defId: 'alien_invader', type: 'minion', owner: '0', controller: '0', power: 3 },
                            { uid: 'm2', defId: 'alien_scout', type: 'minion', owner: '0', controller: '0', power: 2 },
                            { uid: 'm3', defId: 'ninja_shinobi', type: 'minion', owner: '1', controller: '1', power: 3 },
                            { uid: 'm4', defId: 'robot_microbot', type: 'minion', owner: '1', controller: '1', power: 1 },
                        ],
                        ongoingActions: [],
                    },
                ],
                baseDeck: ['base_the_temple_of_goju'],
                currentPlayerIndex: 0,
                turnOrder: PLAYER_IDS,
                turnNumber: 1,
            },
            sys: {
                phase: 'playCards',
            },
        });

        // Step 1: 打出麦田怪圈
        const r1 = runner.dispatch(SU_COMMANDS.PLAY_ACTION, {
            playerId: '0',
            cardUid: 'crop-circles',
        });

        expect(r1.success).toBe(true);
        
        // 验证交互类型：单选基地（不是多选随从）
        const interaction = r1.finalState.sys.interaction.current;
        expect(interaction?.data.sourceId).toBe('alien_crop_circles');
        expect(interaction?.data.targetType).toBe('base');
        
        // 验证没有 multi 配置（单选模式）
        expect((interaction?.data as any).multi).toBeUndefined();

        // Step 2: 选择基地后，自动返回所有随从（强制效果）
        const r2 = runner.dispatch(SU_COMMANDS.RESOLVE_INTERACTION, {
            playerId: '0',
            value: { baseIndex: 0 },
        });

        expect(r2.success).toBe(true);
        
        // D5 核心验证：所有 4 个随从都被返回（强制效果，无需玩家逐个选择）
        const returnedEvents = r2.events.filter(e => e.type === SU_EVENTS.MINION_RETURNED);
        expect(returnedEvents).toHaveLength(4);
        
        const returnedUids = returnedEvents.map(e => (e as any).payload.minionUid);
        expect(returnedUids).toContain('m1');
        expect(returnedUids).toContain('m2');
        expect(returnedUids).toContain('m3');
        expect(returnedUids).toContain('m4');
        
        // 验证基地已清空
        expect(r2.finalState.core.bases[0].minions).toHaveLength(0);
        
        // 验证没有后续交互（不需要玩家选择哪些随从返回）
        expect(r2.finalState.sys.interaction.current).toBeUndefined();
        expect(r2.finalState.sys.interaction.queue).toHaveLength(0);
    });

    it('D37：多基地场景下选项自动刷新（框架层自动处理）', () => {
        const runner = createRunner();
        
        // 初始状态：2 个基地有随从，1 个空基地
        runner.patchState({
            core: {
                players: {
                    '0': {
                        id: '0',
                        vp: 0,
                        hand: [
                            { uid: 'crop-circles', defId: 'alien_crop_circles', type: 'action', owner: '0' },
                        ],
                        deck: [],
                        discard: [],
                        minionsPlayed: 0,
                        minionLimit: 1,
                        actionsPlayed: 0,
                        actionLimit: 1,
                        factions: ['aliens', 'pirates'] as [string, string],
                    },
                    '1': {
                        id: '1',
                        vp: 0,
                        hand: [],
                        deck: [],
                        discard: [],
                        minionsPlayed: 0,
                        minionLimit: 1,
                        actionsPlayed: 0,
                        actionLimit: 1,
                        factions: ['ninjas', 'robots'] as [string, string],
                    },
                },
                bases: [
                    {
                        defId: 'base_the_homeworld',
                        breakpoint: 20,
                        vp: [4, 2, 1],
                        minions: [
                            { uid: 'base0-m1', defId: 'alien_invader', type: 'minion', owner: '0', controller: '0', power: 3 },
                        ],
                        ongoingActions: [],
                    },
                    {
                        defId: 'base_the_jungle_oasis',
                        breakpoint: 18,
                        vp: [4, 2, 1],
                        minions: [
                            { uid: 'base1-m1', defId: 'pirate_buccaneer', type: 'minion', owner: '0', controller: '0', power: 2 },
                        ],
                        ongoingActions: [],
                    },
                    {
                        defId: 'base_the_tar_pits',
                        breakpoint: 16,
                        vp: [3, 2, 1],
                        minions: [], // 空基地
                        ongoingActions: [],
                    },
                ],
                baseDeck: ['base_the_temple_of_goju'],
                currentPlayerIndex: 0,
                turnOrder: PLAYER_IDS,
                turnNumber: 1,
            },
            sys: {
                phase: 'playCards',
            },
        });

        // Step 1: 打出麦田怪圈
        const r1 = runner.dispatch(SU_COMMANDS.PLAY_ACTION, {
            playerId: '0',
            cardUid: 'crop-circles',
        });

        expect(r1.success).toBe(true);
        
        // D37 核心验证：选项只包含有随从的基地（空基地被过滤）
        const options = r1.finalState.sys.interaction.current?.data.options ?? [];
        expect(options).toHaveLength(2); // 只有基地 0 和基地 1
        
        const baseIndices = options.map(opt => (opt.value as any).baseIndex);
        expect(baseIndices).toContain(0);
        expect(baseIndices).toContain(1);
        expect(baseIndices).not.toContain(2); // 空基地不在选项中
        
        // 验证选项标签包含随从数量信息
        const labels = options.map(opt => opt.label);
        expect(labels.some(l => l.includes('1 个随从'))).toBe(true);
    });
});
