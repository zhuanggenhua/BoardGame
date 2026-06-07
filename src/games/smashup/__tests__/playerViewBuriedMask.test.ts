import { describe, expect, it } from 'vitest';
import { SmashUpDomain } from '../domain';
import { makeBase, makePlayer, makeState } from './helpers';

describe('playerView buried mask', () => {
    it('非控制者视角查看 borrowed buried card 时，不应把 trueOwnerId 改写成 controllerId', () => {
        const core = makeState({
            players: {
                '0': makePlayer('0'),
                '1': makePlayer('1'),
                '2': makePlayer('2'),
            },
            bases: [makeBase({
                defId: 'base_isis_swingin_pad',
                minions: [],
                ongoingActions: [],
                buriedCards: [{
                    uid: 'borrowed-buried-a',
                    defId: 'ancient_egyptians_lost_knowledge',
                    trueOwnerId: '1',
                    controllerId: '0',
                    buriedFrom: 'hand',
                } as any],
            })],
        });

        const view = SmashUpDomain.playerView(core, '2') as any;
        expect(view.bases?.[0]?.buriedCards?.[0]).toEqual(expect.objectContaining({
            uid: 'borrowed-buried-a',
            defId: 'buried_unknown',
            trueOwnerId: '1',
            controllerId: '0',
            buriedFrom: 'hand',
        }));
    });
});
