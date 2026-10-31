import { describe, expect, it } from 'vitest';
import { createInitialSystemState, executePipeline } from '../../../engine/pipeline';
import { createRespondToPromptCommand, getCurrentInteractionSummary } from '../../../engine/testing/interactionTestFacade';
import { TUTORIAL_COMMANDS } from '../../../engine/systems/TutorialSystem';
import type { MatchState, RandomFn } from '../../../engine/types';
import { QidahenDomain } from '../domain';
import { engineConfig } from '../game';
import { QIDAHEN_ANNUAL_TUTORIAL } from '../annualTutorial';
import { buildQidahenTutorialSetupData } from '../tutorialSetup';
import type { QidahenCommand, QidahenCore } from '../domain/types';

const players = ['0', '1', '2'];
const random: RandomFn = { random: () => 0.5, d: max => max, range: min => min, shuffle: cards => [...cards] };
function harness() {
    let state: MatchState<QidahenCore> = {
        core: QidahenDomain.setup(players, random, buildQidahenTutorialSetupData('basic-opening')!.setupData),
        sys: createInitialSystemState(players, engineConfig.systems, 'annual-lifecycle'),
    };
    const send = (type: string, payload: object = {}, playerId = '0', authored = false) => {
        const command = { type, payload, playerId, ...(authored ? { skipValidation: true } : {}) } as QidahenCommand;
        if (authored) expect(QidahenDomain.validate(state, command).valid).toBe(true);
        const result = executePipeline({ domain: QidahenDomain, systems: engineConfig.systems }, state, command, random, players);
        expect(result.success, JSON.stringify({ type, error: result.error })).toBe(true);
        state = result.state;
    };
    send(TUTORIAL_COMMANDS.START, { manifest: QIDAHEN_ANNUAL_TUTORIAL });
    for (const action of QIDAHEN_ANNUAL_TUTORIAL.steps[0].aiActions!) send(action.commandType, action.payload as object, action.playerId, true);
    send(TUTORIAL_COMMANDS.AI_CONSUMED, { stepId: 'opening-opponents' });
    send(TUTORIAL_COMMANDS.NEXT, { reason: 'manual' });
    return { get state() { return state; }, replace: (next: MatchState<QidahenCore>) => { state = next; }, send };
}

describe('连续年度教程生命周期', () => {
    it('序列化恢复并重新绑定当前manifest，保留同一正式回合与下一输入', () => {
        const h = harness();
        const before = h.state.core;
        h.replace(JSON.parse(JSON.stringify(h.state)));
        h.send(TUTORIAL_COMMANDS.BIND_MANIFEST, { manifest: QIDAHEN_ANNUAL_TUTORIAL });
        expect(h.state.sys.tutorial.step?.id).toBe('opening-move');
        expect(h.state.core).toEqual(before);
        h.send('EXECUTE_WHEEL_MOVE', { moveId: 'move-1-free' });
        expect(h.state.sys.tutorial.step?.id).toBe('prepare-hand');
        expect(getCurrentInteractionSummary(h.state).playerId).toBe('0');
    });
    it('回到移动前检查点后重做，移动和抽牌不会重复累加', () => {
        const h = harness();
        const before = h.state.core;
        h.send('EXECUTE_WHEEL_MOVE', { moveId: 'move-1-free' });
        h.send(TUTORIAL_COMMANDS.PREVIOUS);
        expect(h.state.sys.tutorial.step?.id).toBe('opening-move');
        expect(h.state.core).toEqual(before);
        h.send('EXECUTE_WHEEL_MOVE', { moveId: 'move-1-free' });
        expect(h.state.core.actionWheelPosition).toBe('wheel-military-farm');
        expect(h.state.core.factions.ming.handCount).toBe(3);
    });
    it('中途退出只清教程，保留正式待选事务并可继续结束轮盘/回合', () => {
        const h = harness();
        h.send('EXECUTE_WHEEL_MOVE', { moveId: 'move-1-free' });
        const before = h.state.core;
        h.send(TUTORIAL_COMMANDS.CLOSE);
        expect(h.state.sys.tutorial).toMatchObject({ active: false, step: null });
        expect(h.state.core).toEqual(before);
        const respond = (optionId: string) => {
            const prompt = getCurrentInteractionSummary(h.state);
            if (!prompt.playerId) throw new Error('Expected an active tutorial prompt');
            const command = createRespondToPromptCommand(h.state, { playerId: prompt.playerId, optionId });
            h.send(command.type, command.payload, command.playerId);
        };
        respond('hand-action');
        h.send('CANCEL_PREVIEW_ACTION');
        expect(h.state.core.factionActionUsed).toBe(false);
        expect(getCurrentInteractionSummary(h.state).id).toBeDefined();
        respond('finish-slot'); respond('skip-hand');
        expect(h.state.core.currentPlayer).toBe('1');
        expect(h.state.sys.resolution).toBeUndefined();
        h.send('EXECUTE_WHEEL_MOVE', { moveId: 'move-1-free' }, '1');
        expect(getCurrentInteractionSummary(h.state).playerId).toBe('1');
    });
});
