import { describe, expect, it } from 'vitest';

import { createInitialSystemState } from '../../pipeline';
import type { MatchState } from '../../types';
import { SummonerWarsDomain, SW_COMMANDS } from '../../../games/summonerwars/domain';
import type { SummonerWarsCore } from '../../../games/summonerwars/domain/types';
import { executeLocalDispatch } from '../localDispatchExecution';
import { createLocalProviderRandom } from '../localProviderBootstrap';

describe('executeLocalDispatch', () => {
    it('本地执行时应把座位控制者带入领域状态，玩家接管 AI 已选派系后释放 AI 座位', () => {
        const setupRandom = createLocalProviderRandom('local-dispatch-seat-controller-setup');
        const core = SummonerWarsDomain.setup(['0', '1'], setupRandom) as SummonerWarsCore;
        core.selectedFactions['1'] = 'necromancer';
        core.readyPlayers['1'] = true;
        const prevState: MatchState<SummonerWarsCore> = {
            core,
            sys: createInitialSystemState(['0', '1'], []),
        };
        const dispatchRandom = createLocalProviderRandom('local-dispatch-seat-controller-dispatch');

        const nextState = executeLocalDispatch({
            commandType: SW_COMMANDS.SELECT_FACTION,
            payload: { factionId: 'necromancer' },
            prevState: prevState as MatchState<unknown>,
            config: {
                gameId: 'summonerwars',
                domain: SummonerWarsDomain,
                systems: [],
                commandTypes: [],
            },
            seed: 'local-dispatch-seat-controller',
            random: dispatchRandom,
            setupPlayerIds: ['0', '1'],
            seatControllers: {
                '0': { type: 'human' },
                '1': { type: 'local-ai' },
            },
            localPregameControlledPlayerId: null,
            commandEffectsByToken: {},
        }) as MatchState<SummonerWarsCore>;

        expect(nextState.core.selectedFactions['0']).toBe('necromancer');
        expect(nextState.core.selectedFactions['1']).toBe('unselected');
        expect(nextState.core.readyPlayers['1']).toBe(false);
        expect(nextState.core.seatControllers?.['1']?.type).toBe('local-ai');
    });
});
