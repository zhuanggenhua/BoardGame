import { beforeAll, describe, expect, it } from 'vitest';
import { initAllAbilities } from '../../abilities';
import { getFactionTitans } from '../../data/cards';
import { SMASHUP_ATLAS_IDS, SMASHUP_FACTION_IDS } from '../../domain/ids';
import { fireTriggers } from '../../domain/ongoingEffects';
import { SU_COMMANDS, SU_EVENTS, type SmashUpCommand, type TitanState } from '../../domain/types';
import {
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
import { defaultTestRandom, runCommand } from '../testRunner';

describe('Tricksters POD titan', () => {
    beforeAll(() => {
        initAllAbilities();
    });

    it('uses the POD titan definition and English POD atlas for Big Funny Giant', () => {
        const titans = getFactionTitans(SMASHUP_FACTION_IDS.TRICKSTERS_POD);

        expect(titans.map(titan => titan.id)).toEqual(['tricksters_big_funny_giant_pod']);
        expect(titans[0]?.faction).toBe(SMASHUP_FACTION_IDS.TRICKSTERS_POD);
        expect(titans[0]?.previewRef).toEqual({
            type: 'atlas',
            atlasId: 'tts_atlas_8789f47742',
            index: 3,
        });
        expect(titans[0]?.previewRef).not.toEqual({
            type: 'atlas',
            atlasId: SMASHUP_ATLAS_IDS.TITANS,
            index: 17,
        });
        expect(titans[0]?.abilityTags).toEqual(['special', 'ongoing']);
    });

    it('can play the POD Big Funny Giant special from setaside without the original empty-base restriction', () => {
        const core = makeState({
            bases: [
                makeBase({
                    minions: [makeMinion('occupied-minion', 'ghosts_spectre', '1', 2)],
                }),
            ],
            titans: [{
                uid: 't-bfg-pod',
                defId: 'tricksters_big_funny_giant_pod',
                faction: SMASHUP_FACTION_IDS.TRICKSTERS_POD,
                ownerId: '0',
                controllerId: '0',
                powerCounters: 0,
                talentUsed: false,
                location: { zone: 'setaside' },
            } satisfies TitanState],
        });

        const result = runCommand(makeMatchState(core), {
            type: SU_COMMANDS.ACTIVATE_SPECIAL,
            playerId: '0',
            payload: { titanUid: 't-bfg-pod', baseIndex: 0 },
            timestamp: 100,
        } satisfies SmashUpCommand, defaultTestRandom);

        expect(result.success).toBe(true);
        expect(result.events.map(event => event.type)).toContain(SU_EVENTS.TITAN_PLAYED);
        expect(result.finalState.core.titans?.find(titan => titan.uid === 't-bfg-pod')?.location).toEqual({
            zone: 'base',
            baseIndex: 0,
            enteredAt: 100,
        });
    });

    it('does not block an opponent from playing their only minion there before the POD discard trigger', () => {
        const core = makeState({
            currentPlayerIndex: 1,
            players: {
                '0': makePlayer('0', { factions: [SMASHUP_FACTION_IDS.TRICKSTERS_POD, SMASHUP_FACTION_IDS.ALIENS] }),
                '1': makePlayer('1', {
                    hand: [makeCard('enemy-only-minion', 'ghosts_spectre', 'minion', '1')],
                }),
            },
            bases: [makeBase()],
            titans: [{
                uid: 't-bfg-pod',
                defId: 'tricksters_big_funny_giant_pod',
                faction: SMASHUP_FACTION_IDS.TRICKSTERS_POD,
                ownerId: '0',
                controllerId: '0',
                powerCounters: 0,
                talentUsed: false,
                location: { zone: 'base', baseIndex: 0, enteredAt: 1 },
            } satisfies TitanState],
        });

        const result = runCommand(makeMatchState(core), {
            type: SU_COMMANDS.PLAY_MINION,
            playerId: '1',
            payload: { cardUid: 'enemy-only-minion', baseIndex: 0, fromDiscard: false },
            timestamp: 101,
        } satisfies SmashUpCommand, defaultTestRandom);

        expect(result.success).toBe(true);
        expect(result.events.map(event => event.type)).not.toContain(SU_EVENTS.CARDS_DISCARDED);
        expect(result.finalState.core.bases[0].minions.map(minion => minion.uid)).toContain('enemy-only-minion');
    });

    it('runs the POD Big Funny Giant discard trigger when an opponent plays a minion there', () => {
        const core = makeState({
            currentPlayerIndex: 1,
            players: {
                '0': makePlayer('0', { factions: [SMASHUP_FACTION_IDS.TRICKSTERS_POD, SMASHUP_FACTION_IDS.ALIENS] }),
                '1': makePlayer('1', {
                    hand: [
                        makeCard('enemy-played-minion', 'ghosts_spectre', 'minion', '1'),
                        makeCard('enemy-discarded-card', 'ghosts_lantern_ghost', 'minion', '1'),
                    ],
                }),
            },
            bases: [makeBase()],
            titans: [{
                uid: 't-bfg-pod',
                defId: 'tricksters_big_funny_giant_pod',
                faction: SMASHUP_FACTION_IDS.TRICKSTERS_POD,
                ownerId: '0',
                controllerId: '0',
                powerCounters: 0,
                talentUsed: false,
                location: { zone: 'base', baseIndex: 0, enteredAt: 1 },
            } satisfies TitanState],
        });

        const result = runCommand(makeMatchState(core), {
            type: SU_COMMANDS.PLAY_MINION,
            playerId: '1',
            payload: { cardUid: 'enemy-played-minion', baseIndex: 0, fromDiscard: false },
            timestamp: 101,
        } satisfies SmashUpCommand, defaultTestRandom);

        expect(result.success).toBe(true);
        expect(result.events.map(event => event.type)).not.toContain(SU_EVENTS.CARDS_DISCARDED);
        const prompt = getSimpleChoicePrompt(result.finalState, 'titan_tricksters_big_funny_giant_discard_to_play');
        expect(prompt.autoResolveIfSingle).toBe(false);
        const discardOption = getPromptOption(prompt, option => option.value?.cardUid === 'enemy-discarded-card', 'Big Funny Giant discard option');
        const resolved = respondToPrompt(result.finalState, discardOption.id, '1', defaultTestRandom);

        expect(resolved.events.map(event => event.type)).toContain(SU_EVENTS.CARDS_DISCARDED);
        expect(resolved.finalState.core.players['1'].hand).toEqual([]);
        expect(resolved.finalState.core.players['1'].discard.map(card => card.uid)).toContain('enemy-discarded-card');
        expect(result.finalState.core.bases[0].minions.map(minion => minion.uid)).toContain('enemy-played-minion');
    });

    it('adds a counter at each other player turn end only when that player has no minion there', () => {
        const core = makeState({
            bases: [
                makeBase({
                    minions: [makeMinion('friendly-minion', 'trickster_gnome', '0', 2)],
                }),
            ],
            titans: [{
                uid: 't-bfg-pod',
                defId: 'tricksters_big_funny_giant_pod',
                faction: SMASHUP_FACTION_IDS.TRICKSTERS_POD,
                ownerId: '0',
                controllerId: '0',
                powerCounters: 0,
                talentUsed: false,
                location: { zone: 'base', baseIndex: 0, enteredAt: 1 },
            } satisfies TitanState],
        });

        const ownerTurnEnd = fireTriggers(core, 'onTurnEnd', {
            state: core,
            playerId: '0',
            random: defaultTestRandom,
            now: 103,
        });
        const opponentTurnEnd = fireTriggers(core, 'onTurnEnd', {
            state: core,
            playerId: '1',
            random: defaultTestRandom,
            now: 104,
        });
        const opponentPresent = fireTriggers({
            ...core,
            bases: [
                makeBase({
                    minions: [
                        makeMinion('friendly-minion', 'trickster_gnome', '0', 2),
                        makeMinion('enemy-minion', 'ghosts_spectre', '1', 2),
                    ],
                }),
            ],
        }, 'onTurnEnd', {
            state: {
                ...core,
                bases: [
                    makeBase({
                        minions: [
                            makeMinion('friendly-minion', 'trickster_gnome', '0', 2),
                            makeMinion('enemy-minion', 'ghosts_spectre', '1', 2),
                        ],
                    }),
                ],
            },
            playerId: '1',
            random: defaultTestRandom,
            now: 105,
        });

        expect(ownerTurnEnd.events).toEqual([]);
        expect(opponentTurnEnd.events.map(event => event.type)).toEqual([SU_EVENTS.TITAN_POWER_COUNTER_ADDED]);
        expect(opponentPresent.events).toEqual([]);
    });
});
