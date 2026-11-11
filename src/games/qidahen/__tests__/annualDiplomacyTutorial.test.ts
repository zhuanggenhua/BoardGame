import { act, renderHook } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { createInitialSystemState, executePipeline } from '../../../engine/pipeline';
import { createRespondToPromptCommand, getCurrentInteractionData, getCurrentInteractionSummary, getPromptOptions } from '../../../engine/testing/interactionTestFacade';
import type { MatchState, RandomFn, TutorialManifest } from '../../../engine/types';
import type { SimpleChoiceData } from '../../../engine/systems/InteractionSystem';
import { createAnnualDiplomacyTutorialStep, resolveAnnualDiplomacyTutorialStep, validateAnnualDiplomacyTutorialStep } from '../annualDiplomacyTutorial';
import { QidahenDomain } from '../domain';
import { getQidahenTurnResolutionFrame } from '../domain/turnResolutionOpportunities';
import { getQidahenWheelPosition } from '../domain/wheelRules';
import type { QidahenCommand, QidahenCore } from '../domain/types';
import { engineConfig } from '../game';
import { buildQidahenTutorialSetupData } from '../tutorialSetup';
import { useQidahenTurnInput } from '../ui/useQidahenTurnInput';

const players = ['0', '1', '2'];
const random: RandomFn = { random: () => 0.5, d: () => 1, range: min => min, shuffle: cards => [...cards] };

/** 从正式教程开局按真实轮次走到大明的外交／雇佣格，不写入局面。 */
function reachDiplomacySlot() {
    let state: MatchState<QidahenCore> = {
        core: QidahenDomain.setup(players, random, buildQidahenTutorialSetupData('basic-opening')!.setupData),
        sys: createInitialSystemState(players, engineConfig.systems, 'annual-diplomacy-test'),
    };
    const send = (type: string, payload: unknown = {}, playerId = state.core.currentPlayer) => {
        const result = executePipeline({ domain: QidahenDomain, systems: engineConfig.systems }, state,
            { type, playerId, payload, timestamp: 100 } as QidahenCommand, random, players);
        expect(result.success, JSON.stringify({ type, payload, error: result.error })).toBe(true);
        state = result.state;
    };
    const choose = (id: string | string[]) => {
        const summary = getCurrentInteractionSummary(state);
        const choice = getCurrentInteractionData<SimpleChoiceData>(state);
        expect(summary.playerId).toBeDefined();
        expect(choice).toBeDefined();
        const ids = Array.isArray(id) ? id : [id];
        const command = createRespondToPromptCommand(state, { playerId: summary.playerId!,
            ...(choice!.multi ? { optionIds: ids } : { optionId: ids[0] }) });
        send(command.type, command.payload, command.playerId);
    };
    let reached = false;
    for (let guard = 0; guard < 150 && !reached; guard++) {
        const frame = getQidahenTurnResolutionFrame(state);
        if (!frame) {
            if (state.core.handLimitDiscardSelection) {
                const limit = state.core.handLimitDiscardSelection;
                choose(limit.candidateCardIds.slice(0, limit.requiredDiscardCount));
            } else send('EXECUTE_WHEEL_MOVE', { moveId: 'move-1-free' });
            continue;
        }
        const data = frame.metadata.qidahenTurn;
        if (data.step === 'menu' && data.factionId === 'ming' && getQidahenWheelPosition(data.positionId)?.kind === 'diplomacy-hire') {
            reached = true;
            continue;
        }
        if (data.step === 'menu') choose('finish-slot');
        else if (data.step === 'finish-hand') choose('skip-hand');
        else if (data.step === 'income-bonus') choose('decline-bonus');
        else if (data.step === 'character-judgement') choose('roll');
        else throw new Error(`Unexpected turn step: ${data.step}`);
    }
    expect(reached).toBe(true);
    const step = createAnnualDiplomacyTutorialStep([]);
    const manifest: TutorialManifest = {
        id: 'annual-diplomacy-cycle-test', numPlayers: 3, steps: [step, { id: 'done', content: 'done', infoStep: true }],
        stepValidator: (match, current) => validateAnnualDiplomacyTutorialStep(match as MatchState<QidahenCore>, current) ?? true,
        resolveStep: (match, current) => resolveAnnualDiplomacyTutorialStep(match as MatchState<QidahenCore>, current),
    };
    send('SYS_TUTORIAL_START', { manifest }, '0');
    return { get state() { return state; }, send, choose };
}

describe('年度教程外交与雇佣', () => {
    it('真实候选可多次外交、结束外交并两次雇佣，离开轮盘后才推进教程', () => {
        const match = reachDiplomacySlot();
        const options = () => getPromptOptions(match.state);
        const current = () => match.state.sys.tutorial.step!;
        expect(current().id).toBe('diplomacy-cycle');
        expect(current().allowedTargets).toBeUndefined();
        match.choose('diplomacy');
        expect(current().content).toContain('diplomacy-target-dynamic');
        const first = options().find(option => option.id !== 'finish-diplomacy')!.id;
        const before = match.state.core.regions.find(region => region.id === first)!;
        match.choose(first);
        const after = match.state.core.regions.find(region => region.id === first)!;
        expect([after.controller, after.diplomacyMarkerFaction, after.diplomacyMarkerSide])
            .not.toEqual([before.controller, before.diplomacyMarkerFaction, before.diplomacyMarkerSide]);
        expect(current().id).toBe('diplomacy-cycle');
        const second = options().find(option => option.id !== 'finish-diplomacy')!.id;
        expect(second).not.toBe(first);
        match.choose(second);
        expect(current().id).toBe('diplomacy-cycle');
        match.choose('finish-diplomacy');
        expect(current().content).toContain('diplomacy-menu-dynamic');

        for (const [index, count] of [2, 1].entries()) {
            match.choose('hire');
            expect(current().content).toContain('hire-payment-dynamic');
            const card = options()[0].id;
            expect(current().allowedTargets).toBeUndefined();
            match.choose(card);
            expect(current().content).toContain(index === 0 ? 'hire-target-first-dynamic' : 'hire-target-extra-dynamic');
            const regionId = options()[0].id;
            const troops = match.state.core.regions.find(region => region.id === regionId)!.troops;
            match.choose(regionId);
            expect(match.state.core.regions.find(region => region.id === regionId)!.troops).toBe(troops + count);
            expect(current().id).toBe('diplomacy-cycle');
        }
        match.choose('finish-slot');
        expect(match.state.sys.tutorial.step?.id).toBe('diplomacy-cycle');
        expect(getQidahenTurnResolutionFrame(match.state)?.metadata.qidahenTurn.step).toBe('finish-hand');
        match.choose('skip-hand');
        expect(match.state.sys.tutorial.step?.id).toBe('done');
    });

    it('允许直接雇佣和结束轮盘，真实输入不触发教程重置', () => {
        const match = reachDiplomacySlot();
        const dispatch = vi.fn();
        const menu = renderHook(() => useQidahenTurnInput(match.state, '0', dispatch, false));
        act(() => menu.result.current.choose('hire'));
        expect(dispatch).toHaveBeenCalledWith('SYS_INTERACTION_RESPOND', expect.objectContaining({ optionId: 'hire' }));
        expect(dispatch).not.toHaveBeenCalledWith('SYS_TUTORIAL_RESTART_STEP', expect.anything());
        menu.unmount();

        match.choose('hire');
        match.choose(getPromptOptions(match.state)[0].id);
        const regionId = getPromptOptions(match.state)[0].id;
        const map = renderHook(() => useQidahenTurnInput(match.state, '0', dispatch, false));
        act(() => map.result.current.toggle(regionId));
        act(() => map.result.current.confirm());
        expect(dispatch).toHaveBeenLastCalledWith('SYS_INTERACTION_RESPOND', expect.objectContaining({ optionId: regionId }));
        expect(dispatch.mock.calls.some(call => call[0] === 'SYS_TUTORIAL_RESTART_STEP')).toBe(false);
        map.unmount();
        match.choose(regionId);
        match.choose('finish-slot');
        match.choose('skip-hand');
        expect(match.state.sys.tutorial.step?.id).toBe('done');
    });

    it('选满三处外交后回到同一轮盘步骤，也可不雇佣直接结束', () => {
        const match = reachDiplomacySlot();
        match.choose('diplomacy');
        const chosen: string[] = [];
        for (let index = 0; index < 3; index++) {
            const region = getPromptOptions(match.state).find(option => option.id !== 'finish-diplomacy')!.id;
            expect(chosen).not.toContain(region);
            chosen.push(region);
            match.choose(region);
            expect(match.state.sys.tutorial.step?.id).toBe('diplomacy-cycle');
        }
        expect(getQidahenTurnResolutionFrame(match.state)?.metadata.qidahenTurn.step).toBe('menu');
        expect(match.state.sys.tutorial.step?.content).toContain('diplomacy-menu-dynamic');
        match.choose('finish-slot');
        match.choose('skip-hand');
        expect(match.state.sys.tutorial.step?.id).toBe('done');
    });
});
