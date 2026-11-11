import { act, fireEvent, render, renderHook } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { createInitialSystemState, executePipeline } from '../../../engine/pipeline';
import { getCurrentInteractionData, getCurrentInteractionSummary } from '../../../engine/testing/interactionTestFacade';
import type { MatchState, RandomFn } from '../../../engine/types';
import { engineConfig } from '../game';
import { QidahenDomain } from '../domain';
import type { QidahenCommand, QidahenCore } from '../domain/types';
import { QIDAHEN_ANNUAL_TUTORIAL } from '../annualTutorial';
import { buildQidahenTutorialSetupData } from '../tutorialSetup';
import { useQidahenTurnInput } from '../ui/useQidahenTurnInput';
import { QidahenHandActionControls } from '../ui/QidahenHandActionControls';
import { respondToPrompt } from './helpers/paymentSelectionHarness';

const players = ['0', '1', '2'];
const random: RandomFn = { random: () => .5, d: sides => sides, range: min => min, shuffle: cards => [...cards] };
function openingMenu() {
    let state: MatchState<QidahenCore> = { core: QidahenDomain.setup(players, random, buildQidahenTutorialSetupData('basic-opening')!.setupData), sys: createInitialSystemState(players, engineConfig.systems, 'tutorial-turn-input') };
    const sent: string[] = [];
    let promptResponseCount = 0;
    const respond = (playerId: string, args: { optionId?: string; optionIds?: string[]; mergedValue?: unknown }) => {
        state = respondToPrompt(state, playerId, args);
        promptResponseCount += 1;
    };
    const send = (type: string, payload: unknown = {}, playerId = '0', authored = false) => {
        if (payload && typeof payload === 'object' && 'interactionId' in payload) {
            respond(playerId, payload as { optionId?: string; optionIds?: string[]; mergedValue?: unknown });
            return;
        }
        const command = { type, payload, playerId, ...(authored ? { skipValidation: true } : {}) } as QidahenCommand;
        if (authored) expect(QidahenDomain.validate(state, command).valid).toBe(true);
        const result = executePipeline({ domain: QidahenDomain, systems: engineConfig.systems }, state, command, random, players);
        expect(result.success, result.error).toBe(true); state = result.state; sent.push(type);
    };
    send('SYS_TUTORIAL_START', { manifest: QIDAHEN_ANNUAL_TUTORIAL });
    for (const action of QIDAHEN_ANNUAL_TUTORIAL.steps[0].aiActions!) send(action.commandType, action.payload, action.playerId, true);
    send('SYS_TUTORIAL_AI_CONSUMED', { stepId: 'opening-opponents' });
    send('SYS_TUTORIAL_NEXT', { reason: 'manual' });
    send('SYS_TUTORIAL_NEXT', { reason: 'manual' });
    send('EXECUTE_WHEEL_MOVE', { moveId: 'move-1-free' });
    // 开垦、军屯现在由同一动态步骤承接，依正式交互完成示范行动。
    for (const target of ['military-farm', 'city-region-15', 'reclaim', 'city-region-15-liaodong']) {
        expect(state.sys.tutorial.step?.id).toBe('opening-farm-cycle');
        const interactionData = getCurrentInteractionData<{ multi?: unknown }>(state);
        respond('0', interactionData?.multi ? { optionIds: [target] } : { optionId: target });
    }
    expect(state.sys.tutorial.step?.id).toBe('opening-farm-cycle');
    return { get state() { return state; }, get promptResponseCount() { return promptResponseCount; }, sent, send };
}

describe('正式轮盘选择与教程示范恢复', () => {
    it('势力行动控件一次选择征召，进入同一正式支付事务', () => {
        const h = openingMenu();
        const responsesBefore = h.promptResponseCount;
        const hook = renderHook(() => useQidahenTurnInput(h.state, '0', h.send, false));
        const view = render(<QidahenHandActionControls input={hook.result.current} />);
        fireEvent.click(view.getByTestId('qidahen-action-recruit'));
        expect(h.promptResponseCount).toBe(responsesBefore + 1);
        expect(h.state.core.confirmedActionId).toBe('recruit');
        expect(h.state.sys.tutorial.step?.id).toBe('opening-farm-cycle');
    });
    it('银两不是通用行动入口；点击支付物不会进入另一套手牌模式', () => {
        const h = openingMenu(); h.send('SYS_TUTORIAL_CLOSE');
        const hook = renderHook(() => useQidahenTurnInput(h.state, '0', h.send, false));
        const count = h.sent.length;
        act(() => hook.result.current.chooseHandCard('hand-3'));
        expect(h.sent).toHaveLength(count);
        expect(h.state.core.confirmedActionId).toBeNull();
        expect(hook.result.current.handActionCardIds).not.toContain('hand-3');
    });
    it('本体入口一次提交真实选择，并进入手牌行动支付', () => {
        const h = openingMenu();
        const hook = renderHook(() => useQidahenTurnInput(h.state, '0', h.send, false));
        expect(hook.result.current.options.some(option => option.id === 'finish-slot')).toBe(true);
        const responsesBefore = h.promptResponseCount;
        act(() => hook.result.current.choose('hand-action:recruit')); hook.rerender();
        expect(h.promptResponseCount).toBe(responsesBefore + 1);
        expect(h.state.sys.tutorial.step?.id).toBe('opening-farm-cycle');
        expect(h.state.core.confirmedActionId).toBe('recruit');
    });
    it('退出教程后相同合法项执行真实落点收口，不再恢复教学检查点', () => {
        const h = openingMenu(); h.send('SYS_TUTORIAL_CLOSE');
        const hook = renderHook(() => useQidahenTurnInput(h.state, '0', h.send, false));
        act(() => hook.result.current.choose('finish-slot')); hook.rerender();
        expect(hook.result.current.step).toBe('finish-hand');
        expect(getCurrentInteractionSummary(h.state).id).toBeDefined();
        expect(getCurrentInteractionSummary(h.state).playerId).toBe('0');
        expect(h.state.sys.tutorial.active).toBe(false);
    });
    it('非操作者不能通过本体入口提交行动', () => {
        const h = openingMenu();
        const hook = renderHook(() => useQidahenTurnInput(h.state, '1', h.send, false));
        const count = h.sent.length;
        act(() => hook.result.current.choose('hand-action:recruit'));
        expect(h.sent).toHaveLength(count);
        expect(h.state.sys.tutorial.step?.id).toBe('opening-farm-cycle');
    });
});
