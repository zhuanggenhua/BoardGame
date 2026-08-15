import { describe, expect, it } from 'vitest';

import '../domain';
import { resolveEffectsToEvents, type EffectContext } from '../domain/effects';
import { buildBonusDiceSettlementEvents } from '../domain/executeTokens';
import { reduce } from '../domain/reducer';
import { getAvailableAbilityIds } from '../domain/rules';
import { TIANSHI_DICE_FACE_IDS as FACE, STATUS_IDS, TOKEN_IDS } from '../domain/ids';
import type { Die, DiceThroneEvent } from '../domain/types';
import type { AbilityDef, AbilityEffect } from '../domain/combat';
import type { EffectTiming } from '../domain/combat/types';
import {
    ARCHANGEL_RESOLVE_2,
    DIVINE_PUNISHMENT_2,
    HOLY_BLADE_2,
    HOLY_BLADE_3,
    HOLY_RADIANCE_2,
    SUPREME_POWER_2,
    TRIUMPHANT_RETURN_2,
    TIANSHI_ABILITIES,
} from '../heroes/tianshi/abilities';
import { TIANSHI_CARDS } from '../heroes/tianshi/cards';
import { createHeroMatchup, createQueuedRandom } from './test-utils';

const playerIds = ['0', '1'];

const createTianshiState = () => createHeroMatchup('tianshi', 'monk')(playerIds, createQueuedRandom([1]));

const createContext = (
    state: ReturnType<typeof createTianshiState>,
    sourceAbilityId: string,
): EffectContext => ({
    attackerId: '0',
    defenderId: '1',
    sourceAbilityId,
    state: state.core,
    damageDealt: 0,
    timestamp: 100,
});

const resolve = (
    state: ReturnType<typeof createTianshiState>,
    sourceAbilityId: string,
    effects: AbilityEffect[],
    timing: EffectTiming,
    randomValues: number[],
): DiceThroneEvent[] => resolveEffectsToEvents(
    effects,
    timing,
    createContext(state, sourceAbilityId),
    { random: createQueuedRandom(randomValues) },
);

const resolveAndSettleBonus = (
    state: ReturnType<typeof createTianshiState>,
    events: DiceThroneEvent[],
): DiceThroneEvent[] => {
    const requestedState = events.reduce((current, event) => reduce(current, event), state.core);
    const settlement = requestedState.pendingBonusDiceSettlement;
    if (!settlement) return events;
    const settlementEvents = buildBonusDiceSettlementEvents({
        state: requestedState,
        settlement,
        random: createQueuedRandom([1]),
        timestamp: 200,
        sourceCommandType: 'TEST_CONFIRM_BONUS_DICE',
    });
    return [...events, ...settlementEvents];
};

const findVariantDamageValues = (ability: AbilityDef): number[] => (
    (ability.variants ?? []).flatMap(variant => {
        const effect = variant.effects.find(entry => entry.action?.type === 'damage');
        return effect?.action?.type === 'damage' ? [effect.action.value ?? 0] : [];
    })
);

const setTianshiDice = (
    state: ReturnType<typeof createTianshiState>,
    values: number[],
    faces: string[],
): void => {
    state.core.rollDiceCount = values.length;
    state.core.dice = values.map((value, index) => ({
        id: index,
        definitionId: 'tianshi-dice',
        value,
        symbol: faces[index] as Die['symbol'],
        symbols: [faces[index] ?? ''],
        isKept: false,
    }));
};

describe('炽天使规则分支矩阵', () => {
    it('圣刃基础版、II、III 的三档伤害按合同分别为 5/6/7、6/7/8、5/7/9', () => {
        const base = TIANSHI_ABILITIES.find(ability => ability.id === 'holy-blade');
        expect(findVariantDamageValues(base as AbilityDef)).toEqual([5, 6, 7]);
        expect(findVariantDamageValues(HOLY_BLADE_2)).toEqual([6, 7, 8]);
        expect(findVariantDamageValues(HOLY_BLADE_3)).toEqual([5, 7, 9]);
    });

    it('复合升级牌只负责替换技能，下半区效果登记在升级后技能分支', () => {
        const compositeUpgradeIds = [
            'upgrade-tianshi-supreme-power-2-gospel-arrival',
            'upgrade-tianshi-divine-punishment-2-divine-command',
            'upgrade-tianshi-archangel-resolve-2-divine-protection',
            'upgrade-tianshi-holy-radiance-2-takeoff',
            'upgrade-tianshi-holy-blade-3-cherub-2',
            'upgrade-tianshi-holy-blade-2-cherub',
        ];

        for (const cardId of compositeUpgradeIds) {
            const card = TIANSHI_CARDS.find(entry => entry.id === cardId);
            expect(card?.effects.map(effect => effect.action?.type)).toEqual(['replaceAbility']);
        }

        expect(SUPREME_POWER_2.variants?.map(variant => variant.id)).toEqual(['supreme-power-2-main', 'gospel-arrival']);
        expect(DIVINE_PUNISHMENT_2.variants?.map(variant => variant.id)).toEqual(['divine-punishment-2-main', 'divine-command']);
        expect(ARCHANGEL_RESOLVE_2.variants?.map(variant => variant.id)).toEqual(['archangel-resolve-2-main', 'divine-protection']);
        expect(HOLY_RADIANCE_2.variants?.map(variant => variant.id)).toEqual(['holy-radiance-2-main', 'takeoff']);
        expect(HOLY_BLADE_3.variants?.map(variant => variant.id)).toEqual(['holy-blade-3-3', 'holy-blade-3-4', 'holy-blade-3-5', 'cherub-2']);
        expect(HOLY_BLADE_2.variants?.map(variant => variant.id)).toEqual(['holy-blade-2-3', 'holy-blade-2-4', 'holy-blade-2-5', 'cherub']);
    });

    it('不满足骰型时九个炽天使技能都不进入进攻阶段可用列表', () => {
        const state = createTianshiState();
        // 2 个炽炎剑、2 个双翼、1 个十字，既不满足三同、顺子、四种骰面齐全，也不满足四/五个圣洁吊坠。
        setTianshiDice(
            state,
            [1, 2, 3, 3, 6],
            [FACE.BLADE, FACE.BLADE, FACE.WING, FACE.WING, FACE.CROSS],
        );

        const available = getAvailableAbilityIds(state.core, '0', 'offensiveRoll');
        const tianshiAbilityIds = new Set(
            TIANSHI_ABILITIES.flatMap(ability => [ability.id, ...(ability.variants ?? []).map(variant => variant.id)]),
        );
        expect(available.filter(abilityId => tianshiAbilityIds.has(abilityId))).toEqual([]);
    });

    it.each([
        { value: 1, damage: 1, undefendable: false },
        { value: 4, damage: 2, undefendable: false },
        { value: 5, damage: 3, undefendable: false },
        { value: 6, damage: 0, undefendable: true },
    ])('凯旋归来 II 奖励骰 $value 点按四面分支结算', ({ value, damage, undefendable }) => {
        const state = createTianshiState();
        const ability = TRIUMPHANT_RETURN_2;
        state.core.pendingAttack = {
            attackerId: '0',
            defenderId: '1',
            sourceAbilityId: 'triumphant-return-2',
            isDefendable: true,
            damage: 8,
        };

        const events = resolveAndSettleBonus(
            state,
            resolve(state, 'triumphant-return-2', ability.effects ?? [], 'preDefense', [value]),
        );
        const bonusDamage = events.find(event => event.type === 'BONUS_DAMAGE_ADDED');
        expect(bonusDamage?.payload.amount ?? 0).toBe(damage);
        expect(events.some(event => event.type === 'ATTACK_MADE_UNDEFENDABLE')).toBe(undefendable);
    });

    it('凯旋归来 II 的小顺子基础伤害为 8 点', () => {
        const damageEffect = TRIUMPHANT_RETURN_2.effects?.find(effect => effect.action?.type === 'damage');
        expect(damageEffect?.action?.type === 'damage' ? damageEffect.action.value : undefined).toBe(8);
    });

    it.each([
        { label: '四个相同数字', values: [2, 2, 2, 2, 5], expected: true },
        { label: '不足四个相同数字', values: [2, 2, 2, 3, 5], expected: false },
    ])('圣刃 III $label时按规则处理眩光', ({ values, expected }) => {
        const state = createTianshiState();
        setTianshiDice(state, values, [FACE.BLADE, FACE.BLADE, FACE.BLADE, FACE.BLADE, FACE.CROSS]);
        state.core.pendingAttack = {
            attackerId: '0',
            defenderId: '1',
            sourceAbilityId: 'holy-blade-3',
            isDefendable: true,
            damage: 5,
        };

        const ability = HOLY_BLADE_3.variants?.[0];
        const events = resolve(state, 'holy-blade-3', ability?.effects ?? [], 'preDefense', []);
        expect(events.some(event => (
            event.type === 'STATUS_APPLIED'
            && event.payload.targetId === '1'
            && event.payload.statusId === STATUS_IDS.DAZZLE
        ))).toBe(expected);
    });

    it.each([
        { label: '圣洁吊坠', values: [1, 4, 5, 6, 2], expectedDazzle: true, expectedDamage: 2 },
        { label: '只有双翼没有圣洁吊坠', values: [1, 4, 5, 2, 3], expectedDazzle: false, expectedDamage: 3 },
    ])('圣击五颗奖励骰按 $label 处理炽炎剑加伤和眩光', ({ values, expectedDazzle, expectedDamage }) => {
        const state = createTianshiState();
        const card = TIANSHI_CARDS.find(entry => entry.id === 'card-tianshi-holy-strike');
        expect(card).toBeDefined();
        if (!card) return;

        const events = resolveAndSettleBonus(state, resolve(state, card.id, card.effects, 'immediate', values));
        expect(events.filter(event => event.type === 'BONUS_DIE_ROLLED')).toHaveLength(5);
        expect(events).toContainEqual(expect.objectContaining({
            type: 'BONUS_DAMAGE_ADDED',
            payload: expect.objectContaining({ playerId: '0', amount: expectedDamage }),
        }));
        expect(events.some(event => (
            event.type === 'STATUS_APPLIED'
            && event.payload.targetId === '1'
            && event.payload.statusId === STATUS_IDS.DAZZLE
        ))).toBe(expectedDazzle);
    });

    it.each([
        { value: 1, eventType: 'BONUS_DAMAGE_ADDED', field: 'amount', expected: 3 },
        { value: 4, eventType: 'TOKEN_GRANTED', field: 'tokenId', expected: TOKEN_IDS.FLIGHT },
        { value: 5, eventType: 'TOKEN_GRANTED', field: 'tokenId', expected: TOKEN_IDS.PURIFY },
        { value: 6, eventType: 'TOKEN_GRANTED', field: 'tokenId', expected: TOKEN_IDS.DIVINE_ARRIVAL },
    ])('天使战术奖励骰 $value 点命中对应分支', ({ value, eventType, field, expected }) => {
        const state = createTianshiState();
        const card = TIANSHI_CARDS.find(entry => entry.id === 'card-tianshi-angelic-tactics');
        expect(card).toBeDefined();
        if (!card) return;

        const events = resolveAndSettleBonus(state, resolve(state, card.id, card.effects, 'immediate', [value]));
        const matching = events.find(event => event.type === eventType);
        expect(matching?.payload[field as keyof typeof matching.payload]).toBe(expected);
    });

    it('至高圣洁投出圣洁吊坠时获得 2 个飞行和 2 个净化', () => {
        const state = createTianshiState();
        const card = TIANSHI_CARDS.find(entry => entry.id === 'card-tianshi-supreme-holiness');
        expect(card).toBeDefined();
        if (!card) return;

        const events = resolveAndSettleBonus(state, resolve(state, card.id, card.effects, 'immediate', [6]));
        expect(events).toContainEqual(expect.objectContaining({
            type: 'TOKEN_GRANTED',
            payload: expect.objectContaining({ targetId: '0', tokenId: TOKEN_IDS.FLIGHT, amount: 2 }),
        }));
        expect(events).toContainEqual(expect.objectContaining({
            type: 'TOKEN_GRANTED',
            payload: expect.objectContaining({ targetId: '0', tokenId: TOKEN_IDS.PURIFY, amount: 2 }),
        }));
        expect(events.some(event => event.type === 'CARD_DRAWN')).toBe(false);
    });

    it('神圣裁决依次选择眩光、2 个飞行和净化目标', () => {
        const state = createHeroMatchup('tianshi', 'monk')(['0', '1'], createQueuedRandom([1]));
        state.core.players['0'].tokens[TOKEN_IDS.DIVINE_ARRIVAL] = 0;
        const card = TIANSHI_CARDS.find(entry => entry.id === 'card-tianshi-divine-arbitration');
        expect(card).toBeDefined();
        if (!card) return;

        const events = resolve(state, card.id, card.effects, 'immediate', [1]);
        const choice = events.find(event => event.type === 'CHOICE_REQUESTED');
        expect(choice?.payload.options.map(option => option.labelParams?.player)).toEqual(['0', '1']);
        expect(choice?.payload.options[0]?.customId).toBe('tianshi-divine-arbitration-dazzle');
    });
});
