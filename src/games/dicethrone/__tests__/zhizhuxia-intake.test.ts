import { describe, expect, it } from 'vitest';

import {
    DICETHRONE_CHARACTER_CATALOG,
} from '../domain/core-types';
import { STATUS_IDS, TOKEN_IDS, ZHIZHUXIA_DICE_FACE_IDS } from '../domain/ids';
import { RESOURCE_IDS } from '../domain/resources';
import { createPendingDamage, getUsableTokensForTiming } from '../domain/tokenResponse';
import { getCustomActionHandler } from '../domain/effects';
import { initializeCustomActions } from '../domain/customActions';
import { createMainRollContext } from '../domain/rollContext';
import { getUsableActiveRollToken } from '../domain/activeRollTokens';
import { resolveOffensivePreDefenseEffects } from '../domain/attack';
import { DiceThroneDomain } from '../domain';
import { reduce } from '../domain/reducer';
import { getAbilitySlotIdForCharacter } from '../ui/abilitySlotMapping';
import {
    COMBO_STRIKE_2,
    HEAVY_PUNCH_2,
    TRAP_2,
    VENOM_PUNCH_2,
    ZHIZHUXIA_ABILITIES,
} from '../heroes/zhizhuxia/abilities';
import { ZHIZHUXIA_CARDS, ZHIZHUXIA_COMMON_ATLAS_INDEX } from '../heroes/zhizhuxia/cards';
import { ZHIZHUXIA_TOKENS } from '../heroes/zhizhuxia/tokens';
import { zhizhuxiaDiceDefinition } from '../heroes/zhizhuxia/diceConfig';
import { createHeroMatchup, fixedRandom, testSystems } from './test-utils';
import { executePipeline } from '../../../engine/pipeline';

initializeCustomActions();

const eventsOfType = (events: Array<{ type: string }>, type: string) => (
    events.filter((event) => event.type === type)
);

describe('蜘蛛侠素材录入与规则合同', () => {
    it('角色目录保留实施中状态，原因明确指向资源链与真实入口审计', () => {
        const character = DICETHRONE_CHARACTER_CATALOG.find((entry) => entry.id === 'zhizhuxia');

        expect(character).toMatchObject({
            setupOptionStatus: 'in_progress',
            setupOptionStatusReason: expect.stringContaining('规则、资源链和真实入口仍在审计中'),
        });
    });

    it('正式蜘蛛侠卡图合同包含 15 张专属卡和 18 张公共卡', () => {
        const heroCards = ZHIZHUXIA_CARDS.filter((card) => card.id.includes('zhizhuxia'));
        const commonCards = ZHIZHUXIA_CARDS.filter((card) => !card.id.includes('zhizhuxia'));

        expect(ZHIZHUXIA_CARDS).toHaveLength(33);
        expect(heroCards).toHaveLength(15);
        expect(heroCards.map((card) => card.sourceAtlasIndex)).toEqual(
            Array.from({ length: 15 }, (_, index) => index + 18),
        );
        expect(commonCards).toHaveLength(18);
        for (const card of commonCards) {
            expect((card.previewRef as any)?.index).toBe(ZHIZHUXIA_COMMON_ATLAS_INDEX[card.id]);
        }

        const upgrades = heroCards.filter((card) => card.type === 'upgrade');
        expect(upgrades).toHaveLength(4);
        expect(upgrades.map((card) => (card.effects[0]?.action as any)?.targetAbilityId)).toEqual([
            'heavy-punch',
            'combo-strike',
            'trap',
            'venom-punch',
        ]);
    });

    it('四张升级技能按蜘蛛侠派系规则录入', () => {
        expect(HEAVY_PUNCH_2.variants?.map((variant) => (variant.effects[0]?.action as any)?.value)).toEqual([5, 6, 7]);
        expect(COMBO_STRIKE_2.trigger).toMatchObject({
            type: 'diceSet',
            faces: {
                [ZHIZHUXIA_DICE_FACE_IDS.WEB]: 2,
                [ZHIZHUXIA_DICE_FACE_IDS.SPIDER]: 2,
            },
        });
        expect((COMBO_STRIKE_2.effects[0]?.action as any)?.value).toBe(6);
        expect(TRAP_2.variants?.map((variant) => (variant.effects.find((effect) => (effect.action as any)?.type === 'damage')?.action as any)?.value)).toEqual([6, 9]);
        expect(VENOM_PUNCH_2.trigger).toMatchObject({
            type: 'diceSet',
            faces: { [ZHIZHUXIA_DICE_FACE_IDS.SPIDER]: 4 },
        });
        expect((VENOM_PUNCH_2.effects.find((effect) => (effect.action as any)?.type === 'damage')?.action as any)).toMatchObject({
            value: 8,
            unblockable: true,
        });
    });

    it('重拳 II 四同数字获得连击，飞荡脱身允许蛛网成功', () => {
        const state = createHeroMatchup('zhizhuxia', 'monk')(['0', '1'], fixedRandom).core;
        state.pendingAttack = {
            attackerId: '0',
            defenderId: '1',
            sourceAbilityId: 'heavy-punch',
            attackDiceValues: [2, 2, 2, 2, 5],
        } as any;

        const comboHandler = getCustomActionHandler('zhizhuxia-heavy-punch-2-combo');
        const comboEvents = comboHandler!({
            ctx: { attackerId: '0', defenderId: '1', sourceAbilityId: 'heavy-punch', state, damageDealt: 6, timestamp: 1 } as any,
            targetId: '1',
            attackerId: '0',
            sourceAbilityId: 'heavy-punch',
            state,
            timestamp: 1,
            action: { type: 'custom', customActionId: 'zhizhuxia-heavy-punch-2-combo' },
        } as any);
        expect(eventsOfType(comboEvents, 'TOKEN_GRANTED')[0]?.payload).toMatchObject({
            targetId: '0',
            tokenId: TOKEN_IDS.COMBO,
            amount: 1,
        });

        state.pendingAttack.defenderId = '1';
        const escapeHandler = getCustomActionHandler('zhizhuxia-flying-escape');
        const escapeEvents = escapeHandler!({
            ctx: { attackerId: '1', defenderId: '0', sourceAbilityId: 'card-zhizhuxia-flying-escape', state, damageDealt: 0, timestamp: 2 } as any,
            targetId: '1',
            attackerId: '1',
            sourceAbilityId: 'card-zhizhuxia-flying-escape',
            state,
            timestamp: 2,
            action: { type: 'custom', customActionId: 'zhizhuxia-flying-escape' },
        } as any);
        expect(eventsOfType(escapeEvents, 'PENDING_ATTACK_UPDATED')[0]?.payload.patch).toMatchObject({
            zhizhuxiaSpiderSenseAcceptsWeb: true,
        });
    });

    it('奇袭、想的美和隐形重拳分别消费隐形并保留正确伤害语义', () => {
        const state = createHeroMatchup('monk', 'zhizhuxia')(['0', '1'], fixedRandom).core;
        state.players['1'].tokens[TOKEN_IDS.INVISIBLE] = 2;
        state.pendingAttack = {
            attackerId: '1',
            defenderId: '0',
            sourceAbilityId: 'heavy-punch',
        } as any;

        const ambush = getCustomActionHandler('zhizhuxia-ambush')!({
            ctx: { attackerId: '1', defenderId: '0', sourceAbilityId: 'card-zhizhuxia-ambush', state, damageDealt: 0, timestamp: 3 } as any,
            targetId: '1', attackerId: '1', sourceAbilityId: 'card-zhizhuxia-ambush', state, timestamp: 3,
            action: { type: 'custom', customActionId: 'zhizhuxia-ambush' },
        } as any);
        expect(eventsOfType(ambush, 'TOKEN_CONSUMED')[0]?.payload.tokenId).toBe(TOKEN_IDS.INVISIBLE);
        expect(eventsOfType(ambush, 'BONUS_DAMAGE_ADDED')[0]?.payload.amount).toBe(3);

        state.pendingDamage = createPendingDamage('0', '1', 5, 'beforeDamageReceived', 'heavy-punch', 4, undefined, 'attack', false, undefined, undefined, 'ability');
        const wishful = getCustomActionHandler('zhizhuxia-wishful-thinking')!({
            ctx: { attackerId: '1', defenderId: '0', sourceAbilityId: 'card-zhizhuxia-wishful-thinking', state, damageDealt: 0, timestamp: 4 } as any,
            targetId: '1', attackerId: '1', sourceAbilityId: 'card-zhizhuxia-wishful-thinking', state, timestamp: 4,
            action: { type: 'custom', customActionId: 'zhizhuxia-wishful-thinking' },
        } as any);
        expect(eventsOfType(wishful, 'DAMAGE_SHIELD_GRANTED')[0]?.payload).toMatchObject({ targetId: '1', value: 3 });

        state.pendingAttack = { ...state.pendingAttack, defenderId: '1', zhizhuxiaDamagePercent: -50 } as any;
        const invisiblePunch = getCustomActionHandler('zhizhuxia-invisible-punch')!({
            ctx: { attackerId: '1', defenderId: '0', sourceAbilityId: 'card-zhizhuxia-invisible-punch', state, damageDealt: 0, timestamp: 5 } as any,
            targetId: '0', attackerId: '1', sourceAbilityId: 'card-zhizhuxia-invisible-punch', state, timestamp: 5,
            action: { type: 'custom', customActionId: 'zhizhuxia-invisible-punch' },
        } as any);
        expect(eventsOfType(invisiblePunch, 'DAMAGE_DEALT')[0]?.payload).toMatchObject({
            amount: 3,
            damageScope: 'direct',
            damageOrigin: 'card',
        });
    });

    it('赞爆的蛛网分支复用落网效果，落网伤害保持状态来源', () => {
        const state = createHeroMatchup('zhizhuxia', 'monk')(['0', '1'], fixedRandom).core;
        const praise = getCustomActionHandler('zhizhuxia-praise-roll')!({
            ctx: { attackerId: '0', defenderId: '1', sourceAbilityId: 'card-zhizhuxia-praise', state, damageDealt: 0, timestamp: 6 } as any,
            targetId: '1', attackerId: '0', sourceAbilityId: 'card-zhizhuxia-praise', state, timestamp: 6,
            random: { d: () => 4 } as any,
            action: { type: 'custom', customActionId: 'zhizhuxia-praise-roll' },
        } as any);
        expect(eventsOfType(praise, 'BONUS_DIE_ROLLED')[0]?.payload.effectKey).toBe('bonusDie.effect.zhizhuxia.praise.web');
        expect(eventsOfType(praise, 'DAMAGE_DEALT')[0]?.payload).toMatchObject({
            amount: 2,
            damageOrigin: 'status',
            damageScope: 'direct',
        });
    });

    it('面板九个物理槽位映射到蜘蛛侠九个技能', () => {
        const expected = {
            fist: 'heavy-punch',
            chi: 'combo-strike',
            sky: 'wall-crawl',
            lotus: 'spider-reflex',
            combo: 'trap',
            lightning: 'venom-punch',
            calm: 'counter',
            meditate: 'spider-sense',
            ultimate: 'ultimate-spider',
        };

        for (const [slot, abilityId] of Object.entries(expected)) {
            expect(getAbilitySlotIdForCharacter('zhizhuxia', abilityId)).toBe(slot);
        }
        expect(ZHIZHUXIA_ABILITIES.map((ability) => ability.id)).toEqual([
            'heavy-punch',
            'combo-strike',
            'trap',
            'venom-punch',
            'wall-crawl',
            'spider-reflex',
            'counter',
            'spider-sense',
            'ultimate-spider',
        ]);
    });

    it('骰面按 1-3 拳、4-5 蛛网、6 蜘蛛录入', () => {
        expect(zhizhuxiaDiceDefinition.faces.map((face) => face.symbols[0])).toEqual([
            ZHIZHUXIA_DICE_FACE_IDS.FIST,
            ZHIZHUXIA_DICE_FACE_IDS.FIST,
            ZHIZHUXIA_DICE_FACE_IDS.FIST,
            ZHIZHUXIA_DICE_FACE_IDS.WEB,
            ZHIZHUXIA_DICE_FACE_IDS.WEB,
            ZHIZHUXIA_DICE_FACE_IDS.SPIDER,
        ]);
    });

    it('落网施加只产生一次独立的 2 点状态伤害', () => {
        const state = createHeroMatchup('zhizhuxia', 'monk')(['0', '1'], fixedRandom).core;
        const handler = getCustomActionHandler('zhizhuxia-apply-webbed');
        expect(handler).toBeDefined();

        const events = handler!({
            ctx: {
                attackerId: '0',
                defenderId: '1',
                sourceAbilityId: 'trap',
                state,
                damageDealt: 5,
                timestamp: 1000,
            },
            targetId: '1',
            attackerId: '0',
            sourceAbilityId: 'trap',
            state,
            timestamp: 1000,
            action: { type: 'custom', customActionId: 'zhizhuxia-apply-webbed' },
        } as any);

        const damage = eventsOfType(events, 'DAMAGE_DEALT');
        expect(damage).toHaveLength(1);
        expect(damage[0]).toMatchObject({
            payload: {
                amount: 2,
                damageScope: 'direct',
                damageOrigin: 'status',
                unblockable: true,
            },
        });

        let reduced = state;
        for (const event of events) {
            reduced = reduce(reduced, event as any);
        }
        expect(reduced.players['1'].resources[RESOURCE_IDS.HP]).toBe(48);
    });

    it('下一次技能区普通攻击消费落网，但不再重复造成 2 点伤害', () => {
        const state = createHeroMatchup('zhizhuxia', 'monk')(['0', '1'], fixedRandom).core;
        state.players['1'].statusEffects[STATUS_IDS.WEBBED] = 1;
        state.pendingAttack = {
            attackerId: '0',
            defenderId: '1',
            sourceAbilityId: 'heavy-punch-3',
            isDefendable: true,
            preDefenseResolved: false,
            defenseResolved: false,
            damageResolved: false,
            zhizhuxiaWebbedTriggeredThisAttack: false,
        } as any;

        const events = resolveOffensivePreDefenseEffects(state, fixedRandom, 2000);

        expect(eventsOfType(events, 'DAMAGE_DEALT')).toHaveLength(0);
        expect(eventsOfType(events, 'PENDING_ATTACK_UPDATED')).toHaveLength(1);
        expect(eventsOfType(events, 'STATUS_REMOVED')).toHaveLength(1);
        expect(state.players['1'].statusEffects[STATUS_IDS.WEBBED]).toBe(1);
    });

    it('延后伤害保留卡牌与 Token 来源，不与技能区来源混同', () => {
        const cardDamage = createPendingDamage(
            '0', '1', 4, 'beforeDamageReceived', 'card-test', 1,
            undefined, 'attack', false, undefined, undefined, 'card',
        );
        const tokenDamage = createPendingDamage(
            '0', '1', 2, 'beforeDamageReceived', 'token-test', 2,
            undefined, 'direct', true, undefined, undefined, 'token',
        );

        expect(cardDamage.damageOrigin).toBe('card');
        expect(tokenDamage.damageOrigin).toBe('token');
    });

    it('隐形只在不可防御伤害窗口可用，并保留蜘蛛感应额外防御投骰入口', () => {
        const state = createHeroMatchup('monk', 'zhizhuxia')(['0', '1'], fixedRandom);
        const spider = state.core.players['1'];
        spider.tokens[TOKEN_IDS.INVISIBLE] = 1;

        const regularDamage = createPendingDamage(
            '0', '1', 5, 'beforeDamageReceived', 'heavy-punch', 3,
            undefined, 'attack', false, undefined, undefined, 'ability',
        );
        const unblockableDamage = createPendingDamage(
            '0', '1', 5, 'beforeDamageReceived', 'venom-punch', 4,
            undefined, 'attack', true, undefined, undefined, 'ability',
        );

        const regularState = { ...state.core, pendingDamage: regularDamage };
        const unblockableState = { ...state.core, pendingDamage: unblockableDamage };
        expect(getUsableTokensForTiming(regularState, '1', 'beforeDamageReceived', {
            damageScope: 'attack',
            unblockable: false,
        }).map((token) => token.id)).not.toContain(TOKEN_IDS.INVISIBLE);
        expect(getUsableTokensForTiming(unblockableState, '1', 'beforeDamageReceived', {
            damageScope: 'attack',
            unblockable: true,
        }).map((token) => token.id)).toContain(TOKEN_IDS.INVISIBLE);

        state.core.pendingAttack = {
            attackerId: '0',
            defenderId: '1',
            sourceAbilityId: 'heavy-punch',
            defenseAbilityId: 'spider-sense',
        } as any;
        state.core.rollConfirmed = false;
        state.core.currentRollContext = createMainRollContext(state.core, {
            phase: 'defensiveRoll',
            ownerPlayerId: '1',
        });
        const spiderSenseToken = getUsableActiveRollToken(
            state.core,
            '1',
            'defensiveRoll',
            TOKEN_IDS.INVISIBLE,
        );
        expect(spiderSenseToken).not.toBeNull();

        state.sys.phase = 'defensiveRoll';
        state.core.rollLimit = 3;
        const useResult = executePipeline(
            { domain: DiceThroneDomain, systems: testSystems },
            state,
            {
                type: 'USE_TOKEN',
                playerId: '1',
                payload: { tokenId: TOKEN_IDS.INVISIBLE, amount: 1 },
                timestamp: 5000,
            } as any,
            fixedRandom,
            ['0', '1'],
        );
        expect(useResult.success).toBe(true);
        const rollLimitEvent = (useResult.events as any[]).find((event) => event.type === 'ROLL_LIMIT_CHANGED');
        expect(rollLimitEvent?.payload).toMatchObject({ playerId: '1', delta: 1, newLimit: 4 });
        expect((useResult.state as any).core.players['1'].tokens[TOKEN_IDS.INVISIBLE]).toBe(0);

        state.core.pendingAttack.defenseAbilityId = 'counter';
        expect(getUsableActiveRollToken(
            state.core,
            '1',
            'defensiveRoll',
            TOKEN_IDS.INVISIBLE,
        )).toBeNull();

        expect(ZHIZHUXIA_TOKENS.find((token) => token.id === TOKEN_IDS.INVISIBLE)?.activeUse).toMatchObject({
            customActionId: 'zhizhuxia-extra-defense-roll',
            requiresDefenseAbilityId: 'spider-sense',
        });
    });
});
