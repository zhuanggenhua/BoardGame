import { describe, it, expect, beforeAll } from 'vitest';
import { makeMinion, makeState, makePlayer, makeMatchState, makeCard } from './helpers';
import { initAllAbilities, resetAbilityInit } from '../abilities';
import { SU_EVENTS } from '../domain/types';
import { SU_COMMANDS } from '../domain/types';
import { killerPlantOvergrowthTrigger } from '../abilities/killer_plants';
import { getMinionPower } from '../domain/abilityHelpers';
import { getEffectiveBreakpoint } from '../domain/ongoingModifiers';
import { getMinionDef } from '../data/cards';
import { runCommand } from './testRunner';
import { SMASHUP_FACTION_IDS } from '../domain/ids';
import { reduce } from '../domain/reducer';

beforeAll(() => {
    resetAbilityInit();
    initAllAbilities();
});

describe('Killer Plants POD Card Logic Verification', () => {
    it('Overgrowth POD should reduce breakpoint to 0', () => {
        const overgrowth = { uid: 'og-1', defId: 'killer_plant_overgrowth_pod', ownerId: '0' };
        const base = {
            defId: 'base_ninja_dojo', // valid base with known breakpoint
            minions: [],
            ongoingActions: [overgrowth],
        } as any;
        // Mock getBaseDef to return 20 breakpoint
        const state = makeState({ bases: [base], turnOrder: ['0', '1'], currentPlayerIndex: 0 });

        const ctx: any = {
            state,
            playerId: '0',
            now: Date.now(),
        };

        const events = killerPlantOvergrowthTrigger(ctx);

        // Should have BREAKPOINT_MODIFIED event
        const bpEvent = events.find(e => e.type === SU_EVENTS.BREAKPOINT_MODIFIED) as any;
        expect(bpEvent).toBeDefined();
        // Since original is 20 (base_rhino/test_base?), we should see a reduction.
        // Let's apply it and check getEffectiveBreakpoint
        const newState = events.reduce((current, event) => reduce(current, event), state);
        expect(getEffectiveBreakpoint(newState, 0)).toBe(0);
    });

    it('Weed Eater POD should use the POD card data and no longer inherit the original onPlay debuff', () => {
        const weedEaterDef = getMinionDef('killer_plant_weed_eater_pod');
        expect(weedEaterDef?.power).toBe(3);
        expect(weedEaterDef?.abilityTags).toContain('ongoing');

        const core = makeState({
            currentPlayerIndex: 0,
            players: {
                '0': makePlayer('0', {
                    factions: [SMASHUP_FACTION_IDS.KILLER_PLANTS_POD, SMASHUP_FACTION_IDS.BEAR_CAVALRY_POD],
                    hand: [makeCard('we-card', 'killer_plant_weed_eater_pod', 'minion', '0')],
                }),
                '1': makePlayer('1'),
            },
        });
        const matchState = makeMatchState(core);

        const result = runCommand(matchState, {
            type: SU_COMMANDS.PLAY_MINION,
            playerId: '0',
            payload: { cardUid: 'we-card', baseIndex: 0 },
            timestamp: 1000,
        });

        expect(result.success).toBe(true);
        expect(result.events.some(event => event.type === SU_EVENTS.TEMP_POWER_ADDED)).toBe(false);

        const playedWeedEater = result.finalState.core.bases[0].minions.find(minion => minion.uid === 'we-card');
        expect(playedWeedEater).toBeDefined();
        expect(playedWeedEater?.basePower).toBe(3);
        expect(getMinionPower(result.finalState.core, playedWeedEater!, 0)).toBe(3);
    });

    it('Weed Eater POD should gain +2 power when its controller starts a turn', () => {
        const weedEater = makeMinion('we-1', 'killer_plant_weed_eater_pod', '0', 3);
        const base = {
            defId: 'base1',
            minions: [weedEater],
            ongoingActions: [],
        } as any;
        const core = makeState({
            bases: [base],
            currentPlayerIndex: 1,
            players: {
                '0': makePlayer('0', {
                    factions: [SMASHUP_FACTION_IDS.KILLER_PLANTS_POD, SMASHUP_FACTION_IDS.BEAR_CAVALRY_POD],
                }),
                '1': makePlayer('1'),
            },
        });
        const matchState = makeMatchState(core);
        matchState.sys.phase = 'endTurn';

        expect(getMinionPower(core, core.bases[0].minions[0], 0)).toBe(3);

        const result = runCommand(matchState, {
            type: 'ADVANCE_PHASE' as any,
            playerId: '1',
            payload: undefined,
            timestamp: 1001,
        });

        expect(result.success).toBe(true);
        expect(result.events.some(event => event.type === SU_EVENTS.MINION_METADATA_UPDATED)).toBe(true);

        const empowered = result.finalState.core.bases[0].minions.find(minion => minion.uid === 'we-1');
        expect(empowered).toBeDefined();
        expect((empowered?.metadata as any)?.weedEaterEmpowered).toBe(true);
        expect(getMinionPower(result.finalState.core, empowered!, 0)).toBe(5);
    });

    it('Sprout POD should still resolve the search if General Ivan makes it indestructible', () => {
        const base = {
            defId: 'base1',
            minions: [
                makeMinion('ivan-1', 'bear_cavalry_general_ivan_pod', '0', 5),
                makeMinion('sprout-1', 'killer_plant_sprout_pod', '0', 2),
            ],
            ongoingActions: [],
        } as any;
        const core = makeState({
            bases: [base],
            currentPlayerIndex: 1,
            players: {
                '0': makePlayer('0', {
                    factions: [SMASHUP_FACTION_IDS.KILLER_PLANTS_POD, SMASHUP_FACTION_IDS.BEAR_CAVALRY_POD],
                    deck: [makeCard('wl-1', 'killer_plant_water_lily_pod', 'minion', '0')],
                }),
                '1': makePlayer('1'),
            },
        });
        const matchState = makeMatchState(core);
        matchState.sys.phase = 'endTurn';

        const result = runCommand(matchState, {
            type: 'ADVANCE_PHASE' as any,
            playerId: '1',
            payload: undefined,
            timestamp: 1002,
        });

        expect(result.success).toBe(true);
        expect(result.events.some(event => event.type === SU_EVENTS.MINION_DESTROYED)).toBe(false);

        const minionUids = result.finalState.core.bases[0].minions.map(minion => minion.uid);
        expect(minionUids).toContain('sprout-1');
        expect(minionUids).toContain('wl-1');
    });

    it('Water Lily played by Sprout on the same start-turn window should draw immediately', () => {
        const base = {
            defId: 'base1',
            minions: [makeMinion('sprout-1', 'killer_plant_sprout_pod', '0', 2)],
            ongoingActions: [],
        } as any;
        const core = makeState({
            bases: [base],
            currentPlayerIndex: 1,
            players: {
                '0': makePlayer('0', {
                    factions: [SMASHUP_FACTION_IDS.KILLER_PLANTS_POD, SMASHUP_FACTION_IDS.BEAR_CAVALRY_POD],
                    deck: [
                        makeCard('wl-1', 'killer_plant_water_lily_pod', 'minion', '0'),
                        makeCard('bud-1', 'killer_plant_budding_pod', 'action', '0'),
                    ],
                }),
                '1': makePlayer('1'),
            },
        });
        const matchState = makeMatchState(core);
        matchState.sys.phase = 'endTurn';

        const result = runCommand(matchState, {
            type: 'ADVANCE_PHASE' as any,
            playerId: '1',
            payload: undefined,
            timestamp: 1003,
        });

        expect(result.success).toBe(true);
        const drawEvents = result.events.filter(event => event.type === SU_EVENTS.CARDS_DRAWN);
        expect(drawEvents).toHaveLength(2);
        expect((drawEvents[0] as any).payload.cardUids).toEqual(['wl-1']);
        expect((drawEvents[1] as any).payload.cardUids).toEqual(['bud-1']);

        const finalBaseMinionUids = result.finalState.core.bases[0].minions.map(minion => minion.uid);
        expect(finalBaseMinionUids).toContain('wl-1');
        expect(finalBaseMinionUids).not.toContain('sprout-1');
        expect(result.finalState.core.players['0'].hand.map(card => card.uid)).toEqual(['bud-1']);
        expect(result.finalState.core.players['0'].deck).toHaveLength(0);
    });
});
