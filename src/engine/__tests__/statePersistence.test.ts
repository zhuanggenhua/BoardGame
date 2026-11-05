import { describe, expect, it, vi } from 'vitest';
import { createInitialSystemState } from '../pipeline';
import { restorePersistedState, stampStateVersion, validateStateFields, type StatePersistenceContract } from '../statePersistence';

interface Core { playerIds: string[]; count: number; migrated?: boolean }
const state = () => ({ core: { playerIds: ['0'], count: 4 }, sys: createInitialSystemState(['0'], []) });
const contract = (migrate = (input: ReturnType<typeof state>) => input): StatePersistenceContract<Core> => ({
    version: 1,
    validate: input => validateStateFields(input, { 'core.playerIds': 'strings', 'core.count': 'number' }),
    migrations: { 0: migrate },
});

describe('versioned state admission', () => {
    it('retains legacy in-memory choice behavior while migrating a private data copy', () => {
        const input = state();
        const optionsGenerator = () => [{ id: 'fresh', label: 'fresh', value: 1 }];
        input.sys.interaction.current = { id: 'legacy', kind: 'simple-choice', playerId: '0', data: { optionsGenerator } };
        const admitted = restorePersistedState('game', contract(draft => {
            draft.core.count += 1;
            return draft;
        }), input);
        expect(input.core.count).toBe(4);
        expect(admitted.core.count).toBe(5);
        expect(admitted.sys.interaction).not.toBe(input.sys.interaction);
        expect((admitted.sys.interaction.current!.data as { optionsGenerator: typeof optionsGenerator }).optionsGenerator()).toEqual(optionsGenerator());
    });
    it('migrates a known old version once on a private copy and stamps its domain', () => {
        const input = state();
        const migrate = vi.fn((draft: ReturnType<typeof state>) => { draft.core.count += 1; return draft; });
        const admitted = restorePersistedState('game', contract(migrate), input);
        expect(admitted.core.count).toBe(5);
        expect(admitted.sys.domainState).toEqual({ gameId: 'game', version: 1 });
        expect(input.core.count).toBe(4);
        restorePersistedState('game', contract(migrate), admitted);
        expect(migrate).toHaveBeenCalledTimes(1);
    });

    it('rejects a future or foreign version before invoking migration and keeps the source bytes', () => {
        const migrate = vi.fn((input: ReturnType<typeof state>) => input);
        const future = stampStateVersion('game', { ...contract(migrate), version: 2 }, state());
        const before = JSON.stringify(future);
        expect(() => restorePersistedState('game', contract(migrate), future)).toThrow('future-domain-version');
        expect(() => restorePersistedState('other', contract(migrate), future)).toThrow('invalid-domain-version');
        expect(migrate).not.toHaveBeenCalled();
        expect(JSON.stringify(future)).toBe(before);
    });

    it('does not let a legacy adapter fabricate missing critical facts', () => {
        const migrate = vi.fn((input: ReturnType<typeof state>) => input);
        const input = state();
        (input.core as Partial<Core>).count = undefined;
        expect(() => restorePersistedState('game', contract(migrate), input)).toThrow('invalid-facts');
        expect(migrate).not.toHaveBeenCalled();
    });

    it('a failing migration cannot mutate the persisted source snapshot', () => {
        const input = state();
        const migration = (draft: ReturnType<typeof state>) => { draft.core.count = 100; throw new Error('migration-failed'); };
        expect(() => restorePersistedState('game', contract(migration), input)).toThrow('migration-failed');
        expect(input.core.count).toBe(4);
        expect(input.sys.domainState).toBeUndefined();
    });
});
