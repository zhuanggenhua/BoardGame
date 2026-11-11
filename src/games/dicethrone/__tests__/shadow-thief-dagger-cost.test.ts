import { describe, expect, it } from 'vitest';
import { executePipeline } from '../../../engine/pipeline';
import { DiceThroneDomain } from '../domain';
import { SHADOW_THIEF_CARDS } from '../heroes/shadow_thief/cards';
import { cmd, createHeroMatchup, fixedRandom, testSystems } from './test-utils';

describe('暗影贼匕首突刺 II 费用', () => {
    it('按勘误收取 2 CP，0 CP 时不能打出', () => {
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
        expect(card.cpCost).toBe(2);
        expect(result.success).toBe(false);
        state.core.players['0'].resources.cp = 2;
        const paid = executePipeline(
            { domain: DiceThroneDomain, systems: testSystems }, state,
            cmd('PLAY_CARD', '0', { cardId: card.id }), fixedRandom, ['0', '1'],
        );
        expect(paid.success).toBe(true);
        if (!paid.success) return;
        expect(paid.state.core.players['0'].resources.cp).toBe(0);
        expect(paid.state.core.players['0'].abilityLevels['dagger-strike']).toBe(2);
    });
});
