import { describe, expect, it } from 'vitest';
import {
    bindEntityScopedValue,
    clearEntityScopedValue,
    createEntityId,
    createEntityRef,
    resolveEntityRef,
    type RuntimeEntity,
} from '../entityIdentity';

describe('runtime entity identity primitives', () => {
    it('allocates deterministic ids from scope and ordinal', () => {
        expect(createEntityId('board:slot', 1)).toBe('board:slot:1');
        expect(createEntityId('board:slot', 2)).toBe('board:slot:2');
    });

    it('resolves by entity id and rejects replacement objects at the same coordinate', () => {
        type TestEntity = RuntimeEntity<'base'> & { slotIndex: number; defId: string };
        const oldBase: TestEntity = {
            entityId: 'base:1',
            kind: 'base',
            slotIndex: 0,
            defId: 'old_base',
        };
        const ref = createEntityRef(oldBase, { coordinate: 0, defId: oldBase.defId });
        const replacementBase: TestEntity = {
            entityId: 'base:2',
            kind: 'base',
            slotIndex: 0,
            defId: 'new_base',
        };

        expect(resolveEntityRef(ref, [replacementBase])).toEqual({ ok: false, reason: 'missing' });
    });

    it('rejects kind mismatches and inactive entities', () => {
        const ref = { entityId: 'entity:1', kind: 'base' };

        expect(resolveEntityRef(ref, [{ entityId: 'entity:1', kind: 'token' }])).toEqual({
            ok: false,
            reason: 'kind-mismatch',
        });
        expect(resolveEntityRef(ref, [{ entityId: 'entity:1', kind: 'base', lifecycleState: 'inactive' }])).toEqual({
            ok: false,
            reason: 'inactive',
        });
    });

    it('binds and clears entity-scoped values', () => {
        const ref = { entityId: 'base:1', kind: 'base' };
        const values = bindEntityScopedValue(undefined, ref, -3);

        expect(values).toEqual({ 'base:1': -3 });
        expect(clearEntityScopedValue(values, ref)).toBeUndefined();
    });
});
