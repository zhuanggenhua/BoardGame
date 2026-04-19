import type { MinionOnBase } from '../domain/types';

export function buildMinionUidSnapshotByController(
    turnOrder: string[],
    minionsByController: Record<string, MinionOnBase[]>,
): Record<string, Set<string>> {
    return Object.fromEntries(
        turnOrder.map((pid) => [
            pid,
            new Set((minionsByController[pid] || []).map((minion) => minion.uid)),
        ]),
    );
}

export function resolveEnteringMinionUidsByController(
    turnOrder: string[],
    currentSnapshot: Record<string, Set<string>>,
    previousSnapshot: Record<string, Set<string>>,
): Record<string, Set<string>> {
    return Object.fromEntries(
        turnOrder.map((pid) => {
            const currentUids = currentSnapshot[pid] ?? new Set<string>();
            const previousUids = previousSnapshot[pid] ?? new Set<string>();
            const enteringUids = new Set(
                Array.from(currentUids).filter((uid) => !previousUids.has(uid)),
            );
            return [pid, enteringUids];
        }),
    );
}
