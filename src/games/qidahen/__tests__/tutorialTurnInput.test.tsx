import { act, renderHook } from '@testing-library/react';
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
    expect(state.sys.tutorial.step?.id).toBe('prepare-hand');
    return { get state() { return state; }, sent, send };
}

describe('正式轮盘选择与教程示范恢复', () => {
    it('显示并允许选择另一合法项，确认后恢复当前完整检查点，清除草稿且不支付或换课', () => {
        const h = openingMenu(); const before = h.state.core;
        const hook = renderHook(() => useQidahenTurnInput(h.state, '0', h.send, false));
        expect(hook.result.current.options.some(option => option.id === 'finish-slot')).toBe(true);
        act(() => hook.result.current.toggle('finish-slot'));
        expect(hook.result.current.canConfirm).toBe(true);
        act(() => hook.result.current.confirm()); hook.rerender();
        expect(h.sent.at(-1)).toBe('SYS_TUTORIAL_RESTART_STEP');
        expect(h.state.core).toEqual(before);
        expect(h.state.sys.tutorial.step?.id).toBe('prepare-hand');
        expect(hook.result.current.selectedIds).toEqual([]);
        act(() => hook.result.current.toggle('hand-action'));
        act(() => hook.result.current.confirm()); hook.rerender();
        expect(h.state.sys.tutorial.step?.id).toBe('recruit-action');
    });
    it('退出教程后相同合法项执行真实落点收口，不再恢复教学检查点', () => {
        const h = openingMenu(); h.send('SYS_TUTORIAL_CLOSE');
        const hook = renderHook(() => useQidahenTurnInput(h.state, '0', h.send, false));
        act(() => hook.result.current.toggle('finish-slot'));
        act(() => hook.result.current.confirm()); hook.rerender();
        expect(hook.result.current.step).toBe('finish-hand');
        expect(getCurrentInteractionSummary(h.state).id).toBeDefined();
        expect(getCurrentInteractionSummary(h.state).playerId).toBe('0');
        expect(h.state.sys.tutorial.active).toBe(false);
    });
});
