import { describe, expect, it } from 'vitest';
import { SmashUpDomain } from '../domain';
import { makeBase, makeCard, makePlayer, makeState } from './helpers';

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

    it('玩家视角不应暴露对手手牌、牌库和暂存卡内容', () => {
        const ownHand = [makeCard('p0-hand-a', 'pirate_first_mate', 'minion', '0')];
        const ownDeck = [makeCard('p0-deck-a', 'pirate_full_sail', 'action', '0')];
        const opponentHand = [
            makeCard('p1-hand-a', 'alien_invader', 'minion', '1'),
            makeCard('p1-hand-b', 'alien_probe', 'action', '1'),
        ];
        const opponentDeck = [
            makeCard('p1-deck-top', 'alien_collector', 'minion', '1'),
            makeCard('p1-deck-next', 'alien_jammed_signal', 'action', '1'),
        ];
        const opponentStored = [{
            ...makeCard('p1-stored-a', 'time_travelers_time_loop', 'action', '1'),
            storedByPlayerId: '1',
            storedUnderUid: 'time-box-a',
            storedUnderDefId: 'time_travelers_time_box',
            reason: 'time_travelers_time_box',
        }];
        const opponentDiscard = [makeCard('p1-discard-a', 'alien_scout', 'minion', '1')];
        const core = makeState({
            players: {
                '0': makePlayer('0', { hand: ownHand, deck: ownDeck }),
                '1': makePlayer('1', {
                    hand: opponentHand,
                    deck: opponentDeck,
                    discard: opponentDiscard,
                    storedCards: opponentStored as any,
                }),
            },
        });

        const view = SmashUpDomain.playerView(core, '0') as any;

        expect(view.players['0'].hand).toEqual(ownHand);
        expect(view.players['0'].deck).toEqual(ownDeck);
        expect(view.players['1'].discard).toEqual(opponentDiscard);
        expect(view.players['1'].hand).toHaveLength(opponentHand.length);
        expect(view.players['1'].deck).toHaveLength(opponentDeck.length);
        expect(view.players['1'].storedCards).toHaveLength(opponentStored.length);
        expect(view.players['1'].hand.map((card: any) => card.defId)).toEqual([
            'hidden_private_card',
            'hidden_private_card',
        ]);
        expect(view.players['1'].deck.map((card: any) => card.defId)).toEqual([
            'hidden_private_card',
            'hidden_private_card',
        ]);
        expect(view.players['1'].storedCards[0]).toEqual(expect.objectContaining({
            uid: 'hidden_1_stored_0',
            defId: 'hidden_private_card',
            storedByPlayerId: '1',
            reason: 'hidden_private_card',
        }));
        expect(view.players['1'].hand.map((card: any) => card.uid)).not.toContain('p1-hand-a');
        expect(view.players['1'].deck.map((card: any) => card.uid)).not.toContain('p1-deck-top');
        expect(view.players['1'].storedCards[0].storedUnderDefId).toBeUndefined();
    });
});
