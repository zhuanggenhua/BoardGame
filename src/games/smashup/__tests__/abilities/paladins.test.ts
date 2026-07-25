import { beforeEach, describe, expect, it } from 'vitest';
import { initAllAbilities, resetAbilityInit } from '../../abilities';
import { interceptEvent } from '../../domain/ongoingEffects';
import { startSmashUpReactionSession } from '../../domain/reactionSession';
import { SU_COMMANDS, SU_EVENTS } from '../../domain/types';
import { SMASHUP_FACTION_IDS } from '../../domain/ids';
import {
    applyEvents,
    expectNoPrompt,
    getPromptOption,
    getSimpleChoicePrompt,
    makeBase,
    makeCard,
    makeMatchState,
    makeMinion,
    makePlayer,
    makeState,
    respondToPrompt,
} from '../helpers';
import { runCommand } from '../testRunner';

function makeSeraphim(ownerId = '0', zone: 'setaside' | 'base' = 'setaside', baseIndex = 0) {
    return {
        uid: `seraphim-${ownerId}`,
        defId: 'paladins_seraphim',
        faction: SMASHUP_FACTION_IDS.PALADINS,
        ownerId,
        controllerId: ownerId,
        powerCounters: 0,
        talentUsed: false,
        location: zone === 'base' ? { zone, baseIndex } as const : { zone } as const,
    };
}

describe('Paladins DIY faction playable behavior', () => {
    beforeEach(() => {
        resetAbilityInit();
        initAllAbilities();
    });

    it('Roland can play Seraphim here when his power is greater than 8', () => {
        const core = makeState({
            titans: [makeSeraphim('0')],
            bases: [makeBase('test_base', [
                makeMinion('roland', 'paladins_roland', '0', 5, { powerCounters: 4 }),
            ])],
        });

        const result = runCommand(makeMatchState(core), {
            type: SU_COMMANDS.USE_TALENT,
            playerId: '0',
            payload: { minionUid: 'roland', baseIndex: 0 },
        } as any);

        expect(result.success).toBe(true);
        const seraphim = result.finalState.core.titans?.find(titan => titan.defId === 'paladins_seraphim');
        expect(seraphim?.location).toMatchObject({ zone: 'base', baseIndex: 0 });
    });

    it('Devout Pastor draws then lets the player choose one hand card to discard when no own titan is here', () => {
        const core = makeState({
            players: {
                '0': makePlayer('0', {
                    hand: [makeCard('old-hand', 'alien_invader', 'minion', '0')],
                    deck: [makeCard('drawn', 'paladins_novice_knight', 'minion', '0')],
                }),
                '1': makePlayer('1'),
            },
            bases: [makeBase('test_base', [
                makeMinion('pastor', 'paladins_devout_pastor', '0', 4),
            ])],
        });

        const result = runCommand(makeMatchState(core), {
            type: SU_COMMANDS.USE_TALENT,
            playerId: '0',
            payload: { minionUid: 'pastor', baseIndex: 0 },
        } as any);

        expect(result.success).toBe(true);
        expect(result.finalState.core.players['0'].hand.map(card => card.uid)).toEqual(['old-hand', 'drawn']);
        expect(result.finalState.core.players['0'].discard.map(card => card.uid)).toEqual([]);

        const prompt = getSimpleChoicePrompt(result.finalState, 'paladins_devout_pastor_discard');
        const oldHandOption = getPromptOption(prompt, option => option.value?.cardUid === 'old-hand', 'old hand discard option');
        expect(getPromptOption(prompt, option => option.value?.cardUid === 'drawn', 'drawn card discard option')).toBeDefined();

        const resolved = respondToPrompt(result.finalState, oldHandOption.id, '0');
        expect(resolved.finalState.core.players['0'].hand.map(card => card.uid)).toEqual(['drawn']);
        expect(resolved.finalState.core.players['0'].discard.map(card => card.uid)).toEqual(['old-hand']);
        expectNoPrompt(resolved.finalState);

        const blocked = runCommand(makeMatchState({
            ...core,
            titans: [makeSeraphim('0', 'base', 0)],
        }), {
            type: SU_COMMANDS.USE_TALENT,
            playerId: '0',
            payload: { minionUid: 'pastor', baseIndex: 0 },
        } as any);
        expect(blocked.finalState.core.players['0'].deck.map(card => card.uid)).toContain('drawn');
    });

    it('Senior Mentor places a +1 counter on a minion here without counters', () => {
        const core = makeState({
            bases: [makeBase('test_base', [
                makeMinion('mentor', 'paladins_senior_mentor', '0', 2),
                makeMinion('target', 'alien_invader', '0', 3),
            ])],
        });

        const result = runCommand(makeMatchState(core), {
            type: SU_COMMANDS.USE_TALENT,
            playerId: '0',
            payload: { minionUid: 'mentor', baseIndex: 0 },
        } as any);
        const prompt = getSimpleChoicePrompt(result.finalState, 'paladins_senior_mentor');
        const option = getPromptOption(prompt, entry => entry.value?.minionUid === 'target', 'mentor target');
        const resolved = respondToPrompt(result.finalState, option.id, '0');

        expect(resolved.finalState.core.bases[0].minions.find(minion => minion.uid === 'target')?.powerCounters).toBe(1);
        expectNoPrompt(resolved.finalState);
    });

    it('Novice Knight gains a counter when another own minion here uses a talent', () => {
        const core = makeState({
            bases: [makeBase('test_base', [
                makeMinion('novice', 'paladins_novice_knight', '0', 2),
                makeMinion('pastor', 'paladins_devout_pastor', '0', 4),
            ])],
        });

        const result = runCommand(makeMatchState(core), {
            type: SU_COMMANDS.USE_TALENT,
            playerId: '0',
            payload: { minionUid: 'pastor', baseIndex: 0 },
        } as any);

        expect(result.finalState.core.bases[0].minions.find(minion => minion.uid === 'novice')?.powerCounters).toBe(1);
    });

    it('Durandal and Climb the Holy Stairs attached talents can play Seraphim', () => {
        const durandalCore = makeState({
            titans: [makeSeraphim('0')],
            bases: [makeBase('test_base', [
                makeMinion('host', 'paladins_novice_knight', '0', 2, {
                    attachedActions: [{ uid: 'durandal', defId: 'paladins_durandal', ownerId: '0' }],
                }),
            ])],
        });

        const durandal = runCommand(makeMatchState(durandalCore), {
            type: SU_COMMANDS.USE_TALENT,
            playerId: '0',
            payload: { ongoingCardUid: 'durandal', baseIndex: 0 },
        } as any);
        expect(durandal.finalState.core.titans?.find(titan => titan.uid === 'seraphim-0')?.location).toMatchObject({ zone: 'base', baseIndex: 0 });
        expect(durandal.finalState.core.titans?.find(titan => titan.uid === 'seraphim-0')?.powerCounters).toBe(1);

        const climbCore = makeState({
            players: { '0': makePlayer('0'), '1': makePlayer('1') },
            titans: [makeSeraphim('0')],
            bases: [makeBase('test_base', [
                makeMinion('host', 'paladins_novice_knight', '0', 2, {
                    powerCounters: 5,
                    attachedActions: [{ uid: 'stairs', defId: 'paladins_climb_the_holy_stairs', ownerId: '0' }],
                }),
            ])],
        });
        const climb = runCommand(makeMatchState(climbCore), {
            type: SU_COMMANDS.USE_TALENT,
            playerId: '0',
            payload: { ongoingCardUid: 'stairs', baseIndex: 0 },
        } as any);

        expect(climb.finalState.core.titans?.find(titan => titan.uid === 'seraphim-0')?.location).toMatchObject({ zone: 'base', baseIndex: 0 });
        expect(climb.finalState.core.titans?.find(titan => titan.uid === 'seraphim-0')?.powerCounters).toBe(1);
        expect(climb.finalState.core.bases[0].minions[0].attachedActions.map(action => action.uid)).not.toContain('stairs');
        expect(climb.finalState.core.players['0'].hand.map(card => card.uid)).toContain('stairs');
    });

    it('Seraphim draw can reshuffle discard when the deck is empty', () => {
        const core = makeState({
            players: {
                '0': makePlayer('0', {
                    discard: [
                        makeCard('discard-1', 'paladins_novice_knight', 'minion', '0'),
                        makeCard('discard-2', 'paladins_devout_pastor', 'minion', '0'),
                    ],
                }),
                '1': makePlayer('1'),
            },
            titans: [makeSeraphim('0')],
            bases: [makeBase('test_base', [
                makeMinion('roland', 'paladins_roland', '0', 5, { powerCounters: 4 }),
            ])],
        });

        const result = runCommand(makeMatchState(core), {
            type: SU_COMMANDS.USE_TALENT,
            playerId: '0',
            payload: { minionUid: 'roland', baseIndex: 0 },
        } as any);

        expect(result.success).toBe(true);
        expect(result.events.some(event => event.type === SU_EVENTS.DECK_RESHUFFLED)).toBe(true);
        expect(result.finalState.core.players['0'].hand.map(card => card.uid)).toEqual(expect.arrayContaining(['discard-1', 'discard-2']));
    });

    it('Seraphim draws two, gains counters, and prompts its controller to destroy a weak minion here', () => {
        const core = makeState({
            players: {
                '0': makePlayer('0', {
                    deck: [
                        makeCard('draw-1', 'paladins_novice_knight', 'minion', '0'),
                        makeCard('draw-2', 'paladins_devout_pastor', 'minion', '0'),
                    ],
                }),
                '1': makePlayer('1'),
            },
            titans: [makeSeraphim('0')],
            bases: [makeBase('test_base', [
                makeMinion('roland', 'paladins_roland', '0', 5, { powerCounters: 4 }),
                makeMinion('pastor', 'paladins_devout_pastor', '0', 4, { talentUsed: true }),
                makeMinion('enemy-low', 'alien_invader', '1', 3),
                makeMinion('enemy-choice', 'alien_invader', '1', 4),
            ])],
        });

        const result = runCommand(makeMatchState(core), {
            type: SU_COMMANDS.USE_TALENT,
            playerId: '0',
            payload: { minionUid: 'roland', baseIndex: 0 },
        } as any);

        expect(result.success).toBe(true);
        expect(result.finalState.core.players['0'].hand.map(card => card.uid)).toEqual(expect.arrayContaining(['draw-1', 'draw-2']));
        expect(result.finalState.core.titans?.find(titan => titan.uid === 'seraphim-0')?.powerCounters).toBe(2);
        expect(result.finalState.core.bases[0].minions.map(minion => minion.uid)).toEqual(expect.arrayContaining(['enemy-low', 'enemy-choice']));

        const prompt = getSimpleChoicePrompt(result.finalState, 'paladins_seraphim');
        const selected = getPromptOption(prompt, option => option.value?.minionUid === 'enemy-choice', 'seraphim destroy target');
        const resolved = respondToPrompt(result.finalState, selected.id, '0');

        expect(resolved.finalState.core.bases[0].minions.map(minion => minion.uid)).toContain('enemy-low');
        expect(resolved.finalState.core.bases[0].minions.map(minion => minion.uid)).not.toContain('enemy-choice');
        expectNoPrompt(resolved.finalState);
    });

    it('Seraphim removes itself at the end of its controller turn', () => {
        const core = makeState({
            players: { '0': makePlayer('0'), '1': makePlayer('1') },
            titans: [makeSeraphim('0', 'base', 0)],
            bases: [makeBase('test_base', [])],
        });
        const matchState = makeMatchState(core);
        matchState.sys.phase = 'endTurn';

        const result = runCommand(matchState, {
            type: 'ADVANCE_PHASE' as any,
            playerId: '0',
            payload: undefined,
        } as any);

        expect(result.events.some(event => event.type === SU_EVENTS.TITAN_REMOVED_FROM_PLAY)).toBe(true);
        expect(result.finalState.core.titans?.find(titan => titan.uid === 'seraphim-0')?.location.zone).toBe('setaside');
    });

    it("Knight's Duel destroys the loser and gives the winning own challenger a counter", () => {
        const core = makeState({
            players: {
                '0': makePlayer('0', { hand: [makeCard('duel-card', 'paladins_knights_duel', 'action', '0')] }),
                '1': makePlayer('1'),
            },
            bases: [makeBase('test_base', [
                makeMinion('ally', 'paladins_roland', '0', 5),
                makeMinion('enemy', 'alien_invader', '1', 3),
            ])],
        });

        const played = runCommand(makeMatchState(core), {
            type: SU_COMMANDS.PLAY_ACTION,
            playerId: '0',
            payload: { cardUid: 'duel-card', targetMinionUid: 'ally', targetBaseIndex: 0 },
        } as any);
        const targetPrompt = getSimpleChoicePrompt(played.finalState, 'paladins_knights_duel');
        const enemy = getPromptOption(targetPrompt, option => option.value?.minionUid === 'enemy', 'enemy duel target');
        const started = respondToPrompt(played.finalState, enemy.id, '0');
        const challengerCardPrompt = getSimpleChoicePrompt(started.finalState, 'smashup_duel_card');
        const skipChallenger = getPromptOption(challengerCardPrompt, option => option.value?.skip, 'challenger skip');
        const challengedPromptState = respondToPrompt(started.finalState, skipChallenger.id, '0').finalState;
        const challengedCardPrompt = getSimpleChoicePrompt(challengedPromptState, 'smashup_duel_card');
        const skipChallenged = getPromptOption(challengedCardPrompt, option => option.value?.skip, 'challenged skip');
        const resolved = respondToPrompt(challengedPromptState, skipChallenged.id, '1');

        expect(resolved.finalState.core.bases[0].minions.map(minion => minion.uid)).not.toContain('enemy');
        expect(resolved.finalState.core.bases[0].minions.find(minion => minion.uid === 'ally')?.powerCounters).toBe(1);
        expectNoPrompt(resolved.finalState);
    });

    it('Battle Cry and Holy Light Blessing apply temporary power buffs', () => {
        const battleCore = makeState({
            players: { '0': makePlayer('0', { hand: [makeCard('battle', 'paladins_battle_cry', 'action', '0')] }), '1': makePlayer('1') },
            bases: [makeBase('test_base', [
                makeMinion('fresh', 'paladins_novice_knight', '0', 2),
                makeMinion('used', 'paladins_devout_pastor', '0', 4, { talentUsed: true }),
                makeMinion('enemy', 'alien_invader', '1', 3),
            ])],
        });
        const battle = runCommand(makeMatchState(battleCore), {
            type: SU_COMMANDS.PLAY_ACTION,
            playerId: '0',
            payload: { cardUid: 'battle' },
        } as any);
        expect(battle.finalState.core.bases[0].minions.find(minion => minion.uid === 'fresh')?.tempPowerModifier).toBe(1);
        expect(battle.finalState.core.bases[0].minions.find(minion => minion.uid === 'used')?.tempPowerModifier).toBe(2);
        expect(battle.finalState.core.bases[0].minions.find(minion => minion.uid === 'enemy')?.tempPowerModifier ?? 0).toBe(0);

        const blessingCore = makeState({
            bases: [makeBase('test_base', [
                makeMinion('host', 'paladins_novice_knight', '0', 2, {
                    attachedActions: [{ uid: 'blessing', defId: 'paladins_holy_light_blessing', ownerId: '0' }],
                }),
            ])],
        });
        const blessing = runCommand(makeMatchState(blessingCore), {
            type: SU_COMMANDS.USE_TALENT,
            playerId: '0',
            payload: { ongoingCardUid: 'blessing', baseIndex: 0 },
        } as any);
        expect(blessing.finalState.core.bases[0].minions[0].tempPowerModifier).toBe(3);
    });

    it('Expel detaches an ongoing action and Spread the Oracle grants an extra action', () => {
        const expelCore = makeState({
            players: { '0': makePlayer('0', { hand: [makeCard('expel', 'paladins_expel', 'action', '0')] }), '1': makePlayer('1') },
            bases: [makeBase({
                defId: 'test_base',
                minions: [],
                ongoingActions: [{ uid: 'ongoing', defId: 'paladins_battle_cry', ownerId: '1' }],
            })],
        });
        const expel = runCommand(makeMatchState(expelCore), {
            type: SU_COMMANDS.PLAY_ACTION,
            playerId: '0',
            payload: { cardUid: 'expel' },
        } as any);
        expect(expel.finalState.core.bases[0].ongoingActions).toHaveLength(0);
        expect(expel.finalState.core.players['1'].discard.map(card => card.uid)).toContain('ongoing');

        const oracleCore = makeState({
            bases: [makeBase('test_base', [
                makeMinion('host', 'paladins_novice_knight', '0', 2, {
                    attachedActions: [{ uid: 'oracle', defId: 'paladins_spread_the_oracle', ownerId: '0' }],
                }),
            ])],
        });
        const oracle = runCommand(makeMatchState(oracleCore), {
            type: SU_COMMANDS.USE_TALENT,
            playerId: '0',
            payload: { ongoingCardUid: 'oracle', baseIndex: 0 },
        } as any);
        expect(oracle.finalState.core.players['0'].actionLimit).toBeGreaterThan(1);
    });

    it('Heavenly Soldiers Descend can play a minion at the scoring base and use a talent there', () => {
        const core = makeState({
            players: {
                '0': makePlayer('0', {
                    hand: [
                        makeCard('heavenly', 'paladins_heavenly_soldiers_descend', 'action', '0'),
                        makeCard('extra', 'paladins_senior_mentor', 'minion', '0'),
                    ],
                }),
                '1': makePlayer('1'),
            },
            bases: [makeBase('base_paladins_monastery', [
                makeMinion('target', 'alien_invader', '0', 3),
            ])],
            scoringEligibleBaseIndices: [0],
        });

        const stateWithPrompt = startSmashUpReactionSession(makeMatchState(core), {
            frameId: 'score-before:0:paladins',
            frameKind: 'score-before',
            phase: 'optional',
            activePlayerId: '0',
            currentPlayerId: '0',
            consecutivePasses: 0,
            sourceBaseIndex: 0,
            responseWindowType: 'meFirst',
        });
        stateWithPrompt.sys.phase = 'scoreBases';
        stateWithPrompt.sys.responseWindow = { ...(stateWithPrompt.sys.responseWindow ?? {}), current: undefined } as any;
        const special = runCommand(stateWithPrompt, {
            type: SU_COMMANDS.PLAY_ACTION,
            playerId: '0',
            payload: { cardUid: 'heavenly', targetBaseIndex: 0 },
        } as any);
        const playPrompt = getSimpleChoicePrompt(special.finalState, 'paladins_heavenly_soldiers_descend');
        const extra = getPromptOption(playPrompt, option => option.value?.cardUid === 'extra', 'extra minion');
        const played = respondToPrompt(special.finalState, extra.id, '0');
        expect(played.finalState.core.bases[0].minions.filter(minion => minion.uid === 'extra')).toHaveLength(1);
        const talentPrompt = getSimpleChoicePrompt(played.finalState, 'paladins_heavenly_soldiers_descend_talent');
        const mentor = getPromptOption(talentPrompt, option => option.value?.minionUid === 'extra', 'mentor talent');
        const talentChosen = respondToPrompt(played.finalState, mentor.id, '0');
        const mentorTargetPrompt = getSimpleChoicePrompt(talentChosen.finalState, 'paladins_senior_mentor');
        const targetOption = getPromptOption(mentorTargetPrompt, option => option.value?.minionUid === 'target', 'mentor target after heavenly soldiers');
        const resolved = respondToPrompt(talentChosen.finalState, targetOption.id, '0');

        expect(resolved.events).toContainEqual(
            expect.objectContaining({
                type: SU_EVENTS.POWER_COUNTER_ADDED,
                payload: expect.objectContaining({ minionUid: 'target', amount: 1 }),
            }),
        );
    });

    it('Paladin bases draw on titan play and award VP when a titan wins a clash here', () => {
        const monastery = makeState({
            players: {
                '0': makePlayer('0', { deck: [makeCard('drawn', 'paladins_novice_knight', 'minion', '0')] }),
                '1': makePlayer('1'),
            },
            titans: [makeSeraphim('0')],
            bases: [makeBase('base_paladins_monastery', [
                makeMinion('roland', 'paladins_roland', '0', 5, { powerCounters: 4 }),
            ])],
        });
        const played = runCommand(makeMatchState(monastery), {
            type: SU_COMMANDS.USE_TALENT,
            playerId: '0',
            payload: { minionUid: 'roland', baseIndex: 0 },
        } as any);
        expect(played.finalState.core.players['0'].hand.map(card => card.uid)).toContain('drawn');

        const monasteryReshuffle = makeState({
            players: {
                '0': makePlayer('0', {
                    discard: [makeCard('monastery-draw', 'paladins_senior_mentor', 'minion', '0')],
                }),
                '1': makePlayer('1'),
            },
            titans: [makeSeraphim('0')],
            bases: [makeBase('base_paladins_monastery', [
                makeMinion('roland', 'paladins_roland', '0', 5, { powerCounters: 4 }),
            ])],
        });
        const monasteryPlayedFromDiscard = runCommand(makeMatchState(monasteryReshuffle), {
            type: SU_COMMANDS.USE_TALENT,
            playerId: '0',
            payload: { minionUid: 'roland', baseIndex: 0 },
        } as any);
        expect(monasteryPlayedFromDiscard.success).toBe(true);
        expect(monasteryPlayedFromDiscard.finalState.core.players['0'].hand.map(card => card.uid)).toContain('monastery-draw');

        const gorge = makeState({
            players: { '0': makePlayer('0'), '1': makePlayer('1') },
            bases: [makeBase('base_paladins_roncesvalles_gorge', [])],
            titans: [
                makeSeraphim('0', 'base', 0),
                { ...makeSeraphim('1', 'base', 0), uid: 'enemy-titan', defId: 'cthulhu_great_old_one' },
            ],
        });
        const removedEvent = {
            type: SU_EVENTS.TITAN_REMOVED_FROM_PLAY,
            payload: {
                titanUid: 'enemy-titan',
                ownerId: '1',
                fromBaseIndex: 0,
                reason: 'titan_clash',
            },
            timestamp: 1000,
        } as any;
        const intercepted = interceptEvent(gorge, removedEvent);
        const resolved = applyEvents(gorge, Array.isArray(intercepted) ? intercepted : [intercepted ?? removedEvent]);
        expect(resolved.players['0'].vp).toBe(1);
    });
});
