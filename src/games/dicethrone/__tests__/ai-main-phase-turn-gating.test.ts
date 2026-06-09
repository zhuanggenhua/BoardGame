import { describe, expect, it } from 'vitest';
import { INTERACTION_COMMANDS } from '../../../engine/systems/InteractionSystem';
import {
    injectRawBlockingInteraction,
    injectSimpleChoiceBlockingInteraction,
} from '../../../engine/testing/interactionTestFacade';

import { buildDiceThroneAiLegalActions } from '../ai';
import { createSetupWithHand, fixedRandom } from './test-utils';

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
});
