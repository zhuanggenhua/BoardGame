/**
 * 护盾减伤日志测试
 * 
 * 验证护盾消耗信息是否正确记录到 DAMAGE_DEALT 事件的 payload 中
 */

import { describe, it, expect } from 'vitest';
import { reduce } from '../domain/reducer';
import type { DiceThroneCore, DiceThroneEvent, DamageDealtEvent } from '../domain/types';
import { RESOURCE_IDS } from '../domain/resources';

describe('护盾减伤日志', () => {
    it('固定值护盾消耗应记录到 DAMAGE_DEALT 事件的 shieldsConsumed 中', () => {
        const initialState: DiceThroneCore = {
            players: {
                '0': {
                    id: '0',
                    characterId: 'paladin',
                    resources: { [RESOURCE_IDS.HP]: 50, [RESOURCE_IDS.CP]: 0 },
                    hand: [],
                    deck: [],
                    discard: [],
                    statusEffects: {},
                    tokens: {},
                    tokenStackLimits: {},
                    damageShields: [
                        { value: 6, sourceId: 'card-next-time', preventStatus: false },
                        { value: 3, sourceId: 'holy-defense', preventStatus: false },
                    ],
                    abilities: [],
                    abilityLevels: {},
                    upgradeCardByAbilityId: {},
                    passiveAbilities: null,
                },
                '1': {
                    id: '1',
                    characterId: 'shadow_thief',
                    resources: { [RESOURCE_IDS.HP]: 50, [RESOURCE_IDS.CP]: 0 },
                    hand: [],
                    deck: [],
                    discard: [],
                    statusEffects: {},
                    tokens: {},
                    tokenStackLimits: {},
                    damageShields: [],
                    abilities: [],
                    abilityLevels: {},
                    upgradeCardByAbilityId: {},
                    passiveAbilities: null,
                },
            },
            selectedCharacters: { '0': 'paladin', '1': 'shadow_thief' },
            readyPlayers: { '0': true, '1': true },
            hostPlayerId: '0',
            hostStarted: true,
            dice: [],
            rollCount: 0,
            rollLimit: 3,
            rollDiceCount: 5,
            rollConfirmed: false,
            activePlayerId: '0',
            startingPlayerId: '0',
            turnNumber: 1,
            pendingAttack: null,
            tokenDefinitions: [],
            lastEffectSourceByPlayerId: {},
            activatingAbilityId: null,
            pendingDamage: null,
            pendingBonusDiceSettlement: null,
            lastResolvedAttackDamage: null,
        };
        
        const damageEvent: DamageDealtEvent = {
            type: 'DAMAGE_DEALT',
            payload: {
                targetId: '0',
                amount: 8,
                actualDamage: 8,
                sourceAbilityId: 'test-ability',
            },
            sourceCommandType: 'DAMAGE_DEALT',
            timestamp: Date.now(),
        };
        
        const newState = reduce(initialState, damageEvent);
        
        // 验证状态变更正确
        expect(newState.players['0'].resources[RESOURCE_IDS.HP]).toBe(50); // 8点伤害被完全抵消，HP 不变
        expect(newState.players['0'].damageShields).toHaveLength(1); // 剩余 1 点护盾
        expect(newState.players['0'].damageShields[0].value).toBe(1); // 神圣防御剩余 1 点
        
        // 验证事件中包含护盾消耗信息
        expect(damageEvent.payload).toHaveProperty('shieldsConsumed');
        
        const shieldsConsumed = damageEvent.payload.shieldsConsumed;
        expect(shieldsConsumed).toHaveLength(2);
        
        // 第一个护盾：下次一定，消耗 6 点
        expect(shieldsConsumed![0]).toMatchObject({
            sourceId: 'card-next-time',
            value: 6,
            absorbed: 6,
        });
        
        // 第二个护盾：神圣防御，消耗 2 点（剩余 1 点）
        expect(shieldsConsumed![1]).toMatchObject({
            sourceId: 'holy-defense',
            value: 3,
            absorbed: 2,
        });
    });
    
    it('单个护盾部分消耗应记录正确的 absorbed 值', () => {
        const initialState: DiceThroneCore = {
            players: {
                '0': {
                    id: '0',
                    characterId: 'paladin',
                    resources: { [RESOURCE_IDS.HP]: 50, [RESOURCE_IDS.CP]: 0 },
                    hand: [],
                    deck: [],
                    discard: [],
                    statusEffects: {},
                    tokens: {},
                    tokenStackLimits: {},
                    damageShields: [
                        { value: 6, sourceId: 'card-next-time', preventStatus: false },
                    ],
                    abilities: [],
                    abilityLevels: {},
                    upgradeCardByAbilityId: {},
                    passiveAbilities: null,
                },
                '1': {
                    id: '1',
                    characterId: 'shadow_thief',
                    resources: { [RESOURCE_IDS.HP]: 50, [RESOURCE_IDS.CP]: 0 },
                    hand: [],
                    deck: [],
                    discard: [],
                    statusEffects: {},
                    tokens: {},
                    tokenStackLimits: {},
                    damageShields: [],
                    abilities: [],
                    abilityLevels: {},
                    upgradeCardByAbilityId: {},
                    passiveAbilities: null,
                },
            },
            selectedCharacters: { '0': 'paladin', '1': 'shadow_thief' },
            readyPlayers: { '0': true, '1': true },
            hostPlayerId: '0',
            hostStarted: true,
            dice: [],
            rollCount: 0,
            rollLimit: 3,
            rollDiceCount: 5,
            rollConfirmed: false,
            activePlayerId: '0',
            startingPlayerId: '0',
            turnNumber: 1,
            pendingAttack: null,
            tokenDefinitions: [],
            lastEffectSourceByPlayerId: {},
            activatingAbilityId: null,
            pendingDamage: null,
            pendingBonusDiceSettlement: null,
            lastResolvedAttackDamage: null,
        };
        
        const damageEvent: DamageDealtEvent = {
            type: 'DAMAGE_DEALT',
            payload: {
                targetId: '0',
                amount: 3,
                actualDamage: 3,
                sourceAbilityId: 'test-ability',
            },
            sourceCommandType: 'DAMAGE_DEALT',
            timestamp: Date.now(),
        };
        
        const newState = reduce(initialState, damageEvent);
        
        // 验证状态变更正确
        expect(newState.players['0'].resources[RESOURCE_IDS.HP]).toBe(50); // 3点伤害被完全抵消
        expect(newState.players['0'].damageShields).toHaveLength(1); // 护盾剩余
        expect(newState.players['0'].damageShields[0].value).toBe(3); // 剩余 3 点
        
        // 验证事件中包含护盾消耗信息
        const shieldsConsumed = damageEvent.payload.shieldsConsumed;
        
        expect(shieldsConsumed).toHaveLength(1);
        expect(shieldsConsumed![0]).toMatchObject({
            sourceId: 'card-next-time',
            value: 6,
            absorbed: 3, // 只消耗了 3 点
        });
    });
    
    it('ActionLog 应显示最终伤害（扣除护盾后）而非基础伤害', async () => {
        const initialState: DiceThroneCore = {
            players: {
                '0': {
                    id: '0',
                    characterId: 'shadow_thief',
                    resources: { [RESOURCE_IDS.HP]: 50, [RESOURCE_IDS.CP]: 13 },
                    hand: [],
                    deck: [],
                    discard: [],
                    dice: [],
                    tokens: {},
                    statusEffects: {},
                    damageShields: [
                        { sourceId: 'card-next-time', value: 6 }, // 固定值护盾不设置 reductionPercent
                        { sourceId: 'card-miss-me', value: 4 },
                    ],
                    abilities: [],
                },
                '1': {
                    id: '1',
                    characterId: 'monk',
                    resources: { [RESOURCE_IDS.HP]: 50, [RESOURCE_IDS.CP]: 0 },
                    hand: [],
                    deck: [],
                    discard: [],
                    dice: [],
                    tokens: {},
                    statusEffects: {},
                    damageShields: [],
                    abilities: [],
                },
            },
            tokenDefinitions: [],
            commonCards: [],
            currentPlayer: '1',
            turnCount: 1,
            pendingAttack: {
                attackerId: '1',
                defenderId: '0',
                sourceAbilityId: 'shadow_thief-shadow-shank-damage',
                isUltimate: false,
            },
        };
        
        // 模拟 13 点伤害（破隐一击）
        const damageEvent: DamageDealtEvent = {
            type: 'DAMAGE_DEALT',
            payload: {
                targetId: '0',
                amount: 13,
                actualDamage: 13,
                sourceAbilityId: 'shadow_thief-shadow-shank-damage',
                sourcePlayerId: '1',
            },
            sourceCommandType: 'DAMAGE_DEALT',
            timestamp: Date.now(),
        };
        
        const newState = reduce(initialState, damageEvent);
        
        // 验证状态：护盾消耗后，实际伤害 = 13 - 6 - 4 = 3 点
        // HP = 50 - 3 = 47（reducer 会扣除护盾后的伤害）
        expect(newState.players['0'].resources[RESOURCE_IDS.HP]).toBe(47); // 50 - 3 = 47
        expect(newState.players['0'].damageShields).toHaveLength(0); // 护盾全部消耗
        
        // 验证 shieldsConsumed 记录（reducer 会回填到事件中）
        expect(damageEvent.payload.shieldsConsumed).toBeDefined();
        expect(damageEvent.payload.shieldsConsumed).toHaveLength(2);
        expect(damageEvent.payload.shieldsConsumed![0].absorbed).toBe(6);
        expect(damageEvent.payload.shieldsConsumed![1].absorbed).toBe(4);
        
        // 模拟 ActionLog 格式化
        const mockCommand = {
            type: 'SELECT_ABILITY' as const,
            playerId: '1',
            payload: { abilityId: 'shadow_thief-shadow-shank-damage' },
            timestamp: Date.now(),
        };
        
        const mockMatchState = {
            core: newState,
            sys: { phase: 'offensiveRoll' },
        };
        
        // 调用格式化函数
        const { diceThroneSystemsForTest, formatDiceThroneActionEntry } = await import('../game');
        const logEntries = formatDiceThroneActionEntry({
            command: mockCommand,
            state: mockMatchState,
            events: [damageEvent],
        });
        
        // 验证日志显示最终伤害
        const logs = Array.isArray(logEntries) ? logEntries : [logEntries].filter(Boolean);
        const damageLog = logs.find(log => log?.kind === 'DAMAGE_DEALT');
        
        expect(damageLog).toBeDefined();
        expect(damageLog!.segments).toHaveLength(3); // before + breakdown + after
        
        const breakdownSeg = damageLog!.segments[1];
        expect(breakdownSeg.type).toBe('breakdown');
        
        if (breakdownSeg.type === 'breakdown') {
            // 关键验证：显示的应该是最终伤害 3 点，而不是基础伤害 13 点
            expect(breakdownSeg.displayText).toBe('3');
            
            // breakdown 应该包含两个护盾行
            const shieldLines = breakdownSeg.lines.filter(line => line.value < 0);
            expect(shieldLines).toHaveLength(2);
            expect(shieldLines[0].value).toBe(-6); // 下次一定
            expect(shieldLines[1].value).toBe(-4); // 打不到我
        }
    });
});
