import { describe, expect, it } from 'vitest';
import { INTERACTION_COMMANDS } from '../../../engine/systems/InteractionSystem';
import {
    injectRawBlockingInteraction,
    injectSimpleChoiceBlockingInteraction,
} from '../../../engine/testing/interactionTestFacade';

import { buildDiceThroneAiLegalActions } from '../ai';
import { checkPlayCard } from '../domain/rules';
import { RESOURCE_IDS } from '../domain/resources';
import { cmd, createRunner, createSetupWithHand, fixedRandom, getCardById } from './test-utils';

describe('DiceThrone AI 主阶段候选门禁', () => {
    it('非当前回合玩家不应生成主阶段出牌或卖牌候选', () => {
        const state = createSetupWithHand(
            ['card-palm-strike', 'card-thrust-punch-2'],
            { playerId: '1', cp: 5 },
        )(['0', '1'], fixedRandom);

        state.core.activePlayerId = '0';
        state.sys.phase = 'main1';

        const actions = buildDiceThroneAiLegalActions({
            playerId: '1',
            state,
        });

        expect(actions.some((action) => action.kind === 'play-card')).toBe(false);
        expect(actions.some((action) => action.kind === 'play-upgrade-card')).toBe(false);
        expect(actions.some((action) => action.kind === 'sell-card')).toBe(false);
        expect(actions.some((action) => action.kind === 'advance-phase')).toBe(false);
    });

    it('当前有其他玩家交互时不应生成主阶段候选', () => {
        const state = createSetupWithHand(
            ['card-palm-strike', 'card-thrust-punch-2'],
            { playerId: '0', cp: 5 },
        )(['0', '1'], fixedRandom);

        state.core.activePlayerId = '0';
        state.sys.phase = 'main1';
        injectSimpleChoiceBlockingInteraction(state, {
            id: 'dt-other-player-choice',
            playerId: '1',
            sourceId: 'other-player-choice',
        });

        const actions = buildDiceThroneAiLegalActions({
            playerId: '0',
            state,
        });

        expect(actions).toEqual([]);
    });

    it('未知阻塞交互属于 AI 时应紧急取消而不是继续走主阶段', () => {
        const state = createSetupWithHand(
            ['card-palm-strike', 'card-thrust-punch-2'],
            { playerId: '0', cp: 5 },
        )(['0', '1'], fixedRandom);

        state.core.activePlayerId = '0';
        state.sys.phase = 'main1';
        injectRawBlockingInteraction(state, {
            id: 'dt-future-choice',
            playerId: '0',
            kind: 'dt:future-choice',
            sourceId: 'future-choice',
        });

        const actions = buildDiceThroneAiLegalActions({
            playerId: '0',
            state,
        });

        expect(actions).toHaveLength(1);
        expect(actions[0]).toMatchObject({
            kind: 'interaction-cancel',
            commands: [{
                type: INTERACTION_COMMANDS.CANCEL,
                payload: {
                    interactionId: 'dt-future-choice',
                    reason: 'unsupported-interaction-kind',
                },
            }],
        });
    });

    it('展示型奖励骰只剩 1 颗时，AI 应确认收口而不是反复打出“俺也一样”', () => {
        const state = createSetupWithHand(['card-me-too'], {
            playerId: '1',
            cp: 4,
            mutate: (core) => {
                core.activePlayerId = '1';
                core.rollCount = 0;
                core.rollConfirmed = false;
                core.pendingBonusDiceSettlement = {
                    id: 'card-one-throw-fortune-display-test',
                    sourceAbilityId: 'card-one-throw-fortune',
                    attackerId: '1',
                    targetId: '1',
                    dice: [{
                        index: 0,
                        value: 6,
                        face: 'meteor',
                        effectKey: 'bonusDie.effect.gainCp',
                        effectParams: { cp: 3, value: 6 },
                    }],
                    rerollCostTokenId: '',
                    rerollCostAmount: 0,
                    rerollCount: 0,
                    maxRerollCount: 0,
                    readyToSettle: false,
                    displayOnly: true,
                    showTotal: false,
                    customResolutionId: 'one-throw-fortune-cp',
                    allowDiceModification: true,
                };
            },
        })(['0', '1'], fixedRandom);
        state.sys.phase = 'main1';

        expect(checkPlayCard(state.core, '1', getCardById('card-me-too'), 'main1')).toEqual({
            ok: false,
            reason: 'requireMinDiceCount',
        });

        const actions = buildDiceThroneAiLegalActions({
            playerId: '1',
            state,
        });

        expect(actions.some((action) =>
            action.kind === 'play-card'
            && action.commands.some((command) =>
                command.type === 'PLAY_CARD'
                && (command.payload as { cardId?: string }).cardId === 'card-me-too',
            ),
        )).toBe(false);
        expect(actions).toContainEqual(expect.objectContaining({
            kind: 'skip-bonus-dice-reroll',
            commands: [{ type: 'SKIP_BONUS_DICE_REROLL', payload: {} }],
        }));

        const result = createRunner(fixedRandom, false).run({
            name: '一掷千金展示型奖励骰 AI 确认收口',
            setup: () => state,
            commands: [cmd('SKIP_BONUS_DICE_REROLL', '1')],
        });

        expect(result.finalState.core.pendingBonusDiceSettlement).toBeUndefined();
        expect(result.finalState.core.players['1'].resources[RESOURCE_IDS.CP]).toBe(7);
    });
});
