import { describe, expect, it } from 'vitest';

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
});
