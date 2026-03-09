/**
 * 测试：外星侦察兵 POD 版本 afterScoring 触发
 *
 * Bug: alien_scout_pod 在基地计分后不触发 afterScoring 交互
 * 根因：registerTrigger 只注册了 alien_scout，没有注册 alien_scout_pod
 *
 * 修复：
 * 1. 在 registerAlienAbilities 中添加 registerTrigger('alien_scout_pod', 'afterScoring', alienScoutAfterScoring)
 * 2. 在 alienScoutAfterScoring 中过滤时检查两个版本：m.defId === 'alien_scout' || m.defId === 'alien_scout_pod'
 */

import { describe, it, expect, beforeAll } from 'vitest';
import { makeState, makeBase, makeMinion, makeMatchState } from './helpers';
import type { SmashUpCore } from '../domain/types';
import { fireTriggers } from '../domain/ongoingEffects';
import { initAllAbilities, resetAbilityInit } from '../abilities';
import { getInteractionHandler } from '../domain/abilityInteractionHandlers';

beforeAll(() => {
    resetAbilityInit();
    initAllAbilities();
});

describe('外星侦察兵 POD 版本 afterScoring', () => {
    it('alien_scout_pod 应该被 isSourceActive 识别', () => {
        // 构造场景：基地上有 alien_scout_pod
        const core = makeState({
            bases: [
                makeBase('base_great_library', [
                    makeMinion('scout1', 'alien_scout_pod', '1', 3),
                    makeMinion('m1', 'wizard_neophyte', '0', 2),
                ]),
            ],
        });
        
        const ms = makeMatchState(core);
        
        // 触发 afterScoring
        const result = fireTriggers(core, 'afterScoring', {
            state: core,
            matchState: ms,
            playerId: '0',
            baseIndex: 0,
            rankings: [{ playerId: '0', power: 10, vp: 3 }],
            random: {
                random: () => 0.5,
                d: () => 1,
                range: (min: number) => min,
                shuffle: <T>(arr: T[]) => [...arr],
            },
            now: 100,
        });
        
        // 验证：应该有交互（侦察兵回手选择）
        expect(result.matchState).toBeDefined();
        expect(result.matchState?.sys.interaction?.current).toBeDefined();
        expect(result.matchState?.sys.interaction?.current?.data.sourceId).toBe('alien_scout_return');
    });
    
    it('alien_scout 基础版本也应该正常触发', () => {
        // 构造场景：基地上有 alien_scout（基础版）
        const core = makeState({
            bases: [
                makeBase('base_great_library', [
                    makeMinion('scout1', 'alien_scout', '1', 3),
                    makeMinion('m1', 'wizard_neophyte', '0', 2),
                ]),
            ],
        });
        
        const ms = makeMatchState(core);
        
        // 触发 afterScoring
        const result = fireTriggers(core, 'afterScoring', {
            state: core,
            matchState: ms,
            playerId: '0',
            baseIndex: 0,
            rankings: [{ playerId: '0', power: 10, vp: 3 }],
            random: {
                random: () => 0.5,
                d: () => 1,
                range: (min: number) => min,
                shuffle: <T>(arr: T[]) => [...arr],
            },
            now: 100,
        });
        
        // 验证：应该有交互
        expect(result.matchState).toBeDefined();
        expect(result.matchState?.sys.interaction?.current).toBeDefined();
        expect(result.matchState?.sys.interaction?.current?.data.sourceId).toBe('alien_scout_return');
    });
    
    it('同时有基础版和 POD 版时，应该创建2个交互', () => {
        // 构造场景：基地上有1个 alien_scout 和1个 alien_scout_pod
        const core = makeState({
            bases: [
                makeBase('base_great_library', [
                    makeMinion('scout1', 'alien_scout', '1', 3),
                    makeMinion('scout2', 'alien_scout_pod', '1', 3),
                    makeMinion('m1', 'wizard_neophyte', '0', 2),
                ]),
            ],
        });
        
        const ms = makeMatchState(core);
        
        // 触发 afterScoring
        const result = fireTriggers(core, 'afterScoring', {
            state: core,
            matchState: ms,
            playerId: '0',
            baseIndex: 0,
            rankings: [{ playerId: '0', power: 10, vp: 3 }],
            random: {
                random: () => 0.5,
                d: () => 1,
                range: (min: number) => min,
                shuffle: <T>(arr: T[]) => [...arr],
            },
            now: 100,
        });
        
        // 验证：应该有2个交互（链式处理）
        expect(result.matchState).toBeDefined();
        expect(result.matchState?.sys.interaction?.current).toBeDefined();
        
        // 第一个交互
        const firstInteraction = result.matchState!.sys.interaction!.current!;
        expect(firstInteraction.data.sourceId).toBe('alien_scout_return');
        
        // 检查 continuationContext 中是否有第二个侦察兵
        const ctx = (firstInteraction.data.continuationContext as any);
        expect(ctx?.remaining).toBeDefined();
        expect(ctx.remaining.length).toBe(1); // 还有1个侦察兵待处理
    });

    it('alien_scout_return: 若所选侦察兵已离开基地则不再回手', () => {
        const core = makeState({
            bases: [
                makeBase('base_great_library', [
                    makeMinion('scout1', 'alien_scout', '1', 3),
                    makeMinion('m1', 'wizard_neophyte', '0', 2),
                ]),
            ],
        });

        const result = fireTriggers(core, 'afterScoring', {
            state: core,
            matchState: makeMatchState(core),
            playerId: '0',
            baseIndex: 0,
            rankings: [{ playerId: '0', power: 10, vp: 3 }],
            random: {
                random: () => 0.5,
                d: () => 1,
                range: (min: number) => min,
                shuffle: <T>(arr: T[]) => [...arr],
            },
            now: 101,
        });

        const interaction = result.matchState!.sys.interaction!.current!;
        const returnOption = interaction.data.options.find((entry: any) => entry.value?.returnIt === true);
        const handler = getInteractionHandler('alien_scout_return');
        expect(interaction.data.sourceId).toBe('alien_scout_return');
        expect(returnOption).toBeDefined();
        expect(handler).toBeDefined();

        const staleCore = makeState({
            bases: [
                makeBase('base_great_library', [
                    makeMinion('m1', 'wizard_neophyte', '0', 2),
                ]),
            ],
            players: {
                '0': core.players['0'],
                '1': {
                    ...core.players['1'],
                    discard: [
                        ...core.players['1'].discard,
                        { uid: 'scout1', defId: 'alien_scout', type: 'minion', owner: '1' },
                    ],
                },
            },
        });

        const resolved = handler!(
            makeMatchState(staleCore),
            '1',
            returnOption.value,
            interaction.data,
            {
                random: () => 0.5,
                d: () => 1,
                range: (min: number) => min,
                shuffle: <T>(arr: T[]) => [...arr],
            },
            102,
        );

        expect(resolved?.events ?? []).toHaveLength(0);
    });
});
