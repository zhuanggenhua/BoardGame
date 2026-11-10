import { act, renderHook } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { createInitialSystemState } from '../../../engine/pipeline';
import type { MatchState } from '../../../engine/types';
import { createAnnualChronologyPaymentStep, createAnnualSeasonTutorialSteps,
    resolveAnnualSeasonTutorialStep, validateAnnualSeasonTutorialStep } from '../annualSeasonTutorial';
import { createInitialCore } from '../domain/initialCoreSetup';
import { buildQidahenUpkeepTasks } from '../domain/seasonTasks';
import { buildQidahenTurnChoice } from '../domain/turnResolutionChoices';
import { QIDAHEN_TURN_RESOLUTION_CHOICE, QIDAHEN_TURN_RESOLUTION_FRAME, type QidahenTurnResolutionData } from '../domain/turnResolutionTypes';
import type { QidahenCore } from '../domain/types';
import { engineConfig } from '../game';
import { useQidahenTurnInput } from '../ui/useQidahenTurnInput';

function fixture(): { state: MatchState<QidahenCore>; data: QidahenTurnResolutionData } {
    const players = ['0', '1', '2'];
    const core = createInitialCore(players, 'post-sarhu-1619', true);
    const data = {
        step: 'upkeep', factionId: 'ming', upkeepTasks: buildQidahenUpkeepTasks(core), upkeepIndex: 0,
        chronologyCandidates: ['ming'], chronologyIndex: 0, paymentCardIds: [],
    } as QidahenTurnResolutionData;
    const sys = createInitialSystemState(players, engineConfig.systems, 'qidahen-turn-frame');
    sys.resolution = { activeFrameId: 'season', frames: [{ id: 'season', kind: QIDAHEN_TURN_RESOLUTION_FRAME,
        ordering: 'explicit', status: 'running', metadata: { qidahenTurn: data } }] };
    return { state: { core, sys }, data };
}

describe('年度教程按真实结算生成耗损与纪年步骤', () => {
    it('玩家分次处理期间刷新地区、候选与待处理数量，不写死部队或手牌', () => {
        const { state, data } = fixture();
        const step = createAnnualSeasonTutorialSteps([])[0];
        const indices = data.upkeepTasks.flatMap((task, index) => task.factionId === 'ming' ? [index] : []);
        expect(indices.length).toBeGreaterThan(1);
        for (const index of indices.slice(0, 2)) {
            data.upkeepIndex = index;
            data.upkeepRemaining = 1;
            const actual = resolveAnnualSeasonTutorialStep(state, step);
            const choice = buildQidahenTurnChoice(state.core, data)!;
            expect(validateAnnualSeasonTutorialStep(state, step)).toBe(true);
            expect(actual.highlightTarget).toBe(`qidahen-map-region-focus-${data.upkeepTasks[index].regionId}`);
            expect(actual.content).toBe(`game-qidahen:tutorial.annual.steps.season-upkeep-${data.upkeepTasks[index].reason}`);
            expect(choice.candidates.length).toBeGreaterThan(0);
            expect(actual.allowedTargets).toBeUndefined();
            expect(actual.advanceOnEvents).toBeUndefined();
        }
        data.step = 'chronology';
        expect(validateAnnualSeasonTutorialStep(state, step)).toBe(false);
    });

    it('对手任务按实际归属和当前合法候选执行，纪年支付只允许现有候选', () => {
        const { state, data } = fixture();
        const steps = createAnnualSeasonTutorialSteps([]);
        const opponent = steps[1];
        const index = data.upkeepTasks.findIndex(task => task.factionId !== 'ming');
        expect(index).toBeGreaterThanOrEqual(0);
        data.upkeepIndex = index;
        const choice = buildQidahenTurnChoice(state.core, data)!;
        const action = resolveAnnualSeasonTutorialStep(state, opponent).aiActions![0];
        expect(action.playerId).toBe(state.core.factions[data.upkeepTasks[index].factionId].playerId);
        expect(choice.candidates.map(candidate => candidate.id)).toContain((action.payload as { optionId: string }).optionId);
        expect(validateAnnualSeasonTutorialStep(state, steps[0])).toBe(false);
        data.step = 'chronology-payment';
        const payment = createAnnualChronologyPaymentStep();
        expect(validateAnnualSeasonTutorialStep(state, payment)).toBe(true);
        expect(buildQidahenTurnChoice(state.core, data)!.candidates.length).toBeGreaterThan(0);
        expect(resolveAnnualSeasonTutorialStep(state, payment).allowedTargets).toBeUndefined();
    });

    it('真实输入 hook 接受多候选中的部分支付，而不是要求选择全部候选或重置教程', () => {
        const { state, data } = fixture();
        data.upkeepIndex = data.upkeepTasks.findIndex(task => task.factionId === 'ming');
        data.upkeepRemaining = 2;
        const choice = buildQidahenTurnChoice(state.core, data)!;
        expect(choice.candidates.length).toBeGreaterThan(2);
        const first = choice.candidates[0].id;
        const step = resolveAnnualSeasonTutorialStep(state, createAnnualSeasonTutorialSteps([])[0]);
        state.sys.tutorial = { ...state.sys.tutorial, active: true, step };
        state.sys.interaction.current = { id: 'upkeep-input', kind: 'simple-choice', playerId: '0',
            data: { sourceId: QIDAHEN_TURN_RESOLUTION_CHOICE, title: choice.title,
                multi: { min: 1, max: 2 }, options: choice.candidates.map(candidate => ({ ...candidate, value: { kind: 'upkeep' } })) },
        } as unknown as typeof state.sys.interaction.current;
        const dispatch = vi.fn();
        const hook = renderHook(() => useQidahenTurnInput(state, '0', dispatch, false));
        act(() => hook.result.current.toggle(first));
        act(() => hook.result.current.confirm());
        expect(dispatch).toHaveBeenCalledOnce();
        expect(dispatch).toHaveBeenCalledWith('SYS_INTERACTION_RESPOND', { interactionId: 'upkeep-input', optionIds: [first] });
    });
});
