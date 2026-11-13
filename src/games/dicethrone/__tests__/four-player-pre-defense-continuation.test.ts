import { expect, it } from 'vitest';
import { createInitialSystemState, executePipeline } from '../../../engine/pipeline';
import type { MatchState, RandomFn } from '../../../engine/types';
import { DiceThroneDomain } from '../domain';
import { TOKEN_IDS } from '../domain/ids';
import { RESOURCE_IDS } from '../domain/resources';
import type { DiceThroneCommand, DiceThroneCore } from '../domain/types';
import { VENGEANCE_2 } from '../heroes/paladin/abilities';
import { createQueuedRandom, fixedRandom, testSystems } from './test-utils';

it('四人无默认防御者时，选择目标后才完成防御前效果并继续结算', () => {
    const players = ['0', '1', '2', '3'];
    const config = { domain: DiceThroneDomain, systems: testSystems };
    let state: MatchState<DiceThroneCore> = {
        core: DiceThroneDomain.setup(players, fixedRandom),
        sys: createInitialSystemState(players, testSystems, undefined),
    };
    const send = (type: string, playerId: string, payload: Record<string, unknown> = {}, random: RandomFn = fixedRandom) => {
        const result = executePipeline(config, state, { type, playerId, payload, timestamp: 100 } as DiceThroneCommand, random, players);
        expect(result.success, `${type}: ${result.error}`).toBe(true);
        state = result.state as MatchState<DiceThroneCore>;
    };
    for (const [index, characterId] of ['paladin', 'monk', 'treant', 'samurai'].entries()) {
        send('SELECT_CHARACTER', String(index), { characterId });
    }
    for (const playerId of players.slice(1)) send('PLAYER_READY', playerId);
    send('HOST_START_GAME', '0');
    for (const playerId of players) state.core.players[playerId].hand = [];
    state.core.players['0'].abilities = state.core.players['0'].abilities.map(ability => (
        ability.id === 'vengeance' ? structuredClone(VENGEANCE_2) : ability
    ));
    state.core.players['0'].abilityLevels.vengeance = 2;
    state.core.players['0'].resources[RESOURCE_IDS.CP] = 1;
    send('ADVANCE_PHASE', '0');
    send('ROLL_DICE', '0', {}, createQueuedRandom([3, 3, 3, 6, 1]));
    send('CONFIRM_ROLL', '0');
    send('SELECT_ABILITY', '0', { abilityId: 'vengeance-2-main' });
    send('ADVANCE_PHASE', '0');
    expect(state.sys.interaction.current?.playerId).toBe('0');
    expect(state.core.pendingAttack?.preDefenseResolved).not.toBe(true);
    send('RESOLVE_INTERACTION', '0', { selectedPlayerIds: ['2'] });
    expect(state.core.players['2'].tokens[TOKEN_IDS.RETRIBUTION]).toBe(1);
    expect(state.core.players['0'].resources[RESOURCE_IDS.CP]).toBe(5);
    expect(state.sys.interaction.current).toBeUndefined();
    expect(state.core.pendingAttack).toBeNull();
    expect(state.sys.phase).toBe('main2');
});
