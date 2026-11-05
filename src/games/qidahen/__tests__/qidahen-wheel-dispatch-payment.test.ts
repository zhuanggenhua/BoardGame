import { describe, expect, it } from 'vitest';
import { QidahenDomain } from '../domain';
import { QIDAHEN_COMMANDS } from '../domain/commands';
import { isQidahenWheelDispatchPaymentPending } from '../domain/wheelDispatchPayment';
import {
    apply,
    applyUnchecked,
    factionHandCards,
    getWheelDispatchSelection,
    random,
    setRegionCavalry,
    setRegionInfantry,
    stateOf,
} from './helpers/paymentSelectionHarness';

describe('七大恨轮盘进攻调度弃牌', () => {
    it('走3格落到进攻调度后必须先弃1张手牌，未支付不能选目标', () => {
        const core = QidahenDomain.setup(['0', '1', '2'], random);
        core.actionWheelPosition = 'wheel-military-farm';
        const sourceSelected = apply(setRegionCavalry(core, 'city-region-24', 'ming', 2), {
            type: QIDAHEN_COMMANDS.SELECT_REGION,
            playerId: '0',
            payload: { regionId: 'city-region-24' },
        });
        const unpaid = applyUnchecked(sourceSelected, {
            type: QIDAHEN_COMMANDS.EXECUTE_WHEEL_MOVE,
            playerId: '0',
            payload: { moveId: 'move-3-all-opponents' },
        });
        expect(unpaid.turnPhase).toBe('dispatch-targeting');
        expect(unpaid.actionWheelPosition).toBe('wheel-hire');
        expect(isQidahenWheelDispatchPaymentPending(unpaid)).toBe(true);
        expect(unpaid.payment).toMatchObject({
            required: 1,
            selected: 0,
        });
        expect(QidahenDomain.validate(stateOf(unpaid), {
            type: QIDAHEN_COMMANDS.SELECT_REGION,
            playerId: '0',
            payload: { regionId: 'city-region-20' },
        }).valid).toBe(false);

        const paymentCard = factionHandCards(unpaid, 'ming').find((card) => card.status !== 'disabled');
        expect(paymentCard).toBeTruthy();
        const selected = applyUnchecked(unpaid, {
            type: QIDAHEN_COMMANDS.SELECT_PAYMENT_CARD,
            playerId: '0',
            payload: { cardId: paymentCard!.id },
        });
        expect(selected.payment).toMatchObject({
            required: 1,
            selected: 1,
        });

        const paid = applyUnchecked(selected, {
            type: QIDAHEN_COMMANDS.CONFIRM_WHEEL_DISPATCH_PAYMENT,
            playerId: '0',
            payload: {},
        });
        expect(isQidahenWheelDispatchPaymentPending(paid)).toBe(false);
        expect(paid.payment.required).toBe(0);
        expect(paid.factions.ming.handCount).toBe(unpaid.factions.ming.handCount - 1);
        expect(paid.factions.ming.discardPileCount).toBe((unpaid.factions.ming.discardPileCount ?? 0) + 1);
        expect(factionHandCards(paid, 'ming').some((card) => card.id === paymentCard!.id)).toBe(false);
        expect(getWheelDispatchSelection(paid)).toMatchObject({
            sourceRegionId: 'city-region-24',
        });
        expect(QidahenDomain.validate(stateOf(paid), {
            type: QIDAHEN_COMMANDS.SELECT_REGION,
            playerId: '0',
            payload: { regionId: 'city-region-20' },
        }).valid).toBe(true);
    });

    it('走2格落到进攻调度同样要先弃1张手牌', () => {
        const core = QidahenDomain.setup(['0', '1', '2'], random);
        core.actionWheelPosition = 'wheel-military-farm';
        const sourceSelected = apply(setRegionInfantry(core, 'city-region-24', 'ming', 2), {
            type: QIDAHEN_COMMANDS.SELECT_REGION,
            playerId: '0',
            payload: { regionId: 'city-region-24' },
        });
        const unpaid = applyUnchecked(sourceSelected, {
            type: QIDAHEN_COMMANDS.EXECUTE_WHEEL_MOVE,
            playerId: '0',
            payload: { moveId: 'move-2-one-opponent', opponentFactionId: 'jin' },
        });

        expect(unpaid.actionWheelPosition).toBe('wheel-diplomacy');
        expect(isQidahenWheelDispatchPaymentPending(unpaid)).toBe(true);
        expect(unpaid.payment.required).toBe(1);
        expect(QidahenDomain.validate(stateOf(unpaid), {
            type: QIDAHEN_COMMANDS.SELECT_REGION,
            playerId: '0',
            payload: { regionId: 'city-region-20' },
        }).valid).toBe(false);
    });

    it('手牌不足时跳过进攻调度并记录手牌不足', () => {
        const core = QidahenDomain.setup(['0', '1', '2'], random);
        core.actionWheelPosition = 'wheel-military-farm';
        const sourceSelected = apply(setRegionCavalry(core, 'city-region-24', 'ming', 2), {
            type: QIDAHEN_COMMANDS.SELECT_REGION,
            playerId: '0',
            payload: { regionId: 'city-region-24' },
        });
        const emptied = {
            ...sourceSelected,
            handCards: sourceSelected.handCards.filter((card) => card.faction !== 'ming'),
            factions: {
                ...sourceSelected.factions,
                ming: {
                    ...sourceSelected.factions.ming,
                    handCount: 0,
                },
            },
        };
        const skipped = applyUnchecked(emptied, {
            type: QIDAHEN_COMMANDS.EXECUTE_WHEEL_MOVE,
            playerId: '0',
            payload: { moveId: 'move-3-all-opponents' },
        });

        expect(isQidahenWheelDispatchPaymentPending(skipped)).toBe(false);
        expect(skipped.turnPhase).not.toBe('dispatch-targeting');
        expect(skipped.actionLog[0]?.text).toContain('手牌不足');
    });
});
