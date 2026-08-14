import { describe, expect, it } from 'vitest';
import { DiceThroneDomain } from '../domain';
import type { DiceThroneCommand, DiceThroneCore } from '../domain/types';
import { executePipeline } from '../../../engine/pipeline';
import type { MatchState, PlayerId } from '../../../engine/types';
import { getCurrentInteractionSummary } from '../../../engine/testing/interactionTestFacade';
import { cmd, createHeroMatchup, createQueuedRandom, testSystems } from './test-utils';

describe('圣光术奖励骰反馈回归', () => {
    it('触发两颗奖励骰后，确认应清空交互与临时结算并继续流程', () => {
        const playerIds: PlayerId[] = ['0', '1'];
        const random = createQueuedRandom([5, 5, 1, 1, 1, 1, 3]);
        let state = createHeroMatchup('paladin', 'monk')(playerIds, random);
        const pipelineConfig = { domain: DiceThroneDomain, systems: testSystems };

        const dispatch = (type: DiceThroneCommand['type'], payload: Record<string, unknown> = {}) => {
            const result = executePipeline(
                pipelineConfig,
                state,
                { ...cmd(type, '0', payload), timestamp: Date.now() } as DiceThroneCommand,
                random,
                playerIds,
            );
            expect(result.success, `${type} 应可执行`).toBe(true);
            if (!result.success) throw new Error(String(result.error));
            state = result.state as MatchState<DiceThroneCore>;
            return result;
        };

        dispatch('ADVANCE_PHASE');
        dispatch('ROLL_DICE');
        dispatch('CONFIRM_ROLL');
        dispatch('SELECT_ABILITY', { abilityId: 'holy-light' });
        dispatch('ADVANCE_PHASE');

        expect(state.core.pendingBonusDiceSettlement).toMatchObject({
            sourceAbilityId: 'holy-light',
            attackerId: '0',
        });
        expect(state.core.pendingBonusDiceSettlement?.dice).toHaveLength(2);
        expect(getCurrentInteractionSummary(state).kind).toBeUndefined();

        dispatch('RESPONSE_PASS');
        expect(getCurrentInteractionSummary(state).kind).toBe('dt:bonus-dice');

        const skipResult = dispatch('SKIP_BONUS_DICE_REROLL');

        expect(skipResult.events.map((event: { type: string }) => event.type)).toContain('BONUS_DICE_SETTLED');
        expect(skipResult.events.map((event: { type: string }) => event.type)).not.toContain('BONUS_DICE_REROLL_REQUESTED');

        expect(state.core.pendingBonusDiceSettlement).toBeUndefined();
        expect(getCurrentInteractionSummary(state).id).toBeUndefined();
        expect(state.sys.phase).toBe('main2');
    });
});
