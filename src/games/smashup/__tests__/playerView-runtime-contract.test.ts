import { describe, expect, it } from 'vitest';
import { applyPlayerViewToState } from '../../../engine/ai/playerView';
import type { GameEngineConfig } from '../../../engine/transport/engineConfig';
import type { MatchState } from '../../../engine/types';
import { SmashUpDomain } from '../domain';
import { normalizeSmashUpMatchStateForUi } from '../ui/normalizeRuntimeState';

const smashUpEngineConfig: GameEngineConfig = {
    gameId: 'smashup',
    domain: {
        gameId: 'smashup',
        setup: () => ({ turnOrder: ['0', '1'] }),
        normalizeRuntimeState: (state) => normalizeSmashUpMatchStateForUi(state),
        validate: () => ({ valid: true }),
        execute: () => [],
        reduce: (state) => state,
    },
    systems: [],
};

const smashUpPrivacyEngineConfig: GameEngineConfig = {
    gameId: 'smashup',
    domain: SmashUpDomain as any,
    systems: [],
};

describe('SmashUp player view runtime contract', () => {
    it('视图应先规范化 runtime-guard 脏态，避免把 null 数组和旧对象型 madnessDeck 继续下发', () => {
        const authoritativeState: MatchState<unknown> = {
            core: {
                activePlayerId: '0',
                currentPlayerIndex: 0,
                turnOrder: ['0', '1'],
                turnNumber: 3,
                nextUid: 5,
                players: {
                    '0': {
                        id: '0',
                        hand: [],
                        deck: [],
                        discard: [],
                        vp: 0,
                        minionsPlayed: 0,
                        minionLimit: 1,
                        actionsPlayed: 0,
                        actionLimit: 1,
                        pendingMinionPlayEffects: null,
                        usedDiscardPlayAbilities: null,
                    },
                    '1': {
                        id: '1',
                        hand: [],
                        deck: [],
                        discard: [],
                        vp: 0,
                        minionsPlayed: 0,
                        minionLimit: 1,
                        actionsPlayed: 0,
                        actionLimit: 1,
                    },
                },
                bases: [
                    {
                        defId: 'base_tortuga',
                        minions: [],
                        ongoingActions: [],
                        buriedCards: null,
                    },
                ],
                baseDeck: [],
                baseDiscard: [],
                madnessDeck: [
                    { uid: 'mad-1', defId: 'special_madness', type: 'action', owner: '0' },
                    { uid: 'mad-2', defId: 'special_madness', type: 'action', owner: '0' },
                ],
            },
            sys: {
                phase: 'playCards',
                turnNumber: 3,
                eventStream: { entries: [], nextId: 1 },
                interaction: { current: undefined, queue: [], isBlocked: false },
                responseWindow: { current: undefined },
            },
        } as MatchState<unknown>;

        const ownerView = applyPlayerViewToState(smashUpEngineConfig, authoritativeState, '0') as any;
        const spectatorView = applyPlayerViewToState(smashUpEngineConfig, authoritativeState, null) as any;

        expect(ownerView.core.players['0'].pendingMinionPlayEffects).toEqual([]);
        expect(ownerView.core.players['0'].usedDiscardPlayAbilities).toBeUndefined();
        expect(ownerView.core.bases[0].buriedCards).toEqual([]);
        expect(ownerView.core.madnessDeck).toEqual(['special_madness', 'special_madness']);

        expect(spectatorView.core.players['0'].pendingMinionPlayEffects).toEqual([]);
        expect(spectatorView.core.players['0'].usedDiscardPlayAbilities).toBeUndefined();
        expect(spectatorView.core.bases[0].buriedCards).toEqual([]);
        expect(spectatorView.core.madnessDeck).toEqual(['special_madness', 'special_madness']);
    });

    it('玩家视图浅合并后不应泄露对手手牌和牌库内容', () => {
        const authoritativeState: MatchState<unknown> = {
            core: {
                activePlayerId: '0',
                currentPlayerIndex: 0,
                turnOrder: ['0', '1'],
                turnNumber: 1,
                nextUid: 10,
                players: {
                    '0': {
                        id: '0',
                        hand: [{ uid: 'p0-hand-a', defId: 'pirate_first_mate', type: 'minion', owner: '0' }],
                        deck: [{ uid: 'p0-deck-a', defId: 'pirate_full_sail', type: 'action', owner: '0' }],
                        discard: [],
                        vp: 0,
                        minionsPlayed: 0,
                        minionLimit: 1,
                        actionsPlayed: 0,
                        actionLimit: 1,
                        factions: ['pirates', 'aliens'],
                    },
                    '1': {
                        id: '1',
                        hand: [{ uid: 'p1-secret-hand', defId: 'alien_probe', type: 'action', owner: '1' }],
                        deck: [{ uid: 'p1-secret-topdeck', defId: 'alien_invader', type: 'minion', owner: '1' }],
                        discard: [{ uid: 'p1-public-discard', defId: 'alien_scout', type: 'minion', owner: '1' }],
                        vp: 0,
                        minionsPlayed: 0,
                        minionLimit: 1,
                        actionsPlayed: 0,
                        actionLimit: 1,
                        factions: ['pirates', 'aliens'],
                    },
                },
                bases: [{ defId: 'base_tortuga', minions: [], ongoingActions: [] }],
                baseDeck: [],
                baseDiscard: [],
            },
            sys: {
                phase: 'playCards',
                turnNumber: 1,
                eventStream: { entries: [], nextId: 1 },
                interaction: { current: undefined, queue: [], isBlocked: false },
                responseWindow: { current: undefined },
            },
        } as MatchState<unknown>;

        const playerView = applyPlayerViewToState(smashUpPrivacyEngineConfig, authoritativeState, '0') as any;

        expect(playerView.core.players['0'].hand[0]).toEqual(expect.objectContaining({
            uid: 'p0-hand-a',
            defId: 'pirate_first_mate',
        }));
        expect(playerView.core.players['1'].hand).toEqual([
            expect.objectContaining({ uid: 'hidden_1_hand_0', defId: 'hidden_private_card' }),
        ]);
        expect(playerView.core.players['1'].deck).toEqual([
            expect.objectContaining({ uid: 'hidden_1_deck_0', defId: 'hidden_private_card' }),
        ]);
        expect(playerView.core.players['1'].discard[0]).toEqual(expect.objectContaining({
            uid: 'p1-public-discard',
            defId: 'alien_scout',
        }));
    });
});
