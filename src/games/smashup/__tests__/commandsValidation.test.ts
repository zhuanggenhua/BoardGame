import { beforeAll, describe, expect, it } from 'vitest';
import { validate } from '../domain/commands';
import { registerAbility } from '../domain/abilityRegistry';
import { hasCardActivatableAbility } from '../domain/activationMetadata';
import { makeBase, makeCard, makeMatchState, makeMinion, makePlayer, makeState } from './helpers';
import { SU_COMMANDS } from '../domain/types';
import type { SmashUpReactionSession, TitanState } from '../domain/types';
import { initAllAbilities } from '../abilities';
import { startSmashUpReactionSession } from '../domain/reactionSession';
import { createScoringBaseRef, createScoringSession, setScoringSession } from '../domain/scoringSession';
import { runCommand } from './testRunner';

function makeTitan(overrides: Partial<TitanState> & Pick<TitanState, 'uid' | 'defId' | 'faction' | 'ownerId' | 'controllerId'>): TitanState {
    return {
        uid: overrides.uid,
        defId: overrides.defId,
        faction: overrides.faction,
        ownerId: overrides.ownerId,
        controllerId: overrides.controllerId,
        powerCounters: 0,
        talentUsed: false,
        location: { zone: 'setaside' },
        ...overrides,
    };
}

function attachReactionSession(
    session: ReturnType<typeof makeMatchState>,
    reactionSession: SmashUpReactionSession,
    phase: 'playCards' | 'scoreBases' = 'scoreBases',
) {
    session.sys.phase = phase;
    let nextSession = session;
    if (reactionSession.responseWindowType === 'afterScoring') {
        const scoringBaseIndex = reactionSession.sourceBaseIndex ?? 0;
        const baseRef = createScoringBaseRef(nextSession.core, scoringBaseIndex);
        if (!baseRef) {
            throw new Error(`无法构造 afterScoring 命令验证用 scoring base ref: ${scoringBaseIndex}`);
        }
        nextSession = setScoringSession(nextSession, {
            ...createScoringSession(nextSession.core, [scoringBaseIndex]),
            currentBaseRef: baseRef,
            currentStep: 'awaiting-response-window',
        });
    }
    return startSmashUpReactionSession(nextSession, reactionSession);
}

beforeAll(() => {
    initAllAbilities();
});

describe('SmashUp command validation', () => {
    it('should return error when command type is missing', () => {
        const core = makeState();
        const ms = makeMatchState(core);

        const result = validate(ms as any, {} as any);
        expect(result.valid).toBe(false);
        expect((result as any).error).toBe('invalid_command_missing_type');
    });

    it('supports titan special activation from setaside when the owner has no titan in play', () => {
        registerAbility('ghosts_creampuff_man', 'special', () => ({ events: [] }));
        const core = makeState({
            titans: [
                makeTitan({
                    uid: 'titan-ghost',
                    defId: 'ghosts_creampuff_man',
                    faction: 'ghosts',
                    ownerId: '0',
                    controllerId: '0',
                }),
            ],
        });

        const result = validate(makeMatchState(core), {
            type: SU_COMMANDS.ACTIVATE_SPECIAL,
            playerId: '0',
            payload: { titanUid: 'titan-ghost', baseIndex: 0 },
        } as any);

        expect(result.valid).toBe(true);
    });

    it('borrowed setaside Time Box 达到 5 计数后，当前控制者也应能通过 ACTIVATE_SPECIAL 打出', () => {
        const core = makeState({
            players: {
                '0': makePlayer('0'),
                '1': makePlayer('1'),
            },
            bases: [makeBase('test_base')],
            titans: [
                makeTitan({
                    uid: 'borrowed-time-box',
                    defId: 'time_travelers_time_box',
                    faction: 'time_travelers',
                    ownerId: '1',
                    controllerId: '0',
                    metadata: { timeBoxCounters: 5, timeBoxPlayArmed: true },
                }),
            ],
            currentPlayerIndex: 0,
            turnOrder: ['0', '1'],
        });

        const result = validate(makeMatchState(core), {
            type: SU_COMMANDS.ACTIVATE_SPECIAL,
            playerId: '0',
            payload: { titanUid: 'borrowed-time-box', baseIndex: 0 },
        } as any);

        expect(result.valid).toBe(true);

        const executed = runCommand(makeMatchState(core), {
            type: SU_COMMANDS.ACTIVATE_SPECIAL,
            playerId: '0',
            payload: { titanUid: 'borrowed-time-box', baseIndex: 0 },
        } as any);

        expect(executed.success).toBe(true);
        expect(executed.finalState.core.titans?.find(titan => titan.uid === 'borrowed-time-box')).toMatchObject({
            location: { zone: 'base', baseIndex: 0 },
            ownerId: '1',
            controllerId: '0',
            metadata: expect.objectContaining({ timeBoxCounters: 0, timeBoxPlayArmed: false }),
        });
    });

    it('时间盒子上场后不能再通过 ACTIVATE_SPECIAL 触发特殊能力', () => {
        const core = makeState({
            players: {
                '0': makePlayer('0'),
                '1': makePlayer('1'),
            },
            bases: [makeBase('test_base')],
            titans: [
                makeTitan({
                    uid: 'live-time-box',
                    defId: 'time_travelers_time_box',
                    faction: 'time_travelers',
                    ownerId: '0',
                    controllerId: '0',
                    location: { zone: 'base', baseIndex: 0, enteredAt: 1 },
                    metadata: { timeBoxCounters: 5, timeBoxPlayArmed: true },
                }),
            ],
            currentPlayerIndex: 0,
            turnOrder: ['0', '1'],
        });

        const result = validate(makeMatchState(core), {
            type: SU_COMMANDS.ACTIVATE_SPECIAL,
            playerId: '0',
            payload: { titanUid: 'live-time-box', baseIndex: 0 },
        } as any);

        expect(result.valid).toBe(false);
        expect(result.error).toBe('该泰坦当前不在牌库旁');
    });

    it('fairies_spirit_of_the_forest special 需要同时保留通常随从与通常行动额度', () => {
        const validCore = makeState({
            players: {
                '0': makePlayer('0', {
                    minionsPlayed: 0,
                    minionLimit: 1,
                    actionsPlayed: 0,
                    actionLimit: 1,
                }),
                '1': makePlayer('1'),
            },
            bases: [makeBase('test_base')],
            titans: [
                makeTitan({
                    uid: 'titan-fairy',
                    defId: 'fairies_spirit_of_the_forest',
                    faction: 'fairies',
                    ownerId: '0',
                    controllerId: '0',
                }),
            ],
        });

        const invalidCore = makeState({
            ...validCore,
            players: {
                ...validCore.players,
                '0': makePlayer('0', {
                    minionsPlayed: 0,
                    minionLimit: 1,
                    actionsPlayed: 1,
                    actionLimit: 1,
                }),
            },
        });

        const validResult = validate(makeMatchState(validCore), {
            type: SU_COMMANDS.ACTIVATE_SPECIAL,
            playerId: '0',
            payload: { titanUid: 'titan-fairy', baseIndex: 0 },
        } as any);
        const invalidResult = validate(makeMatchState(invalidCore), {
            type: SU_COMMANDS.ACTIVATE_SPECIAL,
            playerId: '0',
            payload: { titanUid: 'titan-fairy', baseIndex: 0 },
        } as any);

        expect(validResult.valid).toBe(true);
        expect(invalidResult.valid).toBe(false);
    });
    it('rejects summoning a second titan while another titan is already in play', () => {
        registerAbility('ghosts_creampuff_man', 'special', () => ({ events: [] }));
        const core = makeState({
            titans: [
                makeTitan({
                    uid: 'titan-ghost',
                    defId: 'ghosts_creampuff_man',
                    faction: 'ghosts',
                    ownerId: '0',
                    controllerId: '0',
                }),
                makeTitan({
                    uid: 'titan-wizard',
                    defId: 'wizards_arcane_protector',
                    faction: 'wizards',
                    ownerId: '0',
                    controllerId: '0',
                    location: { zone: 'base', baseIndex: 0, enteredAt: 1 },
                }),
            ],
        });

        const result = validate(makeMatchState(core), {
            type: SU_COMMANDS.ACTIVATE_SPECIAL,
            playerId: '0',
            payload: { titanUid: 'titan-ghost', baseIndex: 0 },
        } as any);

        expect(result.valid).toBe(false);
    });

    it('supports titan talent validation through titanUid', () => {
        const core = makeState({
            bases: [
                makeBase({
                    defId: 'test_base',
                    minions: [
                        makeMinion('vampire-minion-1', 'vampires_teeny_cathulu', '0', 3, { powerCounters: 1 }),
                    ],
                }),
            ],
            titans: [
                makeTitan({
                    uid: 'titan-vampire',
                    defId: 'vampires_ancient_lord',
                    faction: 'vampires',
                    ownerId: '0',
                    controllerId: '0',
                    location: { zone: 'base', baseIndex: 0, enteredAt: 1 },
                }),
            ],
        });

        const result = validate(makeMatchState(core), {
            type: SU_COMMANDS.USE_TALENT,
            playerId: '0',
            payload: { titanUid: 'titan-vampire', baseIndex: 0 },
        } as any);

        expect(result.valid).toBe(true);
    });

    it('only validates titan ongoing activation for real production executors and respects suppression', () => {
        const core = makeState({
            players: {
                '0': makePlayer('0', {
                    deck: [makeCard('penguin-top-minion', 'robot_microbot_guard', 'minion', '0')],
                    minionsPlayed: 0,
                    minionLimit: 1,
                }),
            },
            titans: [
                makeTitan({
                    uid: 'titan-penguin',
                    defId: 'penguins_emperor_penguin',
                    faction: 'penguins',
                    ownerId: '0',
                    controllerId: '0',
                    location: { zone: 'base', baseIndex: 0, enteredAt: 1 },
                }),
                makeTitan({
                    uid: 'titan-dino',
                    defId: 'dinosaurs_fort_titanosaurus',
                    faction: 'dinosaurs',
                    ownerId: '0',
                    controllerId: '0',
                    location: { zone: 'base', baseIndex: 0, enteredAt: 1 },
                }),
            ],
        });

        const validResult = validate(makeMatchState(core), {
            type: SU_COMMANDS.ACTIVATE_TITAN_ONGOING,
            playerId: '0',
            payload: { titanUid: 'titan-penguin', baseIndex: 0 },
        } as any);

        const suppressedResult = validate(makeMatchState({
            ...core,
            titanOngoingSuppressedUntilTurnEnd: ['titan-penguin'],
        }), {
            type: SU_COMMANDS.ACTIVATE_TITAN_ONGOING,
            playerId: '0',
            payload: { titanUid: 'titan-penguin', baseIndex: 0 },
        } as any);

        const missingExecutorResult = validate(makeMatchState(core), {
            type: SU_COMMANDS.ACTIVATE_TITAN_ONGOING,
            playerId: '0',
            payload: { titanUid: 'titan-dino', baseIndex: 0 },
        } as any);

        expect(validResult.valid).toBe(true);
        expect(suppressedResult.valid).toBe(false);
        expect(missingExecutorResult).toEqual({
            valid: false,
            error: '该泰坦的持续能力不能手动激活',
        });
    });

    it('only allows titan special activation for real manual setaside entries', () => {
        const core = makeState({
            titans: [
                makeTitan({
                    uid: 'titan-mergacon',
                    defId: 'changerbots_mergacon',
                    faction: 'changerbots',
                    ownerId: '0',
                    controllerId: '0',
                }),
                makeTitan({
                    uid: 'titan-rainboroc',
                    defId: 'itty_critters_rainboroc',
                    faction: 'itty_critters',
                    ownerId: '0',
                    controllerId: '0',
                }),
                makeTitan({
                    uid: 'titan-kraken',
                    defId: 'pirates_the_kraken',
                    faction: 'pirates',
                    ownerId: '0',
                    controllerId: '0',
                }),
                makeTitan({
                    uid: 'titan-bride',
                    defId: 'frankenstein_the_bride',
                    faction: 'frankenstein',
                    ownerId: '0',
                    controllerId: '0',
                }),
            ],
        });

        expect([
            'titan-mergacon',
            'titan-rainboroc',
            'titan-kraken',
            'titan-bride',
        ].every((titanUid) => {
            const result = validate(makeMatchState(core), {
                type: SU_COMMANDS.ACTIVATE_SPECIAL,
                playerId: '0',
                payload: { titanUid, baseIndex: 0 },
            } as any);
            return result.valid === false && result.error === '该泰坦的特殊能力不能手动激活';
        })).toBe(true);
    });

    it('preserves real manual titan special activation entries in static metadata', () => {
        const core = makeState({
            players: {
                '0': makePlayer('0', {
                    hand: [],
                }),
            },
            bases: [
                makeBase({
                    defId: 'test_base',
                    minions: [
                        makeMinion('ursa-ally', 'ghosts_spectre', '0', 2, '0'),
                        makeMinion('six-legs-ally', 'ghosts_spectre', '0', 2, {
                            owner: '0',
                            powerCounters: 7,
                        }),
                    ],
                }),
            ],
            titans: [
                makeTitan({
                    uid: 'titan-ghost-real',
                    defId: 'ghosts_creampuff_man',
                    faction: 'ghosts',
                    ownerId: '0',
                    controllerId: '0',
                }),
                makeTitan({
                    uid: 'titan-ursa-real',
                    defId: 'bear_cavalry_major_ursa',
                    faction: 'bear_cavalry',
                    ownerId: '0',
                    controllerId: '0',
                }),
                makeTitan({
                    uid: 'titan-six-legs-real',
                    defId: 'giant_ants_death_on_six_legs',
                    faction: 'giant_ants',
                    ownerId: '0',
                    controllerId: '0',
                }),
                makeTitan({
                    uid: 'titan-category-5-real',
                    defId: 'tornados_category_5',
                    faction: 'tornados',
                    ownerId: '0',
                    controllerId: '0',
                }),
            ],
            minionMovesThisTurnByPlayer: { '0': 2 },
        });

        expect([
            'ghosts_creampuff_man',
            'bear_cavalry_major_ursa',
            'giant_ants_death_on_six_legs',
            'tornados_category_5',
        ].every((defId) => hasCardActivatableAbility(defId, {
            kind: 'special',
            zone: 'setaside',
            window: 'playCards',
        }))).toBe(true);

        expect(validate(makeMatchState(core), {
            type: SU_COMMANDS.ACTIVATE_SPECIAL,
            playerId: '0',
            payload: { titanUid: 'titan-ghost-real', baseIndex: 0 },
        } as any).valid).toBe(true);
        expect(validate(makeMatchState(core), {
            type: SU_COMMANDS.ACTIVATE_SPECIAL,
            playerId: '0',
            payload: { titanUid: 'titan-ursa-real', baseIndex: 0 },
        } as any).valid).toBe(true);
        expect(validate(makeMatchState(core), {
            type: SU_COMMANDS.ACTIVATE_SPECIAL,
            playerId: '0',
            payload: { titanUid: 'titan-six-legs-real', baseIndex: 0 },
        } as any).valid).toBe(true);
        expect(validate(makeMatchState(core), {
            type: SU_COMMANDS.ACTIVATE_SPECIAL,
            playerId: '0',
            payload: { titanUid: 'titan-category-5-real', baseIndex: 0 },
        } as any).valid).toBe(true);
    });

    it('preserves real manual titan talent activation entries in static metadata', () => {
        const core = makeState({
            players: {
                '0': makePlayer('0'),
            },
            bases: [
                makeBase({
                    defId: 'test_base',
                }),
            ],
            titans: [
                makeTitan({
                    uid: 'titan-dino-talent',
                    defId: 'dinosaurs_fort_titanosaurus',
                    faction: 'dinosaurs',
                    ownerId: '0',
                    controllerId: '0',
                    powerCounters: 4,
                    location: { zone: 'base', baseIndex: 0, enteredAt: 1 },
                }),
            ],
        });

        expect(hasCardActivatableAbility('dinosaurs_fort_titanosaurus', {
            kind: 'talent',
            zone: 'board',
            window: 'playCards',
        })).toBe(true);

        expect(validate(makeMatchState(core), {
            type: SU_COMMANDS.USE_TALENT,
            playerId: '0',
            payload: { titanUid: 'titan-dino-talent', baseIndex: 0 },
        } as any).valid).toBe(true);
    });

    it('uses frame-backed reaction session as the truth source for meFirst minion plays', () => {
        const core = makeState({
            players: {
                '0': makePlayer('0'),
                '1': makePlayer('1', {
                    hand: [makeCard('shinobi-1', 'ninja_shinobi', '1')],
                }),
            },
            bases: [makeBase('test_base')],
            scoringEligibleBaseIndices: [0],
            currentPlayerIndex: 0,
        });
        const ms = attachReactionSession(makeMatchState(core), {
            frameId: 'score-before:0:test',
            frameKind: 'score-before',
            phase: 'optional',
            activePlayerId: '1',
            currentPlayerId: '0',
            consecutivePasses: 0,
            sourceBaseIndex: 0,
            responseWindowType: 'meFirst',
        });

        const result = validate(ms, {
            type: SU_COMMANDS.PLAY_MINION,
            playerId: '1',
            payload: { cardUid: 'shinobi-1', baseIndex: 0 },
        } as any);

        expect(result.valid).toBe(true);
    });

    it('uses frame-backed reaction session as the truth source for afterScoring action plays', () => {
        const core = makeState({
            players: {
                '0': makePlayer('0'),
                '1': makePlayer('1', {
                    hand: [makeCard('champions-1', 'giant_ant_we_are_the_champions', 'action', '1')],
                }),
            },
            bases: [makeBase('test_base')],
            scoringEligibleBaseIndices: [0],
            currentPlayerIndex: 0,
        });
        const ms = attachReactionSession(makeMatchState(core), {
            frameId: 'score-after:0:test',
            frameKind: 'score-after',
            phase: 'optional',
            activePlayerId: '1',
            currentPlayerId: '0',
            consecutivePasses: 0,
            sourceBaseIndex: 0,
            responseWindowType: 'afterScoring',
        });

        const result = validate(ms, {
            type: SU_COMMANDS.PLAY_ACTION,
            playerId: '1',
            payload: { cardUid: 'champions-1', targetBaseIndex: 0 },
        } as any);

        expect(result.valid).toBe(true);
    });

    it('frame-backed reaction session 不会把仅限 playCards 的泰坦 special 误放行到 scoreBases', () => {
        const core = makeState({
            players: {
                '0': makePlayer('0'),
                '1': makePlayer('1'),
            },
            titans: [
                makeTitan({
                    uid: 'titan-ghost-1',
                    defId: 'ghosts_creampuff_man',
                    faction: 'ghosts',
                    ownerId: '1',
                    controllerId: '1',
                }),
            ],
            bases: [
                makeBase({
                    defId: 'test_base',
                }),
            ],
            scoringEligibleBaseIndices: [0],
            currentPlayerIndex: 0,
        });
        const ms = attachReactionSession(makeMatchState(core), {
            frameId: 'score-before:0:test',
            frameKind: 'score-before',
            phase: 'optional',
            activePlayerId: '1',
            currentPlayerId: '0',
            consecutivePasses: 0,
            sourceBaseIndex: 0,
            responseWindowType: 'meFirst',
        });

        const result = validate(ms, {
            type: SU_COMMANDS.ACTIVATE_SPECIAL,
            playerId: '1',
            payload: { titanUid: 'titan-ghost-1', baseIndex: 0 },
        } as any);

        expect(result).toEqual({
            valid: false,
            error: '该泰坦的特殊能力不能手动激活',
        });
    });

    it('frame-backed reaction session 不会把仅限 playCards 的 minion special 误放行到 scoreBases', () => {
        const core = makeState({
            players: {
                '0': makePlayer('0'),
                '1': makePlayer('1'),
            },
            bases: [
                makeBase({
                    defId: 'test_base',
                    minions: [makeMinion('acolyte-1', 'ninja_acolyte', '1', 2)],
                }),
            ],
            scoringEligibleBaseIndices: [0],
            currentPlayerIndex: 0,
        });
        const ms = attachReactionSession(makeMatchState(core), {
            frameId: 'score-before:0:test',
            frameKind: 'score-before',
            phase: 'optional',
            activePlayerId: '1',
            currentPlayerId: '0',
            consecutivePasses: 0,
            sourceBaseIndex: 0,
            responseWindowType: 'meFirst',
        });

        const result = validate(ms, {
            type: SU_COMMANDS.ACTIVATE_SPECIAL,
            playerId: '1',
            payload: { minionUid: 'acolyte-1', baseIndex: 0 },
        } as any);

        expect(result).toEqual({
            valid: false,
            error: '该随从没有特殊能力',
        });
    });

    it('afterScoring 响应窗口不会放行仅限 playCards 的泰坦 special', () => {
        const core = makeState({
            players: {
                '0': makePlayer('0'),
                '1': makePlayer('1'),
            },
            titans: [
                makeTitan({
                    uid: 'titan-ghost-1',
                    defId: 'ghosts_creampuff_man',
                    faction: 'ghosts',
                    ownerId: '1',
                    controllerId: '1',
                }),
            ],
            bases: [
                makeBase({ defId: 'base_a' }),
                makeBase({ defId: 'base_b' }),
            ],
            scoringEligibleBaseIndices: [0, 1],
            currentPlayerIndex: 0,
        });
        const ms = attachReactionSession(makeMatchState(core), {
            frameId: 'score-after:0:test',
            frameKind: 'score-after',
            phase: 'optional',
            activePlayerId: '1',
            currentPlayerId: '0',
            consecutivePasses: 0,
            sourceBaseIndex: 0,
            responseWindowType: 'afterScoring',
        });

        const result = validate(ms, {
            type: SU_COMMANDS.ACTIVATE_SPECIAL,
            playerId: '1',
            payload: { titanUid: 'titan-ghost-1', baseIndex: 0 },
        } as any);
        expect(result).toEqual({
            valid: false,
            error: '该泰坦的特殊能力不能手动激活',
        });
    });

    it('afterScoring 响应窗口仍应放行当前结算基地上的计分后 special，即使该基地已不在达标列表', () => {
        const core = makeState({
            players: {
                '0': makePlayer('0'),
                '1': makePlayer('1'),
            },
            bases: [
                makeBase({
                    defId: 'base_a',
                    minions: [makeMinion('pink-1', 'mega_troopers_pink_trooper', '0', 3)],
                }),
                makeBase({ defId: 'base_b' }),
            ],
            scoringEligibleBaseIndices: [1],
            currentPlayerIndex: 0,
        });
        const ms = attachReactionSession(makeMatchState(core), {
            frameId: 'score-after:0:test',
            frameKind: 'score-after',
            phase: 'optional',
            activePlayerId: '0',
            currentPlayerId: '0',
            consecutivePasses: 0,
            sourceBaseIndex: 0,
            responseWindowType: 'afterScoring',
        });

        const result = validate(ms, {
            type: SU_COMMANDS.ACTIVATE_SPECIAL,
            playerId: '0',
            payload: { minionUid: 'pink-1', baseIndex: 0 },
        } as any);

        expect(result).toEqual({ valid: true });
    });

    it('afterScoring 响应窗口中的计分后 special 不能改指向其他基地', () => {
        const core = makeState({
            players: {
                '0': makePlayer('0'),
                '1': makePlayer('1'),
            },
            bases: [
                makeBase({ defId: 'base_a' }),
                makeBase({
                    defId: 'base_b',
                    minions: [makeMinion('pink-1', 'mega_troopers_pink_trooper', '0', 3)],
                }),
            ],
            scoringEligibleBaseIndices: [0, 1],
            currentPlayerIndex: 0,
        });
        const ms = attachReactionSession(makeMatchState(core), {
            frameId: 'score-after:0:test',
            frameKind: 'score-after',
            phase: 'optional',
            activePlayerId: '0',
            currentPlayerId: '0',
            consecutivePasses: 0,
            sourceBaseIndex: 0,
            responseWindowType: 'afterScoring',
        });

        const result = validate(ms, {
            type: SU_COMMANDS.ACTIVATE_SPECIAL,
            playerId: '0',
            payload: { minionUid: 'pink-1', baseIndex: 1 },
        } as any);

        expect(result).toEqual({
            valid: false,
            error: 'afterScoring 只能选择当前正在结算的基地',
        });
    });

    it('ignores orphaned responseWindow state without a frame-backed reaction session', () => {
        registerAbility('ghosts_creampuff_man', 'special', () => ({ events: [] }));
        const core = makeState({
            players: {
                '0': makePlayer('0'),
                '1': makePlayer('1'),
            },
            titans: [
                makeTitan({
                    uid: 'titan-ghost-1',
                    defId: 'ghosts_creampuff_man',
                    faction: 'ghosts',
                    ownerId: '0',
                    controllerId: '0',
                }),
            ],
            bases: [
                makeBase({
                    defId: 'test_base',
                    minions: [makeMinion('ally-1', 'robot_microbot_alpha', '0', 2)],
                }),
            ],
            scoringEligibleBaseIndices: [0],
            currentPlayerIndex: 0,
        });
        const ms = makeMatchState(core);
        ms.sys.phase = 'scoreBases';
        ms.sys.responseWindow = {
            ...(ms.sys.responseWindow ?? {}),
            current: {
                id: 'legacy-window',
                windowType: 'meFirst',
                sourceId: 'legacy_me_first',
                responderQueue: ['0', '1'],
                currentResponderIndex: 0,
                passedPlayers: [],
            },
        } as any;

        const result = validate(ms, {
            type: SU_COMMANDS.ACTIVATE_SPECIAL,
            playerId: '0',
            payload: { titanUid: 'titan-ghost-1', baseIndex: 0 },
        } as any);

        expect(result).toEqual({
            valid: false,
            error: '该泰坦的特殊能力不能手动激活',
        });
    });

    it('frame-backed reaction session 已切到 smashup_reaction_choose 时，仍不得绕过泰坦 special 窗口合同', () => {
        const core = makeState({
            players: {
                '0': makePlayer('0'),
                '1': makePlayer('1'),
            },
            titans: [
                makeTitan({
                    uid: 'titan-ghost-1',
                    defId: 'ghosts_creampuff_man',
                    faction: 'ghosts',
                    ownerId: '1',
                    controllerId: '1',
                }),
            ],
            bases: [makeBase({ defId: 'test_base' })],
            scoringEligibleBaseIndices: [0],
            currentPlayerIndex: 0,
        });
        const ms = attachReactionSession(makeMatchState(core), {
            frameId: 'score-before:0:test',
            frameKind: 'score-before',
            phase: 'optional',
            activePlayerId: '1',
            currentPlayerId: '0',
            consecutivePasses: 0,
            sourceBaseIndex: 0,
            responseWindowType: 'meFirst',
        });

        ms.sys.responseWindow = {
            ...(ms.sys.responseWindow ?? {}),
            current: {
                id: 'legacy-window',
                windowType: 'meFirst',
                sourceId: 'legacy_me_first',
                responderQueue: ['0', '1'],
                currentResponderIndex: 1,
                passedPlayers: [],
            },
        } as any;
        ms.sys.interaction = {
            ...(ms.sys.interaction ?? {}),
            current: {
                id: 'reaction-choice',
                kind: 'simple-choice',
                playerId: '1',
                data: {
                    sourceId: 'smashup_reaction_choose',
                    options: [
                        {
                            id: 'trigger-1',
                            label: '触发',
                            value: { kind: 'trigger', triggerId: 'trigger-1' },
                        },
                    ],
                },
            },
            queue: [],
        } as any;

        const result = validate(ms, {
            type: SU_COMMANDS.ACTIVATE_SPECIAL,
            playerId: '1',
            payload: { titanUid: 'titan-ghost-1', baseIndex: 0 },
        } as any);

        expect(result).toEqual({
            valid: false,
            error: '该泰坦的特殊能力不能手动激活',
        });
    });

    it('legacy responderQueue 被 ghost 污染时，validate 仍应按 live ReactionSession 放行 special', () => {
        const core = makeState({
            players: {
                '0': makePlayer('0'),
                '1': makePlayer('1'),
            },
            bases: [
                makeBase({
                    defId: 'test_base',
                    minions: [makeMinion('mole-1', 'super_spies_mole', '0', 2)],
                }),
            ],
            scoringEligibleBaseIndices: [0],
            currentPlayerIndex: 0,
        });
        const ms = attachReactionSession(makeMatchState(core), {
            frameId: 'score-before:0:test',
            frameKind: 'score-before',
            phase: 'optional',
            activePlayerId: '0',
            currentPlayerId: '0',
            consecutivePasses: 0,
            sourceBaseIndex: 0,
            responseWindowType: 'meFirst',
        });
        ms.sys.responseWindow = {
            ...(ms.sys.responseWindow ?? {}),
            current: {
                id: 'legacy-window',
                windowType: 'meFirst',
                sourceId: 'legacy_me_first',
                responderQueue: ['ghost', '1'],
                currentResponderIndex: 0,
                passedPlayers: [],
            },
        } as any;

        const result = validate(ms, {
            type: SU_COMMANDS.ACTIVATE_SPECIAL,
            playerId: '0',
            payload: { minionUid: 'mole-1', baseIndex: 0 },
        } as any);

        expect(result.valid).toBe(true);
    });

    it('rejects deputy special activation because its effect is not a manual on-board special', () => {
        const core = makeState({
            bases: [
                makeBase({
                    defId: 'test_base',
                    minions: [makeMinion('deputy-1', 'cowboys_deputy', '0', 3)],
                }),
            ],
        });

        const result = validate(makeMatchState(core), {
            type: SU_COMMANDS.ACTIVATE_SPECIAL,
            playerId: '0',
            payload: { minionUid: 'deputy-1', baseIndex: 0 },
        } as any);

        expect(result).toEqual({
            valid: false,
            error: '该随从没有特殊能力',
        });
    });

    it('rejects sheriff special activation because its scoring-window effect is trigger-driven, not manual activation', () => {
        const core = makeState({
            bases: [
                makeBase({
                    defId: 'test_base',
                    minions: [makeMinion('sheriff-1', 'cowboys_sheriff', '0', 5)],
                }),
            ],
        });

        const result = validate(makeMatchState(core), {
            type: SU_COMMANDS.ACTIVATE_SPECIAL,
            playerId: '0',
            payload: { minionUid: 'sheriff-1', baseIndex: 0 },
        } as any);

        expect(result).toEqual({
            valid: false,
            error: '该随从没有特殊能力',
        });
    });

    it('does not expose skeletons_gravestones as a manual activatable special entry', () => {
        expect(hasCardActivatableAbility('skeletons_gravestones', {
            kind: 'special',
            zone: 'board',
            window: 'playCards',
        })).toBe(false);
        expect(hasCardActivatableAbility('skeletons_gravestones', {
            kind: 'special',
            zone: 'board',
            window: 'afterScoring',
        })).toBe(false);
    });

    it('exposes ninja_acolyte as a manual board special only during playCards', () => {
        expect(hasCardActivatableAbility('ninja_acolyte', {
            kind: 'special',
            zone: 'board',
            window: 'playCards',
        })).toBe(true);
        expect(hasCardActivatableAbility('ninja_acolyte', {
            kind: 'special',
            zone: 'board',
            window: 'beforeScoring',
        })).toBe(false);
        expect(hasCardActivatableAbility('ninja_acolyte', {
            kind: 'special',
            zone: 'board',
            window: 'afterScoring',
        })).toBe(false);
    });

    it('supports hand-based special validation for geeks_fan during playCards only', () => {
        const core = makeState({
            players: {
                '0': makePlayer('0', {
                    hand: [makeCard('fan-1', 'geeks_fan', 'minion', '0')],
                }),
                '1': makePlayer('1'),
            },
            bases: [makeBase('test_base')],
            currentPlayerIndex: 0,
        });

        const validResult = validate(makeMatchState(core), {
            type: SU_COMMANDS.ACTIVATE_SPECIAL,
            playerId: '0',
            payload: { handCardUid: 'fan-1', baseIndex: 0 },
        } as any);

        const invalidTurnResult = validate(makeMatchState({
            ...core,
            currentPlayerIndex: 1,
        }), {
            type: SU_COMMANDS.ACTIVATE_SPECIAL,
            playerId: '0',
            payload: { handCardUid: 'fan-1', baseIndex: 0 },
        } as any);

        expect(validResult.valid).toBe(true);
        expect(invalidTurnResult.valid).toBe(false);
    });

    it('beforeScoring 仍只允许在达标基地上激活计分前 special', () => {
        const core = makeState({
            players: {
                '0': makePlayer('0'),
                '1': makePlayer('1'),
            },
            bases: [
                makeBase({
                    defId: 'base_a',
                    minions: [makeMinion('mole-1', 'super_spies_mole', '0', 4)],
                }),
                makeBase({ defId: 'base_b' }),
            ],
            scoringEligibleBaseIndices: [1],
            currentPlayerIndex: 0,
        });
        const state = makeMatchState(core);
        state.sys.phase = 'scoreBases';

        const result = validate(state, {
            type: SU_COMMANDS.ACTIVATE_SPECIAL,
            playerId: '0',
            payload: { minionUid: 'mole-1', baseIndex: 0 },
        } as any);

        expect(result).toEqual({
            valid: false,
            error: '只能在达到临界点的基地上激活计分前特殊能力',
        });
    });

    it('rejects ninja_acolyte_pod talent on the same turn it was played', () => {
        const core = makeState({
            players: {
                '0': makePlayer('0', { minionsPlayed: 1 }),
                '1': makePlayer('1'),
            },
            bases: [
                makeBase({
                    defId: 'test_base',
                    minions: [makeMinion('acolyte-pod-1', 'ninja_acolyte_pod', '0', 2)],
                }),
            ],
        });

        const result = validate(makeMatchState(core), {
            type: SU_COMMANDS.USE_TALENT,
            playerId: '0',
            payload: { minionUid: 'acolyte-pod-1', baseIndex: 0 },
        } as any);

        expect(result.valid).toBe(false);
        expect((result as any).error).toContain('已打出过随从');
    });

    it('rejects giant_ant_soldier talent without a +1 power counter', () => {
        const core = makeState({
            bases: [
                makeBase({
                    defId: 'test_base',
                    minions: [
                        makeMinion('soldier-1', 'giant_ant_soldier', '0', 3, { powerCounters: 0 }),
                        makeMinion('ally-1', 'ninja_master', '0', 5),
                    ],
                }),
            ],
        });

        const result = validate(makeMatchState(core), {
            type: SU_COMMANDS.USE_TALENT,
            playerId: '0',
            payload: { minionUid: 'soldier-1', baseIndex: 0 },
        } as any);

        expect(result.valid).toBe(false);
        expect((result as any).error).toContain('没有+1力量指示物');
    });

    it('rejects giant_ant_soldier_pod talent when no friendly minion has a +1 power counter', () => {
        const core = makeState({
            bases: [
                makeBase({
                    defId: 'test_base',
                    minions: [
                        makeMinion('soldier-pod-1', 'giant_ant_soldier_pod', '0', 3, { powerCounters: 0 }),
                    ],
                }),
            ],
        });

        const result = validate(makeMatchState(core), {
            type: SU_COMMANDS.USE_TALENT,
            playerId: '0',
            payload: { minionUid: 'soldier-pod-1', baseIndex: 0 },
        } as any);

        expect(result.valid).toBe(false);
        expect((result as any).error).toContain('力量指示物');
    });

    it('rejects giant_ant_killer_queen talent before another minion is played here this turn', () => {
        const core = makeState({
            players: {
                '0': makePlayer('0', { minionsPlayedPerBase: {} }),
                '1': makePlayer('1'),
            },
            bases: [
                makeBase({
                    defId: 'test_base',
                    minions: [
                        makeMinion('queen-1', 'giant_ant_killer_queen', '0', 4),
                        makeMinion('worker-1', 'giant_ant_worker', '0', 2),
                    ],
                }),
            ],
        });

        const result = validate(makeMatchState(core), {
            type: SU_COMMANDS.USE_TALENT,
            playerId: '0',
            payload: { minionUid: 'queen-1', baseIndex: 0 },
        } as any);

        expect(result.valid).toBe(false);
        expect((result as any).error).toContain('此基地');
    });

    it('rejects ancient_egyptians_pyramid_engineer talent when hand is empty', () => {
        const core = makeState({
            players: {
                '0': makePlayer('0', { hand: [] }),
                '1': makePlayer('1'),
            },
            bases: [
                makeBase({
                    defId: 'test_base',
                    minions: [makeMinion('engineer-1', 'ancient_egyptians_pyramid_engineer', '0', 2)],
                }),
            ],
        });

        const result = validate(makeMatchState(core), {
            type: SU_COMMANDS.USE_TALENT,
            playerId: '0',
            payload: { minionUid: 'engineer-1', baseIndex: 0 },
        } as any);

        expect(result.valid).toBe(false);
        expect((result as any).error).toContain('手牌为空');
    });

    it('rejects frankenstein_herr_doktor talent when no other friendly minion exists', () => {
        const core = makeState({
            bases: [
                makeBase({
                    defId: 'test_base',
                    minions: [makeMinion('doktor-1', 'frankenstein_herr_doktor', '0', 4)],
                }),
            ],
        });

        const result = validate(makeMatchState(core), {
            type: SU_COMMANDS.USE_TALENT,
            playerId: '0',
            payload: { minionUid: 'doktor-1', baseIndex: 0 },
        } as any);

        expect(result.valid).toBe(false);
        expect((result as any).error).toContain('没有可选择的目标');
    });

    it('rejects cthulhu_star_spawn talent when no Madness is in hand', () => {
        const core = makeState({
            players: {
                '0': makePlayer('0', { hand: [makeCard('normal-1', 'ninja_master', '0')] }),
                '1': makePlayer('1'),
            },
            bases: [
                makeBase({
                    defId: 'test_base',
                    minions: [makeMinion('star-spawn-1', 'cthulhu_star_spawn', '0', 3)],
                }),
            ],
        });

        const result = validate(makeMatchState(core), {
            type: SU_COMMANDS.USE_TALENT,
            playerId: '0',
            payload: { minionUid: 'star-spawn-1', baseIndex: 0 },
        } as any);

        expect(result.valid).toBe(false);
        expect((result as any).error).toContain('疯狂卡');
    });

    it('rejects vikings_huscarl talent when hand is empty', () => {
        const core = makeState({
            players: {
                '0': makePlayer('0', { hand: [] }),
                '1': makePlayer('1'),
            },
            bases: [
                makeBase({
                    defId: 'test_base',
                    minions: [makeMinion('huscarl-1', 'vikings_huscarl', '0', 3)],
                }),
            ],
        });

        const result = validate(makeMatchState(core), {
            type: SU_COMMANDS.USE_TALENT,
            playerId: '0',
            payload: { minionUid: 'huscarl-1', baseIndex: 0 },
        } as any);

        expect(result.valid).toBe(false);
        expect((result as any).error).toContain('手牌为空');
    });

    it('rejects innsmouth_sacred_circle talent when hand has no matching minion', () => {
        const core = makeState({
            players: {
                '0': makePlayer('0', { hand: [makeCard('normal-3', 'ninja_master', 'minion', '0')] }),
                '1': makePlayer('1'),
            },
            bases: [
                makeBase({
                    defId: 'test_base',
                    minions: [makeMinion('deep-one-1', 'innsmouth_the_locals', '0', 2)],
                    ongoingActions: [{ uid: 'circle-1', defId: 'innsmouth_sacred_circle', ownerId: '0', talentUsed: false } as any],
                }),
            ],
        });

        const result = validate(makeMatchState(core), {
            type: SU_COMMANDS.USE_TALENT,
            playerId: '0',
            payload: { ongoingCardUid: 'circle-1', baseIndex: 0 },
        } as any);

        expect(result.valid).toBe(false);
        expect((result as any).error).toContain('没有可选择的目标');
    });

    it('rejects killer_plant_venus_man_trap talent when deck has no minion with power 2 or less', () => {
        const core = makeState({
            players: {
                '0': makePlayer('0', {
                    deck: [makeCard('big-minion-1', 'ninja_master', 'minion', '0')],
                }),
                '1': makePlayer('1'),
            },
            bases: [
                makeBase({
                    defId: 'test_base',
                    minions: [makeMinion('venus-1', 'killer_plant_venus_man_trap', '0', 3)],
                }),
            ],
        });

        const result = validate(makeMatchState(core), {
            type: SU_COMMANDS.USE_TALENT,
            playerId: '0',
            payload: { minionUid: 'venus-1', baseIndex: 0 },
        } as any);

        expect(result.valid).toBe(false);
        expect((result as any).error).toContain('力量 2 或更低');
    });

    it('rejects miskatonic_professor_pod talent when no Madness is in hand', () => {
        const core = makeState({
            players: {
                '0': makePlayer('0', { hand: [makeCard('normal-2', 'ninja_master', '0')] }),
                '1': makePlayer('1'),
            },
            bases: [
                makeBase({
                    defId: 'test_base',
                    minions: [makeMinion('professor-pod-1', 'miskatonic_professor_pod', '0', 5)],
                }),
            ],
        });

        const result = validate(makeMatchState(core), {
            type: SU_COMMANDS.USE_TALENT,
            playerId: '0',
            payload: { minionUid: 'professor-pod-1', baseIndex: 0 },
        } as any);

        expect(result.valid).toBe(false);
        expect((result as any).error).toContain('疯狂卡');
    });

    it('rejects bear_cavalry_superiority_pod talent when not highest power on that base', () => {
        const core = makeState({
            bases: [
                makeBase({
                    defId: 'test_base',
                    minions: [
                        makeMinion('my-minion-1', 'ninja_master', '0', 2),
                        makeMinion('enemy-minion-1', 'ninja_master', '1', 5),
                    ],
                    ongoingActions: [{ uid: 'superiority-pod-1', defId: 'bear_cavalry_superiority_pod', ownerId: '0', talentUsed: false } as any],
                }),
            ],
        });

        const result = validate(makeMatchState(core), {
            type: SU_COMMANDS.USE_TALENT,
            playerId: '0',
            payload: { ongoingCardUid: 'superiority-pod-1', baseIndex: 0 },
        } as any);

        expect(result.valid).toBe(false);
        expect((result as any).error).toContain('没有可选择的目标');
    });

    it('rejects trickster_hideout_pod talent when hand and deck have no base ongoing action', () => {
        const core = makeState({
            players: {
                '0': makePlayer('0', {
                    hand: [makeCard('normal-action-1', 'ninja_disguise', 'action', '0')],
                    deck: [makeCard('normal-minion-1', 'ninja_master', 'minion', '0')],
                }),
                '1': makePlayer('1'),
            },
            bases: [
                makeBase({
                    defId: 'test_base',
                    ongoingActions: [{ uid: 'hideout-pod-1', defId: 'trickster_hideout_pod', ownerId: '0', talentUsed: false } as any],
                }),
            ],
        });

        const result = validate(makeMatchState(core), {
            type: SU_COMMANDS.USE_TALENT,
            playerId: '0',
            payload: { ongoingCardUid: 'hideout-pod-1', baseIndex: 0 },
        } as any);

        expect(result.valid).toBe(false);
        expect((result as any).error).toContain('条件不满足');
    });

    it('allows borrowed ongoing talent when metadata.sourceControllerId matches the acting player', () => {
        const core = makeState({
            players: {
                '0': makePlayer('0', {
                    hand: [makeCard('base-ongoing-1', 'trickster_enshrouding_mist_pod', 'action', '0')],
                }),
                '1': makePlayer('1'),
            },
            bases: [
                makeBase({
                    defId: 'test_base',
                    ongoingActions: [{
                        uid: 'hideout-pod-borrowed',
                        defId: 'trickster_hideout_pod',
                        ownerId: '1',
                        talentUsed: false,
                        metadata: { sourceControllerId: '0' },
                    } as any],
                }),
            ],
        });

        const result = validate(makeMatchState(core), {
            type: SU_COMMANDS.USE_TALENT,
            playerId: '0',
            payload: { ongoingCardUid: 'hideout-pod-borrowed', baseIndex: 0 },
        } as any);

        expect(result.valid).toBe(true);
    });

    it('rejects steampunk_zeppelin talent when no friendly minion can be moved', () => {
        const core = makeState({
            bases: [
                makeBase({
                    defId: 'test_base',
                    minions: [],
                    ongoingActions: [{ uid: 'zeppelin-1', defId: 'steampunk_zeppelin', ownerId: '0', talentUsed: false } as any],
                }),
            ],
        });

        const result = validate(makeMatchState(core), {
            type: SU_COMMANDS.USE_TALENT,
            playerId: '0',
            payload: { ongoingCardUid: 'zeppelin-1', baseIndex: 0 },
        } as any);

        expect(result.valid).toBe(false);
        expect((result as any).error).toContain('没有可选择的目标');
    });

    it('rejects world_champs_high_speed_chase talent when its base has no friendly minion', () => {
        const core = makeState({
            bases: [
                makeBase({
                    defId: 'test_base',
                    minions: [makeMinion('enemy-1', 'ninja_master', '1', 5)],
                    ongoingActions: [{ uid: 'chase-1', defId: 'world_champs_high_speed_chase', ownerId: '0', talentUsed: false } as any],
                }),
            ],
        });

        const result = validate(makeMatchState(core), {
            type: SU_COMMANDS.USE_TALENT,
            playerId: '0',
            payload: { ongoingCardUid: 'chase-1', baseIndex: 0 },
        } as any);

        expect(result.valid).toBe(false);
        expect((result as any).error).toContain('没有可选择的目标');
    });
});
