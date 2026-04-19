/**
 * Pyromancer (烈火术士) 技能升级逻辑覆盖测试
 * 验证升级卡牌打出后，所有的技能变体是否按预期更新，且关键数值正确
 */

import { describe, it, expect } from 'vitest';
import { PYROMANCER_CARDS } from '../heroes/pyromancer/cards';
import {
    FIREBALL_2, BURNING_SOUL_2, HOT_STREAK_2, METEOR_2,
    PYRO_BLAST_2, PYRO_BLAST_3, BURN_DOWN_2, IGNITE_2,
    MAGMA_ARMOR_2, MAGMA_ARMOR_3
} from '../heroes/pyromancer/abilities';
import { TOKEN_IDS, STATUS_IDS } from '../domain/ids';

describe('Pyromancer 技能升级路径验证', () => {

    // 辅助函数：从卡牌中获取升级后的英雄技能变体
    const getUpgradedAbilityFromCard = (cardId: string) => {
        const card = PYROMANCER_CARDS.find(c => c.id === cardId);
        if (!card) throw new Error(`找不到卡牌: ${cardId}`);
        const effect = card.effects?.find(e => e.action.type === 'replaceAbility');
        return effect?.action.newAbilityDef;
    };

    it('Fireball II 升级校验', () => {
        const ability = getUpgradedAbilityFromCard('card-fireball-2');
        expect(ability).toBeDefined();
        // 验证变体：Fireball-2 应至少包含 3/4/5 个火符号的变体
        const variants = ability.variants || [];
        expect(variants.length).toBe(3);
        // 验证数值：升级后 3 火应该给 2 点 Fire Mastery (相比 I 级的 1 点)
        const v3 = variants.find(v => v.id === 'fireball-2-3');
        const fmEffect = v3?.effects.find(e => e.action.tokenId === TOKEN_IDS.FIRE_MASTERY);
        expect(fmEffect?.action.value).toBe(2);
    });

    it('Burning Soul II 升级校验', () => {
        const ability = getUpgradedAbilityFromCard('card-burning-soul-2');
        expect(ability).toBeDefined();
        // 验证变体：升级后包含 blazing-soul (2岩浆+2火魂)
        const blazing = ability.variants?.find(v => v.id === 'blazing-soul');
        expect(blazing).toBeDefined();
        // blazing-soul 应包含 increase-fm-limit + gainFM5 + inflictKnockdown
        const fmLimit = blazing?.effects.find(e => e.action.customActionId === 'increase-fm-limit');
        expect(fmLimit).toBeDefined();
        const knockdown = blazing?.effects.find(e => e.action.statusId === STATUS_IDS.KNOCKDOWN);
        expect(knockdown).toBeDefined();
    });

    it('Hot Streak II 升级校验', () => {
        const ability = getUpgradedAbilityFromCard('card-hot-streak-2');
        expect(ability).toBeDefined();
        // 验证变体：应该包含 Incinerate (焚烧) 分支
        const incinerate = ability.variants?.find(v => v.id === 'incinerate');
        expect(incinerate).toBeDefined();
        expect(incinerate?.priority).toBe(2);
        // 焚烧应该有 6 点基础伤害
        const dmg = incinerate?.effects.find(e => e.action.type === 'damage');
        expect(dmg?.action.value).toBe(6);
    });

    it('Meteor II 升级校验', () => {
        const ability = getUpgradedAbilityFromCard('card-meteor-2');
        const v2 = ability.variants?.find(v => v.id === 'meteor-2');
        // Meteor II (x4) 的 FM 获取由 meteor-resolve custom action 内部处理
        // 验证 custom action 存在
        const customAction = v2?.effects.find(e => e.action.customActionId === 'meteor-resolve');
        expect(customAction).toBeDefined();
        // 验证有 STUN 效果
        const stun = v2?.effects.find(e => e.action.statusId === STATUS_IDS.DAZE);
        expect(stun).toBeDefined();
    });

    it('Pyro Blast II & III 升级校验', () => {
        const ab2 = getUpgradedAbilityFromCard('card-pyro-blast-2');
        const ab3 = getUpgradedAbilityFromCard('card-pyro-blast-3');

        // 验证自定义动作 ID 区分
        const action2 = ab2.effects.find(e => e.action.customActionId === 'pyro-blast-2-roll');
        const action3 = ab3.effects.find(e => e.action.customActionId === 'pyro-blast-3-roll');
        expect(action2).toBeDefined();
        expect(action3).toBeDefined();
    });

    it('Burn Down II 升级校验', () => {
        const ability = getUpgradedAbilityFromCard('card-burn-down-2');
        // FM 获取由 burn-down-2-resolve custom action 内部处理
        // 验证 custom action 存在
        const customAction = ability.effects.find(e => e.action.customActionId === 'burn-down-2-resolve');
        expect(customAction).toBeDefined();
    });

    it('Magma Armor II & III 升级校验', () => {
        const ab2 = getUpgradedAbilityFromCard('card-magma-armor-2');
        const ab3 = getUpgradedAbilityFromCard('card-magma-armor-3');
        expect(ab2.effects[0].action.customActionId).toBe('magma-armor-2-resolve');
        expect(ab3.effects[0].action.customActionId).toBe('magma-armor-3-resolve');
    });
});
