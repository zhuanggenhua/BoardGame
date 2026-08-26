export type EntitySideId = string;

export type EntityRelation = 'self' | 'ally' | 'enemy' | 'neutral' | 'unknown';

export type EntityRelationHighlightTone = 'friendly' | 'hostile' | 'neutral' | 'unknown';

export interface ResolveEntityRelationOptions {
    actorEntityId?: string | null;
    actorSideId?: EntitySideId | null;
    targetEntityId?: string | null;
    targetSideId?: EntitySideId | null;
    alliedSidePairs?: ReadonlyArray<readonly [EntitySideId, EntitySideId]>;
    enemySidePairs?: ReadonlyArray<readonly [EntitySideId, EntitySideId]>;
    neutralSideIds?: readonly EntitySideId[];
    defaultRelation?: Exclude<EntityRelation, 'self' | 'ally'>;
}

const normalizeSideId = (value: EntitySideId | null | undefined): EntitySideId | null => {
    const normalized = typeof value === 'string' ? value.trim() : '';
    return normalized || null;
};

const sidePairMatches = (
    pairs: ReadonlyArray<readonly [EntitySideId, EntitySideId]> | undefined,
    left: EntitySideId,
    right: EntitySideId,
): boolean => {
    return Boolean(pairs?.some(([first, second]) => (
        (first === left && second === right)
        || (first === right && second === left)
    )));
};

export function resolveEntityRelation(options: ResolveEntityRelationOptions): EntityRelation {
    const actorEntityId = typeof options.actorEntityId === 'string' ? options.actorEntityId : null;
    const targetEntityId = typeof options.targetEntityId === 'string' ? options.targetEntityId : null;
    if (actorEntityId && targetEntityId && actorEntityId === targetEntityId) {
        return 'self';
    }

    const actorSideId = normalizeSideId(options.actorSideId);
    const targetSideId = normalizeSideId(options.targetSideId);
    if (!actorSideId || !targetSideId) {
        return 'unknown';
    }

    const neutralSideIds = new Set(options.neutralSideIds ?? []);
    if (neutralSideIds.has(actorSideId) || neutralSideIds.has(targetSideId)) {
        return 'neutral';
    }

    if (actorSideId === targetSideId || sidePairMatches(options.alliedSidePairs, actorSideId, targetSideId)) {
        return 'ally';
    }

    if (sidePairMatches(options.enemySidePairs, actorSideId, targetSideId)) {
        return 'enemy';
    }

    return options.defaultRelation ?? 'unknown';
}

export function getEntityRelationHighlightTone(relation: EntityRelation | null | undefined): EntityRelationHighlightTone {
    switch (relation) {
        case 'self':
        case 'ally':
            return 'friendly';
        case 'enemy':
            return 'hostile';
        case 'neutral':
            return 'neutral';
        default:
            return 'unknown';
    }
}

export function isEntityRelationHostile(relation: EntityRelation | null | undefined): boolean {
    return relation === 'enemy';
}
