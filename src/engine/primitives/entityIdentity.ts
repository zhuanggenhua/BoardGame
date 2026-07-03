/**
 * Runtime entity identity primitives.
 *
 * Entity ids identify a runtime object instance. Coordinates such as board slot
 * or array index are only current locations and may be reused by replacement
 * objects.
 */

export type EntityId = string;

export type EntityLifecycleState = 'active' | 'inactive';

export interface EntityRef<Kind extends string = string> {
    entityId: EntityId;
    kind: Kind;
    fallback?: {
        coordinate?: unknown;
        defId?: string;
    };
}

export interface RuntimeEntity<Kind extends string = string> {
    entityId: EntityId;
    kind: Kind;
    lifecycleState?: EntityLifecycleState;
}

export type EntityResolveResult<Entity> =
    | { ok: true; entity: Entity }
    | { ok: false; reason: 'missing' | 'kind-mismatch' | 'inactive' };

export function createEntityId(scope: string, ordinal: number): EntityId {
    return `${scope}:${ordinal}`;
}

export function createEntityRef<Kind extends string>(
    entity: RuntimeEntity<Kind>,
    fallback?: EntityRef<Kind>['fallback'],
): EntityRef<Kind> {
    return {
        entityId: entity.entityId,
        kind: entity.kind,
        ...(fallback ? { fallback } : {}),
    };
}

export function resolveEntityRef<Entity extends RuntimeEntity<string>>(
    ref: EntityRef<string> | undefined,
    entities: readonly Entity[],
): EntityResolveResult<Entity> {
    if (!ref) return { ok: false, reason: 'missing' };
    const entity = entities.find(candidate => candidate.entityId === ref.entityId);
    if (!entity) return { ok: false, reason: 'missing' };
    if (entity.kind !== ref.kind) return { ok: false, reason: 'kind-mismatch' };
    if (entity.lifecycleState === 'inactive') return { ok: false, reason: 'inactive' };
    return { ok: true, entity };
}

export type EntityScopedRecord<Value> = Record<EntityId, Value>;

export function bindEntityScopedValue<Value>(
    values: EntityScopedRecord<Value> | undefined,
    ref: EntityRef,
    value: Value,
): EntityScopedRecord<Value> {
    return {
        ...(values ?? {}),
        [ref.entityId]: value,
    };
}

export function clearEntityScopedValue<Value>(
    values: EntityScopedRecord<Value> | undefined,
    refOrId: EntityRef | EntityId | undefined,
): EntityScopedRecord<Value> | undefined {
    if (!values || !refOrId) return values;
    const entityId = typeof refOrId === 'string' ? refOrId : refOrId.entityId;
    if (!(entityId in values)) return values;
    const { [entityId]: _removed, ...rest } = values;
    void _removed;
    return Object.keys(rest).length > 0 ? rest : undefined;
}
