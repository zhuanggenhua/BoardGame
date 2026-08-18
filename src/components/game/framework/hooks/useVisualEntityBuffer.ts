import { useCallback, useMemo, useRef, useState } from 'react';

export interface VisualEntityHoldInput<TEntity> {
  id: string;
  snapshot: TEntity;
}

export interface VisualEntityHoldEntry<TEntity> {
  id: string;
  snapshot: TEntity;
  owners: ReadonlySet<string>;
}

export interface UseVisualEntityBufferReturn<TEntity> {
  hold: (ownerId: string, entries: Array<VisualEntityHoldInput<TEntity>>) => void;
  transferOwner: (fromOwnerId: string, toOwnerId: string) => void;
  releaseOwner: (ownerId: string) => void;
  clear: () => void;
  getHeldEntries: (liveEntityIds?: Iterable<string> | null) => Array<VisualEntityHoldEntry<TEntity>>;
  getHeldSnapshots: (liveEntityIds?: Iterable<string> | null) => TEntity[];
  getSnapshot: (entityId: string) => TEntity | null;
  snapshot: ReadonlyMap<string, VisualEntityHoldEntry<TEntity>> | null;
  heldSnapshots: TEntity[];
  isHolding: boolean;
}

function assertId(value: string, label: string) {
  if (typeof value !== 'string' || value.length === 0) {
    throw new Error(`useVisualEntityBuffer requires a non-empty ${label}.`);
  }
}

function createLiveIdSet(liveEntityIds?: Iterable<string> | null): Set<string> | null {
  return liveEntityIds == null ? null : new Set(liveEntityIds);
}

function cloneEntry<TEntity>(
  entry: VisualEntityHoldEntry<TEntity>,
): VisualEntityHoldEntry<TEntity> {
  return {
    id: entry.id,
    snapshot: entry.snapshot,
    owners: new Set(entry.owners),
  };
}

/**
 * Keeps visual snapshots of entities that have already left authoritative
 * domain state but still need to remain visible for an active presentation task.
 *
 * This is not a second rules state. It only tracks which FX / animation owner
 * currently holds an entity body for rendering. The entity is released only
 * after every owner has released it.
 */
export function useVisualEntityBuffer<TEntity>(): UseVisualEntityBufferReturn<TEntity> {
  const [snapshot, setSnapshot] = useState<Map<string, VisualEntityHoldEntry<TEntity>> | null>(null);
  const snapshotRef = useRef<Map<string, VisualEntityHoldEntry<TEntity>> | null>(null);

  const commit = useCallback((next: Map<string, VisualEntityHoldEntry<TEntity>>) => {
    const result = next.size === 0 ? null : next;
    snapshotRef.current = result;
    setSnapshot(result);
  }, []);

  const hold = useCallback((ownerId: string, entries: Array<VisualEntityHoldInput<TEntity>>) => {
    assertId(ownerId, 'ownerId');
    if (entries.length === 0) return;

    const next = new Map<string, VisualEntityHoldEntry<TEntity>>(snapshotRef.current ?? []);
    for (const entry of entries) {
      assertId(entry.id, 'entity id');
      const current = next.get(entry.id);
      if (current) {
        const owners = new Set(current.owners);
        owners.add(ownerId);
        next.set(entry.id, {
          ...current,
          owners,
        });
        continue;
      }
      next.set(entry.id, {
        id: entry.id,
        snapshot: entry.snapshot,
        owners: new Set([ownerId]),
      });
    }
    commit(next);
  }, [commit]);

  const transferOwner = useCallback((fromOwnerId: string, toOwnerId: string) => {
    assertId(fromOwnerId, 'fromOwnerId');
    assertId(toOwnerId, 'toOwnerId');
    if (fromOwnerId === toOwnerId || !snapshotRef.current) return;

    let changed = false;
    const next = new Map<string, VisualEntityHoldEntry<TEntity>>();
    for (const [entityId, entry] of snapshotRef.current) {
      if (!entry.owners.has(fromOwnerId)) {
        next.set(entityId, entry);
        continue;
      }
      const owners = new Set(entry.owners);
      owners.delete(fromOwnerId);
      owners.add(toOwnerId);
      next.set(entityId, {
        ...entry,
        owners,
      });
      changed = true;
    }
    if (changed) commit(next);
  }, [commit]);

  const releaseOwner = useCallback((ownerId: string) => {
    assertId(ownerId, 'ownerId');
    if (!snapshotRef.current) return;

    let changed = false;
    const next = new Map<string, VisualEntityHoldEntry<TEntity>>();
    for (const [entityId, entry] of snapshotRef.current) {
      if (!entry.owners.has(ownerId)) {
        next.set(entityId, entry);
        continue;
      }
      const owners = new Set(entry.owners);
      owners.delete(ownerId);
      changed = true;
      if (owners.size > 0) {
        next.set(entityId, {
          ...entry,
          owners,
        });
      }
    }
    if (changed) commit(next);
  }, [commit]);

  const clear = useCallback(() => {
    snapshotRef.current = null;
    setSnapshot(null);
  }, []);

  const getHeldEntries = useCallback((liveEntityIds?: Iterable<string> | null) => {
    const liveIds = createLiveIdSet(liveEntityIds);
    return Array.from(snapshotRef.current?.values() ?? [])
      .filter((entry) => !liveIds?.has(entry.id))
      .map(cloneEntry);
  }, []);

  const getHeldSnapshots = useCallback((liveEntityIds?: Iterable<string> | null) => (
    getHeldEntries(liveEntityIds).map((entry) => entry.snapshot)
  ), [getHeldEntries]);

  const getSnapshot = useCallback((entityId: string) => (
    snapshotRef.current?.get(entityId)?.snapshot ?? null
  ), []);

  const heldSnapshots = useMemo(
    () => Array.from(snapshot?.values() ?? []).map((entry) => entry.snapshot),
    [snapshot],
  );

  return useMemo(() => ({
    hold,
    transferOwner,
    releaseOwner,
    clear,
    getHeldEntries,
    getHeldSnapshots,
    getSnapshot,
    snapshot,
    heldSnapshots,
    isHolding: snapshot !== null,
  }), [
    hold,
    transferOwner,
    releaseOwner,
    clear,
    getHeldEntries,
    getHeldSnapshots,
    getSnapshot,
    snapshot,
    heldSnapshots,
  ]);
}
