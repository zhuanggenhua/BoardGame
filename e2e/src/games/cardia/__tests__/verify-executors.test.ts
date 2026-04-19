/**
 * 验证能力执行器注册
 */

import { describe, it, expect } from 'vitest';
import { abilityExecutorRegistry } from '../domain/abilityExecutor';
import { ABILITY_IDS } from '../domain/ids';

// 导入所有能力组以注册执行器
import '../domain/abilities/group1-resources';
import '../domain/abilities/group2-modifiers';
import '../domain/abilities/group3-ongoing';
import '../domain/abilities/group4-card-ops';
import '../domain/abilities/group5-copy';
import '../domain/abilities/group6-special';
import '../domain/abilities/group7-faction';

describe('Cardia - 能力执行器注册验证', () => {
    it.skip('TODO: Deck II - 应该注册所有 32 个能力执行器', () => {
        const allAbilityIds = Object.values(ABILITY_IDS);
        
        console.log(`总共有 ${allAbilityIds.length} 个能力 ID`);
        console.log(`注册表大小: ${abilityExecutorRegistry.size}`);
        
        expect(allAbilityIds.length).toBe(32);
        expect(abilityExecutorRegistry.size).toBeGreaterThan(0);
        
        // 检查每个能力是否都有执行器
        const missingExecutors: string[] = [];
        for (const abilityId of allAbilityIds) {
            const executor = abilityExecutorRegistry.resolve(abilityId);
            if (!executor) {
                missingExecutors.push(abilityId);
            }
        }
        
        if (missingExecutors.length > 0) {
            console.log('缺失的执行器:', missingExecutors);
        }
        
        expect(missingExecutors).toHaveLength(0);
    });
    
    it.skip('TODO: Deck II - 组 1 能力应该都有执行器', () => {
        const group1Ids = [
            ABILITY_IDS.SABOTEUR,
            ABILITY_IDS.REVOLUTIONARY,
            ABILITY_IDS.HEIR,
        ];
        
        for (const id of group1Ids) {
            const executor = abilityExecutorRegistry.resolve(id);
            expect(executor).toBeDefined();
        }
    });
    
    it.skip('TODO: Deck II - 组 7 能力应该都有执行器', () => {
        const group7Ids = [
            ABILITY_IDS.AMBUSHER,
            ABILITY_IDS.WITCH_KING,
        ];
        
        for (const id of group7Ids) {
            const executor = abilityExecutorRegistry.resolve(id);
            expect(executor).toBeDefined();
        }
    });
});
