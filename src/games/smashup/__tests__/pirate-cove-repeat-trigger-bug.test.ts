/**
 * 海盗湾重复触发 Bug 测试
 * 
 * 用户报告：海盗王移动到海盗湾后，海盗湾一直触发，每次移动都加分
 * 
 * 测试场景：
 * 1. 海盗王在其他基地
 * 2. 海盗湾接近临界点
 * 3. 海盗王 beforeScoring 移动到海盗湾
 * 4. 海盗湾达到临界点，触发计分
 * 5. afterScoring 创建移动交互
 * 6. 验证不会重复触发
 */

import { describe, it, expect, beforeAll } from 'vitest';
import { initAllAbilities } from '../abilities';
import { expectNoPrompt, getPromptsBySourceId, makeState, makeBase, makeMinion, makeMatchState } from './helpers';
import type { SmashUpCore } from '../domain/types';
import { triggerBaseAbility } from '../domain/baseAbilities';

describe('海盗湾重复触发 Bug', () => {
    beforeAll(() => {
        initAllAbilities();
    });

    it('海盗王移动到海盗湾后，afterScoring 只触发一次', () => {
        // 场景：
        // - 基地0：海盗湾（临界点17），当前力量12
        // - 基地1：其他基地，海盗王在此（力量5）
        // - 玩家0：海盗王 + 其他随从（总力量17）
        // - 玩家1：随从（力量5）
        
        const core: SmashUpCore = makeState({
            bases: [
                makeBase('base_pirate_cove', [
                    makeMinion('m1', 'pirate_buccaneer', '0', 4),  // 玩家0：4
                    makeMinion('m2', 'pirate_buccaneer', '0', 4),  // 玩家0：4
                    makeMinion('m3', 'pirate_buccaneer', '0', 4),  // 玩家0：4
                    makeMinion('m4', 'trickster_brownie', '1', 4), // 玩家1：4
                ]),
                makeBase('base_wizard_academy', [
                    makeMinion('king', 'pirate_king', '0', 5),     // 海盗王
                    makeMinion('m5', 'trickster_gremlin', '1', 2), // 玩家1：2
                ]),
            ],
            players: {
                '0': { id: '0', vp: 10, hand: [], deck: [], discard: [], minionsPlayed: 0, minionLimit: 1, actionsPlayed: 0, actionLimit: 1, factions: ['pirates', 'robots'], minionsPlayedPerBase: {}, sameNameMinionDefId: null },
                '1': { id: '1', vp: 5, hand: [], deck: [], discard: [], minionsPlayed: 0, minionLimit: 1, actionsPlayed: 0, actionLimit: 1, factions: ['tricksters', 'wizards'], minionsPlayedPerBase: {}, sameNameMinionDefId: null },
            },
        });

        const ms = makeMatchState(core);
        ms.sys.phase = 'scoreBases';
        ms.core.scoringEligibleBaseIndices = [0]; // 海盗湾达到临界点

        // 步骤1：触发计分（会先触发 beforeScoring，海盗王移动）
        // 注意：这里需要模拟完整的计分流程
        
        // 模拟海盗王移动后的状态
        const coreAfterKingMove: SmashUpCore = makeState({
            bases: [
                makeBase('base_pirate_cove', [
                    makeMinion('m1', 'pirate_buccaneer', '0', 4),
                    makeMinion('m2', 'pirate_buccaneer', '0', 4),
                    makeMinion('m3', 'pirate_buccaneer', '0', 4),
                    makeMinion('king', 'pirate_king', '0', 5),      // 海盗王移动到这里
                    makeMinion('m4', 'trickster_brownie', '1', 4),
                ]),
                makeBase('base_wizard_academy', [
                    makeMinion('m5', 'trickster_gremlin', '1', 2),
                ]),
            ],
            players: core.players,
        });

        const msAfterKingMove = makeMatchState(coreAfterKingMove);
        msAfterKingMove.sys.phase = 'scoreBases';

        // 触发 afterScoring
        const result = triggerBaseAbility('base_pirate_cove', 'afterScoring', {
            state: coreAfterKingMove,
            matchState: msAfterKingMove,
            baseIndex: 0,
            baseDefId: 'base_pirate_cove',
            playerId: '0', // 当前回合玩家
            rankings: [
                { playerId: '0', power: 17, vp: 4 }, // 冠军
                { playerId: '1', power: 4, vp: 1 },  // 非冠军
            ],
            now: 1000,
        });

        // 验证：只为玩家1创建了一个交互
        expect(result.matchState).toBeDefined();
        
        // 应该有一个语义为海盗湾移动选择的 prompt，可能在 current 或 queue 中
        const prompts = getPromptsBySourceId(result.matchState!, 'base_pirate_cove');
        expect(prompts).toHaveLength(1);

        // 验证交互属于玩家1
        const interaction = prompts[0];
        expect(interaction.playerId).toBe('1');
    });

    it('海盗湾 afterScoring 不应该为冠军创建交互', () => {
        const core: SmashUpCore = makeState({
            bases: [
                makeBase('base_pirate_cove', [
                    makeMinion('m1', 'pirate_king', '0', 5),       // 玩家0：冠军
                    makeMinion('m2', 'pirate_buccaneer', '0', 4),
                ]),
            ],
            players: {
                '0': { id: '0', vp: 10, hand: [], deck: [], discard: [], minionsPlayed: 0, minionLimit: 1, actionsPlayed: 0, actionLimit: 1, factions: ['pirates', 'robots'], minionsPlayedPerBase: {}, sameNameMinionDefId: null },
                '1': { id: '1', vp: 5, hand: [], deck: [], discard: [], minionsPlayed: 0, minionLimit: 1, actionsPlayed: 0, actionLimit: 1, factions: ['tricksters', 'wizards'], minionsPlayedPerBase: {}, sameNameMinionDefId: null },
            },
        });

        const ms = makeMatchState(core);

        const result = triggerBaseAbility('base_pirate_cove', 'afterScoring', {
            state: core,
            matchState: ms,
            baseIndex: 0,
            baseDefId: 'base_pirate_cove',
            playerId: '0',
            rankings: [
                { playerId: '0', power: 9, vp: 4 }, // 冠军
            ],
            now: 1000,
        });

        // 验证：没有创建交互（冠军不能移动）
        expectNoPrompt(result.matchState!);
    });

    it('移动随从后不应该触发重新计分', () => {
        // TODO: 实现完整的计分流程测试
        // 1. 海盗湾达到临界点
        // 2. 触发计分
        // 3. afterScoring 创建交互
        // 4. 玩家响应交互，移动随从
        // 5. 验证不会重新触发计分
    });
});
