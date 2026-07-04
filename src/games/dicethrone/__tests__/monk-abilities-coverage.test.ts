
import { describe, it, expect } from 'vitest';
import { MONK_CARDS } from '../heroes/monk/cards';
import { MONK_ABILITIES } from '../heroes/monk/abilities';
import type { AbilityCard } from '../domain/types';
import zhCN from '../../../../public/locales/zh-CN/game-dicethrone.json';

const getReplaceAction = (card: AbilityCard) => (
    card.effects?.find(effect => effect.action?.type === 'replaceAbility')?.action as {
        type: 'replaceAbility';
        targetAbilityId: string;
        newAbilityDef: { id: string };
        newAbilityLevel: number;
    } | undefined
);

describe('Monk 升级卡覆盖测试', () => {
    it('所有升级卡必须包含 replaceAbility 并指向现有技能', () => {
        const abilityIds = new Set(MONK_ABILITIES.map(ability => ability.id));
        const upgradeCards = MONK_CARDS.filter(card => card.type === 'upgrade');
        expect(upgradeCards.length).toBeGreaterThan(0);

        for (const card of upgradeCards) {
            const action = getReplaceAction(card);
            expect(action).toBeDefined();
            expect(action?.targetAbilityId).toBeDefined();
            expect(action?.newAbilityDef).toBeDefined();
            expect(action?.newAbilityLevel).toBeGreaterThan(1);
            expect(abilityIds.has(action?.targetAbilityId ?? '')).toBe(true);
            expect(action?.newAbilityDef?.id).toBe(action?.targetAbilityId);
        }
    });

    it('指定升级卡等级配置正确', () => {
        const expectations = [
            { cardId: 'card-meditation-2', target: 'meditation', level: 2 },
            { cardId: 'card-meditation-3', target: 'meditation', level: 3 },
            { cardId: 'card-zen-fist-2', target: 'calm-water', level: 2 },
            { cardId: 'card-storm-assault-2', target: 'thunder-strike', level: 2 },
            { cardId: 'card-combo-punch-2', target: 'taiji-combo', level: 2 },
            { cardId: 'card-lotus-bloom-2', target: 'lotus-palm', level: 2 },
            { cardId: 'card-mahayana-2', target: 'harmony', level: 2 },
            { cardId: 'card-thrust-punch-2', target: 'fist-technique', level: 2 },
            { cardId: 'card-thrust-punch-3', target: 'fist-technique', level: 3 },
            { cardId: 'card-contemplation-2', target: 'zen-forget', level: 2 },
        ];

        for (const expectation of expectations) {
            const card = MONK_CARDS.find(item => item.id === expectation.cardId);
            expect(card).toBeDefined();
            if (!card) continue;
            const action = getReplaceAction(card);
            expect(action?.targetAbilityId).toBe(expectation.target);
            expect(action?.newAbilityLevel).toBe(expectation.level);
        }
    });

    it('花开见佛 II 只录入卡图可见的 3/4 莲花分支名', () => {
        const card = MONK_CARDS.find(item => item.id === 'card-lotus-bloom-2');
        expect(card).toBeDefined();
        const action = getReplaceAction(card!);
        const variants = action?.newAbilityDef?.variants ?? [];

        expect(variants.map(variant => variant.id)).toEqual(['lotus-palm-2-3', 'lotus-palm-2-4']);
        expect(variants.map(variant => variant.trigger)).toEqual([
            { type: 'diceSet', faces: { lotus: 3 } },
            { type: 'diceSet', faces: { lotus: 4 } },
        ]);
        expect(variants).not.toContainEqual(expect.objectContaining({ id: 'lotus-palm-2-5' }));

        expect(zhCN.abilities['lotus-palm'].name).toBe('花开见佛');
        expect(zhCN.abilities['lotus-palm-2'].name).toBe('花开见佛 II');
        expect(zhCN.abilities['lotus-palm-2-3'].name).toBe('莲花之道');
        expect(zhCN.abilities['lotus-palm-2-4'].name).toBe('花开见佛 II');
        expect(zhCN.cards['card-lotus-bloom-2'].name).toBe('花开见佛 II');
        expect(zhCN.abilities['lotus-palm-2'].description).not.toContain('见微知著');
        expect(zhCN.cards['card-lotus-bloom-2'].description).not.toContain('见微知著');
    });
});
