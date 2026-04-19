/**
 * 狂战士 Token/状态效果 测试
 *
 * 覆盖范围：
 * 1. Token 定义完整性（concussion、daze）
 * 2. 初始状态验证
 * 3. 角色注册数据一致性
 */

import { BARBARIAN_TOKENS, BARBARIAN_INITIAL_TOKENS } from '../heroes/barbarian/tokens';
import { BARBARIAN_ABILITIES } from '../heroes/barbarian/abilities';
import { getBarbarianStartingDeck } from '../heroes/barbarian/cards';
import { CHARACTER_DATA_MAP } from '../domain/characters';
import { STATUS_IDS } from '../domain/ids';

// ============================================================================
// 1. Token 定义完整性
// ============================================================================

describe('狂战士 Token 定义', () => {
    it('应包含 Concussion（脑震荡）状态', () => {
        const concussion = BARBARIAN_TOKENS.find(t => t.id === STATUS_IDS.CONCUSSION);
        expect(concussion).toBeDefined();
        expect(concussion!.category).toBe('debuff');
        expect(concussion!.stackLimit).toBe(1);
        expect(concussion!.passiveTrigger).toBeDefined();
        expect(concussion!.passiveTrigger!.timing).toBe('onPhaseEnter');
        expect(concussion!.passiveTrigger!.removable).toBe(true);
        expect(concussion!.passiveTrigger!.actions).toEqual(
            expect.arrayContaining([expect.objectContaining({ type: 'skipPhase' })])
        );
    });

    it('应包含 Daze（眩晕）状态', () => {
        const daze = BARBARIAN_TOKENS.find(t => t.id === STATUS_IDS.DAZE);
        expect(daze).toBeDefined();
        expect(daze!.category).toBe('debuff');
        expect(daze!.stackLimit).toBe(1);
        expect(daze!.passiveTrigger).toBeDefined();
        expect(daze!.passiveTrigger!.timing).toBe('onAttackEnd');
        expect(daze!.passiveTrigger!.removable).toBe(true);
        expect(daze!.passiveTrigger!.actions).toEqual(
            expect.arrayContaining([expect.objectContaining({ type: 'extraAttack' })])
        );
    });

    it('Token 数量应为 2（concussion + daze）', () => {
        expect(BARBARIAN_TOKENS).toHaveLength(2);
    });
});

// ============================================================================
// 2. 初始状态验证
// ============================================================================

describe('狂战士初始 Token 状态', () => {
    it('所有状态初始值为 0', () => {
        expect(BARBARIAN_INITIAL_TOKENS[STATUS_IDS.CONCUSSION]).toBe(0);
        expect(BARBARIAN_INITIAL_TOKENS[STATUS_IDS.DAZE]).toBe(0);
    });

    it('初始状态键数量与 Token 定义一致', () => {
        const keys = Object.keys(BARBARIAN_INITIAL_TOKENS);
        expect(keys).toHaveLength(BARBARIAN_TOKENS.length);
    });
});

// ============================================================================
// 3. 角色注册数据一致性
// ============================================================================

describe('狂战士角色注册', () => {
    it('CHARACTER_DATA_MAP 中 barbarian 数据正确', () => {
        const data = CHARACTER_DATA_MAP.barbarian;
        expect(data.id).toBe('barbarian');
        expect(data.abilities).toBe(BARBARIAN_ABILITIES);
        expect(data.tokens).toBe(BARBARIAN_TOKENS);
        expect(data.initialTokens).toEqual(BARBARIAN_INITIAL_TOKENS);
        expect(data.diceDefinitionId).toBe('barbarian-dice');
        expect(data.getStartingDeck).toBe(getBarbarianStartingDeck);
    });

    it('技能等级初始值全为 1', () => {
        const data = CHARACTER_DATA_MAP.barbarian;
        for (const level of Object.values(data.initialAbilityLevels)) {
            expect(level).toBe(1);
        }
    });

    it('技能等级映射覆盖所有技能', () => {
        const data = CHARACTER_DATA_MAP.barbarian;
        const abilityIds = BARBARIAN_ABILITIES.map(a => a.id);
        const mappedIds = Object.keys(data.initialAbilityLevels);
        for (const id of abilityIds) {
            expect(mappedIds).toContain(id);
        }
    });
});
