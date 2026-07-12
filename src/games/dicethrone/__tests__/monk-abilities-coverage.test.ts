
import { describe, it, expect } from 'vitest';
import { MONK_CARDS } from '../heroes/monk/cards';
import { MONK_ABILITIES } from '../heroes/monk/abilities';
import type { AbilityCard } from '../domain/types';
import { DICE_FACE_IDS, STATUS_IDS, TOKEN_IDS } from '../domain/ids';
import zhCN from '../../../../public/locales/zh-CN/game-dicethrone.json';

type TestAbilityVariant = {
    id: string;
    trigger?: unknown;
    effects?: Array<{
        action?: {
            type?: string;
            value?: number;
            unblockable?: boolean;
            customActionId?: string;
            statusId?: string;
            tokenId?: string;
            diceCount?: number;
            conditionalEffects?: Array<{
                face?: string;
                bonusDamage?: number;
                grantToken?: { tokenId: string; value: number };
                triggerChoice?: { options: Array<{ tokenId: string; value: number }> };
            }>;
        };
        timing?: string;
        condition?: unknown;
    }>;
    tags?: string[];
};

const getReplaceAction = (card: AbilityCard) => (
    card.effects?.find(effect => effect.action?.type === 'replaceAbility')?.action as {
        type: 'replaceAbility';
        targetAbilityId: string;
        newAbilityDef: { id: string; trigger?: unknown; effects?: TestAbilityVariant['effects']; variants?: TestAbilityVariant[] };
        newAbilityLevel: number;
    } | undefined
);

describe('Monk 基础技能图面合同', () => {
    it('一级花开见佛按玩家板固定造成不可防御伤害，然后上限+1并获得5个太极', () => {
        const ability = MONK_ABILITIES.find(item => item.id === 'lotus-palm');
        expect(ability).toBeDefined();
        expect(ability?.trigger).toEqual({ type: 'diceSet', faces: { [DICE_FACE_IDS.LOTUS]: 4 } });
        expect(ability?.tags).toContain('unblockable');

        const effects = ability?.effects as TestAbilityVariant['effects'];
        expect(effects?.map(effect => effect.action?.customActionId ?? effect.action?.type)).toEqual([
            'damage',
            'lotus-palm-taiji-cap-up-and-grant5',
        ]);

        expect(effects?.[0]?.action).toMatchObject({
            type: 'damage',
            value: 5,
            unblockable: true,
        });
        expect(effects?.[1]?.timing).toBe('postDamage');
        expect(effects?.[1]?.condition).toBeUndefined();
        expect(effects?.some(effect => effect.action?.customActionId === 'lotus-palm-unblockable-choice')).toBe(false);

        expect(zhCN.abilities['lotus-palm'].effects.damage5).toContain('不可防御');
        expect(zhCN.abilities['lotus-palm'].effects.taijiCapMax).toContain('获得 5 个太极标记');
        expect(zhCN.abilities['lotus-palm'].effects.unblockable).not.toContain('花费');
    });
});

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

    it('僧侣高风险升级牌语义必须与卡图分支结构一致', () => {
        const byId = Object.fromEntries(MONK_CARDS.map(card => [card.id, card]));

        const meditation2 = getReplaceAction(byId['card-meditation-2']);
        expect(meditation2?.newAbilityDef.trigger).toEqual({ type: 'phase', phaseId: 'defensiveRoll', diceCount: 5 });
        expect(meditation2?.newAbilityDef.effects?.map(effect => effect.action?.customActionId)).toEqual([
            'meditation-2-taiji',
            'meditation-2-damage',
        ]);

        const meditation3 = getReplaceAction(byId['card-meditation-3']);
        expect(meditation3?.newAbilityDef.trigger).toEqual({ type: 'phase', phaseId: 'defensiveRoll', diceCount: 5 });
        expect(meditation3?.newAbilityDef.effects?.map(effect => effect.action?.customActionId)).toEqual([
            'meditation-3-taiji',
            'meditation-3-damage',
        ]);
        expect(zhCN.cards['card-meditation-3'].name).toBe('清修 III');
        expect(zhCN.abilities['meditation-3'].description).toContain('每有 1 个拳面，便造成 1 点伤害');
        expect(zhCN.abilities['meditation-3'].description).not.toContain('3 点伤害');

        const zenFist = getReplaceAction(byId['card-zen-fist-2']);
        expect(zenFist?.newAbilityDef.variants?.map(variant => variant.id)).toEqual([
            'calm-water-2-way-of-monk',
            'calm-water-2-large-straight',
        ]);
        expect(zenFist?.newAbilityDef.variants?.[0]?.trigger).toEqual({
            type: 'allSymbolsPresent',
            symbols: [DICE_FACE_IDS.FIST, DICE_FACE_IDS.PALM, DICE_FACE_IDS.TAIJI, DICE_FACE_IDS.LOTUS],
        });
        expect(zenFist?.newAbilityDef.variants?.[0]?.tags).toContain('unblockable');
        expect(zenFist?.newAbilityDef.variants?.[1]?.trigger).toEqual({ type: 'largeStraight' });
        expect(zenFist?.newAbilityDef.variants?.[1]?.effects?.map(effect => effect.action?.statusId)).toContain(STATUS_IDS.KNOCKDOWN);
        expect(zhCN.cards['card-zen-fist-2'].description).toContain('击倒');
        expect(zhCN.cards['card-zen-fist-2'].description).not.toContain('眩晕');

        const stormAssault = getReplaceAction(byId['card-storm-assault-2']);
        expect(stormAssault?.newAbilityDef.effects?.map(effect => effect.action?.customActionId)).toContain('thunder-strike-2-roll-damage');
        expect(zhCN.cards['card-storm-assault-2'].description).toContain('击倒');
        expect(zhCN.cards['card-storm-assault-2'].description).not.toContain('眩晕');

        const comboPunch = getReplaceAction(byId['card-combo-punch-2']);
        const comboRoll = comboPunch?.newAbilityDef.effects?.find(effect => effect.action?.type === 'rollDie')?.action;
        expect(comboRoll?.diceCount).toBe(2);
        expect(comboRoll?.conditionalEffects?.map(effect => effect.face)).toEqual([
            DICE_FACE_IDS.FIST,
            DICE_FACE_IDS.PALM,
            DICE_FACE_IDS.TAIJI,
            DICE_FACE_IDS.LOTUS,
        ]);
        expect(comboRoll?.conditionalEffects?.[0]?.bonusDamage).toBe(2);
        expect(comboRoll?.conditionalEffects?.[1]?.bonusDamage).toBe(3);
        expect(comboRoll?.conditionalEffects?.[2]?.grantToken).toEqual({ tokenId: TOKEN_IDS.TAIJI, value: 2 });
        expect(comboRoll?.conditionalEffects?.[3]?.triggerChoice?.options).toEqual([
            { tokenId: TOKEN_IDS.EVASIVE, value: 1 },
            { tokenId: TOKEN_IDS.PURIFY, value: 1 },
        ]);

        const thrust2 = getReplaceAction(byId['card-thrust-punch-2']);
        expect(thrust2?.newAbilityDef.variants?.map(variant => variant.trigger)).toEqual([
            { type: 'diceSet', faces: { [DICE_FACE_IDS.FIST]: 3 } },
            { type: 'diceSet', faces: { [DICE_FACE_IDS.FIST]: 4 } },
            { type: 'diceSet', faces: { [DICE_FACE_IDS.FIST]: 5 } },
        ]);
        expect(zhCN.cards['card-thrust-punch-2'].description).toContain('3/4/5 拳');
        expect(zhCN.cards['card-thrust-punch-2'].description).not.toContain('掌');

        const thrust3 = getReplaceAction(byId['card-thrust-punch-3']);
        expect(thrust3?.newAbilityDef.variants?.map(variant => variant.trigger)).toEqual([
            { type: 'diceSet', faces: { [DICE_FACE_IDS.FIST]: 3 } },
            { type: 'diceSet', faces: { [DICE_FACE_IDS.FIST]: 4 } },
            { type: 'diceSet', faces: { [DICE_FACE_IDS.FIST]: 5 } },
        ]);
        expect(thrust3?.newAbilityDef.variants?.[0]?.effects?.some(effect => effect.action?.customActionId === 'monk-fist-technique-3-knockdown-if-four-kind')).toBe(false);
        expect(thrust3?.newAbilityDef.variants?.[1]?.effects?.map(effect => effect.action?.customActionId)).toContain('monk-fist-technique-3-knockdown-if-four-kind');
        expect(thrust3?.newAbilityDef.variants?.[2]?.effects?.map(effect => effect.action?.customActionId)).toContain('monk-fist-technique-3-knockdown-if-four-kind');

        const contemplation = getReplaceAction(byId['card-contemplation-2']);
        expect(contemplation?.newAbilityDef.variants?.map(variant => variant.id)).toEqual([
            'zen-forget-2-zen-combat',
            'zen-forget-2-3',
        ]);
        expect(contemplation?.newAbilityDef.variants?.[0]?.trigger).toEqual({
            type: 'diceSet',
            faces: { [DICE_FACE_IDS.FIST]: 2, [DICE_FACE_IDS.TAIJI]: 2 },
        });
        expect(contemplation?.newAbilityDef.variants?.[1]?.trigger).toEqual({
            type: 'diceSet',
            faces: { [DICE_FACE_IDS.TAIJI]: 3 },
        });
        expect(zhCN.abilities['zen-forget-2-zen-combat'].name).toBe('禅武归一');
    });
});
