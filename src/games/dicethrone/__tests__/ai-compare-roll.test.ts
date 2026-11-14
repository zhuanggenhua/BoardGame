import { it, expect } from 'vitest';
import { executePipeline } from '../../../engine/pipeline';
import { DiceThroneDomain } from '../domain';
import { createHeroMatchup, createQueuedRandom, getCardById, testSystems } from './test-utils';
import { RESOURCE_IDS } from '../domain/resources';
import { buildDiceThroneAiLegalActions } from '../ai';

it('枪手防御骰响应关闭后比骰只启动一次', () => {
    const ids = ['0', '1'];
    const random = createQueuedRandom([1, 1, 1, 1, 1, 6, 1]);
    let state = createHeroMatchup('monk', 'gunslinger')(ids, random);
    let timestamp = 100;
    const send = (type: string, playerId: string, payload: Record<string, unknown> = {}) => {
        const result = executePipeline({ domain: DiceThroneDomain, systems: testSystems }, state,
            { type, playerId, payload, timestamp: timestamp++ } as any, random, ids);
        expect(result.success, `${type}: ${result.error}`).toBe(true);
        state = result.state;
        return result;
    };
    send('ADVANCE_PHASE', '0');
    send('ROLL_DICE', '0');
    send('CONFIRM_ROLL', '0');
    if (state.sys.responseWindow?.current) send('RESPONSE_PASS', '0');
    if (state.sys.responseWindow?.current) send('RESPONSE_PASS', '1');
    send('SELECT_ABILITY', '0', { abilityId: 'fist-technique-5' });
    send('ADVANCE_PHASE', '0');
    state.core.players['0'].hand = [getCardById('card-give-hand')];
    state.core.players['0'].resources[RESOURCE_IDS.CP] = 1;
    send('ROLL_DICE', '1');
    send('CONFIRM_ROLL', '1');
    expect(state.sys.responseWindow?.current).toBeTruthy();
    send('RESPONSE_PASS', '0');
    const result = send('ADVANCE_PHASE', '1');
    expect(result.events.filter(event => event.type === 'COMPARE_ROLL_REQUESTED')).toHaveLength(1);
    expect(state.core.currentRollContext?.kind).toBe('compare');
    const actions = buildDiceThroneAiLegalActions({ state, playerId: '1' });
    expect(actions.some(action => action.commands.some(c => c.type === 'CONFIRM_COMPARE_ROLL'))).toBe(true);
    expect(buildDiceThroneAiLegalActions({ state, playerId: '0' }).flatMap(action => action.commands)
        .some(command => command.type === 'CONFIRM_COMPARE_ROLL' || command.type === 'ADVANCE_PHASE')).toBe(false);
    send('CONFIRM_COMPARE_ROLL', '1');
    const choice = buildDiceThroneAiLegalActions({ state, playerId: '1' });
    expect(choice.length).toBeGreaterThan(0);
    const next = choice[0].commands[0];
    send(next.type, '1', next.payload as Record<string, unknown>);
    expect(state.core.pendingAttack).toBeNull();
    expect(state.sys.phase).toBe('main2');
});
