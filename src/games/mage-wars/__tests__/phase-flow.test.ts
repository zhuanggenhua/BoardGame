import { describe, expect, it } from 'vitest';
import { FLOW_COMMANDS } from '../../../engine/systems/FlowSystem';
import type { MatchState } from '../../../engine/types';
import { MAGE_WARS_COMMANDS } from '../domain';
import { getFormalArenaZonesFromConfig } from '../data/configPackage';
import { MAGE_WARS_EVENTS } from '../domain/events';
import { ARENA_ZONE_IDS, STATUS_TOKEN_IDS } from '../domain/ids';
import type { MageWarsCore } from '../domain/types';
import {
    actionLogKinds,
    beastmasterSpellIds,
    makeArenaObject,
    planCommand,
    PLAYER_ONE_START_ZONE,
    PLAYER_ZERO_START_ZONE,
    runCommand,
    setupState,
    validateCommand,
    withArenaObject,
} from './helpers/domainFlowHarness';

describe('mage-wars setup and phase flow', () => {
    it('sets up mages in config-backed formal 4x3 diagonal starting zones', () => {
        const state = setupState();

        expect(PLAYER_ZERO_START_ZONE).toBe(ARENA_ZONE_IDS.A3);
        expect(PLAYER_ONE_START_ZONE).toBe(ARENA_ZONE_IDS.D1);
        expect(state.core.players['0'].mageZoneId).toBe(PLAYER_ZERO_START_ZONE);
        expect(state.core.players['1'].mageZoneId).toBe(PLAYER_ONE_START_ZONE);
        expect(state.core.arena.find((zone) => zone.id === PLAYER_ZERO_START_ZONE)?.occupantIds).toEqual(['0']);
        expect(state.core.arena.find((zone) => zone.id === PLAYER_ONE_START_ZONE)?.occupantIds).toEqual(['1']);
        expect(state.core.arena.filter((zone) => zone.occupantIds.length > 0)).toHaveLength(2);
        expect(state.core.arena.map(({ id, row, col }) => ({ id, row, col }))).toEqual(
            getFormalArenaZonesFromConfig().map(({ zoneId, rowIndex, colIndex }) => ({
                id: zoneId,
                row: rowIndex,
                col: colIndex,
            })),
        );
    });

    it('plans at most two spellbook cards for the current mage', () => {
        const state = setupState('planning');
        const spellIds = beastmasterSpellIds();

        const planned = runCommand(state, planCommand(spellIds.slice(0, 2)));

        expect(planned.success).toBe(true);
        expect(planned.state.core.players['0'].preparedSpellCardIds).toEqual(spellIds.slice(0, 2));
        expect(planned.state.core.players['0'].preparedSpellSlots).toBe(2);
        expect(planned.events.map((event) => event.type)).toContain(MAGE_WARS_EVENTS.SPELLS_PLANNED);
        expect(planned.state.sys.undo.snapshots).toHaveLength(1);
        expect(actionLogKinds(planned.state)).toContain(MAGE_WARS_EVENTS.SPELLS_PLANNED);
        expect(planned.state.sys.actionLog.entries[0]?.segments).toEqual(expect.arrayContaining([
            expect.objectContaining({ type: 'card', cardId: String(spellIds[0]) }),
            expect.objectContaining({ type: 'card', cardId: String(spellIds[1]) }),
        ]));

        const duplicateWall = runCommand(state, planCommand([25700, 25700]));
        expect(duplicateWall.success).toBe(true);
        expect(duplicateWall.state.core.players['0'].preparedSpellCardIds).toEqual([25700, 25700]);

        expect(validateCommand(state, planCommand(spellIds.slice(0, 3)))).toBe('tooManyPreparedSpells');
        expect(validateCommand(state, planCommand([3725, 3725]))).toBe('tooManyPreparedSpellCopies');
        expect(validateCommand(state, planCommand([999999]))).toBe('spellNotInPresetSpellbook');
        expect(validateCommand(state, {
            type: MAGE_WARS_COMMANDS.PLAN_SPELLS,
            playerId: '1',
            payload: { spellCardIds: [25700] },
        })).toBe('spellNotInPresetSpellbook');
    });

    it('channels mana on channel phase entry and advances turn after final quickcast', () => {
        const baseState = setupState();
        const playerZeroChannelSource = makeArenaObject('flow-channel-source-0', '0', PLAYER_ZERO_START_ZONE, {
            kind: 'conjuration',
            mana: 1,
            spellcastingSource: {
                abilityId: 'test-channel-source-0',
                channeling: 2,
            },
        });
        const playerOneChannelSource = makeArenaObject('flow-channel-source-1', '1', PLAYER_ONE_START_ZONE, {
            kind: 'conjuration',
            mana: 3,
            spellcastingSource: {
                abilityId: 'test-channel-source-1',
                channeling: 4,
            },
        });
        const resetState: MatchState<MageWarsCore> = {
            ...baseState,
            core: withArenaObject(
                withArenaObject(baseState.core, playerZeroChannelSource),
                playerOneChannelSource,
            ),
        };
        const manaBeforeZero = resetState.core.players['0'].mana;
        const manaBeforeOne = resetState.core.players['1'].mana;
        const channelingZero = resetState.core.players['0'].channeling;
        const channelingOne = resetState.core.players['1'].channeling;

        const channelResult = runCommand(resetState, {
            type: FLOW_COMMANDS.ADVANCE_PHASE,
            playerId: '0',
            payload: {},
        });

        expect(channelResult.success).toBe(true);
        // reset、channel 和无交互 upkeep 由正式流程自动推进，玩家首次决策点是 planning。
        expect(channelResult.state.sys.phase).toBe('planning');
        expect(channelResult.state.core.players['0'].mana).toBe(manaBeforeZero + channelingZero);
        expect(channelResult.state.core.players['1'].mana).toBe(manaBeforeOne + channelingOne);
        expect(channelResult.state.core.objects[playerZeroChannelSource.id].mana).toBe(3);
        expect(channelResult.state.core.objects[playerOneChannelSource.id].mana).toBe(7);
        expect(channelResult.events).toEqual(expect.arrayContaining([
            expect.objectContaining({
                type: MAGE_WARS_EVENTS.MANA_CHANNELED,
                payload: expect.objectContaining({ playerId: '0', amount: channelingZero }),
            }),
            expect.objectContaining({
                type: MAGE_WARS_EVENTS.MANA_CHANNELED,
                payload: expect.objectContaining({ playerId: '1', amount: channelingOne }),
            }),
            expect.objectContaining({
                type: MAGE_WARS_EVENTS.OBJECT_MANA_CHANNELED,
                payload: expect.objectContaining({ ownerId: '0', objectId: playerZeroChannelSource.id, amount: 2 }),
            }),
            expect.objectContaining({
                type: MAGE_WARS_EVENTS.OBJECT_MANA_CHANNELED,
                payload: expect.objectContaining({ ownerId: '1', objectId: playerOneChannelSource.id, amount: 4 }),
            }),
        ]));
        expect(channelResult.events.map((event) => event.type)).toEqual(expect.arrayContaining([
            'SYS_PHASE_CHANGED',
            MAGE_WARS_EVENTS.MANA_CHANNELED,
            MAGE_WARS_EVENTS.OBJECT_MANA_CHANNELED,
        ]));
        expect(actionLogKinds(channelResult.state)).toEqual(expect.arrayContaining([
            'SYS_PHASE_CHANGED',
            MAGE_WARS_EVENTS.MANA_CHANNELED,
        ]));

        const playerZeroResetCreature = makeArenaObject('flow-reset-creature-0', '0', PLAYER_ZERO_START_ZONE, {
            actionReady: false,
            guarding: true,
        });
        const playerOneResetCreature = makeArenaObject('flow-reset-creature-1', '1', PLAYER_ONE_START_ZONE, {
            actionReady: false,
            guarding: true,
        });
        const finalQuickcastState: MatchState<MageWarsCore> = {
            core: {
                ...withArenaObject(
                    withArenaObject(channelResult.state.core, playerZeroResetCreature),
                    playerOneResetCreature,
                ),
                players: {
                    ...channelResult.state.core.players,
                    '0': {
                        ...channelResult.state.core.players['0'],
                        actionReady: false,
                        quickcastReady: false,
                        guarding: true,
                    },
                    '1': {
                        ...channelResult.state.core.players['1'],
                        actionReady: false,
                        quickcastReady: false,
                        guarding: true,
                    },
                },
            },
            sys: { ...channelResult.state.sys, phase: 'finalQuickcast' },
        };

        const nextTurn = runCommand(finalQuickcastState, {
            type: FLOW_COMMANDS.ADVANCE_PHASE,
            playerId: '0',
            payload: {},
        });

        expect(nextTurn.success).toBe(true);
        expect(nextTurn.state.sys.phase).toBe('planning');
        expect(nextTurn.state.core.currentPlayerId).toBe('1');
        expect(nextTurn.state.core.phaseActorId).toBe('1');
        expect(nextTurn.state.core.turnNumber).toBe(2);
        expect(nextTurn.state.core.players['0']).toMatchObject({
            actionReady: true,
            quickcastReady: true,
            guarding: false,
        });
        expect(nextTurn.state.core.players['1']).toMatchObject({
            actionReady: true,
            quickcastReady: true,
            guarding: false,
        });
        expect(nextTurn.state.core.objects[playerZeroResetCreature.id]).toMatchObject({
            actionReady: true,
            guarding: false,
        });
        expect(nextTurn.state.core.objects[playerOneResetCreature.id]).toMatchObject({
            actionReady: true,
            guarding: false,
        });
        expect(nextTurn.events.map((event) => event.type)).toEqual(expect.arrayContaining([
            MAGE_WARS_EVENTS.TURN_ADVANCED,
            MAGE_WARS_EVENTS.ACTION_READINESS_RESET,
        ]));
        expect(nextTurn.events).toEqual(expect.arrayContaining([
            expect.objectContaining({
                type: MAGE_WARS_EVENTS.ACTION_READINESS_RESET,
                payload: expect.objectContaining({
                    playerId: '0',
                    objectIds: [playerZeroResetCreature.id],
                }),
            }),
            expect.objectContaining({
                type: MAGE_WARS_EVENTS.ACTION_READINESS_RESET,
                payload: expect.objectContaining({
                    playerId: '1',
                    objectIds: [playerOneResetCreature.id],
                }),
            }),
        ]));
        expect(actionLogKinds(nextTurn.state)).toEqual(expect.arrayContaining([
            MAGE_WARS_EVENTS.TURN_ADVANCED,
            MAGE_WARS_EVENTS.ACTION_READINESS_RESET,
        ]));
    });

    it('rejects Rouse the Beast on a creature summoned in the previous round after initiative changes', () => {
        const base = setupState('finalQuickcast');
        const wolf = makeArenaObject('previous-round-wolf', '0', PLAYER_ZERO_START_ZONE, {
            sourceSpellCardId: 2819,
            name: '丛林灰狼',
            summonedTurnNumber: base.core.turnNumber,
            actionReady: false,
        });
        let state = { ...base, core: withArenaObject(base.core, wolf) };
        const advance = (playerId: string) => {
            const result = runCommand(state, { type: FLOW_COMMANDS.ADVANCE_PHASE, playerId, payload: {} });
            expect(result.success).toBe(true);
            state = result.state;
        };
        advance('0');
        expect(state.sys.phase).toBe('planning');
        for (const command of [planCommand([3403], '0'), planCommand([], '1')]) {
            const result = runCommand(state, command);
            expect(result.success).toBe(true);
            state = result.state;
        }
        advance('1');
        advance('0');
        expect(state.sys.phase).toBe('initiativeQuickcast');
        advance('1');
        const manaBefore = state.core.players['0'].mana;
        const result = runCommand(state, {
            type: MAGE_WARS_COMMANDS.CAST_SPELL,
            playerId: '0',
            payload: { spellCardId: 3403, manaCost: 2, targetObjectId: wolf.id },
        });
        expect(result.success).toBe(false);
        expect(validateCommand(state, {
            type: MAGE_WARS_COMMANDS.CAST_SPELL,
            playerId: '0',
            payload: { spellCardId: 3403, manaCost: 2, targetObjectId: wolf.id },
        })).toBe('targetNotSummonedThisTurn');
        expect(result.state.core.players['0'].mana).toBe(manaBefore);
    });

    it('allows a mage to cast a quick spell in quickcast but not during spawn-point deployment', () => {
        let state = setupState('planning');
        for (const command of [planCommand([25700], '0'), planCommand([], '1')]) {
            const result = runCommand(state, command);
            expect(result.success).toBe(true);
            state = result.state;
        }
        expect(state.sys.phase).toBe('deployment');
        const cast = {
            type: MAGE_WARS_COMMANDS.CAST_SPELL,
            playerId: '0',
            payload: { spellCardId: 25700, manaCost: 5, targetWallEdgeId: 'a3-b3' },
        } as const;
        const mana = state.core.players['0'].mana;
        const denied = runCommand(state, cast);
        expect(denied.success).toBe(false);
        expect(denied.error).toBe('wrongPhase');
        expect(denied.state.core.players['0'].mana).toBe(mana);
        expect(denied.state.core.walls['a3-b3']).toBeUndefined();
        for (const playerId of ['0', '1']) {
            const result = runCommand(state, { type: FLOW_COMMANDS.ADVANCE_PHASE, playerId, payload: {} });
            expect(result.success).toBe(true);
            state = result.state;
        }
        expect(state.sys.phase).toBe('initiativeQuickcast');
        const allowed = runCommand(state, cast);
        expect(allowed.success).toBe(true);
        expect(allowed.state.core.players['0'].mana).toBe(mana - 5);
        expect(allowed.state.core.walls['a3-b3']?.sourceSpellCardId).toBe(25700);
    });

    it('keeps alternating creature actions until both mages and their creatures have acted', () => {
        const base = setupState('creatureAction');
        const creature0 = makeArenaObject('round-creature-0', '0', PLAYER_ZERO_START_ZONE);
        const creature1 = makeArenaObject('round-creature-1', '1', PLAYER_ONE_START_ZONE);
        let state: MatchState<MageWarsCore> = {
            ...base,
            core: withArenaObject(withArenaObject({
                ...base.core,
                phaseReadyPlayerIds: [],
                phaseActorId: '0',
            }, creature0), creature1),
        };
        const guardAndFinish = (playerId: string, objectId?: string) => {
            const guarded = runCommand(state, {
                type: MAGE_WARS_COMMANDS.GUARD,
                playerId,
                payload: objectId ? { objectId } : {},
            });
            expect(guarded.success).toBe(true);
            const finished = runCommand(guarded.state, {
                type: FLOW_COMMANDS.ADVANCE_PHASE,
                playerId,
                payload: {},
            });
            expect(finished.success).toBe(true);
            state = finished.state;
        };
        guardAndFinish('0', creature0.id);
        expect(state.core.phaseActorId).toBe('1');
        guardAndFinish('1', creature1.id);
        expect(state.sys.phase).toBe('creatureAction');
        expect(state.core.phaseActorId).toBe('0');
        expect(state.core.players['0'].actionReady).toBe(true);
        expect(state.core.players['1'].actionReady).toBe(true);
        guardAndFinish('0');
        guardAndFinish('1');
        expect(state.sys.phase).toBe('finalQuickcast');
    });

    it('does not allow skipping a creature action when both players have the same number of active creatures', () => {
        const base = setupState('creatureAction');
        const state: MatchState<MageWarsCore> = {
            ...base,
            core: { ...base.core, phaseReadyPlayerIds: [], phaseActorId: '0' },
        };
        const skipped = runCommand(state, {
            type: FLOW_COMMANDS.ADVANCE_PHASE,
            playerId: '0',
            payload: {},
        });
        expect(skipped.success).toBe(false);
        expect(skipped.state.core.phaseActorId).toBe('0');
        expect(skipped.state.core.players['0'].actionReady).toBe(true);
    });

    it('lets a player with fewer active creatures pass, and lets a selected creature take no action', () => {
        const base = setupState('creatureAction');
        const opponentCreature = makeArenaObject('extra-enemy', '1', PLAYER_ONE_START_ZONE);
        const state = {
            ...base,
            core: withArenaObject({ ...base.core, phaseReadyPlayerIds: [], phaseActorId: '0' }, opponentCreature),
        };
        const passed = runCommand(state, { type: FLOW_COMMANDS.ADVANCE_PHASE, playerId: '0', payload: {} });
        expect(passed.success).toBe(true);
        expect(passed.state.core.phaseActorId).toBe('1');
        expect(passed.state.core.players['0'].actionReady).toBe(true);
        const noAction = runCommand(passed.state, {
            type: MAGE_WARS_COMMANDS.CREATURE_NO_ACTION,
            playerId: '1',
            payload: { objectId: opponentCreature.id },
        });
        expect(noAction.success).toBe(true);
        expect(noAction.state.core.objects[opponentCreature.id].actionReady).toBe(false);
        const ended = runCommand(noAction.state, { type: FLOW_COMMANDS.ADVANCE_PHASE, playerId: '1', payload: {} });
        expect(ended.success).toBe(true);
        expect(ended.state.sys.phase).toBe('creatureAction');
        expect(ended.state.core.phaseActorId).toBe('0');
    });

    it('clears stun only from the creature whose action ended', () => {
        const base = setupState('creatureAction');
        const first = makeArenaObject('stunned-first', '0', PLAYER_ZERO_START_ZONE, {
            statusTokens: { [STATUS_TOKEN_IDS.STUN]: 1 },
        });
        const second = makeArenaObject('stunned-second', '0', PLAYER_ZERO_START_ZONE, {
            statusTokens: { [STATUS_TOKEN_IDS.STUN]: 1 },
        });
        const state: MatchState<MageWarsCore> = {
            ...base,
            core: withArenaObject(withArenaObject({
                ...base.core, phaseReadyPlayerIds: [], phaseActorId: '0',
            }, first), second),
        };
        const inactive = runCommand(state, {
            type: MAGE_WARS_COMMANDS.CREATURE_NO_ACTION,
            playerId: '0',
            payload: { objectId: first.id },
        });
        expect(inactive.success).toBe(true);
        const ended = runCommand(inactive.state, { type: FLOW_COMMANDS.ADVANCE_PHASE, playerId: '0', payload: {} });
        expect(ended.success).toBe(true);
        expect(ended.state.core.objects[first.id].statusTokens?.[STATUS_TOKEN_IDS.STUN] ?? 0).toBe(0);
        expect(ended.state.core.objects[second.id].statusTokens?.[STATUS_TOKEN_IDS.STUN]).toBe(1);
    });

    it('does not let a different creature act before the current creature action ends', () => {
        const base = setupState('creatureAction');
        const first = makeArenaObject('active-first', '0', PLAYER_ZERO_START_ZONE);
        const second = makeArenaObject('active-second', '0', PLAYER_ZERO_START_ZONE);
        const state: MatchState<MageWarsCore> = {
            ...base,
            core: withArenaObject(withArenaObject({
                ...base.core, phaseReadyPlayerIds: [], phaseActorId: '0',
            }, first), second),
        };
        const moved = runCommand(state, {
            type: MAGE_WARS_COMMANDS.MOVE_ARENA_OBJECT,
            playerId: '0',
            payload: { objectId: first.id, toZoneId: ARENA_ZONE_IDS.A2 },
        });
        expect(moved.success).toBe(true);
        const denied = runCommand(moved.state, {
            type: MAGE_WARS_COMMANDS.GUARD,
            playerId: '0',
            payload: { objectId: second.id },
        });
        expect(denied.success).toBe(false);
        expect(denied.state.core.objects[second.id].actionReady).toBe(true);
    });

    it('emits a visible phase-window completion event when a player passes deployment or quickcast', () => {
        const deploymentBase = setupState('deployment');
        const deploymentState: MatchState<MageWarsCore> = {
            core: {
                ...deploymentBase.core,
                phaseReadyPlayerIds: [],
                phaseActorId: '0',
            },
            sys: deploymentBase.sys,
        };

        const passedDeployment = runCommand(deploymentState, {
            type: FLOW_COMMANDS.ADVANCE_PHASE,
            playerId: '0',
            payload: {},
        });

        expect(passedDeployment.success).toBe(true);
        expect(passedDeployment.state.sys.phase).toBe('deployment');
        expect(passedDeployment.state.core.phaseActorId).toBe('1');
        expect(passedDeployment.events).toEqual(expect.arrayContaining([
            expect.objectContaining({
                type: MAGE_WARS_EVENTS.PHASE_WINDOW_COMPLETED,
                payload: expect.objectContaining({
                    playerId: '0',
                    phase: 'deployment',
                    nextActorId: '1',
                    readyPlayerIds: ['0'],
                }),
            }),
        ]));

        const quickcastBase = setupState('initiativeQuickcast');
        const quickcastState: MatchState<MageWarsCore> = {
            core: {
                ...quickcastBase.core,
                phaseReadyPlayerIds: [],
                phaseActorId: '0',
            },
            sys: quickcastBase.sys,
        };

        const passedQuickcast = runCommand(quickcastState, {
            type: FLOW_COMMANDS.ADVANCE_PHASE,
            playerId: '0',
            payload: {},
        });

        expect(passedQuickcast.success).toBe(true);
        expect(passedQuickcast.state.sys.phase).toBe('initiativeQuickcast');
        expect(passedQuickcast.state.core.phaseActorId).toBe('1');
        expect(passedQuickcast.events).toEqual(expect.arrayContaining([
            expect.objectContaining({
                type: MAGE_WARS_EVENTS.PHASE_WINDOW_COMPLETED,
                payload: expect.objectContaining({
                    playerId: '0',
                    phase: 'initiativeQuickcast',
                    nextActorId: '1',
                    readyPlayerIds: ['0'],
                }),
            }),
        ]));
    });

    it('emits a visible phase-window completion event when the first creature-action player ends their window', () => {
        const base = setupState('creatureAction');
        const state: MatchState<MageWarsCore> = {
            core: withArenaObject({
                ...base.core,
                phaseReadyPlayerIds: [],
                phaseActorId: '0',
            }, makeArenaObject('extra-opponent-creature', '1', PLAYER_ONE_START_ZONE)),
            sys: base.sys,
        };

        const result = runCommand(state, {
            type: FLOW_COMMANDS.ADVANCE_PHASE,
            playerId: '0',
            payload: {},
        });

        expect(result.success).toBe(true);
        expect(result.state.sys.phase).toBe('creatureAction');
        expect(result.state.core.phaseActorId).toBe('1');
        expect(result.events).toEqual(expect.arrayContaining([
            expect.objectContaining({
                type: MAGE_WARS_EVENTS.PHASE_WINDOW_COMPLETED,
                payload: expect.objectContaining({
                    playerId: '0',
                    phase: 'creatureAction',
                    nextActorId: '1',
                    readyPlayerIds: ['0'],
                }),
            }),
        ]));
    });

    it('emits a visible phase-window completion event when the final creature-action player ends their window', () => {
        const base = setupState('creatureAction');
        const state: MatchState<MageWarsCore> = {
            core: {
                ...base.core,
                currentPlayerId: '1',
                phaseReadyPlayerIds: ['1'],
                phaseActorId: '0',
                players: {
                    ...base.core.players,
                    '0': { ...base.core.players['0'], actionReady: false },
                    '1': { ...base.core.players['1'], actionReady: false },
                },
            },
            sys: base.sys,
        };

        const result = runCommand(state, {
            type: FLOW_COMMANDS.ADVANCE_PHASE,
            playerId: '0',
            payload: {},
        });

        expect(result.success).toBe(true);
        expect(result.state.sys.phase).toBe('finalQuickcast');
        expect(result.state.core.phaseActorId).toBe('1');
        expect(result.events).toEqual(expect.arrayContaining([
            expect.objectContaining({
                type: MAGE_WARS_EVENTS.PHASE_WINDOW_COMPLETED,
                payload: expect.objectContaining({
                    playerId: '0',
                    phase: 'creatureAction',
                    readyPlayerIds: ['1', '0'],
                }),
            }),
        ]));
    });
});
