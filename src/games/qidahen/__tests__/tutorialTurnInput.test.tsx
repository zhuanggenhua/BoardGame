import { act, fireEvent, render, renderHook } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { createInitialSystemState, executePipeline } from '../../../engine/pipeline';
import { getCurrentInteractionSummary } from '../../../engine/testing/interactionTestFacade';
import type { MatchState, RandomFn } from '../../../engine/types';
import { engineConfig } from '../game';
import { QidahenDomain } from '../domain';
import type { QidahenCommand, QidahenCore } from '../domain/types';
import { QIDAHEN_ANNUAL_TUTORIAL } from '../annualTutorial';
import { buildQidahenTutorialSetupData } from '../tutorialSetup';
import { useQidahenTurnInput } from '../ui/useQidahenTurnInput';
import { QidahenHandActionControls } from '../ui/QidahenHandActionControls';

const players = ['0', '1', '2'];
const random: RandomFn = { random: () => .5, d: sides => sides, range: min => min, shuffle: cards => [...cards] };
function openingMenu() {
    let state: MatchState<QidahenCore> = { core: QidahenDomain.setup(players, random, buildQidahenTutorialSetupData('basic-opening')!.setupData), sys: createInitialSystemState(players, engineConfig.systems, 'tutorial-turn-input') };
    const sent: string[] = [];
    const send = (type: string, payload: unknown = {}, playerId = '0', authored = false) => {
        const command = { type, payload, playerId, ...(authored ? { skipValidation: true } : {}) } as QidahenCommand;
        if (authored) expect(QidahenDomain.validate(state, command).valid).toBe(true);
        const result = executePipeline({ domain: QidahenDomain, systems: engineConfig.systems }, state, command, random, players);
        expect(result.success, result.error).toBe(true); state = result.state; sent.push(type);
    };
    send('SYS_TUTORIAL_START', { manifest: QIDAHEN_ANNUAL_TUTORIAL });
    for (const action of QIDAHEN_ANNUAL_TUTORIAL.steps[0].aiActions!) send(action.commandType, action.payload, action.playerId, true);
    send('SYS_TUTORIAL_AI_CONSUMED', { stepId: 'opening-opponents' });
    send('SYS_TUTORIAL_NEXT', { reason: 'manual' });
    send('EXECUTE_WHEEL_MOVE', { moveId: 'move-1-free' });
    // 按当前合法课程先完成军屯与开垦，再到手牌入口；不把旧步骤位置当夹具。
    for (const expectedStep of ['farm-action', 'farm-target', 'reclaim-action', 'reclaim-target']) {
        expect(state.sys.tutorial.step?.id).toBe(expectedStep);
        const targets = state.sys.tutorial.step?.allowedTargets;
        expect(targets?.length).toBeGreaterThan(0);
        const interaction = state.sys.interaction!.current!;
        send('SYS_INTERACTION_RESPOND', { interactionId: interaction.id,
            ...((interaction.data as { multi?: unknown }).multi ? { optionIds: targets } : { optionId: targets![0] }) });
    }
    expect(state.sys.tutorial.step?.id).toBe('recruit-action');
    return { get state() { return state; }, sent, send };
}

describe('正式轮盘选择与教程示范恢复', () => {
    it('势力行动控件一次选择征召，进入同一正式支付事务', () => {
        const h = openingMenu();
        const hook = renderHook(() => useQidahenTurnInput(h.state, '0', h.send, false));
        const view = render(<QidahenHandActionControls input={hook.result.current} />);
        fireEvent.click(view.getByTestId('qidahen-action-recruit'));
        expect(h.sent.at(-1)).toBe('SYS_INTERACTION_RESPOND');
        expect(h.state.core.confirmedActionId).toBe('recruit');
        expect(h.state.sys.tutorial.step?.id).toBe('recruit-payment');
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
    it('本体入口一次提交真实选择；偏离示范恢复完整检查点，正确选择进入手牌行动', () => {
        const h = openingMenu(); const before = h.state.core;
        const hook = renderHook(() => useQidahenTurnInput(h.state, '0', h.send, false));
        expect(hook.result.current.options.some(option => option.id === 'finish-slot')).toBe(true);
        act(() => hook.result.current.choose('finish-slot')); hook.rerender();
        expect(h.sent.at(-1)).toBe('SYS_TUTORIAL_RESTART_STEP');
        expect(h.state.core).toEqual(before);
        expect(h.state.sys.tutorial.step?.id).toBe('recruit-action');
        expect(hook.result.current.selectedIds).toEqual([]);
        act(() => hook.result.current.choose('hand-action:recruit')); hook.rerender();
        expect(h.sent.at(-1)).toBe('SYS_INTERACTION_RESPOND');
        expect(h.state.sys.tutorial.step?.id).toBe('recruit-payment');
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
        expect(h.state.sys.tutorial.step?.id).toBe('recruit-action');
    });
});
