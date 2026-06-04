import { describe, expect, it } from 'vitest';
import { executePipeline } from '../../../engine/pipeline';
import { SmashUpDomain } from '../domain';
import { SU_COMMANDS } from '../domain/types';
import { makeMatchState, makeState, makePlayer } from './helpers';
import { smashUpTestSystems, defaultTestRandom } from './testRunner';

describe('SmashUp runtime state normalization in pipeline', () => {
    it('命令进入 pipeline 前会先归一化旧 madnessDeck/null 运行时状态', () => {
        const initialState = makeMatchState(makeState({
            players: {
                '0': makePlayer('0', {
                    factions: ['minions_of_cthulhu', 'innsmouth'],
                    pendingMinionPlayEffects: null as any,
                    usedDiscardPlayAbilities: null as any,
                }),
                '1': makePlayer('1'),
            },
            bases: [{
                defId: 'base_tortuga',
                minions: [],
                ongoingActions: [],
                buriedCards: null as any,
            }],
            madnessDeck: [
                { uid: 'mad-1', defId: 'special_madness', type: 'action', owner: '0' } as any,
                { uid: 'mad-2', defId: 'special_madness', type: 'action', owner: '0' } as any,
            ] as any,
        }));

        const result = executePipeline(
            {
                domain: SmashUpDomain,
                systems: smashUpTestSystems,
            },
            initialState,
            {
                type: SU_COMMANDS.PLAY_ACTION,
                playerId: '0',
                payload: { cardUid: 'missing-action', baseIndex: 0 },
                timestamp: 1,
            } as any,
            defaultTestRandom,
            ['0', '1'],
        );

        expect(result.success).toBe(false);
        expect(result.state.core.players['0'].pendingMinionPlayEffects).toEqual([]);
        expect(result.state.core.players['0'].usedDiscardPlayAbilities).toBeUndefined();
        expect(result.state.core.bases[0].buriedCards).toEqual([]);
        expect(result.state.core.madnessDeck).toEqual([
            'special_madness',
            'special_madness',
        ]);
    });
});
