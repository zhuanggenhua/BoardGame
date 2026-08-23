import { describe, expect, it } from 'vitest';
import {
    createAiActionOutcomeNoBenefitScorer,
    getCachedAiActionOutcome,
    isAiActionOutcomeNoBenefit,
    type AiActionOutcome,
    type AiActionOutcomeCache,
} from '../actionOutcome';
import type { AiDecisionContext, AiLegalAction } from '../types';

const sampleAction: AiLegalAction = {
    actionId: 'play-action:sample',
    kind: 'play-action',
    label: '打出示例行动',
    commands: [{
        type: 'PLAY_ACTION',
        payload: { cardUid: 'sample' },
    }],
};

const sampleContext = {
    gameId: 'test-game',
    matchId: 'match-action-outcome',
    playerId: '0',
    visibleState: { core: {}, sys: {} },
    interaction: null,
    responseWindow: null,
    legalActions: [sampleAction],
    rulesVersion: null,
    decisionBudgetMs: 250,
    source: 'local',
    difficulty: {
        level: 'normal',
        searchDepth: 1,
        shortlistSize: 4,
        simulationBudgetMs: 100,
        randomness: 0,
        beliefSampleCount: 0,
        evaluatorProfile: 'balanced',
    },
} as AiDecisionContext;

describe('AI action outcome contract', () => {
    it('没有真实效果且只有无有效目标反馈时，判为无收益', () => {
        expect(isAiActionOutcomeNoBenefit({
            status: 'succeeded',
            feedbackKeys: ['feedback.no_valid_targets'],
            hasMeaningfulEffect: false,
            hasOwnedFollowUp: false,
            utilityDelta: 0,
        })).toBe(true);
    });

    it('有真实效果或己方后续交互时，不因反馈或非正收益被误判为空耗', () => {
        expect(isAiActionOutcomeNoBenefit({
            status: 'succeeded',
            feedbackKeys: ['feedback.no_valid_targets'],
            hasMeaningfulEffect: true,
            hasOwnedFollowUp: false,
            utilityDelta: 0,
        })).toBe(false);

        expect(isAiActionOutcomeNoBenefit({
            status: 'succeeded',
            hasMeaningfulEffect: false,
            hasOwnedFollowUp: true,
            utilityDelta: -1,
        }, {
            treatNonPositiveUtilityAsNoBenefit: true,
        })).toBe(false);
    });

    it('可选择把非正局势变化视为空耗动作', () => {
        expect(isAiActionOutcomeNoBenefit({
            status: 'succeeded',
            hasMeaningfulEffect: false,
            hasOwnedFollowUp: false,
            utilityDelta: 0,
        })).toBe(false);

        expect(isAiActionOutcomeNoBenefit({
            status: 'succeeded',
            hasMeaningfulEffect: false,
            hasOwnedFollowUp: false,
            utilityDelta: 0,
        }, {
            treatNonPositiveUtilityAsNoBenefit: true,
        })).toBe(true);
    });

    it('按 context 和 action 缓存投影结果，避免 scorer 与 lookahead 重复执行预演', () => {
        const cache: AiActionOutcomeCache<AiActionOutcome> = new WeakMap();
        let projectCount = 0;
        const first = getCachedAiActionOutcome(cache, sampleContext, sampleAction, () => {
            projectCount += 1;
            return {
                status: 'succeeded',
                utilityDelta: 3,
            };
        });
        const second = getCachedAiActionOutcome(cache, sampleContext, sampleAction, () => {
            projectCount += 1;
            return {
                status: 'succeeded',
                utilityDelta: 9,
            };
        });

        expect(projectCount).toBe(1);
        expect(first).toBe(second);
        expect(second?.utilityDelta).toBe(3);
    });

    it('零收益 scorer 只对声明的动作类型扣分', () => {
        const scorer = createAiActionOutcomeNoBenefitScorer({
            id: 'no-benefit',
            actionKinds: ['play-action'],
            projectOutcome: () => ({
                status: 'succeeded',
                feedbackKeys: ['feedback.no_valid_targets'],
                hasMeaningfulEffect: false,
                hasOwnedFollowUp: false,
            }),
            noBenefitScore: -180,
        });

        expect(scorer.score(sampleContext, sampleAction)).toEqual({
            score: -180,
            reason: '动作预演没有产生实际收益，跳过优先于空耗资源',
        });
        expect(scorer.score(sampleContext, {
            ...sampleAction,
            actionId: 'play-minion:sample',
            kind: 'play-minion',
        })).toBeNull();
    });
});
