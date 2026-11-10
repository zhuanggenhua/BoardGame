import { describe, expect, it } from 'vitest';
import { executePipeline } from '../../../engine/pipeline';
import { DiceThroneDomain } from '../domain';
import { SHADOW_THIEF_CARDS } from '../heroes/shadow_thief/cards';
import { cmd, createHeroMatchup, fixedRandom, testSystems } from './test-utils';

describe('暗影贼匕首突刺 II 费用', () => {
    it('0 CP 时可打出卡面标注免费的升级牌，且不扣 CP', () => {
        const state = createHeroMatchup('shadow_thief', 'monk')(['0', '1'], fixedRandom);
        const card = SHADOW_THIEF_CARDS.find(item => item.id === 'upgrade-dagger-strike-2')!;
        state.sys.phase = 'main1';
        state.core.activePlayerId = '0';
        state.core.players['0'].resources.cp = 0;
        state.core.players['0'].hand = [card];
        const result = executePipeline(
            { domain: DiceThroneDomain, systems: testSystems }, state,
            cmd('PLAY_CARD', '0', { cardId: card.id }), fixedRandom, ['0', '1'],
        );
        expect(result.success).toBe(true);
        if (!result.success) return;
        expect(result.state.core.players['0'].resources.cp).toBe(0);
        expect(result.state.core.players['0'].abilityLevels['dagger-strike']).toBe(2);
    });
});
