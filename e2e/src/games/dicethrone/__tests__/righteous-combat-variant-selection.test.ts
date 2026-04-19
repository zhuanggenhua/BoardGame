/**
 * 正义战法 III 变体选择测试
 * 
 * 验证当投出 3剑+2盔 时，两个变体都满足条件：
 * - 执着 III (2剑+1盔)
 * - 正义战法 III (3剑+2盔)
 * 
 * 应该弹出选择窗口让玩家选择
 */

import { describe, it, expect, beforeAll } from 'vitest';
import { RIGHTEOUS_COMBAT_3 } from '../heroes/paladin/abilities';
import { ECLIPSE_2 } from '../heroes/moon_elf/abilities';
import { evaluateTriggerCondition } from '../domain/combat/conditions';
import { registerDiceThroneConditions } from '../conditions';
import { PALADIN_DICE_FACE_IDS as FACES } from '../domain/ids';
import type { AbilityContext } from '../domain/combat/conditions';
import { getAbilityChoiceText } from '../ui/abilityChoiceText';

describe('正义战法 III 变体选择', () => {
    beforeAll(() => {
        // 注册 DiceThrone 条件评估器
        registerDiceThroneConditions();
    });

    const getVariantById = (variantId: string) => {
        const variant = RIGHTEOUS_COMBAT_3.variants?.find((v) => v.id === variantId);
        expect(variant).toBeDefined();
        return variant!;
    };

    it('投出 3剑+2盔 时，两个变体都应该满足条件', () => {
        // 模拟投出 3剑+2盔 的骰面
        const context: AbilityContext = {
            currentPhase: 'offensiveRoll',
            diceValues: [1, 1, 1, 3, 3], // 假设 sword=1, helm=3
            faceCounts: {
                [FACES.SWORD]: 3,
                [FACES.HELM]: 2,
            },
            resources: { cp: 10 },
            statusEffects: {},
        };

        // 检查执着 III (2剑+1盔)
        const tenacityVariant = getVariantById('righteous-combat-3-tenacity');
        const tenacityResult = evaluateTriggerCondition(
            tenacityVariant.trigger,
            context
        );
        expect(tenacityResult).toBe(true);

        // 检查正义战法 III (3剑+2盔)
        const mainVariant = getVariantById('righteous-combat-3-main');
        const mainResult = evaluateTriggerCondition(
            mainVariant.trigger,
            context
        );
        expect(mainResult).toBe(true);
    });

    it('投出 2剑+1盔 时，只有执着 III 满足条件', () => {
        const context: AbilityContext = {
            currentPhase: 'offensiveRoll',
            diceValues: [1, 1, 3],
            faceCounts: {
                [FACES.SWORD]: 2,
                [FACES.HELM]: 1,
            },
            resources: { cp: 10 },
            statusEffects: {},
        };

        // 检查执着 III (2剑+1盔)
        const tenacityVariant = getVariantById('righteous-combat-3-tenacity');
        const tenacityResult = evaluateTriggerCondition(
            tenacityVariant.trigger,
            context
        );
        expect(tenacityResult).toBe(true);

        // 检查正义战法 III (3剑+2盔)
        const mainVariant = getVariantById('righteous-combat-3-main');
        const mainResult = evaluateTriggerCondition(
            mainVariant.trigger,
            context
        );
        expect(mainResult).toBe(false);
    });

    it('两个变体的骰面 key 集合相同但数量不同', () => {
        const tenacityTrigger = getVariantById('righteous-combat-3-tenacity').trigger;
        const mainTrigger = getVariantById('righteous-combat-3-main').trigger;

        expect(tenacityTrigger.type).toBe('diceSet');
        expect(mainTrigger.type).toBe('diceSet');

        const tenacityKeys = Object.keys((tenacityTrigger as any).faces).sort().join(',');
        const mainKeys = Object.keys((mainTrigger as any).faces).sort().join(',');

        // 骰面 key 集合相同（都是 sword,helm）
        expect(tenacityKeys).toBe(mainKeys);

        // 但是数量不同
        const tenacityFaces = (tenacityTrigger as any).faces;
        const mainFaces = (mainTrigger as any).faces;
        expect(tenacityFaces[FACES.SWORD]).toBe(2);
        expect(tenacityFaces[FACES.HELM]).toBe(1);
        expect(mainFaces[FACES.SWORD]).toBe(3);
        expect(mainFaces[FACES.HELM]).toBe(2);
    });
});

describe('变体选择文案兜底', () => {
    const translations: Record<string, string> = {
        'abilities.righteous-combat-3.name': 'righteous-combat-3',
        'abilities.righteous-combat-3.effects.heal2': 'heal-2',
        'abilities.righteous-combat-3.effects.damage2Unblockable': 'damage-2-unblockable',
        'abilities.righteous-combat-3.effects.damage6': 'damage-6',
        'abilities.righteous-combat-3.effects.roll3': 'roll-3',
    };

    const resolver = {
        t: (key: string, options?: Record<string, unknown>) => {
            if (key === 'abilityChoice.trigger.countFace') {
                return `${options?.count ?? ''}${options?.face ?? ''}`;
            }
            return translations[key] ?? key;
        },
        exists: (key: string) => key in translations,
    };

    it('缺少变体 locale key 时使用基础技能名和触发条件兜底', () => {
        const tenacity = RIGHTEOUS_COMBAT_3.variants?.find(variant => variant.id === 'righteous-combat-3-tenacity');
        if (!tenacity) {
            throw new Error('missing righteous-combat-3-tenacity');
        }

        const text = getAbilityChoiceText('righteous-combat-3-tenacity', {
            ability: RIGHTEOUS_COMBAT_3,
            variant: tenacity,
        }, resolver);
        const description = text.description ?? '';

        expect(text.name).toContain('righteous-combat-3');
        expect(text.name).toContain('2');
        expect(text.name).toContain('剑');
        expect(text.name).toContain('1');
        expect(text.name).toContain('头盔');
        expect(description).toContain('heal-2');
        expect(description).toContain('damage-2-unblockable');
    });

    it('主变体复用父技能 description key 时，优先展示 effect 汇总', () => {
        const eclipse = ECLIPSE_2.variants?.find(variant => variant.id === 'eclipse-2');
        if (!eclipse) {
            throw new Error('missing eclipse-2');
        }

        const text = getAbilityChoiceText('eclipse-2', {
            ability: ECLIPSE_2,
            variant: eclipse,
        }, {
            t: (key: string) => ({
                'abilities.eclipse-2.name': '星蚀 II',
                'abilities.eclipse-2.description': '包含星蚀与暗月两个变体',
                'abilities.eclipse-2.effects.inflictBlinded': '施加1个致盲标记',
                'abilities.eclipse-2.effects.inflictEntangle': '施加1个缠绕标记',
                'abilities.eclipse-2.effects.inflictTargeted': '施加1个锁定标记',
                'abilities.eclipse-2.effects.damage9': '造成9点伤害',
            }[key] ?? key),
            exists: (key: string) => [
                'abilities.eclipse-2.name',
                'abilities.eclipse-2.description',
                'abilities.eclipse-2.effects.inflictBlinded',
                'abilities.eclipse-2.effects.inflictEntangle',
                'abilities.eclipse-2.effects.inflictTargeted',
                'abilities.eclipse-2.effects.damage9',
            ].includes(key),
        });

        expect(text.name).toBe('星蚀 II');
        expect(text.description).toContain('施加1个致盲标记');
        expect(text.description).toContain('施加1个缠绕标记');
        expect(text.description).toContain('施加1个锁定标记');
        expect(text.description).toContain('造成9点伤害');
        expect(text.description).not.toContain('包含星蚀与暗月两个变体');
    });
});
