/**
 * 护盾日志显示集成测试
 * 
 * 模拟真实游戏场景：刺客使用 CP 造成伤害，月精灵使用"下次一定"卡牌和"打不到我"防御技能
 */

import { describe, it, expect } from 'vitest';
import { reduce } from '../domain/reducer';
import type { DiceThroneCore, DiceThroneEvent, DamageDealtEvent } from '../domain/types';
import { RESOURCE_IDS } from '../domain/resources';

describe('护盾日志显示集成测试', () => {
    it('真实场景：刺客 10 点伤害 vs 月精灵护盾（下次一定6点 + 打不到我50%）', async () => {
        // 初始状态：月精灵有两个护盾
        const initialState: DiceThroneCore = {
            players: {
                '0': {
                    id: '0',
                    characterId: 'moon-elf',
                    resources: { [RESOURCE_IDS.HP]: 50, [RESOURCE_IDS.CP]: 5 },
                    hand: [],
                    deck: [],
                    discard: [],
                    statusEffects: {},
                    tokens: {},
                    tokenStackLimits: {},
                    damageShields: [
                        { value: 6, sourceId: 'card-next-time', preventStatus: false }, // 固定值护盾
                        { reductionPercent: 50, sourceId: 'miss-me', preventStatus: false }, // 百分比护盾
                    ],
                    abilities: [],
                    abilityLevels: {},
                    upgradeCardByAbilityId: {},
                    passiveAbilities: null,
                },
                '1': {
                    id: '1',
                    characterId: 'shadow_thief',
                    resources: { [RESOURCE_IDS.HP]: 50, [RESOURCE_IDS.CP]: 13 },
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
            selectedCharacters: { '0': 'moon-elf', '1': 'shadow_thief' },
            readyPlayers: { '0': true, '1': true },
            hostPlayerId: '0',
            hostStarted: true,
            dice: [],
            rollCount: 0,
            rollLimit: 3,
            rollDiceCount: 5,
            rollConfirmed: false,
            activePlayerId: '1',
            startingPlayerId: '0',
            turnNumber: 1,
            pendingAttack: {
                attackerId: '1',
                defenderId: '0',
                sourceAbilityId: 'shadow-shank-damage',
                isUltimate: false,
                isDefendable: true,
            },
            tokenDefinitions: [],
            lastEffectSourceByPlayerId: {},
            activatingAbilityId: null,
            pendingDamage: null,
            pendingBonusDiceSettlement: null,
            lastResolvedAttackDamage: null,
        };

        // 刺客造成 10 点伤害
        const damageEvent: DamageDealtEvent = {
            type: 'DAMAGE_DEALT',
            payload: {
                targetId: '0',
                amount: 10,
                actualDamage: 10,
                sourceAbilityId: 'shadow-shank-damage',
                sourcePlayerId: '1',
            },
            sourceCommandType: 'DAMAGE_DEALT',
            timestamp: Date.now(),
        };

        // 同批次中的百分比护盾事件（模拟 reduceCombat 中的逻辑）
        const shieldEvent: DiceThroneEvent = {
            type: 'DAMAGE_SHIELD_GRANTED',
            payload: {
                targetId: '0',
                sourceId: 'miss-me',
                reductionPercent: 50,
            },
            sourceCommandType: 'DAMAGE_DEALT',
            timestamp: Date.now(),
        };

        // 执行 reduce
        const newState = reduce(initialState, damageEvent);

        // 验证伤害计算：
        // 基础伤害：10
        // 百分比护盾：10 * 50% = 5（向上取整）
        // 剩余伤害：10 - 5 = 5
        // 固定值护盾：5（被"下次一定"吸收）
        // 最终伤害：0
        expect(newState.players['0'].resources[RESOURCE_IDS.HP]).toBe(50); // HP 不变
        expect(newState.players['0'].damageShields).toHaveLength(1); // 剩余 1 点护盾
        expect(newState.players['0'].damageShields[0].value).toBe(1); // 6 - 5 = 1

        // 验证 shieldsConsumed 记录
        expect(damageEvent.payload.shieldsConsumed).toBeDefined();
        expect(damageEvent.payload.shieldsConsumed).toHaveLength(2);
        
        // 第一个护盾：打不到我（百分比），吸收 5 点（百分比护盾先处理）
        expect(damageEvent.payload.shieldsConsumed![0]).toMatchObject({
            sourceId: 'miss-me',
            reductionPercent: 50,
            absorbed: 5,
        });
        
        // 第二个护盾：下次一定，消耗 5 点（剩余 1 点）
        expect(damageEvent.payload.shieldsConsumed![1]).toMatchObject({
            sourceId: 'card-next-time',
            value: 6,
            absorbed: 5,
        });

        // 模拟 ActionLog 格式化
        const mockCommand = {
            type: 'SELECT_ABILITY' as const,
            playerId: '1',
            payload: { abilityId: 'shadow-shank-damage' },
            timestamp: Date.now(),
        };

        const mockMatchState = {
            core: newState,
            sys: { phase: 'offensiveRoll' },
        };

        // 调用格式化函数
        const { formatDiceThroneActionEntry } = await import('../game');
        const logEntries = formatDiceThroneActionEntry({
            command: mockCommand,
            state: mockMatchState,
            events: [shieldEvent, damageEvent], // 包含百分比护盾事件
        });

        // 验证日志显示最终伤害
        const logs = Array.isArray(logEntries) ? logEntries : [logEntries].filter(Boolean);
        const damageLog = logs.find(log => log?.kind === 'DAMAGE_DEALT');

        expect(damageLog).toBeDefined();
        const breakdownSeg = damageLog!.segments.find(s => s.type === 'breakdown');
        expect(breakdownSeg).toBeDefined();
        expect(breakdownSeg!.type).toBe('breakdown');

        if (breakdownSeg!.type === 'breakdown') {
            console.log('Scenario 1 - Breakdown lines:', JSON.stringify(breakdownSeg!.lines, null, 2));
            console.log('Scenario 1 - Display text:', breakdownSeg!.displayText);

            // 验证护盾行数量：应该有 2 个（固定值护盾 + 百分比护盾）
            const shieldLines = breakdownSeg!.lines.filter(line => line.value < 0);
            expect(shieldLines.length).toBe(2);

            // 验证护盾值
            const shieldValues = shieldLines.map(l => l.value).sort((a, b) => a - b);
            expect(shieldValues).toEqual([-5, -5]); // 两个护盾各吸收 5 点

            // 关键验证：displayText 应该是最终伤害 0 点，而不是基础伤害 10 点
            expect(breakdownSeg!.displayText).toBe('0');
        }
    });

    it('真实场景2：刺客 14 点伤害 vs 月精灵护盾（下次一定6点 + 打不到我50%）', async () => {
        const initialState: DiceThroneCore = {
            players: {
                '0': {
                    id: '0',
                    characterId: 'moon-elf',
                    resources: { [RESOURCE_IDS.HP]: 50, [RESOURCE_IDS.CP]: 5 },
                    hand: [],
                    deck: [],
                    discard: [],
                    statusEffects: {},
                    tokens: {},
                    tokenStackLimits: {},
                    damageShields: [
                        { value: 6, sourceId: 'card-next-time', preventStatus: false },
                        { reductionPercent: 50, sourceId: 'miss-me', preventStatus: false },
                    ],
                    abilities: [],
                    abilityLevels: {},
                    upgradeCardByAbilityId: {},
                    passiveAbilities: null,
                },
                '1': {
                    id: '1',
                    characterId: 'shadow_thief',
                    resources: { [RESOURCE_IDS.HP]: 50, [RESOURCE_IDS.CP]: 13 },
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
            selectedCharacters: { '0': 'moon-elf', '1': 'shadow_thief' },
            readyPlayers: { '0': true, '1': true },
            hostPlayerId: '0',
            hostStarted: true,
            dice: [],
            rollCount: 0,
            rollLimit: 3,
            rollDiceCount: 5,
            rollConfirmed: false,
            activePlayerId: '1',
            startingPlayerId: '0',
            turnNumber: 1,
            pendingAttack: {
                attackerId: '1',
                defenderId: '0',
                sourceAbilityId: 'shadow-shank-damage',
                isUltimate: false,
                isDefendable: true,
            },
            tokenDefinitions: [],
            lastEffectSourceByPlayerId: {},
            activatingAbilityId: null,
            pendingDamage: null,
            pendingBonusDiceSettlement: null,
            lastResolvedAttackDamage: null,
        };

        // 刺客造成 14 点伤害
        const damageEvent: DamageDealtEvent = {
            type: 'DAMAGE_DEALT',
            payload: {
                targetId: '0',
                amount: 14,
                actualDamage: 14,
                sourceAbilityId: 'shadow-shank-damage',
                sourcePlayerId: '1',
            },
            sourceCommandType: 'DAMAGE_DEALT',
            timestamp: Date.now(),
        };

        const shieldEvent: DiceThroneEvent = {
            type: 'DAMAGE_SHIELD_GRANTED',
            payload: {
                targetId: '0',
                sourceId: 'miss-me',
                reductionPercent: 50,
            },
            sourceCommandType: 'DAMAGE_DEALT',
            timestamp: Date.now(),
        };

        const newState = reduce(initialState, damageEvent);

        // 验证伤害计算：
        // 基础伤害：14
        // 百分比护盾：14 * 50% = 7
        // 剩余伤害：14 - 7 = 7
        // 固定值护盾：6（全部消耗）
        // 最终伤害：7 - 6 = 1
        expect(newState.players['0'].resources[RESOURCE_IDS.HP]).toBe(49); // 50 - 1 = 49
        expect(newState.players['0'].damageShields).toHaveLength(0); // 护盾全部消耗

        // 验证 shieldsConsumed
        expect(damageEvent.payload.shieldsConsumed).toHaveLength(2);
        expect(damageEvent.payload.shieldsConsumed![0].absorbed).toBe(7); // 百分比护盾先处理
        expect(damageEvent.payload.shieldsConsumed![1].absorbed).toBe(6); // 固定值护盾后处理

        // 模拟 ActionLog 格式化
        const mockCommand = {
            type: 'SELECT_ABILITY' as const,
            playerId: '1',
            payload: { abilityId: 'shadow-shank-damage' },
            timestamp: Date.now(),
        };

        const mockMatchState = {
            core: newState,
            sys: { phase: 'offensiveRoll' },
        };

        const { formatDiceThroneActionEntry } = await import('../game');
        const logEntries = formatDiceThroneActionEntry({
            command: mockCommand,
            state: mockMatchState,
            events: [shieldEvent, damageEvent],
        });

        const logs = Array.isArray(logEntries) ? logEntries : [logEntries].filter(Boolean);
        const damageLog = logs.find(log => log?.kind === 'DAMAGE_DEALT');
        const breakdownSeg = damageLog!.segments.find(s => s.type === 'breakdown');

        if (breakdownSeg!.type === 'breakdown') {
            console.log('Scenario 2 - Breakdown lines:', JSON.stringify(breakdownSeg!.lines, null, 2));
            console.log('Scenario 2 - Display text:', breakdownSeg!.displayText);

            // 关键验证：displayText 应该是最终伤害 1 点，而不是基础伤害 14 点
            expect(breakdownSeg!.displayText).toBe('1');
            
            // 验证护盾行
            const shieldLines = breakdownSeg!.lines.filter(line => line.value < 0);
            expect(shieldLines.length).toBe(2);
            const shieldValues = shieldLines.map(l => l.value).sort((a, b) => a - b);
            expect(shieldValues).toEqual([-7, -6]); // 百分比护盾 7 点，固定值护盾 6 点
        }
    });
});
