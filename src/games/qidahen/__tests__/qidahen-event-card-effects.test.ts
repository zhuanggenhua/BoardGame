import { describe, expect, it } from 'vitest';import { getQidahenDriveTigerConsentSelectionForCore, getQidahenEventCharacterTargetSelectionForCore, getQidahenEventOpponentHandChoiceSelectionForCore, QidahenDomain } from '../domain';

import { QIDAHEN_COMMANDS } from '../domain/commands';
import { getQidahenDirectedPassageRule } from '../domain/movement';import { QIDAHEN_ATLAS05_ORDINARY_HAND_CARD_RULES_SUMMARY_BY_DEF_ID } from '../domain/ordinaryHandCardIdentities';
import { isQidahenHanRuntimeRegionId, isQidahenJurchenRuntimeRegionId, isQidahenMongolRuntimeRegionId } from '../domain/regionEthnicity';

import { getEffectiveHomelandController } from '../domain/regionRuleSemantics';import type { QidahenCore } from '../domain/types';
import { random, stateOf, apply, getDriveTigerConsentSelection, getGrantPardonSelection, setFactionCharactersInPlay, factionHandCards, setRegionCavalry } from './helpers/paymentSelectionHarness';

describe('七大恨事件牌结算合同', () => {
it('反间计会进入人物目标选择，并排除努尔哈赤、林丹汗和阿巴凯', () => {
        const core = QidahenDomain.setup(['0', '1', '2'], random);
        const [sourceCard, firstPaymentCard, secondPaymentCard] = factionHandCards(core, 'ming');
        const rulesSummary = QIDAHEN_ATLAS05_ORDINARY_HAND_CARD_RULES_SUMMARY_BY_DEF_ID[
            'qidahen-atlas05-1600-counter-spy-plot'
        ];
        setFactionCharactersInPlay(core, 'jin', ['jin-nurhaci', 'jin-abakai', 'jin-eidu']);
        setFactionCharactersInPlay(core, 'mongol', ['mongol-lindan-hutuktu']);
        const mappedCore: QidahenCore = {
            ...core,
            handCards: core.handCards.map((card) => (
                card.id === sourceCard.id
                    ? {
                        ...card,
                        label: '反间计',
                        cardKind: 'event' as const,
                        armamentId: null,
                        cardDefId: 'qidahen-atlas05-1600-counter-spy-plot',
                        rulesSummary,
                    }
                    : card
            )),
        };

        const previewed = apply(mappedCore, {
            type: QIDAHEN_COMMANDS.CONFIRM_PREVIEW_ACTION,
            playerId: '0',
            payload: { actionId: 'play-event-card', sourceHandCardId: sourceCard.id },
        });
        const firstPaid = apply(previewed, {
            type: QIDAHEN_COMMANDS.SELECT_PAYMENT_CARD,
            playerId: '0',
            payload: { cardId: firstPaymentCard.id },
        });
        expect(QidahenDomain.validate(stateOf(firstPaid), {
            type: QIDAHEN_COMMANDS.EXECUTE_SELECTED_ACTION,
            playerId: '0',
            payload: {},
        })).toEqual({ valid: false, error: 'paymentIncomplete' });
        const paid = apply(firstPaid, {
            type: QIDAHEN_COMMANDS.SELECT_PAYMENT_CARD,
            playerId: '0',
            payload: { cardId: secondPaymentCard.id },
        });
        const executed = apply(paid, {
            type: QIDAHEN_COMMANDS.EXECUTE_SELECTED_ACTION,
            playerId: '0',
            payload: {},
        });

        const selection = getQidahenEventCharacterTargetSelectionForCore(executed);
        expect(executed.turnPhase).toBe('event-character-target');
        expect(selection?.title).toBe('反间计');
        expect(selection?.paymentCardIds).toEqual([
            sourceCard.id,
            firstPaymentCard.id,
            secondPaymentCard.id,
        ]);
        expect(selection?.choices.map((choice) => choice.characterId)).toEqual(['jin-eidu']);
        expect(selection?.choices[0]).toMatchObject({
            id: 'jin:jin-eidu',
            characterName: '额亦都',
            factionId: 'jin',
        });
    });

it('反间计选择合法目标后会移除人物，事件牌移出游戏，额外费用进弃牌堆', () => {
        const core = QidahenDomain.setup(['0', '1', '2'], random);
        const [sourceCard, firstPaymentCard, secondPaymentCard] = factionHandCards(core, 'ming');
        const rulesSummary = QIDAHEN_ATLAS05_ORDINARY_HAND_CARD_RULES_SUMMARY_BY_DEF_ID[
            'qidahen-atlas05-1600-counter-spy-plot'
        ];
        setFactionCharactersInPlay(core, 'jin', ['jin-eidu']);
        const mappedCore: QidahenCore = {
            ...core,
            handCards: core.handCards.map((card) => (
                card.id === sourceCard.id
                    ? {
                        ...card,
                        label: '反间计',
                        cardKind: 'event' as const,
                        armamentId: null,
                        cardDefId: 'qidahen-atlas05-1600-counter-spy-plot',
                        rulesSummary,
                    }
                    : card
            )),
        };

        const previewed = apply(mappedCore, {
            type: QIDAHEN_COMMANDS.CONFIRM_PREVIEW_ACTION,
            playerId: '0',
            payload: { actionId: 'play-event-card', sourceHandCardId: sourceCard.id },
        });
        const firstPaid = apply(previewed, {
            type: QIDAHEN_COMMANDS.SELECT_PAYMENT_CARD,
            playerId: '0',
            payload: { cardId: firstPaymentCard.id },
        });
        const paid = apply(firstPaid, {
            type: QIDAHEN_COMMANDS.SELECT_PAYMENT_CARD,
            playerId: '0',
            payload: { cardId: secondPaymentCard.id },
        });
        const waitingTarget = apply(paid, {
            type: QIDAHEN_COMMANDS.EXECUTE_SELECTED_ACTION,
            playerId: '0',
            payload: {},
        });

        const resolved = apply(waitingTarget, {
            type: QIDAHEN_COMMANDS.RESOLVE_EVENT_CHARACTER_TARGET,
            playerId: '0',
            payload: { choiceId: 'jin:jin-eidu' },
        });

        expect(resolved.eventCharacterTargetSelection).toBeNull();
        expect(resolved.turnPhase).toBe('action-window');
        expect(resolved.handCards.some((card) => card.id === sourceCard.id)).toBe(false);
        expect(resolved.handCards.some((card) => card.id === firstPaymentCard.id)).toBe(false);
        expect(resolved.handCards.some((card) => card.id === secondPaymentCard.id)).toBe(false);
        expect(resolved.discardPileCount).toBe(core.discardPileCount + 2);
        expect(resolved.factions.ming.discardPileCount).toBe(core.factions.ming.discardPileCount + 2);
        expect(resolved.factions.jin.characters.find((character) => character.id === 'jin-eidu')).toMatchObject({
            inPlay: false,
            removedFromGame: true,
        });
        expect(resolved.lastSeasonSummary?.title).toBe('反间计');
        expect(resolved.lastSeasonSummary?.lines.join(' ')).toContain('反间计使用后移出游戏；此牌未进入弃牌堆。');
        expect(resolved.actionLog[0]?.text).toContain('大明 执行事件「反间计」');
    });

it('反间计没有合法人物目标时不消耗手牌', () => {
        const core = QidahenDomain.setup(['0', '1', '2'], random);
        const [sourceCard, firstPaymentCard, secondPaymentCard] = factionHandCards(core, 'ming');
        const rulesSummary = QIDAHEN_ATLAS05_ORDINARY_HAND_CARD_RULES_SUMMARY_BY_DEF_ID[
            'qidahen-atlas05-1600-counter-spy-plot'
        ];
        setFactionCharactersInPlay(core, 'jin', ['jin-nurhaci', 'jin-abakai']);
        setFactionCharactersInPlay(core, 'mongol', ['mongol-lindan-hutuktu']);
        const mappedCore: QidahenCore = {
            ...core,
            handCards: core.handCards.map((card) => (
                card.id === sourceCard.id
                    ? {
                        ...card,
                        label: '反间计',
                        cardKind: 'event' as const,
                        armamentId: null,
                        cardDefId: 'qidahen-atlas05-1600-counter-spy-plot',
                        rulesSummary,
                    }
                    : card
            )),
        };

        const previewed = apply(mappedCore, {
            type: QIDAHEN_COMMANDS.CONFIRM_PREVIEW_ACTION,
            playerId: '0',
            payload: { actionId: 'play-event-card', sourceHandCardId: sourceCard.id },
        });
        const firstPaid = apply(previewed, {
            type: QIDAHEN_COMMANDS.SELECT_PAYMENT_CARD,
            playerId: '0',
            payload: { cardId: firstPaymentCard.id },
        });
        const paid = apply(firstPaid, {
            type: QIDAHEN_COMMANDS.SELECT_PAYMENT_CARD,
            playerId: '0',
            payload: { cardId: secondPaymentCard.id },
        });
        const executed = apply(paid, {
            type: QIDAHEN_COMMANDS.EXECUTE_SELECTED_ACTION,
            playerId: '0',
            payload: {},
        });

        expect(executed.eventCharacterTargetSelection).toBeNull();
        expect(executed.handCards.some((card) => card.id === sourceCard.id)).toBe(true);
        expect(executed.handCards.some((card) => card.id === firstPaymentCard.id)).toBe(true);
        expect(executed.handCards.some((card) => card.id === secondPaymentCard.id)).toBe(true);
        expect(executed.discardPileCount).toBe(core.discardPileCount);
        expect(executed.factions.ming.discardPileCount).toBe(core.factions.ming.discardPileCount);
        expect(executed.lastSeasonSummary?.title).toBe('执行事件');
        expect(executed.lastSeasonSummary?.lines.join(' ')).toContain('反间计需要一个可被指定的对手在场人物');
        expect(executed.lastSeasonSummary?.lines.join(' ')).toContain('本次未消耗手牌');
    });

it('各个击破不能从普通执行事件入口被当作已结算事件消耗', () => {
        const core = QidahenDomain.setup(['0', '1', '2'], random);
        const [sourceCard] = factionHandCards(core, 'ming');
        const rulesSummary = QIDAHEN_ATLAS05_ORDINARY_HAND_CARD_RULES_SUMMARY_BY_DEF_ID[
            'qidahen-atlas05-1601-defeat-in-detail'
        ];
        const mappedCore: QidahenCore = {
            ...core,
            currentPlayer: '0',
            handCards: core.handCards.map((card) => (
                card.id === sourceCard.id
                    ? {
                        ...card,
                        label: '各个击破',
                        cardKind: 'event' as const,
                        armamentId: null,
                        cardDefId: 'qidahen-atlas05-1601-defeat-in-detail',
                        rulesSummary,
                    }
                    : card
            )),
        };

        const previewed = apply(mappedCore, {
            type: QIDAHEN_COMMANDS.CONFIRM_PREVIEW_ACTION,
            playerId: '0',
            payload: { actionId: 'play-event-card', sourceHandCardId: sourceCard.id },
        });
        const executed = apply(previewed, {
            type: QIDAHEN_COMMANDS.EXECUTE_SELECTED_ACTION,
            playerId: '0',
            payload: {},
        });

        expect(executed.handCards.some((card) => card.id === sourceCard.id)).toBe(true);
        expect(executed.discardPileCount).toBe(core.discardPileCount);
        expect(executed.factions.ming.discardPileCount).toBe(core.factions.ming.discardPileCount);
        expect(executed.lastSeasonSummary?.title).toBe('执行事件');
        expect(executed.lastSeasonSummary?.lines.join(' ')).toContain('只能在遭到攻击时作为防守响应打出');
        expect(executed.lastSeasonSummary?.lines.join(' ')).toContain('本次未消耗手牌，也未结算事件效果。');
        expect(executed.actionLog[0]?.text).toContain('尝试执行事件「各个击破」');
    });

it('蒙古打出王公大会会进入打出/回收蒙古人物二择一，不立即消耗手牌', () => {
        const core = QidahenDomain.setup(['0', '1', '2'], random);
        const [sourceCard] = factionHandCards(core, 'mongol');
        const rulesSummary = QIDAHEN_ATLAS05_ORDINARY_HAND_CARD_RULES_SUMMARY_BY_DEF_ID[
            'qidahen-atlas05-1623-mongol-nobles-congress'
        ];
        const mappedCore: QidahenCore = {
            ...core,
            currentPlayer: '1',
            handCards: core.handCards.map((card) => (
                card.id === sourceCard.id
                    ? {
                        ...card,
                        label: '王公大会',
                        cardKind: 'event' as const,
                        armamentId: null,
                        cardDefId: 'qidahen-atlas05-1623-mongol-nobles-congress',
                        rulesSummary,
                    }
                    : card
            )),
        };

        const previewed = apply(mappedCore, {
            type: QIDAHEN_COMMANDS.CONFIRM_PREVIEW_ACTION,
            playerId: '1',
            payload: { actionId: 'play-event-card', sourceHandCardId: sourceCard.id },
        });
        const executed = apply(previewed, {
            type: QIDAHEN_COMMANDS.EXECUTE_SELECTED_ACTION,
            playerId: '1',
            payload: {},
        });

        const selection = getQidahenEventOpponentHandChoiceSelectionForCore(executed);
        expect(executed.turnPhase).toBe('event-opponent-hand-choice');
        expect(selection).toMatchObject({
            source: 'mongol-nobles-congress-effect',
            title: '王公大会',
            eventCardId: sourceCard.id,
            eventCardDefId: 'qidahen-atlas05-1623-mongol-nobles-congress',
            ownerFactionId: 'mongol',
            paymentCardIds: [sourceCard.id],
        });
        expect(selection?.choices.map((choice) => choice.id)).toEqual(['play-character']);
        expect(executed.handCards.some((card) => card.id === sourceCard.id)).toBe(true);
        expect(executed.discardPileCount).toBe(core.discardPileCount);
        expect(executed.factions.mongol.discardPileCount).toBe(core.factions.mongol.discardPileCount);
        expect(executed.lastSeasonSummary?.title).toBe('王公大会');
        expect(executed.lastSeasonSummary?.lines.join(' ')).toContain('选择打出 1 张蒙古人物');
    });

it('蒙古打出王公大会可选择 1 张蒙古人物打出并将事件牌放入蒙古弃牌堆', () => {
        const core = QidahenDomain.setup(['0', '1', '2'], random);
        const [sourceCard] = factionHandCards(core, 'mongol');
        const rulesSummary = QIDAHEN_ATLAS05_ORDINARY_HAND_CARD_RULES_SUMMARY_BY_DEF_ID[
            'qidahen-atlas05-1623-mongol-nobles-congress'
        ];
        const mappedCore: QidahenCore = {
            ...core,
            currentPlayer: '1',
            handCards: core.handCards.map((card) => (
                card.id === sourceCard.id
                    ? {
                        ...card,
                        label: '王公大会',
                        cardKind: 'event' as const,
                        armamentId: null,
                        cardDefId: 'qidahen-atlas05-1623-mongol-nobles-congress',
                        rulesSummary,
                    }
                    : card
            )),
        };

        const previewed = apply(mappedCore, {
            type: QIDAHEN_COMMANDS.CONFIRM_PREVIEW_ACTION,
            playerId: '1',
            payload: { actionId: 'play-event-card', sourceHandCardId: sourceCard.id },
        });
        const waitingEffectChoice = apply(previewed, {
            type: QIDAHEN_COMMANDS.EXECUTE_SELECTED_ACTION,
            playerId: '1',
            payload: {},
        });
        const waitingCharacterChoice = apply(waitingEffectChoice, {
            type: QIDAHEN_COMMANDS.RESOLVE_EVENT_OPPONENT_HAND_CHOICE,
            playerId: '1',
            payload: { choiceId: 'play-character' },
        });
        const characterSelection = getQidahenEventOpponentHandChoiceSelectionForCore(waitingCharacterChoice);
        expect(waitingCharacterChoice.turnPhase).toBe('event-opponent-hand-choice');
        expect(characterSelection).toMatchObject({
            source: 'mongol-nobles-congress-play-character',
            ownerFactionId: 'mongol',
        });
        expect(characterSelection?.choices.map((choice) => choice.cardId)).toEqual([
            'mongol-choghtu-taiji',
            'mongol-oba-taiji',
            'mongol-qisai-noyan',
            'mongol-gunchu-ketuji',
        ]);

        const resolved = apply(waitingCharacterChoice, {
            type: QIDAHEN_COMMANDS.RESOLVE_EVENT_OPPONENT_HAND_CHOICE,
            playerId: '1',
            payload: { choiceId: 'mongol-choghtu-taiji' },
        });

        expect(resolved.turnPhase).toBe('action-window');
        expect(getQidahenEventOpponentHandChoiceSelectionForCore(resolved)).toBeNull();
        expect(resolved.handCards.some((card) => card.id === sourceCard.id)).toBe(false);
        expect(resolved.factions.mongol.characters.find((character) => character.id === 'mongol-choghtu-taiji')).toMatchObject({
            inPlay: true,
            removedFromGame: false,
            defeatMarkers: 0,
        });
        expect(resolved.factions.mongol.handCount).toBe(core.factions.mongol.handCount - 1);
        expect(resolved.discardPileCount).toBe(core.discardPileCount + 1);
        expect(resolved.factions.mongol.discardPileCount).toBe(core.factions.mongol.discardPileCount + 1);
        expect(resolved.lastSeasonSummary?.title).toBe('王公大会');
        expect(resolved.lastSeasonSummary?.lines.join(' ')).toContain('打出蒙古人物「绰克图台吉」');
        expect(resolved.lastSeasonSummary?.lines.join(' ')).toContain('王公大会使用后进入蒙古弃牌堆');
        expect(resolved.actionLog.some((entry) => (
            entry.text.includes('蒙古 执行事件「王公大会」')
            && entry.text.includes('打出蒙古人物「绰克图台吉」')
        ))).toBe(true);
    });

it('蒙古打出王公大会可将大明侧在场蒙古人物拿回蒙古人物牌堆', () => {
        const core = QidahenDomain.setup(['0', '1', '2'], random);
        const [sourceCard] = factionHandCards(core, 'mongol');
        const returnedCharacter = {
            ...core.factions.mongol.characters.find((character) => character.id === 'mongol-choghtu-taiji')!,
            faction: 'mongol' as const,
            inPlay: true,
            removedFromGame: false,
            defeatMarkers: 1,
        };
        const rulesSummary = QIDAHEN_ATLAS05_ORDINARY_HAND_CARD_RULES_SUMMARY_BY_DEF_ID[
            'qidahen-atlas05-1623-mongol-nobles-congress'
        ];
        const mappedCore: QidahenCore = {
            ...core,
            currentPlayer: '1',
            factions: {
                ...core.factions,
                ming: {
                    ...core.factions.ming,
                    characters: [...core.factions.ming.characters, returnedCharacter],
                },
                mongol: {
                    ...core.factions.mongol,
                    characters: core.factions.mongol.characters.filter((character) => character.id !== returnedCharacter.id),
                },
            },
            handCards: core.handCards.map((card) => (
                card.id === sourceCard.id
                    ? {
                        ...card,
                        label: '王公大会',
                        cardKind: 'event' as const,
                        armamentId: null,
                        cardDefId: 'qidahen-atlas05-1623-mongol-nobles-congress',
                        rulesSummary,
                    }
                    : card
            )),
        };

        const previewed = apply(mappedCore, {
            type: QIDAHEN_COMMANDS.CONFIRM_PREVIEW_ACTION,
            playerId: '1',
            payload: { actionId: 'play-event-card', sourceHandCardId: sourceCard.id },
        });
        const waitingEffectChoice = apply(previewed, {
            type: QIDAHEN_COMMANDS.EXECUTE_SELECTED_ACTION,
            playerId: '1',
            payload: {},
        });
        const effectSelection = getQidahenEventOpponentHandChoiceSelectionForCore(waitingEffectChoice);
        expect(effectSelection?.choices.map((choice) => choice.id)).toEqual(['play-character', 'return-character']);

        const waitingCharacterChoice = apply(waitingEffectChoice, {
            type: QIDAHEN_COMMANDS.RESOLVE_EVENT_OPPONENT_HAND_CHOICE,
            playerId: '1',
            payload: { choiceId: 'return-character' },
        });
        const characterSelection = getQidahenEventOpponentHandChoiceSelectionForCore(waitingCharacterChoice);
        expect(characterSelection).toMatchObject({
            source: 'mongol-nobles-congress-return-character',
            ownerFactionId: 'mongol',
        });
        expect(characterSelection?.choices.map((choice) => choice.id)).toContain('ming:mongol-choghtu-taiji');

        const resolved = apply(waitingCharacterChoice, {
            type: QIDAHEN_COMMANDS.RESOLVE_EVENT_OPPONENT_HAND_CHOICE,
            playerId: '1',
            payload: { choiceId: 'ming:mongol-choghtu-taiji' },
        });

        expect(resolved.turnPhase).toBe('action-window');
        expect(getQidahenEventOpponentHandChoiceSelectionForCore(resolved)).toBeNull();
        expect(resolved.handCards.some((card) => card.id === sourceCard.id)).toBe(false);
        expect(resolved.factions.ming.characters.some((character) => character.id === 'mongol-choghtu-taiji')).toBe(false);
        expect(resolved.factions.mongol.characters.find((character) => character.id === 'mongol-choghtu-taiji')).toMatchObject({
            faction: 'mongol',
            inPlay: false,
            removedFromGame: false,
            defeatMarkers: 0,
        });
        expect(resolved.factions.mongol.handCount).toBe(core.factions.mongol.handCount - 1);
        expect(resolved.discardPileCount).toBe(core.discardPileCount + 1);
        expect(resolved.factions.mongol.discardPileCount).toBe(core.factions.mongol.discardPileCount + 1);
        expect(resolved.lastSeasonSummary?.title).toBe('王公大会');
        expect(resolved.lastSeasonSummary?.lines.join(' ')).toContain('将大明在场蒙古人物「绰克图台吉」拿回蒙古人物牌堆');
        expect(resolved.actionLog.some((entry) => (
            entry.text.includes('将大明在场蒙古人物「绰克图台吉」拿回蒙古人物牌堆')
        ))).toBe(true);
    });

it('后金打出王公大会会按牌面无效果处理并进入当前势力弃牌堆', () => {
        const core = QidahenDomain.setup(['0', '1', '2'], random);
        const [sourceCard] = factionHandCards(core, 'jin');
        const rulesSummary = QIDAHEN_ATLAS05_ORDINARY_HAND_CARD_RULES_SUMMARY_BY_DEF_ID[
            'qidahen-atlas05-1623-mongol-nobles-congress'
        ];
        const mappedCore: QidahenCore = {
            ...core,
            currentPlayer: '2',
            handCards: core.handCards.map((card) => (
                card.id === sourceCard.id
                    ? {
                        ...card,
                        label: '王公大会',
                        cardKind: 'event' as const,
                        armamentId: null,
                        cardDefId: 'qidahen-atlas05-1623-mongol-nobles-congress',
                        rulesSummary,
                    }
                    : card
            )),
        };

        const previewed = apply(mappedCore, {
            type: QIDAHEN_COMMANDS.CONFIRM_PREVIEW_ACTION,
            playerId: '2',
            payload: { actionId: 'play-event-card', sourceHandCardId: sourceCard.id },
        });
        const executed = apply(previewed, {
            type: QIDAHEN_COMMANDS.EXECUTE_SELECTED_ACTION,
            playerId: '2',
            payload: {},
        });

        expect(executed.handCards.some((card) => card.id === sourceCard.id)).toBe(false);
        expect(executed.discardPileCount).toBe(core.discardPileCount + 1);
        expect(executed.factions.jin.discardPileCount).toBe(core.factions.jin.discardPileCount + 1);
        expect(executed.lastSeasonSummary?.title).toBe('执行事件');
        expect(executed.lastSeasonSummary?.lines.join(' ')).toContain('打出事件牌：王公大会');
        expect(executed.lastSeasonSummary?.lines.join(' ')).toContain('后金使用王公大会无效果');
        expect(executed.lastSeasonSummary?.lines.join(' ')).toContain('使用后进入当前势力弃牌堆。');
        expect(executed.actionLog[0]?.text).toContain('执行事件「王公大会」');
        expect(executed.actionLog[0]?.text).toContain('后金使用王公大会无效果');
    });

it('后金打出人参貂皮会指定对手，并由该对手选择给出手牌', () => {
        const core = QidahenDomain.setup(['0', '1', '2'], random);
        const [sourceCard] = factionHandCards(core, 'jin');
        const targetCard = factionHandCards(core, 'ming')[1];
        const rulesSummary = QIDAHEN_ATLAS05_ORDINARY_HAND_CARD_RULES_SUMMARY_BY_DEF_ID[
            'qidahen-atlas05-1630-ginseng-and-sable'
        ];
        const mappedCore: QidahenCore = {
            ...core,
            currentPlayer: '2',
            handCards: core.handCards.map((card) => (
                card.id === sourceCard.id
                    ? {
                        ...card,
                        label: '人参貂皮',
                        cardKind: 'event' as const,
                        armamentId: null,
                        cardDefId: 'qidahen-atlas05-1630-ginseng-and-sable',
                        rulesSummary,
                    }
                    : card
            )),
        };

        const previewed = apply(mappedCore, {
            type: QIDAHEN_COMMANDS.CONFIRM_PREVIEW_ACTION,
            playerId: '2',
            payload: { actionId: 'play-event-card', sourceHandCardId: sourceCard.id },
        });
        const executed = apply(previewed, {
            type: QIDAHEN_COMMANDS.EXECUTE_SELECTED_ACTION,
            playerId: '2',
            payload: {},
        });

        const opponentSelection = getQidahenEventOpponentHandChoiceSelectionForCore(executed);
        expect(executed.turnPhase).toBe('event-opponent-hand-choice');
        expect(opponentSelection).toMatchObject({
            source: 'ginseng-and-sable-opponent',
            title: '人参貂皮',
            eventCardId: sourceCard.id,
            eventCardDefId: 'qidahen-atlas05-1630-ginseng-and-sable',
            ownerFactionId: 'jin',
            paymentCardIds: [sourceCard.id],
        });
        expect(opponentSelection?.choices.map((choice) => choice.id)).toEqual(['ming', 'mongol']);
        expect(executed.handCards.some((card) => card.id === sourceCard.id)).toBe(true);
        expect(executed.handCards.some((card) => card.id === targetCard.id)).toBe(true);
        expect(executed.discardPileCount).toBe(core.discardPileCount);
        expect(executed.factions.jin.discardPileCount).toBe(core.factions.jin.discardPileCount);
        expect(executed.lastSeasonSummary?.title).toBe('人参貂皮');
        expect(executed.lastSeasonSummary?.lines.join(' ')).toContain('由该对手选择给出哪张手牌');

        const waitingCardChoice = apply(executed, {
            type: QIDAHEN_COMMANDS.RESOLVE_EVENT_OPPONENT_HAND_CHOICE,
            playerId: '2',
            payload: { choiceId: 'ming' },
        });
        const cardSelection = getQidahenEventOpponentHandChoiceSelectionForCore(waitingCardChoice);
        expect(waitingCardChoice.turnPhase).toBe('event-opponent-hand-choice');
        expect(cardSelection).toMatchObject({
            source: 'ginseng-and-sable-card',
            targetFactionId: 'ming',
            targetFactionName: '大明',
        });
        expect(cardSelection?.choices.map((choice) => choice.cardId)).toEqual(
            factionHandCards(core, 'ming').map((card) => card.id),
        );

        const resolved = apply(waitingCardChoice, {
            type: QIDAHEN_COMMANDS.RESOLVE_EVENT_OPPONENT_HAND_CHOICE,
            playerId: '0',
            payload: { choiceId: targetCard.id },
        });

        expect(resolved.turnPhase).toBe('action-window');
        expect(getQidahenEventOpponentHandChoiceSelectionForCore(resolved)).toBeNull();
        expect(resolved.handCards.some((card) => card.id === sourceCard.id)).toBe(false);
        expect(factionHandCards(resolved, 'jin').some((card) => card.id === targetCard.id)).toBe(true);
        expect(factionHandCards(resolved, 'ming').some((card) => card.id === targetCard.id)).toBe(false);
        expect(resolved.factions.jin.handCount).toBe(core.factions.jin.handCount);
        expect(resolved.factions.ming.handCount).toBe(core.factions.ming.handCount - 1);
        expect(resolved.discardPileCount).toBe(core.discardPileCount + 1);
        expect(resolved.factions.jin.discardPileCount).toBe(core.factions.jin.discardPileCount);
        expect(resolved.factions.ming.discardPileCount).toBe(core.factions.ming.discardPileCount + 1);
        expect(resolved.lastSeasonSummary?.title).toBe('人参貂皮');
        expect(resolved.lastSeasonSummary?.lines.join(' ')).toContain(`后金获得大明给出的手牌「${targetCard.label}」`);
        expect(resolved.lastSeasonSummary?.lines.join(' ')).toContain('人参貂皮使用后进入大明弃牌堆');
        expect(resolved.actionLog[0]?.text).toContain('后金 执行事件「人参貂皮」');
        expect(resolved.actionLog[0]?.text).toContain('事件牌进入大明弃牌堆');
    });

it('后金打出封贡敕书会额外弃 1 张手牌，再指定对手并由该对手选择赐印招安或驱虎吞狼', () => {
        const core = QidahenDomain.setup(['0', '1', '2'], random);
        const [sourceCard, paymentCard] = factionHandCards(core, 'jin');
        const rulesSummary = QIDAHEN_ATLAS05_ORDINARY_HAND_CARD_RULES_SUMMARY_BY_DEF_ID[
            'qidahen-atlas05-1633-tribute-edict'
        ];
        const mappedCore: QidahenCore = {
            ...core,
            currentPlayer: '2',
            handCards: core.handCards.map((card) => (
                card.id === sourceCard.id
                    ? {
                        ...card,
                        label: '封贡敕书',
                        cardKind: 'event' as const,
                        armamentId: null,
                        cardDefId: 'qidahen-atlas05-1633-tribute-edict',
                        rulesSummary,
                    }
                    : card
            )),
        };

        const previewed = apply(mappedCore, {
            type: QIDAHEN_COMMANDS.CONFIRM_PREVIEW_ACTION,
            playerId: '2',
            payload: { actionId: 'play-event-card', sourceHandCardId: sourceCard.id },
        });
        expect(previewed.payment.required).toBe(2);

        const paid = apply(previewed, {
            type: QIDAHEN_COMMANDS.SELECT_PAYMENT_CARD,
            playerId: '2',
            payload: { cardId: paymentCard.id },
        });
        const executed = apply(paid, {
            type: QIDAHEN_COMMANDS.EXECUTE_SELECTED_ACTION,
            playerId: '2',
            payload: {},
        });

        const opponentSelection = getQidahenEventOpponentHandChoiceSelectionForCore(executed);
        expect(executed.turnPhase).toBe('event-opponent-hand-choice');
        expect(opponentSelection).toMatchObject({
            source: 'tribute-edict-opponent',
            title: '封贡敕书',
            eventCardId: sourceCard.id,
            eventCardDefId: 'qidahen-atlas05-1633-tribute-edict',
            ownerFactionId: 'jin',
            paymentCardIds: [sourceCard.id, paymentCard.id],
        });
        expect(opponentSelection?.choices.map((choice) => choice.id)).toEqual(['ming', 'mongol']);
        expect(executed.handCards.some((card) => card.id === sourceCard.id)).toBe(true);
        expect(executed.discardPileCount).toBe(core.discardPileCount);
        expect(executed.factions.ming.discardPileCount).toBe(core.factions.ming.discardPileCount);
        expect(executed.lastSeasonSummary?.title).toBe('封贡敕书');
        expect(executed.lastSeasonSummary?.lines.join(' ')).toContain('由该对手选择执行赐印招安或驱虎吞狼');

        const waitingActionChoice = apply(executed, {
            type: QIDAHEN_COMMANDS.RESOLVE_EVENT_OPPONENT_HAND_CHOICE,
            playerId: '2',
            payload: { choiceId: 'ming' },
        });
        const actionSelection = getQidahenEventOpponentHandChoiceSelectionForCore(waitingActionChoice);
        expect(waitingActionChoice.turnPhase).toBe('event-opponent-hand-choice');
        expect(actionSelection).toMatchObject({
            source: 'tribute-edict-action',
            targetFactionId: 'ming',
            targetFactionName: '大明',
        });
        expect(actionSelection?.choices.map((choice) => choice.id)).toEqual(['grant-pardon', 'drive-tiger']);

        const resolved = apply(waitingActionChoice, {
            type: QIDAHEN_COMMANDS.RESOLVE_EVENT_OPPONENT_HAND_CHOICE,
            playerId: '0',
            payload: { choiceId: 'drive-tiger' },
        });

        expect(resolved.turnPhase).toBe('action-window');
        expect(getQidahenEventOpponentHandChoiceSelectionForCore(resolved)).toBeNull();
        expect(resolved.handCards.some((card) => card.id === sourceCard.id)).toBe(false);
        expect(resolved.handCards.some((card) => card.id === paymentCard.id)).toBe(false);
        expect(resolved.factions.jin.handCount).toBe(core.factions.jin.handCount - 2);
        expect(resolved.discardPileCount).toBe(core.discardPileCount + 2);
        expect(resolved.factions.jin.discardPileCount).toBe(core.factions.jin.discardPileCount + 1);
        expect(resolved.factions.ming.discardPileCount).toBe(core.factions.ming.discardPileCount + 1);
        expect(resolved.lastSeasonSummary?.title).toBe('封贡敕书');
        expect(resolved.lastSeasonSummary?.lines.join(' ')).toContain('大明选择执行驱虎吞狼');
        expect(resolved.lastSeasonSummary?.lines.join(' ')).toContain('封贡敕书使用后进入大明弃牌堆');
        expect(resolved.lastSeasonSummary?.lines.join(' ')).toContain('额外弃 1 张手牌作为费用');
        expect(resolved.lastSeasonSummary?.lines.join(' ')).toContain('当前没有可由大明指挥的对手调度进攻来源');
        expect(resolved.actionLog[0]?.text).toContain('后金 执行事件「封贡敕书」');
        expect(resolved.actionLog[0]?.text).toContain('事件牌进入大明弃牌堆');
    });

it('封贡敕书指定大明执行驱虎吞狼时，会进入既有驱虎吞狼同意链', () => {
        const baseCore = setRegionCavalry(QidahenDomain.setup(['0', '1', '2'], random), 'jinzhou', 'jin', 2, 2);
        const core: QidahenCore = {
            ...baseCore,
            currentPlayer: '2',
            selectedRegionId: 'jinzhou',
            explicitRegionId: 'jinzhou',
            regionFocusState: {
                ...baseCore.regionFocusState,
                defaultFocusRegionId: baseCore.regionFocusState.defaultFocusRegionId,
                lockedSourceRegionId: 'jinzhou',
                currentTargetRegionId: 'jinzhou',
                displayAnchorRegionId: 'jinzhou',
            },
        };
        const [sourceCard, paymentCard] = factionHandCards(core, 'jin');
        const rulesSummary = QIDAHEN_ATLAS05_ORDINARY_HAND_CARD_RULES_SUMMARY_BY_DEF_ID[
            'qidahen-atlas05-1633-tribute-edict'
        ];
        const mappedCore: QidahenCore = {
            ...core,
            currentPlayer: '2',
            handCards: core.handCards.map((card) => (
                card.id === sourceCard.id
                    ? {
                        ...card,
                        label: '封贡敕书',
                        cardKind: 'event' as const,
                        armamentId: null,
                        cardDefId: 'qidahen-atlas05-1633-tribute-edict',
                        rulesSummary,
                    }
                    : card
            )),
        };

        const previewed = apply(mappedCore, {
            type: QIDAHEN_COMMANDS.CONFIRM_PREVIEW_ACTION,
            playerId: '2',
            payload: { actionId: 'play-event-card', sourceHandCardId: sourceCard.id },
        });
        const paid = apply(previewed, {
            type: QIDAHEN_COMMANDS.SELECT_PAYMENT_CARD,
            playerId: '2',
            payload: { cardId: paymentCard.id },
        });
        const executed = apply(paid, {
            type: QIDAHEN_COMMANDS.EXECUTE_SELECTED_ACTION,
            playerId: '2',
            payload: {},
        });
        const waitingActionChoice = apply(executed, {
            type: QIDAHEN_COMMANDS.RESOLVE_EVENT_OPPONENT_HAND_CHOICE,
            playerId: '2',
            payload: { choiceId: 'ming' },
        });
        const consenting = apply(waitingActionChoice, {
            type: QIDAHEN_COMMANDS.RESOLVE_EVENT_OPPONENT_HAND_CHOICE,
            playerId: '0',
            payload: { choiceId: 'drive-tiger' },
        });

        expect(consenting.turnPhase).toBe('drive-tiger-consent');
        expect(getQidahenEventOpponentHandChoiceSelectionForCore(consenting)).toBeNull();
        expect(getDriveTigerConsentSelection(consenting)).toMatchObject({
            commanderFactionId: 'ming',
            targetFactionId: 'jin',
            targetFactionName: '后金',
        });
        expect(getDriveTigerConsentSelection(consenting)?.dispatchSelection).toMatchObject({
            attackerFactionId: 'jin',
            sourceRegionId: 'jinzhou',
            sourceActionId: 'drive-tiger',
        });
        expect(consenting.handCards.some((card) => card.id === sourceCard.id)).toBe(false);
        expect(consenting.handCards.some((card) => card.id === paymentCard.id)).toBe(false);
        expect(consenting.factions.jin.handCount).toBe(core.factions.jin.handCount - 2);
        expect(consenting.factions.jin.discardPileCount).toBe(core.factions.jin.discardPileCount + 1);
        expect(consenting.factions.ming.discardPileCount).toBe(core.factions.ming.discardPileCount + 1);
        expect(consenting.lastSeasonSummary?.title).toBe('封贡敕书');
        expect(consenting.lastSeasonSummary?.lines.join(' ')).toContain('等待后金决定是否接受大明指挥');
    });

it('封贡敕书指定大明执行赐印招安时，会先进入目标选择并免费结算所选目标', () => {
        const baseCore = QidahenDomain.setup(['0', '1', '2'], random);
        const core: QidahenCore = {
            ...baseCore,
            currentPlayer: '2',
            selectedRegionId: 'jinzhou',
            explicitRegionId: 'jinzhou',
            regionFocusState: {
                ...baseCore.regionFocusState,
                defaultFocusRegionId: baseCore.regionFocusState.defaultFocusRegionId,
                lockedSourceRegionId: 'jinzhou',
                currentTargetRegionId: 'jinzhou',
                displayAnchorRegionId: 'jinzhou',
            },
        };
        const [sourceCard, paymentCard] = factionHandCards(core, 'jin');
        const rulesSummary = QIDAHEN_ATLAS05_ORDINARY_HAND_CARD_RULES_SUMMARY_BY_DEF_ID[
            'qidahen-atlas05-1633-tribute-edict'
        ];
        const mappedCore: QidahenCore = {
            ...core,
            handCards: core.handCards.map((card) => (
                card.id === sourceCard.id
                    ? {
                        ...card,
                        label: '封贡敕书',
                        cardKind: 'event' as const,
                        armamentId: null,
                        cardDefId: 'qidahen-atlas05-1633-tribute-edict',
                        rulesSummary,
                    }
                    : card
            )),
        };

        const previewed = apply(mappedCore, {
            type: QIDAHEN_COMMANDS.CONFIRM_PREVIEW_ACTION,
            playerId: '2',
            payload: { actionId: 'play-event-card', sourceHandCardId: sourceCard.id },
        });
        const paid = apply(previewed, {
            type: QIDAHEN_COMMANDS.SELECT_PAYMENT_CARD,
            playerId: '2',
            payload: { cardId: paymentCard.id },
        });
        const executed = apply(paid, {
            type: QIDAHEN_COMMANDS.EXECUTE_SELECTED_ACTION,
            playerId: '2',
            payload: {},
        });
        const waitingActionChoice = apply(executed, {
            type: QIDAHEN_COMMANDS.RESOLVE_EVENT_OPPONENT_HAND_CHOICE,
            playerId: '2',
            payload: { choiceId: 'ming' },
        });
        const choosingGrantPardonTarget = apply(waitingActionChoice, {
            type: QIDAHEN_COMMANDS.RESOLVE_EVENT_OPPONENT_HAND_CHOICE,
            playerId: '0',
            payload: { choiceId: 'grant-pardon' },
        });

        expect(choosingGrantPardonTarget.turnPhase).toBe('grant-pardon-choice');
        expect(getQidahenEventOpponentHandChoiceSelectionForCore(choosingGrantPardonTarget)).toBeNull();
        expect(choosingGrantPardonTarget.currentPlayer).toBe('0');
        expect(choosingGrantPardonTarget.payment).toMatchObject({
            required: 0,
            selected: 0,
        });
        expect(choosingGrantPardonTarget.grantPardonSelection).toMatchObject({
            executionSource: 'tribute-edict',
            selectedChoiceId: null,
        });
        expect(getGrantPardonSelection(choosingGrantPardonTarget)?.choices.map((choice) => choice.id)).toContain('jinzhou->city-region-25');

        const resolved = apply(choosingGrantPardonTarget, {
            type: QIDAHEN_COMMANDS.RESOLVE_GRANT_PARDON_CHOICE,
            playerId: '0',
            payload: { choiceId: 'jinzhou->city-region-25' },
        });

        expect(resolved.turnPhase).toBe('action-window');
        expect(resolved.grantPardonSelection).toBeNull();
        expect(resolved.handCards.some((card) => card.id === sourceCard.id)).toBe(false);
        expect(resolved.handCards.some((card) => card.id === paymentCard.id)).toBe(false);
        expect(resolved.factions.jin.handCount).toBe(core.factions.jin.handCount - 2);
        expect(resolved.discardPileCount).toBe(core.discardPileCount + 2);
        expect(resolved.factions.jin.discardPileCount).toBe(core.factions.jin.discardPileCount + 1);
        expect(resolved.factions.ming.discardPileCount).toBe(core.factions.ming.discardPileCount + 1);
        expect(resolved.regions.find((region) => region.id === 'jinzhou')).toMatchObject({
            controller: 'jin',
            troops: 1,
        });
        expect(resolved.regions.find((region) => region.id === 'city-region-25')).toMatchObject({
            controller: 'ming',
            troops: 3,
        });
        expect(resolved.selectedRegionId).toBe('city-region-25');
        expect(resolved.lastSeasonSummary?.title).toBe('封贡敕书');
        expect(resolved.lastSeasonSummary?.lines.join(' ')).toContain('大明选择执行赐印招安');
        expect(resolved.lastSeasonSummary?.lines.join(' ')).toContain('赐印招安：锦州 有 1 个部队被招安，转入 山海关 并成为大明部队');
    });

it('封贡敕书指定蒙古执行赐印招安时，会进入目标选择并把部队转为蒙古部队', () => {
        const baseCore = QidahenDomain.setup(['0', '1', '2'], random);
        const core: QidahenCore = {
            ...baseCore,
            currentPlayer: '2',
            selectedRegionId: 'jinzhou',
            explicitRegionId: 'jinzhou',
            regionFocusState: {
                ...baseCore.regionFocusState,
                defaultFocusRegionId: baseCore.regionFocusState.defaultFocusRegionId,
                lockedSourceRegionId: 'jinzhou',
                currentTargetRegionId: 'jinzhou',
                displayAnchorRegionId: 'jinzhou',
            },
            regions: baseCore.regions.map((region) => (
                region.id === 'city-region-25'
                    ? {
                        ...region,
                        controller: 'mongol' as const,
                        controlLabel: '蒙古',
                    }
                    : region
            )),
        };
        const [sourceCard, paymentCard] = factionHandCards(core, 'jin');
        const rulesSummary = QIDAHEN_ATLAS05_ORDINARY_HAND_CARD_RULES_SUMMARY_BY_DEF_ID[
            'qidahen-atlas05-1633-tribute-edict'
        ];
        const mappedCore: QidahenCore = {
            ...core,
            currentPlayer: '2',
            handCards: core.handCards.map((card) => (
                card.id === sourceCard.id
                    ? {
                        ...card,
                        label: '封贡敕书',
                        cardKind: 'event' as const,
                        armamentId: null,
                        cardDefId: 'qidahen-atlas05-1633-tribute-edict',
                        rulesSummary,
                    }
                    : card
            )),
        };

        const previewed = apply(mappedCore, {
            type: QIDAHEN_COMMANDS.CONFIRM_PREVIEW_ACTION,
            playerId: '2',
            payload: { actionId: 'play-event-card', sourceHandCardId: sourceCard.id },
        });
        const paid = apply(previewed, {
            type: QIDAHEN_COMMANDS.SELECT_PAYMENT_CARD,
            playerId: '2',
            payload: { cardId: paymentCard.id },
        });
        const executed = apply(paid, {
            type: QIDAHEN_COMMANDS.EXECUTE_SELECTED_ACTION,
            playerId: '2',
            payload: {},
        });
        const waitingActionChoice = apply(executed, {
            type: QIDAHEN_COMMANDS.RESOLVE_EVENT_OPPONENT_HAND_CHOICE,
            playerId: '2',
            payload: { choiceId: 'mongol' },
        });
        const resolved = apply(waitingActionChoice, {
            type: QIDAHEN_COMMANDS.RESOLVE_EVENT_OPPONENT_HAND_CHOICE,
            playerId: '1',
            payload: { choiceId: 'grant-pardon' },
        });

        expect(resolved.turnPhase).toBe('grant-pardon-choice');
        expect(resolved.currentPlayer).toBe('1');
        expect(getQidahenEventOpponentHandChoiceSelectionForCore(resolved)).toBeNull();
        expect(resolved.grantPardonSelection).toMatchObject({
            executionSource: 'tribute-edict',
            executorFactionId: 'mongol',
            selectedChoiceId: null,
        });
        expect(getGrantPardonSelection(resolved)?.choices.map((choice) => choice.id)).toContain('jinzhou->city-region-25');

        const granted = apply(resolved, {
            type: QIDAHEN_COMMANDS.RESOLVE_GRANT_PARDON_CHOICE,
            playerId: '1',
            payload: { choiceId: 'jinzhou->city-region-25' },
        });

        expect(granted.turnPhase).toBe('action-window');
        expect(granted.grantPardonSelection).toBeNull();
        expect(granted.handCards.some((card) => card.id === sourceCard.id)).toBe(false);
        expect(granted.handCards.some((card) => card.id === paymentCard.id)).toBe(false);
        expect(granted.factions.jin.handCount).toBe(core.factions.jin.handCount - 2);
        expect(granted.discardPileCount).toBe(core.discardPileCount + 2);
        expect(granted.factions.jin.discardPileCount).toBe(core.factions.jin.discardPileCount + 1);
        expect(granted.factions.mongol.discardPileCount).toBe(core.factions.mongol.discardPileCount + 1);
        expect(granted.factions.jin.troops).toBe(core.factions.jin.troops - 1);
        expect(granted.factions.mongol.troops).toBe(core.factions.mongol.troops + 1);
        expect(granted.regions.find((region) => region.id === 'jinzhou')).toMatchObject({
            controller: 'jin',
            troops: 1,
        });
        expect(granted.regions.find((region) => region.id === 'city-region-25')).toMatchObject({
            controller: 'mongol',
            troops: 3,
        });
        expect(granted.lastSeasonSummary?.title).toBe('封贡敕书');
        expect(granted.lastSeasonSummary?.lines.join(' ')).toContain('蒙古选择执行赐印招安');
        expect(granted.lastSeasonSummary?.lines.join(' ')).toContain('成为蒙古部队');
    });

it('封贡敕书指定蒙古执行驱虎吞狼时，会由蒙古指挥并进入既有同意链', () => {
        const baseCore = setRegionCavalry(QidahenDomain.setup(['0', '1', '2'], random), 'jinzhou', 'jin', 2, 2);
        const core: QidahenCore = {
            ...baseCore,
            currentPlayer: '2',
            selectedRegionId: 'jinzhou',
            explicitRegionId: 'jinzhou',
            regionFocusState: {
                ...baseCore.regionFocusState,
                defaultFocusRegionId: baseCore.regionFocusState.defaultFocusRegionId,
                lockedSourceRegionId: 'jinzhou',
                currentTargetRegionId: 'jinzhou',
                displayAnchorRegionId: 'jinzhou',
            },
        };
        const [sourceCard, paymentCard] = factionHandCards(core, 'jin');
        const rulesSummary = QIDAHEN_ATLAS05_ORDINARY_HAND_CARD_RULES_SUMMARY_BY_DEF_ID[
            'qidahen-atlas05-1633-tribute-edict'
        ];
        const mappedCore: QidahenCore = {
            ...core,
            handCards: core.handCards.map((card) => (
                card.id === sourceCard.id
                    ? {
                        ...card,
                        label: '封贡敕书',
                        cardKind: 'event' as const,
                        armamentId: null,
                        cardDefId: 'qidahen-atlas05-1633-tribute-edict',
                        rulesSummary,
                    }
                    : card
            )),
        };

        const previewed = apply(mappedCore, {
            type: QIDAHEN_COMMANDS.CONFIRM_PREVIEW_ACTION,
            playerId: '2',
            payload: { actionId: 'play-event-card', sourceHandCardId: sourceCard.id },
        });
        const paid = apply(previewed, {
            type: QIDAHEN_COMMANDS.SELECT_PAYMENT_CARD,
            playerId: '2',
            payload: { cardId: paymentCard.id },
        });
        const executed = apply(paid, {
            type: QIDAHEN_COMMANDS.EXECUTE_SELECTED_ACTION,
            playerId: '2',
            payload: {},
        });
        const waitingActionChoice = apply(executed, {
            type: QIDAHEN_COMMANDS.RESOLVE_EVENT_OPPONENT_HAND_CHOICE,
            playerId: '2',
            payload: { choiceId: 'mongol' },
        });
        const consenting = apply(waitingActionChoice, {
            type: QIDAHEN_COMMANDS.RESOLVE_EVENT_OPPONENT_HAND_CHOICE,
            playerId: '1',
            payload: { choiceId: 'drive-tiger' },
        });

        expect(consenting.turnPhase).toBe('drive-tiger-consent');
        expect(consenting.currentPlayer).toBe('1');
        expect(getQidahenDriveTigerConsentSelectionForCore(consenting)).toMatchObject({
            commanderFactionId: 'mongol',
            targetFactionId: 'jin',
            targetFactionName: '后金',
        });
        expect(consenting.lastSeasonSummary?.lines.join(' ')).toContain('等待后金决定是否接受蒙古指挥');

        const targeting = apply(consenting, {
            type: QIDAHEN_COMMANDS.RESOLVE_DRIVE_TIGER_CONSENT,
            playerId: '2',
            payload: { choiceId: 'accept' },
        });

        expect(targeting.turnPhase).toBe('dispatch-targeting');
        expect(getQidahenDriveTigerConsentSelectionForCore(targeting)).toBeNull();
        expect(targeting.currentPlayer).toBe('1');
        expect(targeting.lastSeasonSummary?.lines.join(' ')).toContain('后金 同意接受蒙古指挥');
        expect(targeting.lastSeasonSummary?.lines.join(' ')).toContain('由蒙古指挥其执行进攻');
    });

it('蒙古打出人参貂皮会按牌面无效果处理并进入当前势力弃牌堆', () => {
        const core = QidahenDomain.setup(['0', '1', '2'], random);
        const [sourceCard] = factionHandCards(core, 'mongol');
        const rulesSummary = QIDAHEN_ATLAS05_ORDINARY_HAND_CARD_RULES_SUMMARY_BY_DEF_ID[
            'qidahen-atlas05-1630-ginseng-and-sable'
        ];
        const mappedCore: QidahenCore = {
            ...core,
            currentPlayer: '1',
            handCards: core.handCards.map((card) => (
                card.id === sourceCard.id
                    ? {
                        ...card,
                        label: '人参貂皮',
                        cardKind: 'event' as const,
                        armamentId: null,
                        cardDefId: 'qidahen-atlas05-1630-ginseng-and-sable',
                        rulesSummary,
                    }
                    : card
            )),
        };

        const previewed = apply(mappedCore, {
            type: QIDAHEN_COMMANDS.CONFIRM_PREVIEW_ACTION,
            playerId: '1',
            payload: { actionId: 'play-event-card', sourceHandCardId: sourceCard.id },
        });
        const executed = apply(previewed, {
            type: QIDAHEN_COMMANDS.EXECUTE_SELECTED_ACTION,
            playerId: '1',
            payload: {},
        });

        expect(executed.handCards.some((card) => card.id === sourceCard.id)).toBe(false);
        expect(executed.discardPileCount).toBe(core.discardPileCount + 1);
        expect(executed.factions.mongol.discardPileCount).toBe(core.factions.mongol.discardPileCount + 1);
        expect(executed.lastSeasonSummary?.title).toBe('执行事件');
        expect(executed.lastSeasonSummary?.lines.join(' ')).toContain('打出事件牌：人参貂皮');
        expect(executed.lastSeasonSummary?.lines.join(' ')).toContain('蒙古使用人参貂皮无效果');
        expect(executed.lastSeasonSummary?.lines.join(' ')).toContain('使用后进入当前势力弃牌堆。');
        const eventLog = executed.actionLog.find((log) => log.text.includes('执行事件「人参貂皮」'));
        expect(eventLog?.text).toContain('蒙古使用人参貂皮无效果');
    });

it('后金从手牌打出七大恨会在当前后金本土建立 2 个 3 级步兵', () => {
        const core = QidahenDomain.setup(['0', '1', '2'], random);
        const [sourceCard] = factionHandCards(core, 'jin');
        const sevenGrievancesRulesSummary = QIDAHEN_ATLAS05_ORDINARY_HAND_CARD_RULES_SUMMARY_BY_DEF_ID[
            'qidahen-atlas05-1609-seven-grievances'
        ];
        const mappedCore: QidahenCore = {
            ...core,
            currentPlayer: '2',
            selectedRegionId: 'city-region-13',
            handCards: core.handCards.map((card) => (
                card.id === sourceCard.id
                    ? {
                        ...card,
                        label: '七大恨',
                        cardKind: 'event' as const,
                        armamentId: null,
                        cardDefId: 'qidahen-atlas05-1609-seven-grievances',
                        rulesSummary: sevenGrievancesRulesSummary,
                    }
                    : card
            )),
        };
        const baseRegion = mappedCore.regions.find((region) => region.id === 'city-region-13')!;

        const previewed = apply(mappedCore, {
            type: QIDAHEN_COMMANDS.CONFIRM_PREVIEW_ACTION,
            playerId: '2',
            payload: { actionId: 'play-event-card', sourceHandCardId: sourceCard.id },
        });
        const executed = apply(previewed, {
            type: QIDAHEN_COMMANDS.EXECUTE_SELECTED_ACTION,
            playerId: '2',
            payload: {},
        });
        const nextRegion = executed.regions.find((region) => region.id === 'city-region-13')!;

        expect(nextRegion.troops).toBe(baseRegion.troops + 2);
        expect(nextRegion.specialTroops).toEqual(expect.arrayContaining([
            expect.objectContaining({
                id: 'jin-seven-grievances-regular-infantry-lv3',
                faction: 'jin',
                troopKind: 'infantry',
                count: 2,
                level: 3,
            }),
        ]));
        expect(executed.pieces.filter((piece) => (
            piece.regionId === 'city-region-13'
            && piece.sourceStackId === 'jin-seven-grievances-regular-infantry-lv3'
            && piece.location === 'field'
        ))).toHaveLength(2);
        expect(executed.factions.jin.troops).toBe(core.factions.jin.troops + 2);
        expect(executed.discardPileCount).toBe(core.discardPileCount);
        expect(executed.factions.jin.discardPileCount).toBe(core.factions.jin.discardPileCount);
        expect(executed.lastSeasonSummary?.title).toBe('执行事件');
        expect(executed.lastSeasonSummary?.lines.join(' ')).toContain('打出事件牌：七大恨');
        expect(executed.lastSeasonSummary?.lines.join(' ')).toContain('结算效果：在 建州 建立 2 个 3 级后金步兵。');
        expect(executed.lastSeasonSummary?.lines.join(' ')).not.toContain('其它完整事件效果仍待逐张实现');
        expect(executed.actionLog[0]?.text).toContain('执行事件「七大恨」');
        expect(executed.actionLog[0]?.text).toContain('在 建州 建立 2 个 3 级后金步兵');
    });

it('后金已打出三旗时，七大恨会按每张八旗多建 1 个 3 级步兵', () => {
        const core = QidahenDomain.setup(['0', '1', '2'], random);
        const [sourceCard] = factionHandCards(core, 'jin');
        const rulesSummary = QIDAHEN_ATLAS05_ORDINARY_HAND_CARD_RULES_SUMMARY_BY_DEF_ID[
            'qidahen-atlas05-1609-seven-grievances'
        ];
        const mappedCore: QidahenCore = {
            ...core,
            currentPlayer: '2',
            selectedRegionId: 'city-region-13',
            activeEventCards: [
                {
                    id: 'active-event-han-banners-jin',
                    cardDefId: 'qidahen-atlas05-1605-establish-han-banners',
                    label: '成立汉八旗',
                    ownerFactionId: 'jin',
                    rulesSummary: null,
                },
                {
                    id: 'active-event-manzhou-banners-jin',
                    cardDefId: 'qidahen-atlas05-1606-establish-manzhou-banners',
                    label: '成立满八旗',
                    ownerFactionId: 'jin',
                    rulesSummary: null,
                },
                {
                    id: 'active-event-mongol-banners-jin',
                    cardDefId: 'qidahen-atlas05-1607-establish-mongol-banners',
                    label: '成立蒙八旗',
                    ownerFactionId: 'jin',
                    rulesSummary: null,
                },
            ],
            handCards: core.handCards.map((card) => (
                card.id === sourceCard.id
                    ? {
                        ...card,
                        label: '七大恨',
                        cardKind: 'event' as const,
                        armamentId: null,
                        cardDefId: 'qidahen-atlas05-1609-seven-grievances',
                        rulesSummary,
                    }
                    : card
            )),
        };
        const baseRegion = mappedCore.regions.find((region) => region.id === 'city-region-13')!;

        const previewed = apply(mappedCore, {
            type: QIDAHEN_COMMANDS.CONFIRM_PREVIEW_ACTION,
            playerId: '2',
            payload: { actionId: 'play-event-card', sourceHandCardId: sourceCard.id },
        });
        const executed = apply(previewed, {
            type: QIDAHEN_COMMANDS.EXECUTE_SELECTED_ACTION,
            playerId: '2',
            payload: {},
        });
        const nextRegion = executed.regions.find((region) => region.id === 'city-region-13')!;

        expect(nextRegion.troops).toBe(baseRegion.troops + 5);
        expect(nextRegion.specialTroops).toEqual(expect.arrayContaining([
            expect.objectContaining({
                id: 'jin-seven-grievances-regular-infantry-lv3',
                faction: 'jin',
                troopKind: 'infantry',
                count: 5,
                level: 3,
            }),
        ]));
        expect(executed.pieces.filter((piece) => (
            piece.regionId === 'city-region-13'
            && piece.sourceStackId === 'jin-seven-grievances-regular-infantry-lv3'
            && piece.location === 'field'
        ))).toHaveLength(5);
        expect(executed.factions.jin.troops).toBe(core.factions.jin.troops + 5);
        expect(executed.lastSeasonSummary?.lines.join(' ')).toContain('已生效 3 张八旗事件');
        expect(executed.lastSeasonSummary?.lines.join(' ')).toContain('建立 5 个 3 级后金步兵');
        expect(executed.actionLog[0]?.text).toContain('执行事件「七大恨」');
        expect(executed.actionLog[0]?.text).toContain('建立 5 个 3 级后金步兵');
    });

it('七大恨只计算后金持有的八旗持续事件，不计算他势力八旗、无关事件或军备等级', () => {
        const core = QidahenDomain.setup(['0', '1', '2'], random);
        const [sourceCard] = factionHandCards(core, 'jin');
        const rulesSummary = QIDAHEN_ATLAS05_ORDINARY_HAND_CARD_RULES_SUMMARY_BY_DEF_ID[
            'qidahen-atlas05-1609-seven-grievances'
        ];
        const mappedCore: QidahenCore = {
            ...core,
            currentPlayer: '2',
            selectedRegionId: 'city-region-13',
            activeEventCards: [
                {
                    id: 'active-event-han-banners-jin',
                    cardDefId: 'qidahen-atlas05-1605-establish-han-banners',
                    label: '成立汉八旗',
                    ownerFactionId: 'jin',
                    rulesSummary: null,
                },
                {
                    id: 'active-event-manzhou-banners-ming',
                    cardDefId: 'qidahen-atlas05-1606-establish-manzhou-banners',
                    label: '成立满八旗',
                    ownerFactionId: 'ming',
                    rulesSummary: null,
                },
                {
                    id: 'active-event-jade-casket-jin',
                    cardDefId: 'qidahen-atlas05-1625-jade-casket-unearthed',
                    label: '玉匣出土',
                    ownerFactionId: 'jin',
                    rulesSummary: null,
                },
            ],
            factions: {
                ...core.factions,
                jin: {
                    ...core.factions.jin,
                    armaments: core.factions.jin.armaments.map((armament) => (
                        armament.id === 'han-banners'
                        || armament.id === 'manzhou-banners'
                        || armament.id === 'mongol-banners'
                            ? { ...armament, level: 1 }
                            : armament
                    )),
                },
            },
            handCards: core.handCards.map((card) => (
                card.id === sourceCard.id
                    ? {
                        ...card,
                        label: '七大恨',
                        cardKind: 'event' as const,
                        armamentId: null,
                        cardDefId: 'qidahen-atlas05-1609-seven-grievances',
                        rulesSummary,
                    }
                    : card
            )),
        };
        const baseRegion = mappedCore.regions.find((region) => region.id === 'city-region-13')!;

        const previewed = apply(mappedCore, {
            type: QIDAHEN_COMMANDS.CONFIRM_PREVIEW_ACTION,
            playerId: '2',
            payload: { actionId: 'play-event-card', sourceHandCardId: sourceCard.id },
        });
        const executed = apply(previewed, {
            type: QIDAHEN_COMMANDS.EXECUTE_SELECTED_ACTION,
            playerId: '2',
            payload: {},
        });
        const nextRegion = executed.regions.find((region) => region.id === 'city-region-13')!;

        expect(nextRegion.troops).toBe(baseRegion.troops + 3);
        expect(nextRegion.specialTroops).toEqual(expect.arrayContaining([
            expect.objectContaining({
                id: 'jin-seven-grievances-regular-infantry-lv3',
                faction: 'jin',
                troopKind: 'infantry',
                count: 3,
                level: 3,
            }),
        ]));
        expect(executed.pieces.filter((piece) => (
            piece.regionId === 'city-region-13'
            && piece.sourceStackId === 'jin-seven-grievances-regular-infantry-lv3'
            && piece.location === 'field'
        ))).toHaveLength(3);
        expect(executed.factions.jin.troops).toBe(core.factions.jin.troops + 3);
        expect(executed.lastSeasonSummary?.lines.join(' ')).toContain('已生效 1 张八旗事件');
        expect(executed.lastSeasonSummary?.lines.join(' ')).toContain('建立 3 个 3 级后金步兵');
    });

it('后金已打出汉八旗时，七大恨可在后金控制的汉人区域建兵', () => {
        const core = QidahenDomain.setup(['0', '1', '2'], random);
        const [sourceCard] = factionHandCards(core, 'jin');
        const rulesSummary = QIDAHEN_ATLAS05_ORDINARY_HAND_CARD_RULES_SUMMARY_BY_DEF_ID[
            'qidahen-atlas05-1609-seven-grievances'
        ];
        const mappedCore: QidahenCore = {
            ...core,
            currentPlayer: '2',
            selectedRegionId: 'city-region-19-liaoxi',
            activeEventCards: [
                {
                    id: 'active-event-han-banners-jin',
                    cardDefId: 'qidahen-atlas05-1605-establish-han-banners',
                    label: '成立汉八旗',
                    ownerFactionId: 'jin',
                    rulesSummary: null,
                },
            ],
            factions: {
                ...core.factions,
                jin: {
                    ...core.factions.jin,
                    armaments: core.factions.jin.armaments.map((armament) => (
                        armament.id === 'han-banners'
                            ? { ...armament, level: 1 }
                            : armament
                    )),
                },
            },
            regions: core.regions.map((region) => (
                region.id === 'city-region-19-liaoxi'
                    ? {
                        ...region,
                        controller: 'jin' as const,
                        controlLabel: '后金',
                    }
                    : region
            )),
            handCards: core.handCards.map((card) => (
                card.id === sourceCard.id
                    ? {
                        ...card,
                        label: '七大恨',
                        cardKind: 'event' as const,
                        armamentId: null,
                        cardDefId: 'qidahen-atlas05-1609-seven-grievances',
                        rulesSummary,
                    }
                    : card
            )),
        };
        const baseRegion = mappedCore.regions.find((region) => region.id === 'city-region-19-liaoxi')!;

        const previewed = apply(mappedCore, {
            type: QIDAHEN_COMMANDS.CONFIRM_PREVIEW_ACTION,
            playerId: '2',
            payload: { actionId: 'play-event-card', sourceHandCardId: sourceCard.id },
        });
        const executed = apply(previewed, {
            type: QIDAHEN_COMMANDS.EXECUTE_SELECTED_ACTION,
            playerId: '2',
            payload: {},
        });
        const nextRegion = executed.regions.find((region) => region.id === 'city-region-19-liaoxi')!;

        expect(getEffectiveHomelandController(mappedCore, 'city-region-19-liaoxi')).toBe('jin');
        expect(nextRegion.troops).toBe(baseRegion.troops + 3);
        expect(nextRegion.specialTroops).toEqual(expect.arrayContaining([
            expect.objectContaining({
                id: 'jin-seven-grievances-regular-infantry-lv3',
                faction: 'jin',
                troopKind: 'infantry',
                count: 3,
                level: 3,
            }),
        ]));
        expect(executed.pieces.filter((piece) => (
            piece.regionId === 'city-region-19-liaoxi'
            && piece.sourceStackId === 'jin-seven-grievances-regular-infantry-lv3'
            && piece.location === 'field'
        ))).toHaveLength(3);
        expect(executed.factions.jin.troops).toBe(core.factions.jin.troops + 3);
        expect(executed.lastSeasonSummary?.lines.join(' ')).toContain('已生效 1 张八旗事件');
        expect(executed.lastSeasonSummary?.lines.join(' ')).toContain('在 辽西 建立 3 个 3 级后金步兵');
    });

it('七大恨不会仅因汉八旗生效就在非后金控制汉人区域建兵', () => {
        const core = QidahenDomain.setup(['0', '1', '2'], random);
        const [sourceCard] = factionHandCards(core, 'jin');
        const rulesSummary = QIDAHEN_ATLAS05_ORDINARY_HAND_CARD_RULES_SUMMARY_BY_DEF_ID[
            'qidahen-atlas05-1609-seven-grievances'
        ];
        const mappedCore: QidahenCore = {
            ...core,
            currentPlayer: '2',
            selectedRegionId: 'city-region-19-liaoxi',
            activeEventCards: [
                {
                    id: 'active-event-han-banners-jin',
                    cardDefId: 'qidahen-atlas05-1605-establish-han-banners',
                    label: '成立汉八旗',
                    ownerFactionId: 'jin',
                    rulesSummary: null,
                },
            ],
            factions: {
                ...core.factions,
                jin: {
                    ...core.factions.jin,
                    armaments: core.factions.jin.armaments.map((armament) => (
                        armament.id === 'han-banners'
                            ? { ...armament, level: 1 }
                            : armament
                    )),
                },
            },
            handCards: core.handCards.map((card) => (
                card.id === sourceCard.id
                    ? {
                        ...card,
                        label: '七大恨',
                        cardKind: 'event' as const,
                        armamentId: null,
                        cardDefId: 'qidahen-atlas05-1609-seven-grievances',
                        rulesSummary,
                    }
                    : card
            )),
        };
        const baseRegion = mappedCore.regions.find((region) => region.id === 'city-region-19-liaoxi')!;

        const previewed = apply(mappedCore, {
            type: QIDAHEN_COMMANDS.CONFIRM_PREVIEW_ACTION,
            playerId: '2',
            payload: { actionId: 'play-event-card', sourceHandCardId: sourceCard.id },
        });
        const executed = apply(previewed, {
            type: QIDAHEN_COMMANDS.EXECUTE_SELECTED_ACTION,
            playerId: '2',
            payload: {},
        });
        const nextRegion = executed.regions.find((region) => region.id === 'city-region-19-liaoxi')!;

        expect(getEffectiveHomelandController(mappedCore, 'city-region-19-liaoxi')).toBe('jin');
        expect(baseRegion.controller).not.toBe('jin');
        expect(nextRegion.troops).toBe(baseRegion.troops);
        expect(nextRegion.specialTroops).toEqual(baseRegion.specialTroops);
        expect(executed.pieces.filter((piece) => (
            piece.regionId === 'city-region-19-liaoxi'
            && piece.sourceStackId === 'jin-seven-grievances-regular-infantry-lv3'
            && piece.location === 'field'
        ))).toHaveLength(0);
        expect(executed.factions.jin.troops).toBe(core.factions.jin.troops);
        expect(executed.lastSeasonSummary?.lines.join(' ')).toContain('当前选中区域不是后金本土，本次未建立部队');
    });

it('蒙古打出七大恨会按牌面无效果处理并移出游戏，不建立部队也不进弃牌堆', () => {
        const core = QidahenDomain.setup(['0', '1', '2'], random);
        const [sourceCard] = factionHandCards(core, 'mongol');
        const rulesSummary = QIDAHEN_ATLAS05_ORDINARY_HAND_CARD_RULES_SUMMARY_BY_DEF_ID[
            'qidahen-atlas05-1609-seven-grievances'
        ];
        const baseRegion = core.regions.find((region) => region.id === 'city-region-14')!;
        const mappedCore: QidahenCore = {
            ...core,
            currentPlayer: '1',
            selectedRegionId: 'city-region-14',
            handCards: core.handCards.map((card) => (
                card.id === sourceCard.id
                    ? {
                        ...card,
                        label: '七大恨',
                        cardKind: 'event' as const,
                        armamentId: null,
                        cardDefId: 'qidahen-atlas05-1609-seven-grievances',
                        rulesSummary,
                    }
                    : card
            )),
        };

        const previewed = apply(mappedCore, {
            type: QIDAHEN_COMMANDS.CONFIRM_PREVIEW_ACTION,
            playerId: '1',
            payload: { actionId: 'play-event-card', sourceHandCardId: sourceCard.id },
        });
        const executed = apply(previewed, {
            type: QIDAHEN_COMMANDS.EXECUTE_SELECTED_ACTION,
            playerId: '1',
            payload: {},
        });
        const nextRegion = executed.regions.find((region) => region.id === 'city-region-14')!;

        expect(executed.handCards.some((card) => card.id === sourceCard.id)).toBe(false);
        expect(executed.discardPileCount).toBe(core.discardPileCount);
        expect(executed.factions.mongol.discardPileCount).toBe(core.factions.mongol.discardPileCount);
        expect(nextRegion.troops).toBe(baseRegion.troops);
        expect(nextRegion.specialTroops).toEqual(baseRegion.specialTroops);
        expect(executed.factions.mongol.troops).toBe(core.factions.mongol.troops);
        expect(executed.lastSeasonSummary?.title).toBe('执行事件');
        expect(executed.lastSeasonSummary?.lines.join(' ')).toContain('打出事件牌：七大恨');
        expect(executed.lastSeasonSummary?.lines.join(' ')).toContain('蒙古使用七大恨无效果');
        expect(executed.lastSeasonSummary?.lines.join(' ')).toContain('使用后移出游戏：此牌未进入弃牌堆。');
        const eventLog = executed.actionLog.find((log) => log.text.includes('执行事件「七大恨」'));
        expect(eventLog?.text).toContain('打出并移出游戏');
        expect(eventLog?.text).toContain('蒙古使用七大恨无效果');
    });

it('后金从手牌打出成立汉八旗会在已控制汉人区域建立 2 级次级步兵，并让汉人区域视为后金本土', () => {
        const core = QidahenDomain.setup(['0', '1', '2'], random);
        const [sourceCard] = factionHandCards(core, 'jin');
        const hanBannersRulesSummary = QIDAHEN_ATLAS05_ORDINARY_HAND_CARD_RULES_SUMMARY_BY_DEF_ID[
            'qidahen-atlas05-1605-establish-han-banners'
        ];
        const mappedCore: QidahenCore = {
            ...core,
            currentPlayer: '2',
            selectedRegionId: 'city-region-19-liaoxi',
            regions: core.regions.map((region) => (
                region.id === 'city-region-19-liaoxi'
                    ? {
                        ...region,
                        controller: 'jin' as const,
                        controlLabel: '后金',
                    }
                    : region
            )),
            handCards: core.handCards.map((card) => (
                card.id === sourceCard.id
                    ? {
                        ...card,
                        label: '成立汉八旗',
                        cardKind: 'event' as const,
                        armamentId: null,
                        cardDefId: 'qidahen-atlas05-1605-establish-han-banners',
                        rulesSummary: hanBannersRulesSummary,
                    }
                    : card
            )),
        };
        const baseRegion = mappedCore.regions.find((region) => region.id === 'city-region-19-liaoxi')!;
        const baseJinzhou = mappedCore.regions.find((region) => region.id === 'jinzhou')!;
        const controlledHanRegions = mappedCore.regions.filter((region) => (
            !region.isLogicalRegion
            && region.controller === 'jin'
            && isQidahenHanRuntimeRegionId(region.id)
        ));

        const previewed = apply(mappedCore, {
            type: QIDAHEN_COMMANDS.CONFIRM_PREVIEW_ACTION,
            playerId: '2',
            payload: { actionId: 'play-event-card', sourceHandCardId: sourceCard.id },
        });
        const executed = apply(previewed, {
            type: QIDAHEN_COMMANDS.EXECUTE_SELECTED_ACTION,
            playerId: '2',
            payload: {},
        });
        const nextRegion = executed.regions.find((region) => region.id === 'city-region-19-liaoxi')!;
        const nextJinzhou = executed.regions.find((region) => region.id === 'jinzhou')!;

        expect(nextRegion.troops).toBe(baseRegion.troops + 1);
        expect(nextRegion.specialTroops).toEqual(expect.arrayContaining([
            expect.objectContaining({
                id: 'jin-han-banners-city-region-19-liaoxi-secondary-infantry-lv2',
                faction: 'jin',
                originalFaction: 'jin',
                troopClass: 'secondary',
                troopKind: 'infantry',
                count: 1,
                level: 2,
            }),
        ]));
        expect(executed.pieces.filter((piece) => (
            piece.regionId === 'city-region-19-liaoxi'
            && piece.sourceStackId === 'jin-han-banners-city-region-19-liaoxi-secondary-infantry-lv2'
            && piece.troopClass === 'secondary'
            && piece.originalFaction === 'jin'
            && piece.location === 'field'
        ))).toHaveLength(1);
        expect(nextJinzhou.troops).toBe(baseJinzhou.troops + 1);
        expect(nextJinzhou.specialTroops).toEqual(expect.arrayContaining([
            expect.objectContaining({
                id: 'jin-han-banners-jinzhou-secondary-infantry-lv2',
                faction: 'jin',
                originalFaction: 'jin',
                troopClass: 'secondary',
                troopKind: 'infantry',
                count: 1,
                level: 2,
            }),
        ]));
        expect(executed.factions.jin.troops).toBe(mappedCore.factions.jin.troops + controlledHanRegions.length);
        expect(executed.factions.jin.armaments.find((armament) => armament.id === 'han-banners')?.level).toBe(1);
        expect(getEffectiveHomelandController(executed, 'city-region-19-liaoxi')).toBe('jin');
        expect(executed.discardPileCount).toBe(core.discardPileCount);
        expect(executed.factions.jin.discardPileCount).toBe(core.factions.jin.discardPileCount);
        expect(executed.lastSeasonSummary?.title).toBe('执行事件');
        expect(executed.lastSeasonSummary?.lines.join(' ')).toContain('打出事件牌：成立汉八旗');
        expect(executed.lastSeasonSummary?.lines.join(' ')).toContain(`结算效果：后金控制 ${controlledHanRegions.length} 个汉人区域，建立 ${controlledHanRegions.length} 个 2 级后金次级步兵。`);
        expect(executed.lastSeasonSummary?.lines.join(' ')).toContain('持续事件：此牌未进入弃牌堆');
        expect(executed.actionLog[0]?.text).toContain('执行事件「成立汉八旗」');
        expect(executed.actionLog[0]?.text).toContain('打出为持续事件，不进入弃牌堆');
    });

it('后金从手牌打出成立满八旗会在已控制女真人区域建立 2 级次级步兵，并让女真人区域视为后金本土', () => {
        const core = QidahenDomain.setup(['0', '1', '2'], random);
        const [sourceCard] = factionHandCards(core, 'jin');
        const rulesSummary = QIDAHEN_ATLAS05_ORDINARY_HAND_CARD_RULES_SUMMARY_BY_DEF_ID[
            'qidahen-atlas05-1606-establish-manzhou-banners'
        ];
        const mappedCore: QidahenCore = {
            ...core,
            currentPlayer: '2',
            selectedRegionId: 'city-region-4',
            regions: core.regions.map((region) => (
                region.id === 'city-region-4'
                    ? {
                        ...region,
                        controller: 'jin' as const,
                        controlLabel: '后金',
                    }
                    : region
            )),
            handCards: core.handCards.map((card) => (
                card.id === sourceCard.id
                    ? {
                        ...card,
                        label: '成立满八旗',
                        cardKind: 'event' as const,
                        armamentId: null,
                        cardDefId: 'qidahen-atlas05-1606-establish-manzhou-banners',
                        rulesSummary,
                    }
                    : card
            )),
        };
        const controlledJurchenRegions = mappedCore.regions.filter((region) => (
            !region.isLogicalRegion
            && region.controller === 'jin'
            && isQidahenJurchenRuntimeRegionId(region.id)
        ));
        const baseTargetRegion = mappedCore.regions.find((region) => region.id === 'city-region-4')!;

        const previewed = apply(mappedCore, {
            type: QIDAHEN_COMMANDS.CONFIRM_PREVIEW_ACTION,
            playerId: '2',
            payload: { actionId: 'play-event-card', sourceHandCardId: sourceCard.id },
        });
        const executed = apply(previewed, {
            type: QIDAHEN_COMMANDS.EXECUTE_SELECTED_ACTION,
            playerId: '2',
            payload: {},
        });
        const nextTargetRegion = executed.regions.find((region) => region.id === 'city-region-4')!;

        expect(nextTargetRegion.troops).toBe(baseTargetRegion.troops + 1);
        expect(nextTargetRegion.specialTroops).toEqual(expect.arrayContaining([
            expect.objectContaining({
                id: 'jin-manzhou-banners-city-region-4-secondary-infantry-lv2',
                faction: 'jin',
                originalFaction: 'jin',
                troopClass: 'secondary',
                troopKind: 'infantry',
                count: 1,
                level: 2,
            }),
        ]));
        expect(executed.factions.jin.troops).toBe(mappedCore.factions.jin.troops + controlledJurchenRegions.length);
        expect(executed.factions.jin.armaments.find((armament) => armament.id === 'manzhou-banners')?.level).toBe(1);
        expect(getEffectiveHomelandController(executed, 'city-region-4')).toBe('jin');
        expect(executed.discardPileCount).toBe(core.discardPileCount);
        expect(executed.lastSeasonSummary?.lines.join(' ')).toContain('打出事件牌：成立满八旗');
        expect(executed.lastSeasonSummary?.lines.join(' ')).toContain(`结算效果：后金控制 ${controlledJurchenRegions.length} 个女真人区域，建立 ${controlledJurchenRegions.length} 个 2 级后金次级步兵。`);
        expect(executed.lastSeasonSummary?.lines.join(' ')).toContain('持续事件：此牌未进入弃牌堆');
    });

it('后金从手牌打出成立蒙八旗会在已控制蒙古人区域建立 2 级次级步兵，并让蒙古人区域视为后金本土', () => {
        const core = QidahenDomain.setup(['0', '1', '2'], random);
        const [sourceCard] = factionHandCards(core, 'jin');
        const rulesSummary = QIDAHEN_ATLAS05_ORDINARY_HAND_CARD_RULES_SUMMARY_BY_DEF_ID[
            'qidahen-atlas05-1607-establish-mongol-banners'
        ];
        const mappedCore: QidahenCore = {
            ...core,
            currentPlayer: '2',
            selectedRegionId: 'city-region-3',
            regions: core.regions.map((region) => (
                region.id === 'city-region-3' || region.id === 'city-region-14'
                    ? {
                        ...region,
                        controller: 'jin' as const,
                        controlLabel: '后金',
                    }
                    : region
            )),
            handCards: core.handCards.map((card) => (
                card.id === sourceCard.id
                    ? {
                        ...card,
                        label: '成立蒙八旗',
                        cardKind: 'event' as const,
                        armamentId: null,
                        cardDefId: 'qidahen-atlas05-1607-establish-mongol-banners',
                        rulesSummary,
                    }
                    : card
            )),
        };
        const controlledMongolRegions = mappedCore.regions.filter((region) => (
            !region.isLogicalRegion
            && region.controller === 'jin'
            && isQidahenMongolRuntimeRegionId(region.id)
            && region.id !== 'city-region-14'
        ));
        const baseTargetRegion = mappedCore.regions.find((region) => region.id === 'city-region-3')!;
        const baseChaharRegion = mappedCore.regions.find((region) => region.id === 'city-region-14')!;

        const previewed = apply(mappedCore, {
            type: QIDAHEN_COMMANDS.CONFIRM_PREVIEW_ACTION,
            playerId: '2',
            payload: { actionId: 'play-event-card', sourceHandCardId: sourceCard.id },
        });
        const executed = apply(previewed, {
            type: QIDAHEN_COMMANDS.EXECUTE_SELECTED_ACTION,
            playerId: '2',
            payload: {},
        });
        const nextTargetRegion = executed.regions.find((region) => region.id === 'city-region-3')!;
        const nextChaharRegion = executed.regions.find((region) => region.id === 'city-region-14')!;

        expect(nextTargetRegion.troops).toBe(baseTargetRegion.troops + 1);
        expect(nextTargetRegion.specialTroops).toEqual(expect.arrayContaining([
            expect.objectContaining({
                id: 'jin-mongol-banners-city-region-3-secondary-infantry-lv2',
                faction: 'jin',
                originalFaction: 'jin',
                troopClass: 'secondary',
                troopKind: 'infantry',
                count: 1,
                level: 2,
            }),
        ]));
        expect(executed.factions.jin.troops).toBe(mappedCore.factions.jin.troops + controlledMongolRegions.length);
        expect(executed.factions.jin.armaments.find((armament) => armament.id === 'mongol-banners')?.level).toBe(1);
        expect(getEffectiveHomelandController(executed, 'city-region-3')).toBe('jin');
        expect(nextChaharRegion.troops).toBe(baseChaharRegion.troops);
        expect(nextChaharRegion.specialTroops).toEqual(baseChaharRegion.specialTroops);
        expect(nextChaharRegion.specialTroops.some((stack) => stack.id.includes('mongol-banners'))).toBe(false);
        expect(executed.discardPileCount).toBe(core.discardPileCount);
        expect(executed.lastSeasonSummary?.lines.join(' ')).toContain('打出事件牌：成立蒙八旗');
        expect(executed.lastSeasonSummary?.lines.join(' ')).toContain(`结算效果：后金控制 ${controlledMongolRegions.length} 个蒙古人区域，建立 ${controlledMongolRegions.length} 个 2 级后金次级步兵。`);
        expect(executed.lastSeasonSummary?.lines.join(' ')).toContain('持续事件：此牌未进入弃牌堆');
    });

it.each([
        { cardDefId: 'qidahen-atlas05-1605-establish-han-banners', cardName: '成立汉八旗', armamentId: 'han-banners' as const, factionId: 'ming' as const, playerId: '0', factionName: '大明' },
        { cardDefId: 'qidahen-atlas05-1605-establish-han-banners', cardName: '成立汉八旗', armamentId: 'han-banners' as const, factionId: 'mongol' as const, playerId: '1', factionName: '蒙古' },
        { cardDefId: 'qidahen-atlas05-1606-establish-manzhou-banners', cardName: '成立满八旗', armamentId: 'manzhou-banners' as const, factionId: 'ming' as const, playerId: '0', factionName: '大明' },
        { cardDefId: 'qidahen-atlas05-1606-establish-manzhou-banners', cardName: '成立满八旗', armamentId: 'manzhou-banners' as const, factionId: 'mongol' as const, playerId: '1', factionName: '蒙古' },
        { cardDefId: 'qidahen-atlas05-1607-establish-mongol-banners', cardName: '成立蒙八旗', armamentId: 'mongol-banners' as const, factionId: 'ming' as const, playerId: '0', factionName: '大明' },
        { cardDefId: 'qidahen-atlas05-1607-establish-mongol-banners', cardName: '成立蒙八旗', armamentId: 'mongol-banners' as const, factionId: 'mongol' as const, playerId: '1', factionName: '蒙古' },
    ])('$factionName 打出$cardName不会建立次级部队或改变后金本土判定', ({ cardDefId, cardName, armamentId, factionId, playerId, factionName }) => {
        const core = QidahenDomain.setup(['0', '1', '2'], random);
        const [sourceCard] = factionHandCards(core, factionId);
        const rulesSummary = QIDAHEN_ATLAS05_ORDINARY_HAND_CARD_RULES_SUMMARY_BY_DEF_ID[cardDefId];
        const mappedCore: QidahenCore = {
            ...core,
            currentPlayer: playerId,
            selectedRegionId: 'city-region-3',
            regions: core.regions.map((region) => (
                region.id === 'city-region-3'
                    ? {
                        ...region,
                        controller: factionId,
                        controlLabel: factionName,
                    }
                    : region
            )),
            handCards: core.handCards.map((card) => (
                card.id === sourceCard.id
                    ? {
                        ...card,
                        label: cardName,
                        cardKind: 'event' as const,
                        armamentId: null,
                        cardDefId,
                        rulesSummary,
                    }
                    : card
            )),
        };
        const baseTargetRegion = mappedCore.regions.find((region) => region.id === 'city-region-3')!;
        const baseBannerLevel = mappedCore.factions.jin.armaments.find((armament) => armament.id === armamentId)?.level;

        const previewed = apply(mappedCore, {
            type: QIDAHEN_COMMANDS.CONFIRM_PREVIEW_ACTION,
            playerId,
            payload: { actionId: 'play-event-card', sourceHandCardId: sourceCard.id },
        });
        const executed = apply(previewed, {
            type: QIDAHEN_COMMANDS.EXECUTE_SELECTED_ACTION,
            playerId,
            payload: {},
        });
        const nextTargetRegion = executed.regions.find((region) => region.id === 'city-region-3')!;

        expect(nextTargetRegion.troops).toBe(baseTargetRegion.troops);
        expect(nextTargetRegion.specialTroops).toEqual(baseTargetRegion.specialTroops);
        expect(executed.factions.jin.armaments.find((armament) => armament.id === armamentId)?.level).toBe(baseBannerLevel);
        expect(executed.lastSeasonSummary?.lines.join(' ')).toContain(`${factionName}使用${cardName}无效果`);
    });

it('从手牌打出蒙古大旱会在蒙古人区域放置可见旱灾标记', () => {
        const core = QidahenDomain.setup(['0', '1', '2'], random);
        const [sourceCard] = factionHandCards(core, 'jin');
        const rulesSummary = QIDAHEN_ATLAS05_ORDINARY_HAND_CARD_RULES_SUMMARY_BY_DEF_ID[
            'qidahen-atlas05-1608-mongol-drought'
        ];
        const mappedCore: QidahenCore = {
            ...core,
            currentPlayer: '2',
            selectedRegionId: 'city-region-14',
            handCards: core.handCards.map((card) => (
                card.id === sourceCard.id
                    ? {
                        ...card,
                        label: '蒙古大旱',
                        cardKind: 'event' as const,
                        armamentId: null,
                        cardDefId: 'qidahen-atlas05-1608-mongol-drought',
                        rulesSummary,
                    }
                    : card
            )),
        };

        const previewed = apply(mappedCore, {
            type: QIDAHEN_COMMANDS.CONFIRM_PREVIEW_ACTION,
            playerId: '2',
            payload: { actionId: 'play-event-card', sourceHandCardId: sourceCard.id },
        });
        const executed = apply(previewed, {
            type: QIDAHEN_COMMANDS.EXECUTE_SELECTED_ACTION,
            playerId: '2',
            payload: {},
        });
        const droughtRegion = executed.regions.find((region) => region.id === 'city-region-14')!;

        expect(droughtRegion.eventMarkers).toEqual(expect.arrayContaining([
            expect.objectContaining({
                id: 'drought-marker-city-region-14',
                kind: 'drought',
                label: '旱灾标记',
                sourceCardDefId: 'qidahen-atlas05-1608-mongol-drought',
                imageSrc: 'qidahen/markers/drought-marker',
            }),
        ]));
        expect(executed.mapTokens).toEqual(expect.arrayContaining([
            expect.objectContaining({
                id: 'drought-marker-city-region-14',
                type: 'marker',
                faction: 'neutral',
                imageSrc: 'qidahen/markers/drought-marker',
            }),
        ]));
        expect(executed.discardPileCount).toBe(core.discardPileCount);
        expect(executed.lastSeasonSummary?.lines.join(' ')).toContain('打出事件牌：蒙古大旱');
        expect(executed.lastSeasonSummary?.lines.join(' ')).toContain('结算效果：在 察哈尔 放置旱灾标记。');
        expect(executed.lastSeasonSummary?.lines.join(' ')).toContain('使用后移出游戏：此牌未进入弃牌堆。');
    });

it('从手牌打出第二张蒙古大旱也会在蒙古人区域放置可见旱灾标记', () => {
        const core = QidahenDomain.setup(['0', '1', '2'], random);
        const [sourceCard] = factionHandCards(core, 'jin');
        const rulesSummary = QIDAHEN_ATLAS05_ORDINARY_HAND_CARD_RULES_SUMMARY_BY_DEF_ID[
            'qidahen-atlas05-1637-mongol-drought-alt'
        ];
        const mappedCore: QidahenCore = {
            ...core,
            currentPlayer: '2',
            selectedRegionId: 'city-region-14',
            handCards: core.handCards.map((card) => (
                card.id === sourceCard.id
                    ? {
                        ...card,
                        label: '蒙古大旱',
                        cardKind: 'event' as const,
                        armamentId: null,
                        cardDefId: 'qidahen-atlas05-1637-mongol-drought-alt',
                        rulesSummary,
                    }
                    : card
            )),
        };

        const previewed = apply(mappedCore, {
            type: QIDAHEN_COMMANDS.CONFIRM_PREVIEW_ACTION,
            playerId: '2',
            payload: { actionId: 'play-event-card', sourceHandCardId: sourceCard.id },
        });
        const executed = apply(previewed, {
            type: QIDAHEN_COMMANDS.EXECUTE_SELECTED_ACTION,
            playerId: '2',
            payload: {},
        });
        const droughtRegion = executed.regions.find((region) => region.id === 'city-region-14')!;

        expect(droughtRegion.eventMarkers).toEqual(expect.arrayContaining([
            expect.objectContaining({
                id: 'drought-marker-city-region-14',
                kind: 'drought',
                label: '旱灾标记',
                sourceCardDefId: 'qidahen-atlas05-1637-mongol-drought-alt',
                imageSrc: 'qidahen/markers/drought-marker',
            }),
        ]));
        expect(executed.mapTokens).toEqual(expect.arrayContaining([
            expect.objectContaining({
                id: 'drought-marker-city-region-14',
                type: 'marker',
                faction: 'neutral',
                imageSrc: 'qidahen/markers/drought-marker',
            }),
        ]));
        expect(executed.discardPileCount).toBe(core.discardPileCount);
        expect(executed.lastSeasonSummary?.lines.join(' ')).toContain('打出事件牌：蒙古大旱');
        expect(executed.lastSeasonSummary?.lines.join(' ')).toContain('结算效果：在 察哈尔 放置旱灾标记。');
        expect(executed.lastSeasonSummary?.lines.join(' ')).toContain('使用后移出游戏：此牌未进入弃牌堆。');
    });

it('东北大旱不会在非女真人区域放置旱灾标记', () => {
        const core = QidahenDomain.setup(['0', '1', '2'], random);
        const [sourceCard] = factionHandCards(core, 'jin');
        const rulesSummary = QIDAHEN_ATLAS05_ORDINARY_HAND_CARD_RULES_SUMMARY_BY_DEF_ID[
            'qidahen-atlas05-1613-northeast-drought'
        ];
        const mappedCore: QidahenCore = {
            ...core,
            currentPlayer: '2',
            selectedRegionId: 'city-region-14',
            handCards: core.handCards.map((card) => (
                card.id === sourceCard.id
                    ? {
                        ...card,
                        label: '东北大旱',
                        cardKind: 'event' as const,
                        armamentId: null,
                        cardDefId: 'qidahen-atlas05-1613-northeast-drought',
                        rulesSummary,
                    }
                    : card
            )),
        };

        const previewed = apply(mappedCore, {
            type: QIDAHEN_COMMANDS.CONFIRM_PREVIEW_ACTION,
            playerId: '2',
            payload: { actionId: 'play-event-card', sourceHandCardId: sourceCard.id },
        });
        const executed = apply(previewed, {
            type: QIDAHEN_COMMANDS.EXECUTE_SELECTED_ACTION,
            playerId: '2',
            payload: {},
        });
        const selectedRegion = executed.regions.find((region) => region.id === 'city-region-14')!;

        expect(selectedRegion.eventMarkers).toEqual([]);
        expect(executed.mapTokens.some((token) => token.id === 'drought-marker-city-region-14')).toBe(false);
        expect(executed.lastSeasonSummary?.lines.join(' ')).toContain('打出事件牌：东北大旱');
        expect(executed.lastSeasonSummary?.lines.join(' ')).toContain('结算效果：当前选中区域不是女真人区域，本次未放置旱灾标记。');
        expect(executed.discardPileCount).toBe(core.discardPileCount);
    });

it('从手牌打出东北大旱会在女真人区域放置可见旱灾标记', () => {
        const core = QidahenDomain.setup(['0', '1', '2'], random);
        const [sourceCard] = factionHandCards(core, 'jin');
        const rulesSummary = QIDAHEN_ATLAS05_ORDINARY_HAND_CARD_RULES_SUMMARY_BY_DEF_ID[
            'qidahen-atlas05-1613-northeast-drought'
        ];
        const mappedCore: QidahenCore = {
            ...core,
            currentPlayer: '2',
            selectedRegionId: 'city-region-13',
            handCards: core.handCards.map((card) => (
                card.id === sourceCard.id
                    ? {
                        ...card,
                        label: '东北大旱',
                        cardKind: 'event' as const,
                        armamentId: null,
                        cardDefId: 'qidahen-atlas05-1613-northeast-drought',
                        rulesSummary,
                    }
                    : card
            )),
        };

        const previewed = apply(mappedCore, {
            type: QIDAHEN_COMMANDS.CONFIRM_PREVIEW_ACTION,
            playerId: '2',
            payload: { actionId: 'play-event-card', sourceHandCardId: sourceCard.id },
        });
        const executed = apply(previewed, {
            type: QIDAHEN_COMMANDS.EXECUTE_SELECTED_ACTION,
            playerId: '2',
            payload: {},
        });
        const droughtRegion = executed.regions.find((region) => region.id === 'city-region-13')!;

        expect(droughtRegion.eventMarkers).toEqual(expect.arrayContaining([
            expect.objectContaining({
                id: 'drought-marker-city-region-13',
                kind: 'drought',
                label: '旱灾标记',
                sourceCardDefId: 'qidahen-atlas05-1613-northeast-drought',
                imageSrc: 'qidahen/markers/drought-marker',
            }),
        ]));
        expect(executed.mapTokens).toEqual(expect.arrayContaining([
            expect.objectContaining({
                id: 'drought-marker-city-region-13',
                type: 'marker',
                faction: 'neutral',
                imageSrc: 'qidahen/markers/drought-marker',
            }),
        ]));
        expect(executed.discardPileCount).toBe(core.discardPileCount);
        expect(executed.lastSeasonSummary?.lines.join(' ')).toContain('打出事件牌：东北大旱');
        expect(executed.lastSeasonSummary?.lines.join(' ')).toContain('结算效果：在 建州 放置旱灾标记。');
        expect(executed.lastSeasonSummary?.lines.join(' ')).toContain('使用后移出游戏：此牌未进入弃牌堆。');
    });

it.each([
        {
            cardDefId: 'qidahen-atlas05-1608-mongol-drought',
            cardName: '蒙古大旱',
            targetRegionId: 'city-region-14',
            wheelPosition: 'wheel-midyear',
            wheelPositionLabel: '年中',
        },
        {
            cardDefId: 'qidahen-atlas05-1608-mongol-drought',
            cardName: '蒙古大旱',
            targetRegionId: 'city-region-14',
            wheelPosition: 'wheel-new-year',
            wheelPositionLabel: '新年',
        },
        {
            cardDefId: 'qidahen-atlas05-1613-northeast-drought',
            cardName: '东北大旱',
            targetRegionId: 'city-region-13',
            wheelPosition: 'wheel-midyear',
            wheelPositionLabel: '年中',
        },
        {
            cardDefId: 'qidahen-atlas05-1613-northeast-drought',
            cardName: '东北大旱',
            targetRegionId: 'city-region-13',
            wheelPosition: 'wheel-new-year',
            wheelPositionLabel: '新年',
        },
        {
            cardDefId: 'qidahen-atlas05-1637-mongol-drought-alt',
            cardName: '蒙古大旱',
            targetRegionId: 'city-region-14',
            wheelPosition: 'wheel-midyear',
            wheelPositionLabel: '年中',
        },
        {
            cardDefId: 'qidahen-atlas05-1637-mongol-drought-alt',
            cardName: '蒙古大旱',
            targetRegionId: 'city-region-14',
            wheelPosition: 'wheel-new-year',
            wheelPositionLabel: '新年',
        },
    ] as const)(
        '$cardName在轮盘行动标记位于$wheelPositionLabel时不能使用并保留手牌',
        ({ cardDefId, cardName, targetRegionId, wheelPosition, wheelPositionLabel }) => {
            const core = QidahenDomain.setup(['0', '1', '2'], random);
            const [sourceCard] = factionHandCards(core, 'jin');
            const rulesSummary = QIDAHEN_ATLAS05_ORDINARY_HAND_CARD_RULES_SUMMARY_BY_DEF_ID[cardDefId];
            const mappedCore: QidahenCore = {
                ...core,
                currentPlayer: '2',
                actionWheelPosition: wheelPosition,
                selectedRegionId: targetRegionId,
                handCards: core.handCards.map((card) => (
                    card.id === sourceCard.id
                        ? {
                            ...card,
                            label: cardName,
                            cardKind: 'event' as const,
                            armamentId: null,
                            cardDefId,
                            rulesSummary,
                        }
                        : card
                )),
            };

            const previewed = apply(mappedCore, {
                type: QIDAHEN_COMMANDS.CONFIRM_PREVIEW_ACTION,
                playerId: '2',
                payload: { actionId: 'play-event-card', sourceHandCardId: sourceCard.id },
            });
            const executed = apply(previewed, {
                type: QIDAHEN_COMMANDS.EXECUTE_SELECTED_ACTION,
                playerId: '2',
                payload: {},
            });
            const targetRegion = executed.regions.find((region) => region.id === targetRegionId)!;

            expect(executed.handCards.some((card) => card.id === sourceCard.id)).toBe(true);
            expect(targetRegion.eventMarkers.some((marker) => marker.kind === 'drought')).toBe(false);
            expect(executed.mapTokens.some((token) => token.id === `drought-marker-${targetRegionId}`)).toBe(false);
            expect(executed.discardPileCount).toBe(core.discardPileCount);
            expect(executed.factions.jin.discardPileCount).toBe(core.factions.jin.discardPileCount);
            expect(executed.lastSeasonSummary?.title).toBe('执行事件');
            expect(executed.lastSeasonSummary?.lines.join(' ')).toContain(`${cardName}不能在轮盘行动标记进入下半年后使用。`);
            expect(executed.lastSeasonSummary?.lines.join(' ')).toContain('本次未消耗手牌，也未结算事件效果。');
            expect(executed.actionLog[0]?.text).toContain(`尝试执行事件「${cardName}」`);
            expect(executed.actionLog[0]?.text).toContain(`轮盘行动标记在${wheelPositionLabel}位置`);
        },
    );

it('从手牌打出东北大军会在女真人区域放置结构化甲喇标记', () => {
        const core = QidahenDomain.setup(['0', '1', '2'], random);
        const [sourceCard] = factionHandCards(core, 'jin');
        const rulesSummary = QIDAHEN_ATLAS05_ORDINARY_HAND_CARD_RULES_SUMMARY_BY_DEF_ID[
            'qidahen-atlas05-1631-northeast-army'
        ];
        const mappedCore: QidahenCore = {
            ...core,
            currentPlayer: '2',
            selectedRegionId: 'city-region-13',
            handCards: core.handCards.map((card) => (
                card.id === sourceCard.id
                    ? {
                        ...card,
                        label: '东北大军',
                        cardKind: 'event' as const,
                        armamentId: null,
                        cardDefId: 'qidahen-atlas05-1631-northeast-army',
                        rulesSummary,
                    }
                    : card
            )),
        };

        const previewed = apply(mappedCore, {
            type: QIDAHEN_COMMANDS.CONFIRM_PREVIEW_ACTION,
            playerId: '2',
            payload: { actionId: 'play-event-card', sourceHandCardId: sourceCard.id },
        });
        const executed = apply(previewed, {
            type: QIDAHEN_COMMANDS.EXECUTE_SELECTED_ACTION,
            playerId: '2',
            payload: {},
        });
        const jurchenRegion = executed.regions.find((region) => region.id === 'city-region-13')!;

        expect(jurchenRegion.eventMarkers).toEqual(expect.arrayContaining([
            expect.objectContaining({
                id: 'jala-marker-city-region-13',
                kind: 'jala',
                label: '甲喇标记',
                sourceCardDefId: 'qidahen-atlas05-1631-northeast-army',
                imageSrc: undefined,
                mapLabel: '甲喇',
            }),
        ]));
        expect(executed.mapTokens).toEqual(expect.arrayContaining([
            expect.objectContaining({
                id: 'jala-marker-city-region-13',
                type: 'marker',
                faction: 'neutral',
                value: '甲喇',
            }),
        ]));
        expect(executed.discardPileCount).toBe(core.discardPileCount);
        expect(executed.lastSeasonSummary?.lines.join(' ')).toContain('打出事件牌：东北大军');
        expect(executed.lastSeasonSummary?.lines.join(' ')).toContain('结算效果：在 建州 放置甲喇标记。');
        expect(executed.lastSeasonSummary?.lines.join(' ')).toContain('甲喇标记在地图上以“甲喇”汉字显示。');
        expect(executed.lastSeasonSummary?.lines.join(' ')).toContain('使用后移出游戏：此牌未进入弃牌堆。');
    });

it('先在地图选择女真人区域后打出东北大军会把甲喇标记放到新选区', () => {
        const core = QidahenDomain.setup(['0', '1', '2'], random);
        const [sourceCard] = factionHandCards(core, 'jin');
        const rulesSummary = QIDAHEN_ATLAS05_ORDINARY_HAND_CARD_RULES_SUMMARY_BY_DEF_ID[
            'qidahen-atlas05-1631-northeast-army'
        ];
        const mappedCore: QidahenCore = {
            ...core,
            currentPlayer: '2',
            selectedRegionId: 'city-region-14',
            handCards: core.handCards.map((card) => (
                card.id === sourceCard.id
                    ? {
                        ...card,
                        label: '东北大军',
                        cardKind: 'event' as const,
                        armamentId: null,
                        cardDefId: 'qidahen-atlas05-1631-northeast-army',
                        rulesSummary,
                    }
                    : card
            )),
        };

        const targetSelected = apply(mappedCore, {
            type: QIDAHEN_COMMANDS.SELECT_REGION,
            playerId: '2',
            payload: { regionId: 'city-region-13' },
        });
        const previewed = apply(targetSelected, {
            type: QIDAHEN_COMMANDS.CONFIRM_PREVIEW_ACTION,
            playerId: '2',
            payload: { actionId: 'play-event-card', sourceHandCardId: sourceCard.id },
        });
        const executed = apply(previewed, {
            type: QIDAHEN_COMMANDS.EXECUTE_SELECTED_ACTION,
            playerId: '2',
            payload: {},
        });
        const oldRegion = executed.regions.find((region) => region.id === 'city-region-14')!;
        const targetRegion = executed.regions.find((region) => region.id === 'city-region-13')!;

        expect(targetSelected.selectedRegionId).toBe('city-region-13');
        expect(oldRegion.eventMarkers).toEqual([]);
        expect(targetRegion.eventMarkers).toEqual(expect.arrayContaining([
            expect.objectContaining({
                id: 'jala-marker-city-region-13',
                kind: 'jala',
                label: '甲喇标记',
                sourceCardDefId: 'qidahen-atlas05-1631-northeast-army',
                mapLabel: '甲喇',
            }),
        ]));
        expect(executed.mapTokens).toEqual(expect.arrayContaining([
            expect.objectContaining({
                id: 'jala-marker-city-region-13',
                type: 'marker',
                faction: 'neutral',
                value: '甲喇',
            }),
        ]));
        expect(executed.lastSeasonSummary?.lines.join(' ')).toContain('结算效果：在 建州 放置甲喇标记。');
    });

it('东北大军不会在非女真人区域放置甲喇标记', () => {
        const core = QidahenDomain.setup(['0', '1', '2'], random);
        const [sourceCard] = factionHandCards(core, 'jin');
        const rulesSummary = QIDAHEN_ATLAS05_ORDINARY_HAND_CARD_RULES_SUMMARY_BY_DEF_ID[
            'qidahen-atlas05-1631-northeast-army'
        ];
        const mappedCore: QidahenCore = {
            ...core,
            currentPlayer: '2',
            selectedRegionId: 'city-region-14',
            handCards: core.handCards.map((card) => (
                card.id === sourceCard.id
                    ? {
                        ...card,
                        label: '东北大军',
                        cardKind: 'event' as const,
                        armamentId: null,
                        cardDefId: 'qidahen-atlas05-1631-northeast-army',
                        rulesSummary,
                    }
                    : card
            )),
        };

        const previewed = apply(mappedCore, {
            type: QIDAHEN_COMMANDS.CONFIRM_PREVIEW_ACTION,
            playerId: '2',
            payload: { actionId: 'play-event-card', sourceHandCardId: sourceCard.id },
        });
        const executed = apply(previewed, {
            type: QIDAHEN_COMMANDS.EXECUTE_SELECTED_ACTION,
            playerId: '2',
            payload: {},
        });
        const selectedRegion = executed.regions.find((region) => region.id === 'city-region-14')!;

        expect(selectedRegion.eventMarkers).toEqual([]);
        expect(executed.mapTokens.some((token) => token.id === 'jala-marker-city-region-14')).toBe(false);
        expect(executed.lastSeasonSummary?.lines.join(' ')).toContain('打出事件牌：东北大军');
        expect(executed.lastSeasonSummary?.lines.join(' ')).toContain('结算效果：当前选中区域不是女真人区域，本次未放置甲喇标记。');
        expect(executed.discardPileCount).toBe(core.discardPileCount);
    });

it('东北大军在轮盘行动标记走到新年时不能使用并保留手牌', () => {
        const core = QidahenDomain.setup(['0', '1', '2'], random);
        const [sourceCard] = factionHandCards(core, 'jin');
        const rulesSummary = QIDAHEN_ATLAS05_ORDINARY_HAND_CARD_RULES_SUMMARY_BY_DEF_ID[
            'qidahen-atlas05-1631-northeast-army'
        ];
        const mappedCore: QidahenCore = {
            ...core,
            currentPlayer: '2',
            actionWheelPosition: 'wheel-new-year',
            selectedRegionId: 'city-region-13',
            handCards: core.handCards.map((card) => (
                card.id === sourceCard.id
                    ? {
                        ...card,
                        label: '东北大军',
                        cardKind: 'event' as const,
                        armamentId: null,
                        cardDefId: 'qidahen-atlas05-1631-northeast-army',
                        rulesSummary,
                    }
                    : card
            )),
        };

        const previewed = apply(mappedCore, {
            type: QIDAHEN_COMMANDS.CONFIRM_PREVIEW_ACTION,
            playerId: '2',
            payload: { actionId: 'play-event-card', sourceHandCardId: sourceCard.id },
        });
        const executed = apply(previewed, {
            type: QIDAHEN_COMMANDS.EXECUTE_SELECTED_ACTION,
            playerId: '2',
            payload: {},
        });
        const jurchenRegion = executed.regions.find((region) => region.id === 'city-region-13')!;

        expect(executed.handCards.some((card) => card.id === sourceCard.id)).toBe(true);
        expect(jurchenRegion.eventMarkers).toEqual([]);
        expect(executed.mapTokens.some((token) => token.id === 'jala-marker-city-region-13')).toBe(false);
        expect(executed.discardPileCount).toBe(core.discardPileCount);
        expect(executed.factions.jin.discardPileCount).toBe(core.factions.jin.discardPileCount);
        expect(executed.lastSeasonSummary?.title).toBe('执行事件');
        expect(executed.lastSeasonSummary?.lines.join(' ')).toContain('东北大军不能在轮盘行动标记走到新年时使用。');
        expect(executed.lastSeasonSummary?.lines.join(' ')).toContain('本次未消耗手牌，也未结算事件效果。');
        expect(executed.actionLog[0]?.text).toContain('尝试执行事件「东北大军」');
        expect(executed.actionLog[0]?.text).toContain('轮盘行动标记在新年位置');
    });

it('翻山越岭会把本次进攻中的长城边界临时视为平原', () => {
        const core = QidahenDomain.setup(['0', '1', '2'], random);
        const [sourceCard] = factionHandCards(core, 'mongol');
        const rulesSummary = QIDAHEN_ATLAS05_ORDINARY_HAND_CARD_RULES_SUMMARY_BY_DEF_ID[
            'qidahen-atlas05-1614-cross-mountains'
        ];
        const mappedCore: QidahenCore = {
            ...core,
            currentPlayer: '1',
            selectedRegionId: 'city-region-24',
            handCards: core.handCards.map((card) => (
                card.id === sourceCard.id
                    ? {
                        ...card,
                        label: '翻山越岭',
                        cardKind: 'event' as const,
                        armamentId: null,
                        cardDefId: 'qidahen-atlas05-1614-cross-mountains',
                        rulesSummary,
                    }
                    : card
            )),
            regions: core.regions.map((region) => {
                if (region.id === 'city-region-20') {
                    return {
                        ...region,
                        controller: 'mongol' as const,
                        controlLabel: '蒙古',
                        troops: 3,
                        population: 1,
                    };
                }
                if (region.id === 'city-region-24') {
                    return {
                        ...region,
                        controller: 'ming' as const,
                        controlLabel: '大明',
                        troops: 2,
                        population: 1,
                    };
                }
                return region;
            }),
        };

        const originalPassage = getQidahenDirectedPassageRule(mappedCore, 'city-region-20', 'city-region-24', 'mongol');
        expect(originalPassage).toMatchObject({
            boundaryType: 'wall-convex',
            battleWidth: 1,
        });

        const previewed = apply(mappedCore, {
            type: QIDAHEN_COMMANDS.CONFIRM_PREVIEW_ACTION,
            playerId: '1',
            payload: { actionId: 'play-event-card', sourceHandCardId: sourceCard.id },
        });
        const pending = apply(previewed, {
            type: QIDAHEN_COMMANDS.EXECUTE_SELECTED_ACTION,
            playerId: '1',
            payload: {},
        });

        expect(pending.turnPhase).toBe('resolve-pending');
        expect(pending.pendingTargetAction).toMatchObject({
            actionId: 'raid',
            sourceRegionId: 'city-region-20',
            sourceRegionName: '土默特部',
            targetRuntimeRegionId: 'city-region-24',
            targetRegionName: '宁远',
            battleWidth: 3,
            boundaryUnitCap: null,
            committedTroops: 3,
            attackPressure: 3,
            attackBoundaryType: 'plain',
        });
        expect(pending.pendingTargetAction?.resolutionHint).toContain('平原 3');
        expect(pending.pendingTargetAction?.resolutionHint).toContain('翻山越岭');
        expect(pending.actionLog[0]?.text).toContain('翻山越岭');
        expect(pending.lastSeasonSummary?.lines.join(' ')).toContain('规则摘要：执行一次进攻行动；本次进攻中，长城、山脉边界视为平原边界。');
        expect(getQidahenDirectedPassageRule(pending, 'city-region-20', 'city-region-24', 'mongol')).toMatchObject({
            boundaryType: 'wall-convex',
            battleWidth: 1,
        });
    });

it('翻山越岭会把本次进攻中的山脉边界临时视为平原', () => {
        const core = QidahenDomain.setup(['0', '1', '2'], random);
        const [sourceCard] = factionHandCards(core, 'mongol');
        const rulesSummary = QIDAHEN_ATLAS05_ORDINARY_HAND_CARD_RULES_SUMMARY_BY_DEF_ID[
            'qidahen-atlas05-1614-cross-mountains'
        ];
        const mappedCore: QidahenCore = {
            ...core,
            currentPlayer: '1',
            selectedRegionId: 'city-region-1',
            handCards: core.handCards.map((card) => (
                card.id === sourceCard.id
                    ? {
                        ...card,
                        label: '翻山越岭',
                        cardKind: 'event' as const,
                        armamentId: null,
                        cardDefId: 'qidahen-atlas05-1614-cross-mountains',
                        rulesSummary,
                    }
                    : card
            )),
            regions: core.regions.map((region) => {
                if (region.id === 'city-region-20') {
                    return {
                        ...region,
                        controller: 'mongol' as const,
                        controlLabel: '蒙古',
                        troops: 3,
                        population: 1,
                    };
                }
                if (region.id === 'city-region-1') {
                    return {
                        ...region,
                        controller: 'ming' as const,
                        controlLabel: '大明',
                        troops: 2,
                        population: 1,
                    };
                }
                return region;
            }),
        };

        const originalPassage = getQidahenDirectedPassageRule(mappedCore, 'city-region-20', 'city-region-1', 'mongol');
        expect(originalPassage).toMatchObject({
            boundaryType: 'mountain',
            battleWidth: 2,
        });

        const previewed = apply(mappedCore, {
            type: QIDAHEN_COMMANDS.CONFIRM_PREVIEW_ACTION,
            playerId: '1',
            payload: { actionId: 'play-event-card', sourceHandCardId: sourceCard.id },
        });
        const pending = apply(previewed, {
            type: QIDAHEN_COMMANDS.EXECUTE_SELECTED_ACTION,
            playerId: '1',
            payload: {},
        });

        expect(pending.turnPhase).toBe('resolve-pending');
        expect(pending.pendingTargetAction).toMatchObject({
            actionId: 'raid',
            sourceRegionId: 'city-region-20',
            sourceRegionName: '土默特部',
            targetRuntimeRegionId: 'city-region-1',
            targetRegionName: '大同',
            battleWidth: 3,
            boundaryUnitCap: null,
            committedTroops: 3,
            attackPressure: 3,
            attackBoundaryType: 'plain',
        });
        expect(pending.pendingTargetAction?.resolutionHint).toContain('平原 3');
        expect(pending.pendingTargetAction?.resolutionHint).toContain('翻山越岭');
        expect(getQidahenDirectedPassageRule(pending, 'city-region-20', 'city-region-1', 'mongol')).toMatchObject({
            boundaryType: 'mountain',
            battleWidth: 2,
        });
    });

it('手牌直点来源必须匹配当前势力和动作，不能把任意手牌伪装成事件或军备入口', () => {
        const core = QidahenDomain.setup(['0', '1', '2'], random);
        const [mingCard] = factionHandCards(core, 'ming');
        const [mongolCard] = factionHandCards(core, 'mongol');
        const mappedCore: QidahenCore = {
            ...core,
            handCards: core.handCards.map((card) => {
                if (card.id === mingCard.id) {
                    return {
                        ...card,
                        cardKind: 'armament' as const,
                        armamentId: 'artillery-tech' as const,
                        cardDefId: 'test-ming-artillery-tech',
                    };
                }
                if (card.id === mongolCard.id) {
                    return {
                        ...card,
                        cardKind: 'event' as const,
                        cardDefId: 'test-mongol-khan-edict-event',
                    };
                }
                return card;
            }),
        };

        expect(QidahenDomain.validate(stateOf(mappedCore), {
            type: QIDAHEN_COMMANDS.CONFIRM_PREVIEW_ACTION,
            playerId: '0',
            payload: { actionId: 'khan-edict', sourceHandCardId: mingCard.id },
        })).toEqual({ valid: false, error: 'unknownPaymentCard' });
        expect(QidahenDomain.validate(stateOf(mappedCore), {
            type: QIDAHEN_COMMANDS.CONFIRM_PREVIEW_ACTION,
            playerId: '0',
            payload: { actionId: 'khan-edict', sourceHandCardId: mongolCard.id },
        })).toEqual({ valid: false, error: 'unknownPaymentCard' });
    });

it('取消军备手牌预览后只保留当前聚焦动作，不再保留已确认动作', () => {
        const core = QidahenDomain.setup(['0', '1', '2'], random);
        const [armamentCard] = factionHandCards(core, 'ming');
        const mappedCore: QidahenCore = {
            ...core,
            handCards: core.handCards.map((card) => (
                card.id === armamentCard.id
                    ? {
                        ...card,
                        cardKind: 'armament' as const,
                        armamentId: 'artillery-tech' as const,
                        cardDefId: 'test-ming-artillery-tech',
                    }
                    : card
            )),
        };
        const previewed = apply(mappedCore, {
            type: QIDAHEN_COMMANDS.CONFIRM_PREVIEW_ACTION,
            playerId: '0',
            payload: { actionId: 'upgrade-armament', sourceHandCardId: armamentCard.id },
        });

        const cancelled = apply(previewed, {
            type: QIDAHEN_COMMANDS.CANCEL_PREVIEW_ACTION,
            playerId: '0',
            payload: {},
        });

        expect(cancelled.selectedActionId).toBe('upgrade-armament');
        expect(cancelled.confirmedActionId).toBeNull();
        expect(cancelled.selectedPaymentCardIds).toEqual([]);
        expect(cancelled.selectedHandActionCardId).toBeNull();
        expect(cancelled.payment).toMatchObject({
            required: 2,
            selected: 0,
            prompt: '需弃 2 / 已选 0',
        });
    });

it('抽象升级军备执行入口不再作为势力行动长期存在', () => {
        const core = QidahenDomain.setup(['0', '1', '2'], random);

        const validation = QidahenDomain.validate(stateOf(core), {
            type: QIDAHEN_COMMANDS.EXECUTE_ACTION,
            playerId: '0',
            payload: { actionId: 'upgrade-armament' },
        });

        expect(validation).toEqual({ valid: false, error: 'unknownAction' });
    });

it('升级军备到低保真上限后会被校验拦截，避免白白弃牌', () => {
        const core = QidahenDomain.setup(['0', '1', '2'], random);
        const maxedCore: QidahenCore = {
            ...core,
            factions: {
                ...core.factions,
                ming: {
                    ...core.factions.ming,
                    armaments: core.factions.ming.armaments.map((armament) => ({
                        ...armament,
                        level: 2,
                    })),
                },
            },
        };
        const selectedCore: QidahenCore = {
            ...maxedCore,
            selectedActionId: 'upgrade-armament',
            confirmedActionId: 'upgrade-armament',
            selectedPaymentCardIds: factionHandCards(maxedCore, 'ming').slice(0, 2).map((card) => card.id),
            payment: {
                required: 2,
                selected: 2,
                prompt: '需弃 2 / 已选 2',
            },
        };

        const directValidation = QidahenDomain.validate(stateOf(maxedCore), {
            type: QIDAHEN_COMMANDS.EXECUTE_ACTION,
            playerId: '0',
            payload: { actionId: 'upgrade-armament' },
        });
        const selectedValidation = QidahenDomain.validate(stateOf(selectedCore), {
            type: QIDAHEN_COMMANDS.EXECUTE_SELECTED_ACTION,
            playerId: '0',
        });

        expect(directValidation).toEqual({ valid: false, error: 'unknownAction' });
        expect(selectedValidation).toEqual({ valid: false, error: 'noUpgradableArmament' });
        expect(maxedCore.factions.ming.handCount).toBe(3);
        expect(factionHandCards(maxedCore, 'ming').filter((card) => card.status === 'payable')).toHaveLength(3);
        expect(maxedCore.factions.ming.armaments).toEqual([
            { id: 'artillery-tech', name: '火炮技术', level: 2 },
            { id: 'infantry-armor', name: '步兵铁甲', level: 2 },
            { id: 'cavalry-armor', name: '骑兵铁甲', level: 2 },
            { id: 'western-bastion', name: '西式棱堡', level: 2 },
            { id: 'long-barreled-musket', name: '长管火铳', level: 2 },
            { id: 'cavalry-firearm', name: '骑兵火器', level: 2 },
            { id: 'manzhou-banners', name: '满州八旗', level: 2 },
            { id: 'horse-breeding', name: '骏马育种', level: 2 },
            { id: 'mongol-banners', name: '蒙古八旗', level: 2 },
            { id: 'han-banners', name: '汉军八旗', level: 2 },
        ]);
    });
});
