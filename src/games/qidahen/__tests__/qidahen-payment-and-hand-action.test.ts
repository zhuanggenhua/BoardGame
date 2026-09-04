import { describe, expect, it } from 'vitest';import { QidahenDomain } from '../domain';

import { QIDAHEN_COMMANDS } from '../domain/commands';
import { getActionChoicesForFaction } from '../domain/factionActionWindow';import { getQidahenDirectActionIdForHandCard } from '../domain/handCardIdentity';
import { QIDAHEN_ATLAS05_ORDINARY_HAND_CARD_IDENTITIES, QIDAHEN_ATLAS05_ORDINARY_HAND_CARD_RULES_SUMMARY_BY_DEF_ID } from '../domain/ordinaryHandCardIdentities';
import type { QidahenCore } from '../domain/types';
import { random, stateOf, apply, factionHandCards } from './helpers/paymentSelectionHarness';

describe('七大恨支付与手牌行动', () => {
it('点击手牌会写入支付选择并更新支付提示', () => {
        const core = QidahenDomain.setup(['0', '1', '2'], random);

        const next = apply(core, {
            type: QIDAHEN_COMMANDS.SELECT_PAYMENT_CARD,
            playerId: '0',
            payload: { cardId: 'hand-4' },
        });

        expect(next.selectedPaymentCardIds).toEqual(['hand-4']);
        expect(next.payment).toMatchObject({
            required: 3,
            selected: 1,
            prompt: '需弃 3 / 已选 1',
        });
    });

it('atlas05 银两作为支付牌被消费时，会在执行记录里保留资源牌身份', () => {
        const silverIdentities = QIDAHEN_ATLAS05_ORDINARY_HAND_CARD_IDENTITIES
            .filter((identity) => identity.cardKind === 'silver');
        expect(silverIdentities).toHaveLength(2);

        for (const identity of silverIdentities) {
            const core = QidahenDomain.setup(['0', '1', '2'], random);
            const [paymentCard] = factionHandCards(core, 'ming');
            const mappedCore: QidahenCore = {
                ...core,
                handCards: core.handCards.map((card) => (
                    card.id === paymentCard.id
                        ? {
                            ...card,
                            label: identity.displayName,
                            cardKind: identity.cardKind,
                            armamentId: identity.armamentId,
                            cardDefId: identity.cardDefId,
                            rulesSummary: QIDAHEN_ATLAS05_ORDINARY_HAND_CARD_RULES_SUMMARY_BY_DEF_ID[identity.cardDefId],
                        }
                        : card
                )),
            };

            expect(getQidahenDirectActionIdForHandCard(mappedCore.handCards.find((card) => card.id === paymentCard.id)!)).toBeNull();

            const previewed = apply(mappedCore, {
                type: QIDAHEN_COMMANDS.CONFIRM_PREVIEW_ACTION,
                playerId: '0',
                payload: { actionId: 'recruit' },
            });
            const paid = apply(previewed, {
                type: QIDAHEN_COMMANDS.SELECT_PAYMENT_CARD,
                playerId: '0',
                payload: { cardId: paymentCard.id },
            });
            expect(paid.selectedPaymentCardIds).toEqual([paymentCard.id]);

            const executed = apply(paid, {
                type: QIDAHEN_COMMANDS.EXECUTE_SELECTED_ACTION,
                playerId: '0',
                payload: {},
            });
            expect(executed.handCards.some((card) => card.id === paymentCard.id)).toBe(false);
            expect(executed.actionLog[0]?.text).toContain('银两资源牌 1 张：银两');
        }
    });

it('后金弃封贡敕书支付普通行动时，会按 2 张银两计入支付值', () => {
        const tributeEdictIdentity = QIDAHEN_ATLAS05_ORDINARY_HAND_CARD_IDENTITIES
            .find((identity) => identity.cardDefId === 'qidahen-atlas05-1633-tribute-edict');
        expect(tributeEdictIdentity).toMatchObject({
            displayName: '封贡敕书',
            cardKind: 'event',
        });

        const core = QidahenDomain.setup(['0', '1', '2'], random);
        const [paymentCard] = factionHandCards(core, 'jin');
        const mappedCore: QidahenCore = {
            ...core,
            currentPlayer: '2',
            selectedActionId: 'marriage-subjugation',
            confirmedActionId: 'marriage-subjugation',
            actionChoices: getActionChoicesForFaction('jin'),
            selectedPaymentCardIds: [],
            payment: {
                required: 2,
                selected: 0,
                prompt: '需弃 2 / 已选 0',
            },
            handCards: core.handCards.map((card) => (
                card.id === paymentCard.id
                    ? {
                        ...card,
                        label: tributeEdictIdentity!.displayName,
                        cardKind: tributeEdictIdentity!.cardKind,
                        armamentId: tributeEdictIdentity!.armamentId,
                        cardDefId: tributeEdictIdentity!.cardDefId,
                        rulesSummary: QIDAHEN_ATLAS05_ORDINARY_HAND_CARD_RULES_SUMMARY_BY_DEF_ID[tributeEdictIdentity!.cardDefId],
                    }
                    : card
            )),
        };

        const paid = apply(mappedCore, {
            type: QIDAHEN_COMMANDS.SELECT_PAYMENT_CARD,
            playerId: '2',
            payload: { cardId: paymentCard.id },
        });

        expect(paid.selectedPaymentCardIds).toEqual([paymentCard.id]);
        expect(paid.payment).toMatchObject({
            required: 2,
            selected: 2,
            prompt: '需弃 2 / 已选 2',
        });
        expect(QidahenDomain.validate(stateOf(paid), {
            type: QIDAHEN_COMMANDS.EXECUTE_SELECTED_ACTION,
            playerId: '2',
            payload: {},
        })).toEqual({ valid: true });

        const capped = apply(paid, {
            type: QIDAHEN_COMMANDS.SELECT_PAYMENT_CARD,
            playerId: '2',
            payload: { cardId: factionHandCards(paid, 'jin').find((card) => card.id !== paymentCard.id)!.id },
        });
        expect(capped.selectedPaymentCardIds).toEqual([paymentCard.id]);

        const executed = apply(paid, {
            type: QIDAHEN_COMMANDS.EXECUTE_SELECTED_ACTION,
            playerId: '2',
            payload: {},
        });

        expect(executed.handCards.some((card) => card.id === paymentCard.id)).toBe(false);
        expect(executed.actionLog[0]?.text).toContain('封贡敕书（视作 2 张银两）');
    });

it('后金直接执行普通行动时，会自动按封贡敕书 2 张银两支付', () => {
        const tributeEdictIdentity = QIDAHEN_ATLAS05_ORDINARY_HAND_CARD_IDENTITIES
            .find((identity) => identity.cardDefId === 'qidahen-atlas05-1633-tribute-edict');
        expect(tributeEdictIdentity).toBeDefined();

        const core = QidahenDomain.setup(['0', '1', '2'], random);
        const [paymentCard, secondPaymentCard] = factionHandCards(core, 'jin');
        const mappedCore: QidahenCore = {
            ...core,
            currentPlayer: '2',
            selectedActionId: 'marriage-subjugation',
            confirmedActionId: null,
            actionChoices: getActionChoicesForFaction('jin'),
            selectedPaymentCardIds: [],
            payment: {
                required: 2,
                selected: 0,
                prompt: '需弃 2 / 已选 0',
            },
            handCards: core.handCards.map((card) => {
                if (card.id === paymentCard.id) {
                    return {
                        ...card,
                        label: tributeEdictIdentity!.displayName,
                        cardKind: tributeEdictIdentity!.cardKind,
                        armamentId: tributeEdictIdentity!.armamentId,
                        cardDefId: tributeEdictIdentity!.cardDefId,
                        rulesSummary: QIDAHEN_ATLAS05_ORDINARY_HAND_CARD_RULES_SUMMARY_BY_DEF_ID[tributeEdictIdentity!.cardDefId],
                    };
                }
                return card;
            }),
        };

        expect(QidahenDomain.validate(stateOf(mappedCore), {
            type: QIDAHEN_COMMANDS.EXECUTE_ACTION,
            playerId: '2',
            payload: { actionId: 'marriage-subjugation' },
        })).toEqual({ valid: true });

        const executed = apply(mappedCore, {
            type: QIDAHEN_COMMANDS.EXECUTE_ACTION,
            playerId: '2',
            payload: { actionId: 'marriage-subjugation' },
        });

        expect(executed.handCards.some((card) => card.id === paymentCard.id)).toBe(false);
        expect(executed.handCards.some((card) => card.id === secondPaymentCard.id)).toBe(true);
        expect(executed.actionLog[0]?.text).toContain('封贡敕书（视作 2 张银两）');
    });

it('蒙古弃封贡敕书支付普通行动时，也会按 2 张银两计入支付值', () => {
        const tributeEdictIdentity = QIDAHEN_ATLAS05_ORDINARY_HAND_CARD_IDENTITIES
            .find((identity) => identity.cardDefId === 'qidahen-atlas05-1633-tribute-edict');
        expect(tributeEdictIdentity).toBeDefined();

        const core = QidahenDomain.setup(['0', '1', '2'], random);
        const [paymentCard, secondPaymentCard] = factionHandCards(core, 'mongol');
        const mappedCore: QidahenCore = {
            ...core,
            currentPlayer: '1',
            selectedActionId: 'khan-edict',
            confirmedActionId: 'khan-edict',
            actionChoices: getActionChoicesForFaction('mongol'),
            selectedPaymentCardIds: [],
            payment: {
                required: 1,
                selected: 0,
                prompt: '需弃 1 / 已选 0',
            },
            handCards: core.handCards.map((card) => (
                card.id === paymentCard.id
                    ? {
                        ...card,
                        label: tributeEdictIdentity!.displayName,
                        cardKind: tributeEdictIdentity!.cardKind,
                        armamentId: tributeEdictIdentity!.armamentId,
                        cardDefId: tributeEdictIdentity!.cardDefId,
                        rulesSummary: QIDAHEN_ATLAS05_ORDINARY_HAND_CARD_RULES_SUMMARY_BY_DEF_ID[tributeEdictIdentity!.cardDefId],
                    }
                    : card
            )),
        };

        const paid = apply(mappedCore, {
            type: QIDAHEN_COMMANDS.SELECT_PAYMENT_CARD,
            playerId: '1',
            payload: { cardId: paymentCard.id },
        });

        expect(paid.selectedPaymentCardIds).toEqual([paymentCard.id]);
        expect(paid.payment).toMatchObject({
            required: 1,
            selected: 1,
            prompt: '需弃 1 / 已选 1',
        });

        const capped = apply(paid, {
            type: QIDAHEN_COMMANDS.SELECT_PAYMENT_CARD,
            playerId: '1',
            payload: { cardId: secondPaymentCard.id },
        });
        expect(capped.selectedPaymentCardIds).toEqual([paymentCard.id]);

        const executed = apply(paid, {
            type: QIDAHEN_COMMANDS.EXECUTE_SELECTED_ACTION,
            playerId: '1',
            payload: {},
        });

        expect(executed.handCards.some((card) => card.id === paymentCard.id)).toBe(false);
        expect(executed.handCards.some((card) => card.id === secondPaymentCard.id)).toBe(true);
        expect(executed.actionLog[0]?.text).toContain('封贡敕书（视作 2 张银两）');
    });

it('蒙古直接执行普通行动时，会自动按封贡敕书 2 张银两支付', () => {
        const tributeEdictIdentity = QIDAHEN_ATLAS05_ORDINARY_HAND_CARD_IDENTITIES
            .find((identity) => identity.cardDefId === 'qidahen-atlas05-1633-tribute-edict');
        expect(tributeEdictIdentity).toBeDefined();

        const core = QidahenDomain.setup(['0', '1', '2'], random);
        const [paymentCard, secondPaymentCard] = factionHandCards(core, 'mongol');
        const mappedCore: QidahenCore = {
            ...core,
            currentPlayer: '1',
            selectedActionId: 'khan-edict',
            confirmedActionId: null,
            actionChoices: getActionChoicesForFaction('mongol'),
            selectedPaymentCardIds: [],
            payment: {
                required: 1,
                selected: 0,
                prompt: '需弃 1 / 已选 0',
            },
            handCards: core.handCards.map((card) => (
                card.id === paymentCard.id
                    ? {
                        ...card,
                        label: tributeEdictIdentity!.displayName,
                        cardKind: tributeEdictIdentity!.cardKind,
                        armamentId: tributeEdictIdentity!.armamentId,
                        cardDefId: tributeEdictIdentity!.cardDefId,
                        rulesSummary: QIDAHEN_ATLAS05_ORDINARY_HAND_CARD_RULES_SUMMARY_BY_DEF_ID[tributeEdictIdentity!.cardDefId],
                    }
                    : card
            )),
        };

        expect(QidahenDomain.validate(stateOf(mappedCore), {
            type: QIDAHEN_COMMANDS.EXECUTE_ACTION,
            playerId: '1',
            payload: { actionId: 'khan-edict' },
        })).toEqual({ valid: true });

        const executed = apply(mappedCore, {
            type: QIDAHEN_COMMANDS.EXECUTE_ACTION,
            playerId: '1',
            payload: { actionId: 'khan-edict' },
        });

        expect(executed.handCards.some((card) => card.id === paymentCard.id)).toBe(false);
        expect(executed.handCards.some((card) => card.id === secondPaymentCard.id)).toBe(true);
        expect(executed.actionLog[0]?.text).toContain('封贡敕书（视作 2 张银两）');
    });

it('大明弃封贡敕书支付普通行动时，仍只按 1 张手牌计入支付值', () => {
        const tributeEdictIdentity = QIDAHEN_ATLAS05_ORDINARY_HAND_CARD_IDENTITIES
            .find((identity) => identity.cardDefId === 'qidahen-atlas05-1633-tribute-edict');
        expect(tributeEdictIdentity).toBeDefined();

        const core = QidahenDomain.setup(['0', '1', '2'], random);
        const [paymentCard, secondPaymentCard] = factionHandCards(core, 'ming');
        const mappedCore: QidahenCore = {
            ...core,
            handCards: core.handCards.map((card) => (
                card.id === paymentCard.id
                    ? {
                        ...card,
                        label: tributeEdictIdentity!.displayName,
                        cardKind: tributeEdictIdentity!.cardKind,
                        armamentId: tributeEdictIdentity!.armamentId,
                        cardDefId: tributeEdictIdentity!.cardDefId,
                        rulesSummary: QIDAHEN_ATLAS05_ORDINARY_HAND_CARD_RULES_SUMMARY_BY_DEF_ID[tributeEdictIdentity!.cardDefId],
                    }
                    : card
            )),
        };

        const previewed = apply(mappedCore, {
            type: QIDAHEN_COMMANDS.CONFIRM_PREVIEW_ACTION,
            playerId: '0',
            payload: { actionId: 'recruit' },
        });
        const paid = apply(previewed, {
            type: QIDAHEN_COMMANDS.SELECT_PAYMENT_CARD,
            playerId: '0',
            payload: { cardId: paymentCard.id },
        });

        expect(previewed.payment).toMatchObject({
            required: 1,
            selected: 0,
            prompt: '需弃 1 / 已选 0',
        });
        expect(paid.payment).toMatchObject({
            required: 1,
            selected: 1,
            prompt: '需弃 1 / 已选 1',
        });
        expect(paid.selectedPaymentCardIds).toEqual([paymentCard.id]);
        expect(secondPaymentCard).toBeDefined();

        const executed = apply(paid, {
            type: QIDAHEN_COMMANDS.EXECUTE_SELECTED_ACTION,
            playerId: '0',
            payload: {},
        });

        expect(executed.handCards.some((card) => card.id === paymentCard.id)).toBe(false);
        expect(executed.handCards.some((card) => card.id === secondPaymentCard.id)).toBe(true);
        expect(executed.actionLog[0]?.text).not.toContain('封贡敕书（视作 2 张银两）');
    });

it('切换行动会清空已选支付牌并按新花费重算', () => {
        const selected = apply(QidahenDomain.setup(['0', '1', '2'], random), {
            type: QIDAHEN_COMMANDS.SELECT_PAYMENT_CARD,
            playerId: '0',
            payload: { cardId: 'hand-4' },
        });

        const next = apply(selected, {
            type: QIDAHEN_COMMANDS.CONFIRM_PREVIEW_ACTION,
            playerId: '0',
            payload: { actionId: 'recruit' },
        });

        expect(next.selectedActionId).toBe('recruit');
        expect(next.selectedPaymentCardIds).toEqual([]);
        expect(next.payment).toMatchObject({
            required: 1,
            selected: 0,
            prompt: '需弃 1 / 已选 0',
        });
    });

it('达到当前花费上限后不会继续增加支付牌', () => {
        const recruit = apply(QidahenDomain.setup(['0', '1', '2'], random), {
            type: QIDAHEN_COMMANDS.CONFIRM_PREVIEW_ACTION,
            playerId: '0',
            payload: { actionId: 'recruit' },
        });
        const first = apply(recruit, {
            type: QIDAHEN_COMMANDS.SELECT_PAYMENT_CARD,
            playerId: '0',
            payload: { cardId: 'hand-1' },
        });
        const second = apply(first, {
            type: QIDAHEN_COMMANDS.SELECT_PAYMENT_CARD,
            playerId: '0',
            payload: { cardId: 'hand-2' },
        });

        expect(second.selectedPaymentCardIds).toEqual(['hand-1']);
        expect(second.payment.prompt).toBe('需弃 1 / 已选 1');
    });

it('实体手牌按势力隔离，轮到蒙古时不会消费大明剩牌', () => {
        const core = QidahenDomain.setup(['0', '1', '2'], random);
        expect(factionHandCards(core, 'ming')).toHaveLength(4);
        expect(factionHandCards(core, 'mongol')).toHaveLength(6);
        expect(factionHandCards(core, 'jin')).toHaveLength(10);

        const next = apply({
            ...core,
            currentPlayer: '1',
            selectedActionId: 'ma-shi-trade',
            actionChoices: getActionChoicesForFaction('mongol'),
            selectedPaymentCardIds: [],
            payment: {
                required: 1,
                selected: 0,
                prompt: '需弃 1 / 已选 0',
            },
        }, {
            type: QIDAHEN_COMMANDS.EXECUTE_ACTION,
            playerId: '1',
            payload: { actionId: 'ma-shi-trade' },
        });

        expect(factionHandCards(next, 'ming')).toHaveLength(4);
        expect(factionHandCards(next, 'mongol')).toHaveLength(5);
        expect(next.factions.mongol.handCount).toBe(5);
    });
});
