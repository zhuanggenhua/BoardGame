import { describe, it, expect, beforeAll } from 'vitest';
import { makeMinion, makeState, makePlayer, makeMatchState, makeCard } from './helpers';
import { initAllAbilities, resetAbilityInit } from '../abilities';
import { SU_EVENTS } from '../domain/types';
import { SU_COMMANDS } from '../domain/types';
import { killerPlantOvergrowthTrigger } from '../abilities/killer_plants';
import { getMinionPower } from '../domain/abilityHelpers';
import { getEffectiveBreakpoint } from '../domain/ongoingModifiers';
import { getCardDef, getMinionDef } from '../data/cards';
import { runCommand } from './testRunner';
import { SMASHUP_FACTION_IDS } from '../domain/ids';
import { reduce } from '../domain/reducer';

beforeAll(() => {
    resetAbilityInit();
    initAllAbilities();
});

describe('Killer Plants POD Card Logic Verification', () => {
    it('Killer Plants POD should use the POD action counts for Sleep Spores and Budding', () => {
        const sleepSporesDef = getCardDef('killer_plant_sleep_spores_pod');
        const buddingDef = getCardDef('killer_plant_budding_pod');

        expect(sleepSporesDef?.count).toBe(2);
        expect(buddingDef?.count).toBe(1);
    });

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

    it('???? playCards ??? Sprout POD ????? onTurnStart ??', () => {
        const core = makeState({
            currentPlayerIndex: 1,
            bases: [{ defId: 'base1', minions: [], ongoingActions: [] } as any],
            players: {
                '0': makePlayer('0', {
                    factions: [SMASHUP_FACTION_IDS.KILLER_PLANTS_POD, SMASHUP_FACTION_IDS.BEAR_CAVALRY_POD],
                    hand: [makeCard('sprout-hand', 'killer_plant_sprout_pod', 'minion', '0')],
                    deck: [makeCard('wl-1', 'killer_plant_water_lily_pod', 'minion', '0')],
                }),
                '1': makePlayer('1'),
            },
        });
        const matchState = makeMatchState(core);
        matchState.sys.phase = 'playCards';

        const turnResult = runCommand(matchState, {
            type: 'ADVANCE_PHASE' as any,
            playerId: '1',
            payload: undefined,
            timestamp: 1002,
        });

        expect(turnResult.success).toBe(true);
        expect(turnResult.finalState.sys.phase).toBe('playCards');
        expect((turnResult.finalState.sys as any)._smashupStartTurnWindowActive).toBeUndefined();

        const playResult = runCommand(turnResult.finalState, {
            type: SU_COMMANDS.PLAY_MINION,
            playerId: '0',
            payload: { cardUid: 'sprout-hand', baseIndex: 0 },
            timestamp: 1003,
        });

        expect(playResult.success).toBe(true);
        expect(playResult.events.some(event => event.type === SU_EVENTS.MINION_DESTROYED)).toBe(false);
        expect(playResult.events.some(event => event.type === SU_EVENTS.CARDS_DRAWN)).toBe(false);
        expect(playResult.finalState.sys.interaction.current).toBeUndefined();
        expect(playResult.finalState.core.bases[0].minions.map(minion => minion.uid)).toContain('sprout-hand');
    });

    it('???? playCards ?????????? Sprout POD ????? onTurnStart ??', () => {
        const core = makeState({
            currentPlayerIndex: 1,
            bases: [{ defId: 'base1', minions: [], ongoingActions: [] } as any],
            players: {
                '0': makePlayer('0', {
                    factions: [SMASHUP_FACTION_IDS.KILLER_PLANTS_POD, SMASHUP_FACTION_IDS.BEAR_CAVALRY_POD],
                    hand: [makeCard('venus-hand', 'killer_plant_venus_man_trap_pod', 'minion', '0')],
                    deck: [makeCard('sprout-deck', 'killer_plant_sprout_pod', 'minion', '0')],
                }),
                '1': makePlayer('1'),
            },
        });
        const matchState = makeMatchState(core);
        matchState.sys.phase = 'playCards';

        const turnResult = runCommand(matchState, {
            type: 'ADVANCE_PHASE' as any,
            playerId: '1',
            payload: undefined,
            timestamp: 1004,
        });

        expect(turnResult.success).toBe(true);
        expect(turnResult.finalState.sys.phase).toBe('playCards');
        expect((turnResult.finalState.sys as any)._smashupStartTurnWindowActive).toBeUndefined();

        const playVenusResult = runCommand(turnResult.finalState, {
            type: SU_COMMANDS.PLAY_MINION,
            playerId: '0',
            payload: { cardUid: 'venus-hand', baseIndex: 0 },
            timestamp: 1005,
        });

        expect(playVenusResult.success).toBe(true);

        const talentResult = runCommand(playVenusResult.finalState, {
            type: SU_COMMANDS.USE_TALENT,
            playerId: '0',
            payload: { minionUid: 'venus-hand', baseIndex: 0 },
            timestamp: 1006,
        });

        expect(talentResult.success).toBe(true);
        const drawEvents = talentResult.events.filter(event => event.type === SU_EVENTS.CARDS_DRAWN);
        expect(drawEvents).toHaveLength(1);
        expect((drawEvents[0] as any).payload.cardUids).toEqual(['sprout-deck']);
        expect(talentResult.events.some(event => event.type === SU_EVENTS.MINION_DESTROYED)).toBe(false);
        expect(talentResult.finalState.sys.interaction.current).toBeUndefined();
        const finalMinionUids = talentResult.finalState.core.bases[0].minions.map(minion => minion.uid);
        expect(finalMinionUids).toContain('venus-hand');
        expect(finalMinionUids).toContain('sprout-deck');
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

    it('Sprout 交互响应打出的 Water Lily 仍应在同一个 start-turn 窗口立即抽牌', () => {
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
                        makeCard('we-1', 'killer_plant_weed_eater_pod', 'minion', '0'),
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
            timestamp: 1004,
        });

        expect(result.success).toBe(true);
        expect(result.finalState.sys.phase).toBe('startTurn');
        const interaction = result.finalState.sys.interaction.current as any;
        expect(interaction?.data?.sourceId).toBe('killer_plant_sprout_search');

        const waterLilyOption = interaction.data.options.find((option: any) => option.value?.cardUid === 'wl-1');
        expect(waterLilyOption).toBeDefined();

        const respondResult = runCommand(result.finalState, {
            type: 'SYS_INTERACTION_RESPOND' as any,
            playerId: '0',
            payload: { optionId: waterLilyOption.id },
            timestamp: 1005,
        });

        expect(respondResult.success).toBe(true);
        const drawEvents = respondResult.events.filter(event => event.type === SU_EVENTS.CARDS_DRAWN);
        const drawUids = drawEvents.flatMap(event => (event as any).payload.cardUids ?? []);
        expect(drawUids).toEqual(expect.arrayContaining(['wl-1', 'we-1']));
        expect(respondResult.finalState.core.players['0'].hand.map(card => card.uid)).toContain('we-1');
    });

    it('Sprout 连锁打出另一个 Sprout 时，阶段应保持在 startTurn 直到整条链结束', () => {
        const base = {
            defId: 'base_ninja_dojo',
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
                        makeCard('sprout-2', 'killer_plant_sprout_pod', 'minion', '0'),
                        makeCard('sprout-3', 'killer_plant_sprout_pod', 'minion', '0'),
                        makeCard('wl-1', 'killer_plant_water_lily_pod', 'minion', '0'),
                    ],
                }),
                '1': makePlayer('1'),
            },
        });
        const matchState = makeMatchState(core);
        matchState.sys.phase = 'endTurn';

        const startTurnResult = runCommand(matchState, {
            type: 'ADVANCE_PHASE' as any,
            playerId: '1',
            payload: undefined,
            timestamp: 1100,
        });

        expect(startTurnResult.success).toBe(true);
        expect(startTurnResult.finalState.sys.phase).toBe('startTurn');
        expect(startTurnResult.finalState.sys.interaction.current?.data?.sourceId).toBe('killer_plant_sprout_search');

        const firstInteraction = startTurnResult.finalState.sys.interaction.current as any;
        const sproutOption = firstInteraction.data.options.find((option: any) => option.value?.cardUid === 'sprout-2');
        expect(sproutOption).toBeDefined();

        const firstRespondResult = runCommand(startTurnResult.finalState, {
            type: 'SYS_INTERACTION_RESPOND' as any,
            playerId: '0',
            payload: { optionId: sproutOption.id },
            timestamp: 1101,
        });

        expect(firstRespondResult.success).toBe(true);
        expect(firstRespondResult.finalState.sys.phase).toBe('startTurn');
        expect(firstRespondResult.finalState.sys.interaction.current?.data?.sourceId).toBe('killer_plant_sprout_search');

        const secondInteraction = firstRespondResult.finalState.sys.interaction.current as any;
        const waterLilyOption = secondInteraction.data.options.find((option: any) => option.value?.cardUid === 'wl-1');
        expect(waterLilyOption).toBeDefined();

        const secondRespondResult = runCommand(firstRespondResult.finalState, {
            type: 'SYS_INTERACTION_RESPOND' as any,
            playerId: '0',
            payload: { optionId: waterLilyOption.id },
            timestamp: 1102,
        });

        expect(secondRespondResult.success).toBe(true);
        expect(secondRespondResult.finalState.sys.phase).toBe('playCards');
        expect(secondRespondResult.finalState.sys.interaction.current).toBeUndefined();
        expect(secondRespondResult.finalState.core.bases[0].minions.map(minion => minion.uid)).toEqual(['wl-1']);
    });

    it('爆破点降到 0 后进入计分阶段，只应产生一次 BASE_SCORED', () => {
        const core = makeState({
            tempBreakpointModifiers: { 0: -999 },
            bases: [{
                defId: 'base_the_jungle',
                minions: [makeMinion('m1', 'killer_plant_weed_eater_pod', '0', 3)],
                ongoingActions: [],
            } as any],
            players: {
                '0': makePlayer('0', {
                    factions: [SMASHUP_FACTION_IDS.KILLER_PLANTS_POD, SMASHUP_FACTION_IDS.BEAR_CAVALRY_POD],
                }),
                '1': makePlayer('1'),
            },
        });
        const matchState = makeMatchState(core);
        matchState.sys.phase = 'playCards';

        const result = runCommand(matchState, {
            type: 'ADVANCE_PHASE' as any,
            playerId: '0',
            payload: undefined,
            timestamp: 1200,
        });

        expect(result.success).toBe(true);
        expect(result.events.filter(event => event.type === SU_EVENTS.BASE_SCORED)).toHaveLength(1);
        expect(result.events.filter(event => event.type === SU_EVENTS.BASE_CLEARED)).toHaveLength(1);
    });
});
