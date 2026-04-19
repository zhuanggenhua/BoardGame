import { describe, expect, it } from 'vitest';
import { validate } from '../domain/commands';
import { registerAbility } from '../domain/abilityRegistry';
import { makeBase, makeCard, makeMatchState, makeMinion, makePlayer, makeState } from './helpers';
import { SU_COMMANDS } from '../domain/types';
import type { SmashUpReactionSession, TitanState } from '../domain/types';

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
    (session.sys as any).smashupReactionSession = reactionSession;
    session.sys.responseWindow = {
        ...(session.sys.responseWindow ?? {}),
        current: undefined,
    };
    return session;
}

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
        registerAbility('vampires_ancient_lord', 'talent', () => ({ events: [] }));
        const core = makeState({
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

    it('supports active titan ongoing validation and respects suppression', () => {
        registerAbility('dinosaurs_fort_titanosaurus', 'ongoingActivation', () => ({ events: [] }));
        const core = makeState({
            titans: [
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
            payload: { titanUid: 'titan-dino', baseIndex: 0 },
        } as any);

        const suppressedResult = validate(makeMatchState({
            ...core,
            titanOngoingSuppressedUntilTurnEnd: ['titan-dino'],
        }), {
            type: SU_COMMANDS.ACTIVATE_TITAN_ONGOING,
            playerId: '0',
            payload: { titanUid: 'titan-dino', baseIndex: 0 },
        } as any);

        expect(validResult.valid).toBe(true);
        expect(suppressedResult.valid).toBe(false);
    });

    it('uses smashupReactionSession as the truth source for meFirst minion plays', () => {
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

    it('uses smashupReactionSession as the truth source for afterScoring action plays', () => {
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

    it('uses smashupReactionSession as the truth source for scoreBases special activation order', () => {
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

        expect(result.valid).toBe(true);
    });

    it('still blocks scoreBases special activation behind a legacy response window', () => {
        const core = makeState({
            bases: [
                makeBase({
                    defId: 'test_base',
                    minions: [makeMinion('acolyte-1', 'ninja_acolyte', '0', 2)],
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
            payload: { minionUid: 'acolyte-1', baseIndex: 0 },
        } as any);

        expect(result.valid).toBe(false);
    });
});
