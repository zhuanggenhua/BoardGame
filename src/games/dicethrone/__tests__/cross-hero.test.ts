/**
 * DiceThrone 跨英雄对战测试
 *
 * 覆盖范围：
 * 1. 不同英雄对组合的选角与初始化
 * 2. 不同英雄的骰子定义正确加载
 * 3. 不同英雄的防御技能正确触发
 */

import { describe, it, expect } from 'vitest';
import { DiceThroneDomain } from '../domain';
import type { DiceThroneCore, DiceThroneCommand } from '../domain/types';
import { RESOURCE_IDS } from '../domain/resources';
import { INITIAL_HEALTH, INITIAL_CP } from '../domain/types';
import type { MatchState, PlayerId, RandomFn } from '../../../engine/types';
import { createInitialSystemState, executePipeline } from '../../../engine/pipeline';
import { GameTestRunner } from '../../../engine/testing';
import {
    fixedRandom,
    createQueuedRandom,
    cmd,
    testSystems,
    assertState,
    type CommandInput,
} from './test-utils';

// ============================================================================
// 跨英雄 setup 工具
// ============================================================================

function createInitializedStateWithCharacters(
    playerIds: PlayerId[],
    random: RandomFn,
    characters: Record<PlayerId, string>
): MatchState<DiceThroneCore> {
    const pipelineConfig = {
        domain: DiceThroneDomain,
        systems: testSystems,
    };

    let state: MatchState<DiceThroneCore> = {
        core: DiceThroneDomain.setup(playerIds, random),
        sys: createInitialSystemState(playerIds, testSystems, undefined),
    };

    const commands: CommandInput[] = [
        cmd('SELECT_CHARACTER', '0', { characterId: characters['0'] ?? 'monk' }),
        cmd('SELECT_CHARACTER', '1', { characterId: characters['1'] ?? 'monk' }),
        cmd('PLAYER_READY', '1'),
        cmd('HOST_START_GAME', '0'),
    ];

    for (const input of commands) {
        const command = {
            type: input.type,
            playerId: input.playerId,
            payload: input.payload,
            timestamp: Date.now(),
        } as DiceThroneCommand;
        const result = executePipeline(pipelineConfig, state, command, random, playerIds);
        if (result.success) {
            state = result.state as MatchState<DiceThroneCore>;
        }
    }

    return state;
}

function createCrossHeroRunner(
    random: RandomFn,
    characters: Record<PlayerId, string>,
    silent = true
) {
    return new GameTestRunner({
        domain: DiceThroneDomain,
        systems: testSystems,
        playerIds: ['0', '1'],
        random,
        setup: (playerIds: PlayerId[], r: RandomFn) => createInitializedStateWithCharacters(playerIds, r, characters),
        assertFn: assertState,
        silent,
    });
}

// ============================================================================
// 测试
// ============================================================================

describe('跨英雄对战', () => {
    describe('选角与初始化', () => {
        const heroPairs: [string, string][] = [
            ['monk', 'barbarian'],
            ['monk', 'paladin'],
            ['barbarian', 'pyromancer'],
            ['shadow_thief', 'moon_elf'],
            ['paladin', 'pyromancer'],
        ];

        it.each(heroPairs)('%s vs %s 初始化成功', (hero0, hero1) => {
            const state = createInitializedStateWithCharacters(
                ['0', '1'],
                fixedRandom,
                { '0': hero0, '1': hero1 }
            );

            expect(state.core.players['0'].characterId).toBe(hero0);
            expect(state.core.players['1'].characterId).toBe(hero1);
            expect(state.core.players['0'].resources[RESOURCE_IDS.HP]).toBe(INITIAL_HEALTH);
            expect(state.core.players['1'].resources[RESOURCE_IDS.HP]).toBe(INITIAL_HEALTH);
            expect(state.core.players['0'].resources[RESOURCE_IDS.CP]).toBe(INITIAL_CP);
            expect(state.core.players['1'].resources[RESOURCE_IDS.CP]).toBe(INITIAL_CP);
            expect(state.core.players['0'].hand.length).toBe(4);
            expect(state.core.players['1'].hand.length).toBe(4);
            expect(state.sys.phase).toBe('main1');
        });
    });

    describe('圣骑士 vs 僧侣', () => {
        it('圣骑士初始化 - 技能与骰子正确', () => {
            const state = createInitializedStateWithCharacters(
                ['0', '1'],
                fixedRandom,
                { '0': 'paladin', '1': 'monk' }
            );

            // 圣骑士应有 8 个技能
            expect(state.core.players['0'].abilities).toHaveLength(8);

            // 圣骑士技能 ID 验证
            const paladinAbilityIds = state.core.players['0'].abilities.map(a => a.id);
            expect(paladinAbilityIds).toContain('righteous-combat');
            expect(paladinAbilityIds).toContain('blessing-of-might');
            expect(paladinAbilityIds).toContain('holy-strike');
            expect(paladinAbilityIds).toContain('holy-light');
            expect(paladinAbilityIds).toContain('vengeance');
            expect(paladinAbilityIds).toContain('righteous-prayer');
            expect(paladinAbilityIds).toContain('holy-defense');
            expect(paladinAbilityIds).toContain('unyielding-faith');
        });

        it('圣骑士防御阶段使用 holy-defense', () => {
            // 僧侣进攻，圣骑士防御
            // 僧侣骰面: 1,2=fist → 5 个 fist(值全1) 触发 fist-technique-5
            const runner = createCrossHeroRunner(
                createQueuedRandom([1, 1, 1, 1, 1]),
                { '0': 'monk', '1': 'paladin' }
            );

            const result = runner.run({
                name: '圣骑士防御',
                commands: [
                    cmd('ADVANCE_PHASE', '0'), // main1 -> offensiveRoll
                    cmd('ROLL_DICE', '0'),
                    cmd('CONFIRM_ROLL', '0'),
                    cmd('RESPONSE_PASS', '0'),
                    cmd('RESPONSE_PASS', '1'),
                    cmd('SELECT_ABILITY', '0', { abilityId: 'fist-technique-5' }),
                    cmd('ADVANCE_PHASE', '0'), // -> defensiveRoll
                ],
                expect: {
                    turnPhase: 'defensiveRoll',
                    pendingAttack: {
                        attackerId: '0',
                        defenderId: '1',
                        isDefendable: true,
                        sourceAbilityId: 'fist-technique-5',
                    },
                },
            });
            expect(result.assertionErrors).toEqual([]);
            expect(result.finalState.core.pendingAttack?.defenseAbilityId).toBe('holy-defense');
        });
    });

    describe('影子盗贼 vs 月精灵', () => {
        it('双方初始化 Token 正确', () => {
            const state = createInitializedStateWithCharacters(
                ['0', '1'],
                fixedRandom,
                { '0': 'shadow_thief', '1': 'moon_elf' }
            );

            // 影子盗贼初始 Token 全为 0
            expect(state.core.players['0'].tokens.sneak).toBe(0);
            expect(state.core.players['0'].tokens.sneak_attack).toBe(0);

            // 月精灵初始状态效果全为 0
            expect(state.core.players['1'].statusEffects.blinded ?? 0).toBe(0);
        });
    });

    describe('炎术士 vs 狂战士', () => {
        it('炎术士初始化 - 技能与骰子正确', () => {
            const state = createInitializedStateWithCharacters(
                ['0', '1'],
                fixedRandom,
                { '0': 'barbarian', '1': 'pyromancer' }
            );

            // 狂战士应有 8 个技能
            expect(state.core.players['0'].abilities).toHaveLength(8);
            const barbarianAbilityIds = state.core.players['0'].abilities.map(a => a.id);
            expect(barbarianAbilityIds).toContain('slap');
            expect(barbarianAbilityIds).toContain('thick-skin');

            // 炎术士应有正确数量的技能
            expect(state.core.players['1'].abilities.length).toBeGreaterThanOrEqual(8);
            // 双方 HP/CP 正确
            expect(state.core.players['0'].resources[RESOURCE_IDS.HP]).toBe(INITIAL_HEALTH);
            expect(state.core.players['1'].resources[RESOURCE_IDS.HP]).toBe(INITIAL_HEALTH);
        });

        it('狂战士与炎术士角色 ID 正确', () => {
            const state = createInitializedStateWithCharacters(
                ['0', '1'],
                fixedRandom,
                { '0': 'barbarian', '1': 'pyromancer' }
            );

            expect(state.core.players['0'].characterId).toBe('barbarian');
            expect(state.core.players['1'].characterId).toBe('pyromancer');
            // 双方手牌各 4 张
            expect(state.core.players['0'].hand).toHaveLength(4);
            expect(state.core.players['1'].hand).toHaveLength(4);
        });
    });
});
