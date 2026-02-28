/**
 * 测试母舰基地 afterScoring 能力是否错误地包含了其他基地的随从
 * 
 * Bug 报告：用户截图显示母舰基地计分时，可以选择收回忍者道场上的随从
 * 预期行为：只能收回母舰基地上力量≤3的随从
 */

import { describe, it, expect, beforeAll } from 'vitest';
import { triggerBaseAbility, type BaseAbilityContext } from '../domain/baseAbilities';
import type { SmashUpCore } from '../domain/types';
import { makeMatchState } from './helpers';
import { initAllAbilities } from '../abilities';

describe('母舰基地 afterScoring - 只能收回本基地随从', () => {
    beforeAll(() => {
        initAllAbilities();
    });

    it('应该只显示母舰基地上的随从选项，不包含其他基地', () => {
        // 设置初始状态：两个基地，母舰和忍者道场
        const state: SmashUpCore = {
            bases: [
                {
                    defId: 'base_the_mothership',
                    minions: [
                        // 玩家0在母舰上有一个力量2的随从
                        { uid: 'm1', defId: 'alien_invader', controller: '0', owner: '0', basePower: 2, powerCounters: 0, powerModifier: 0, tempPowerModifier: 0, talentUsed: false, attachedActions: [] },
                    ],
                    ongoingActions: [],
                },
                {
                    defId: 'base_ninja_dojo',
                    minions: [
                        // 玩家0在忍者道场上有一个力量3的随从
                        { uid: 'm2', defId: 'alien_collector', controller: '0', owner: '0', basePower: 3, powerCounters: 0, powerModifier: 0, tempPowerModifier: 0, talentUsed: false, attachedActions: [] },
                        // 玩家0在忍者道场上有一个力量2的随从
                        { uid: 'm3', defId: 'alien_invader', controller: '0', owner: '0', basePower: 2, powerCounters: 0, powerModifier: 0, tempPowerModifier: 0, talentUsed: false, attachedActions: [] },
                    ],
                    ongoingActions: [],
                },
            ],
            players: {
                '0': {
                    id: '0',
                    vp: 0,
                    hand: [],
                    deck: [],
                    discard: [],
                    minionsPlayed: 0,
                    minionLimit: 1,
                    actionsPlayed: 0,
                    actionLimit: 1,
                    factions: ['aliens', 'ninjas'],
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
                    factions: ['robots', 'pirates'],
                },
            },
            turnOrder: ['0', '1'],
            currentPlayerIndex: 0,
            baseDeck: ['base_tar_pits'],
            turnNumber: 1,
            nextUid: 100,
        } as any;
        
        const matchState = makeMatchState(state);
        
        const ctx: BaseAbilityContext = {
            state,
            matchState,
            baseIndex: 0,
            baseDefId: 'base_the_mothership',
            playerId: '0',
            rankings: [
                { playerId: '0', power: 2, vp: 4 },
                { playerId: '1', power: 0, vp: 2 },
            ],
            now: Date.now(),
        };
        
        // 触发母舰基地的 afterScoring 能力
        const result = triggerBaseAbility('base_the_mothership', 'afterScoring', ctx);
        
        // 验证：应该创建交互
        expect(result.matchState).toBeDefined();
        const interaction = result.matchState?.sys.interaction.current || result.matchState?.sys.interaction.queue[0];
        expect(interaction).toBeDefined();
        expect(interaction?.data.title).toBe('母舰：选择收回的随从');
        
        // 验证：选项中只包含母舰基地上的随从（m1），不包含忍者道场的随从（m2, m3）
        const options = interaction?.data.options as any[];
        expect(options).toBeDefined();
        
        // 应该有2个选项：跳过 + m1
        expect(options.length).toBe(2);
        
        // 第一个选项应该是"跳过"
        expect(options[0].id).toBe('skip');
        expect(options[0].label).toBe('不收回');
        
        // 第二个选项应该是 m1（母舰上的随从）
        expect(options[1].value.minionUid).toBe('m1');
        expect(options[1].value.baseIndex).toBe(0); // 验证 baseIndex 存在
        expect(options[1].displayMode).toBe('card'); // 验证 displayMode 存在
        
        // 验证：continuationContext 包含 baseIndex
        expect(interaction?.data.continuationContext).toBeDefined();
        expect((interaction?.data.continuationContext as any).baseIndex).toBe(0);
        
        // 验证：不应该包含 m2 或 m3（忍者道场上的随从）
        const minionUids = options.slice(1).map((opt: any) => opt.value.minionUid);
        expect(minionUids).not.toContain('m2');
        expect(minionUids).not.toContain('m3');
        expect(minionUids).toEqual(['m1']);
    });
    
    it('应该只收回母舰基地上的随从，即使其他基地有符合条件的随从', () => {
        // 设置：母舰上有力量4的随从（不符合条件），忍者道场上有力量2的随从（符合条件但不在母舰上）
        const state: SmashUpCore = {
            bases: [
                {
                    defId: 'base_the_mothership',
                    minions: [
                        // 玩家0在母舰上有一个力量4的随从（不符合≤3的条件）
                        { uid: 'm1', defId: 'alien_supreme_overlord', controller: '0', owner: '0', basePower: 4, powerCounters: 0, powerModifier: 0, tempPowerModifier: 0, talentUsed: false, attachedActions: [] },
                    ],
                    ongoingActions: [],
                },
                {
                    defId: 'base_ninja_dojo',
                    minions: [
                        // 玩家0在忍者道场上有一个力量2的随从（符合≤3的条件，但不在母舰上）
                        { uid: 'm2', defId: 'alien_invader', controller: '0', owner: '0', basePower: 2, powerCounters: 0, powerModifier: 0, tempPowerModifier: 0, talentUsed: false, attachedActions: [] },
                    ],
                    ongoingActions: [],
                },
            ],
            players: {
                '0': {
                    id: '0',
                    vp: 0,
                    hand: [],
                    deck: [],
                    discard: [],
                    minionsPlayed: 0,
                    minionLimit: 1,
                    actionsPlayed: 0,
                    actionLimit: 1,
                    factions: ['aliens', 'ninjas'],
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
                    factions: ['robots', 'pirates'],
                },
            },
            turnOrder: ['0', '1'],
            currentPlayerIndex: 0,
            baseDeck: ['base_tar_pits'],
            turnNumber: 1,
            nextUid: 100,
        } as any;
        
        const matchState = makeMatchState(state);
        
        const ctx: BaseAbilityContext = {
            state,
            matchState,
            baseIndex: 0,
            baseDefId: 'base_the_mothership',
            playerId: '0',
            rankings: [
                { playerId: '0', power: 4, vp: 4 },
                { playerId: '1', power: 0, vp: 2 },
            ],
            now: Date.now(),
        };
        
        // 触发母舰基地的 afterScoring 能力
        const result = triggerBaseAbility('base_the_mothership', 'afterScoring', ctx);
        
        // 验证：不应该创建交互（因为母舰上没有力量≤3的随从）
        expect(result.matchState).toBeUndefined();
        expect(result.events).toEqual([]);
    });
});
