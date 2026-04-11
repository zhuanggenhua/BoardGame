import { describe, expect, it } from 'vitest';
import { validate } from '../domain/commands';
import { registerAbility } from '../domain/abilityRegistry';
import { makeMatchState, makeState } from './helpers';
import { SU_COMMANDS } from '../domain/types';
import type { TitanState } from '../domain/types';

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

describe('SmashUp command validation', () => {
    it('should return error when command type is missing', () => {
        const core = makeState();
        const ms = makeMatchState(core);

        const result = validate(ms as any, {} as any);
        expect(result.valid).toBe(false);
        expect((result as any).error).toBe('Invalid command: missing type');
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
});
