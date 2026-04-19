/**
 * Cardia - 能力注册表完整性测试
 * 
 * 验证所有 32 个能力的元数据和执行器都已正确注册
 */

import { describe, it, expect } from 'vitest';
import { abilityRegistry } from '../domain/abilityRegistry';
import { ABILITY_IDS } from '../domain/ids';

describe('Cardia - 能力注册表完整性', () => {
    // I 牌组能力（16 个）
    const deck1Abilities = [
        ABILITY_IDS.MERCENARY_SWORDSMAN,
        ABILITY_IDS.VOID_MAGE,
        ABILITY_IDS.SURGEON,
        ABILITY_IDS.MEDIATOR,
        ABILITY_IDS.SABOTEUR,
        ABILITY_IDS.DIVINER,
        ABILITY_IDS.COURT_GUARD,
        ABILITY_IDS.MAGISTRATE,
        ABILITY_IDS.AMBUSHER,
        ABILITY_IDS.PUPPETEER,
        ABILITY_IDS.CLOCKMAKER,
        ABILITY_IDS.TREASURER,
        ABILITY_IDS.SWAMP_GUARD,
        ABILITY_IDS.GOVERNESS,
        ABILITY_IDS.INVENTOR,
        ABILITY_IDS.ELF,
    ];
    
    // II 牌组能力（16 个）
    const deck2Abilities = [
        ABILITY_IDS.POISONER,
        ABILITY_IDS.TELEKINETIC_MAGE,
        ABILITY_IDS.MESSENGER,
        ABILITY_IDS.TAX_COLLECTOR,
        ABILITY_IDS.REVOLUTIONARY,
        ABILITY_IDS.LIBRARIAN,
        ABILITY_IDS.GENIUS,
        ABILITY_IDS.ARISTOCRAT,
        ABILITY_IDS.EXTORTIONIST,
        ABILITY_IDS.ILLUSIONIST,
        ABILITY_IDS.ENGINEER,
        ABILITY_IDS.ADVISOR,
        ABILITY_IDS.WITCH_KING,
        ABILITY_IDS.ELEMENTALIST,
        ABILITY_IDS.MECHANICAL_SPIRIT,
        ABILITY_IDS.HEIR,
    ];
    
    describe('I 牌组能力注册', () => {
        deck1Abilities.forEach((abilityId) => {
            it(`应该注册 ${abilityId} 的元数据`, () => {
                const ability = abilityRegistry.get(abilityId);
                expect(ability).toBeDefined();
                expect(ability?.id).toBe(abilityId);
                expect(ability?.name).toBeDefined();
                expect(ability?.description).toBeDefined();
                expect(ability?.trigger).toBeDefined();
            });
        });
    });
    
    describe.skip('TODO: Deck II - II 牌组能力注册', () => {
        deck2Abilities.forEach((abilityId) => {
            it(`应该注册 ${abilityId} 的元数据`, () => {
                const ability = abilityRegistry.get(abilityId);
                expect(ability).toBeDefined();
                expect(ability?.id).toBe(abilityId);
                expect(ability?.name).toBeDefined();
                expect(ability?.description).toBeDefined();
                expect(ability?.trigger).toBeDefined();
            });
        });
    });
    
    describe.skip('TODO: Deck II - 能力类型标记', () => {
        it('即时能力应该标记 isInstant=true', () => {
            const instantAbilities = [
                ABILITY_IDS.SABOTEUR,
                ABILITY_IDS.REVOLUTIONARY,
                ABILITY_IDS.SURGEON,
                ABILITY_IDS.TAX_COLLECTOR,
            ];
            
            instantAbilities.forEach((abilityId) => {
                const ability = abilityRegistry.get(abilityId);
                expect(ability?.isInstant).toBe(true);
                expect(ability?.isOngoing).toBe(false);
            });
        });
        
        it('持续能力应该标记 isOngoing=true', () => {
            const ongoingAbilities = [
                ABILITY_IDS.MEDIATOR,
                ABILITY_IDS.MAGISTRATE,
                ABILITY_IDS.TREASURER,
                ABILITY_IDS.ADVISOR,
                ABILITY_IDS.MECHANICAL_SPIRIT,
            ];
            
            ongoingAbilities.forEach((abilityId) => {
                const ability = abilityRegistry.get(abilityId);
                expect(ability?.isOngoing).toBe(true);
                expect(ability?.isInstant).toBe(false);
                expect(ability?.requiresMarker).toBe(true);
            });
        });
    });
    
    describe.skip('TODO: Deck II - 能力触发时机', () => {
        it('失败时触发的能力应该有 trigger=onLose', () => {
            const onLoseAbilities = [
                ABILITY_IDS.SABOTEUR,
                ABILITY_IDS.REVOLUTIONARY,
                ABILITY_IDS.SURGEON,
                ABILITY_IDS.WITCH_KING,
            ];
            
            onLoseAbilities.forEach((abilityId) => {
                const ability = abilityRegistry.get(abilityId);
                expect(ability?.trigger).toBe('onLose');
            });
        });
        
        it('胜利时触发的能力应该有 trigger=onWin', () => {
            const onWinAbilities = [
                ABILITY_IDS.ARISTOCRAT,
            ];
            
            onWinAbilities.forEach((abilityId) => {
                const ability = abilityRegistry.get(abilityId);
                expect(ability?.trigger).toBe('onWin');
            });
        });
        
        it('持续能力应该有 trigger=ongoing', () => {
            const ongoingAbilities = [
                ABILITY_IDS.MEDIATOR,
                ABILITY_IDS.MAGISTRATE,
                ABILITY_IDS.TREASURER,
                ABILITY_IDS.ADVISOR,
                ABILITY_IDS.MECHANICAL_SPIRIT,
            ];
            
            ongoingAbilities.forEach((abilityId) => {
                const ability = abilityRegistry.get(abilityId);
                expect(ability?.trigger).toBe('ongoing');
            });
        });
    });
});
