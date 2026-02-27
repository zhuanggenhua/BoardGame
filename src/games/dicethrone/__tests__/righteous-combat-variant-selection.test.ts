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
import { evaluateTriggerCondition } from '../domain/combat/conditions';
import { registerDiceThroneConditions } from '../conditions';
import { PALADIN_DICE_FACE_IDS as FACES } from '../domain/ids';
import type { AbilityContext } from '../domain/combat/conditions';

describe('正义战法 III 变体选择', () => {
    beforeAll(() => {
        // 注册 DiceThrone 条件评估器
        registerDiceThroneConditions();
    });

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
        const tenacityVariant = RIGHTEOUS_COMBAT_3.variants![0];
        expect(tenacityVariant.id).toBe('righteous-combat-3-tenacity');
        const tenacityResult = evaluateTriggerCondition(
            tenacityVariant.trigger,
            context
        );
        expect(tenacityResult).toBe(true);

        // 检查正义战法 III (3剑+2盔)
        const mainVariant = RIGHTEOUS_COMBAT_3.variants![1];
        expect(mainVariant.id).toBe('righteous-combat-3-main');
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
        const tenacityVariant = RIGHTEOUS_COMBAT_3.variants![0];
        const tenacityResult = evaluateTriggerCondition(
            tenacityVariant.trigger,
            context
        );
        expect(tenacityResult).toBe(true);

        // 检查正义战法 III (3剑+2盔)
        const mainVariant = RIGHTEOUS_COMBAT_3.variants![1];
        const mainResult = evaluateTriggerCondition(
            mainVariant.trigger,
            context
        );
        expect(mainResult).toBe(false);
    });

    it('两个变体的骰面 key 集合相同但数量不同', () => {
        const tenacityTrigger = RIGHTEOUS_COMBAT_3.variants![0].trigger;
        const mainTrigger = RIGHTEOUS_COMBAT_3.variants![1].trigger;

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
