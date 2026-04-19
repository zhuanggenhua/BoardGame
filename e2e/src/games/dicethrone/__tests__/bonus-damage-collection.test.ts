/**
 * bonusDamage 自动收集测试
 * 
 * 验证伤害计算管线能够自动收集 pendingAttack.bonusDamage
 * 并将其记录到 breakdown 中，使 ActionLog 能够正确显示攻击修正卡的效果。
 */

import { describe, it, expect } from 'vitest';
import { createDamageCalculation } from '../../../engine/primitives/damageCalculation';
import type { DiceThroneCore } from '../domain/types';
import { TOKEN_IDS } from '../domain/ids';

describe('bonusDamage 自动收集测试', () => {
    it('应该自动收集 pendingAttack.bonusDamage 并记录到 breakdown', () => {
        // 模拟"红热"卡牌场景：基础伤害 2，bonusDamage +2（来自 2 个火焰精通）
        const state = {
            core: {
                players: {
                    '0': {
                        id: 'player-0',
                        characterId: 'pyromancer',
                        tokens: {
                            [TOKEN_IDS.FIRE_MASTERY]: 2,
                        },
                    },
                    '1': {
                        id: 'player-1',
                        characterId: 'moon_elf',
                        tokens: {},
                    },
                },
                pendingAttack: {
                    attackerId: '0',
                    defenderId: '1',
                    sourceAbilityId: 'meteor',
                    bonusDamage: 2,  // "红热"卡牌的效果
                },
                tokenDefinitions: [],
            },
        };

        const calc = createDamageCalculation({
            baseDamage: 2,
            source: { playerId: '0', abilityId: 'meteor' },
            target: { playerId: '1' },
            state,
            timestamp: Date.now(),
        });

        const result = calc.resolve();

        // 验证最终伤害 = 基础伤害 + bonusDamage
        expect(result.finalDamage).toBe(4);

        // 验证 breakdown 包含 bonusDamage
        expect(result.breakdown.base.value).toBe(2);
        expect(result.breakdown.steps).toHaveLength(1);
        expect(result.breakdown.steps[0].sourceId).toBe('attack_modifier');
        expect(result.breakdown.steps[0].value).toBe(2);
        expect(result.breakdown.steps[0].sourceName).toBe('actionLog.damageSource.attackModifier');
        expect(result.breakdown.steps[0].sourceNameIsI18n).toBe(true);

        // 验证 modifiers 包含 bonusDamage
        expect(result.modifiers).toHaveLength(1);
        expect(result.modifiers[0].type).toBe('flat');
        expect(result.modifiers[0].value).toBe(2);
        expect(result.modifiers[0].sourceId).toBe('attack_modifier');
    });

    it('bonusDamage 为 0 时不应添加修正', () => {
        const state = {
            core: {
                players: {
                    '0': { id: 'player-0', characterId: 'pyromancer', tokens: {} },
                    '1': { id: 'player-1', characterId: 'moon_elf', tokens: {} },
                },
                pendingAttack: {
                    attackerId: '0',
                    defenderId: '1',
                    sourceAbilityId: 'meteor',
                    bonusDamage: 0,
                },
                tokenDefinitions: [],
            },
        };

        const calc = createDamageCalculation({
            baseDamage: 2,
            source: { playerId: '0', abilityId: 'meteor' },
            target: { playerId: '1' },
            state,
            timestamp: Date.now(),
        });

        const result = calc.resolve();

        expect(result.finalDamage).toBe(2);
        expect(result.breakdown.steps).toHaveLength(0);
        expect(result.modifiers).toHaveLength(0);
    });

    it('没有 pendingAttack 时不应崩溃', () => {
        const state = {
            core: {
                players: {
                    '0': { id: 'player-0', characterId: 'pyromancer', tokens: {} },
                    '1': { id: 'player-1', characterId: 'moon_elf', tokens: {} },
                },
                tokenDefinitions: [],
            },
        };

        const calc = createDamageCalculation({
            baseDamage: 2,
            source: { playerId: '0', abilityId: 'meteor' },
            target: { playerId: '1' },
            state,
            timestamp: Date.now(),
        });

        const result = calc.resolve();

        expect(result.finalDamage).toBe(2);
        expect(result.breakdown.steps).toHaveLength(0);
    });

    it('bonusDamage 只对攻击方生效', () => {
        // 防御方的 bonusDamage 不应被收集
        const state = {
            core: {
                players: {
                    '0': { id: 'player-0', characterId: 'pyromancer', tokens: {} },
                    '1': { id: 'player-1', characterId: 'moon_elf', tokens: {} },
                },
                pendingAttack: {
                    attackerId: '1',  // 攻击方是玩家 1
                    defenderId: '0',
                    sourceAbilityId: 'longbow',
                    bonusDamage: 3,
                },
                tokenDefinitions: [],
            },
        };

        // 但我们计算的是玩家 0 的伤害（不是攻击方）
        const calc = createDamageCalculation({
            baseDamage: 2,
            source: { playerId: '0', abilityId: 'meteor' },
            target: { playerId: '1' },
            state,
            timestamp: Date.now(),
        });

        const result = calc.resolve();

        // bonusDamage 不应被收集（因为 source.playerId !== pendingAttack.attackerId）
        expect(result.finalDamage).toBe(2);
        expect(result.breakdown.steps).toHaveLength(0);
    });

    it('bonusDamage 与 Token 修正同时存在', () => {
        const state = {
            core: {
                players: {
                    '0': {
                        id: 'player-0',
                        characterId: 'pyromancer',
                        tokens: {
                            [TOKEN_IDS.FIRE_MASTERY]: 3,  // FM 有 damageBonus
                        },
                    },
                    '1': { id: 'player-1', characterId: 'moon_elf', tokens: {} },
                },
                pendingAttack: {
                    attackerId: '0',
                    defenderId: '1',
                    sourceAbilityId: 'meteor',
                    bonusDamage: 2,  // "红热"卡牌
                },
                tokenDefinitions: [
                    {
                        id: TOKEN_IDS.FIRE_MASTERY,
                        name: 'token.fire_mastery.name',
                        category: 'buff',
                        damageBonus: 1,  // 每个 FM +1 伤害
                    },
                ],
            },
        };

        const calc = createDamageCalculation({
            baseDamage: 2,
            source: { playerId: '0', abilityId: 'meteor' },
            target: { playerId: '1' },
            state,
            timestamp: Date.now(),
        });

        const result = calc.resolve();

        // 最终伤害 = 基础 2 + FM 3 + bonusDamage 2 = 7
        expect(result.finalDamage).toBe(7);

        // breakdown 应该包含两个修正
        expect(result.breakdown.steps).toHaveLength(2);
        
        // Token 修正（priority 10）
        const tokenMod = result.breakdown.steps.find(s => s.sourceId === TOKEN_IDS.FIRE_MASTERY);
        expect(tokenMod).toBeDefined();
        expect(tokenMod?.value).toBe(3);
        
        // bonusDamage 修正（priority 15）
        const bonusMod = result.breakdown.steps.find(s => s.sourceId === 'attack_modifier');
        expect(bonusMod).toBeDefined();
        expect(bonusMod?.value).toBe(2);
    });

    it('显式传入 attack_modifier 时不应再次自动收集 pendingAttack.bonusDamage', () => {
        const state = {
            core: {
                players: {
                    '0': { id: 'player-0', characterId: 'paladin', tokens: {} },
                    '1': { id: 'player-1', characterId: 'monk', tokens: {} },
                },
                pendingAttack: {
                    attackerId: '0',
                    defenderId: '1',
                    sourceAbilityId: 'holy-strike-2-small',
                    bonusDamage: 4,
                },
                tokenDefinitions: [],
            },
        };

        const calc = createDamageCalculation({
            baseDamage: 7,
            source: { playerId: '0', abilityId: 'holy-strike-2-small' },
            target: { playerId: '1' },
            state,
            timestamp: Date.now(),
            autoCollectBonusDamage: false,
            additionalModifiers: [{
                id: '__bonus_damage_from_config__',
                type: 'flat',
                value: 4,
                priority: 15,
                source: 'attack_modifier',
                description: 'actionLog.damageSource.attackModifier',
            }],
        });

        const result = calc.resolve();

        expect(result.finalDamage).toBe(11);
        expect(result.breakdown.base.value).toBe(7);
        expect(result.breakdown.steps).toHaveLength(1);
        expect(result.breakdown.steps[0].sourceId).toBe('attack_modifier');
        expect(result.breakdown.steps[0].value).toBe(4);
        expect(result.modifiers).toHaveLength(1);
    });
});
