import type { MatchState } from './types';
import { cloneSnapshotState } from './systems/UndoSystem';

export interface StatePersistenceContract<TCore> {
    version: number;
    /** Validate required facts without inventing turns, resources or cards. */
    validate(state: unknown): string[];
    /** Each key is a supported source version; every migration advances by one. */
    migrations?: Record<number, StateMigration<TCore>['migrate']>;
}

/** Match DomainCore's method contract at the heterogeneous game registry boundary. */
export interface StateMigration<TCore> {
    migrate(state: MatchState<TCore>): MatchState<TCore>;
}

export class StateRestoreError extends Error {
    readonly reason: string;
    readonly details: string[];

    constructor(reason: string, details: string[] = []) {
        super(`state_restore:${reason}${details.length ? `:${details.join(',')}` : ''}`);
        this.name = 'StateRestoreError';
        this.reason = reason;
        this.details = details;
    }
}

export const isStateRecord = (value: unknown): value is Record<string, unknown> =>
    value !== null && typeof value === 'object' && !Array.isArray(value);

export type StateFieldKind = 'array' | 'strings' | 'record' | 'number' | 'string' | 'boolean';

/** Paths can traverse record values or array entries with '*'. No values are repaired. */
export function validateStateFields(value: unknown, fields: Record<string, StateFieldKind>): string[] {
    const errors: string[] = [];
    const matches = (entry: unknown, kind: StateFieldKind): boolean => {
        if (kind === 'array') return Array.isArray(entry);
        if (kind === 'strings') return Array.isArray(entry) && entry.every((item) => typeof item === 'string');
        if (kind === 'record') return isStateRecord(entry);
        if (kind === 'number') return typeof entry === 'number' && Number.isFinite(entry);
        return typeof entry === kind;
    };
    for (const [field, kind] of Object.entries(fields)) {
        const visit = (entry: unknown, parts: string[], prefix: string): void => {
            if (!parts.length) {
                if (!matches(entry, kind)) errors.push(prefix);
                return;
            }
            const [part, ...rest] = parts;
            if (part === '*') {
                if (!isStateRecord(entry) && !Array.isArray(entry)) {
                    errors.push(prefix);
                    return;
                }
                for (const [key, child] of Object.entries(entry)) visit(child, rest, `${prefix}.${key}`);
            } else
                visit(
                    isStateRecord(entry) || Array.isArray(entry) ? (entry as Record<string, unknown>)[part] : undefined,
                    rest,
                    prefix ? `${prefix}.${part}` : part,
                );
        };
        visit(value, field.split('.'), '');
    }
    return [...new Set(errors)];
}

export function stampStateVersion<TCore>(
    gameId: string,
    contract: StatePersistenceContract<TCore> | undefined,
    state: MatchState<TCore>,
): MatchState<TCore> {
    if (!contract) return state;
    return { ...state, sys: { ...state.sys, domainState: { gameId, version: contract.version } } };
}

export function restorePersistedState<TCore>(
    gameId: string,
    contract: StatePersistenceContract<TCore> | undefined,
    input: unknown,
): MatchState<TCore> {
    if (!isStateRecord(input) || !isStateRecord(input.core) || !isStateRecord(input.sys))
        throw new StateRestoreError('invalid-envelope');
    if (input.sys.schemaVersion !== 1) throw new StateRestoreError('unsupported-system-version');
    const systemErrors = validateStateFields(input, {
        'sys.undo.snapshots': 'array',
        'sys.interaction.queue': 'array',
        'sys.eventStream.entries': 'array',
        'sys.actionLog.entries': 'array',
        'sys.phase': 'string',
        'sys.turnNumber': 'number',
    });
    if (systemErrors.length) throw new StateRestoreError('invalid-system-state', systemErrors);
    let state = input as unknown as MatchState<TCore>;
    // Non-production lightweight engine consumers may omit the contract. All
    // formally registered games are required to declare it by architecture checks.
    if (!contract) return state;
    const marker = input.sys.domainState;
    let version = 0;
    if (marker !== undefined) {
        if (
            !isStateRecord(marker) ||
            marker.gameId !== gameId ||
            !Number.isInteger(marker.version) ||
            (marker.version as number) < 0
        )
            throw new StateRestoreError('invalid-domain-version');
        version = marker.version as number;
    }
    if (version > contract.version) throw new StateRestoreError('future-domain-version');
    // Validate critical facts before legacy adapters can fill optional defaults.
    const before = contract.validate(state);
    if (before.length) throw new StateRestoreError('invalid-facts', before);
    while (version < contract.version) {
        const migrate = contract.migrations?.[version];
        if (!migrate) throw new StateRestoreError('unsupported-domain-version', [String(version)]);
        // Never mutate the fetched source snapshot; rejection preserves it.
        state = migrate(cloneSnapshotState(state));
        version += 1;
    }
    const after = contract.validate(state);
    if (after.length) throw new StateRestoreError('invalid-migration', after);
    return stampStateVersion(gameId, contract, state);
}
