import {
    canEffectMove,
    canEnterLocation as canEnterMovementLocation,
    canLeaveLocation as canLeaveMovementLocation,
    canNormalMove,
    movementCheck,
    resolveMovementCost,
    resolveMovementPath,
    type MovementCheck,
    type MovementFailure,
    type MovementMode,
    type MovementResolution,
} from '../../../engine/primitives';
import type { AttackCardDefinition, FateDominationCore, LocationId, PlayerState } from './types';
import { hasFateDefeat } from './mechanics';
import type { FateRuleModifier } from './mechanics';

/** Fate 当前作者源锁定的单向路线。规则改写通过上下文传入新的顺序。 */
export const FATE_LOCATION_ORDER: LocationId[] = ['workshop', 'miyama', 'shinto', 'recon'];
export const FATE_STEP_COST: Record<LocationId, number> = { workshop: 1, miyama: 2, shinto: 2, recon: 0 };

export interface FateMovementContext {
    /** 当前规则上下文的有向路线；未提供时使用基础路线。 */
    locationOrder?: readonly LocationId[];
    /** 仅由已授权的能力/规则 adapter 提供，不能来自玩家 UI payload。 */
    allowAnyDestination?: boolean;
    ignoreEngagement?: boolean;
    free?: boolean;
    extraCostPerStep?: number;
    extraCost?: number;
    excludedLocations?: readonly LocationId[];
    fromLocations?: readonly LocationId[];
    toLocations?: readonly LocationId[];
}

export type FateMovementResolution = MovementResolution<LocationId>;

const locationOrderFor = (context?: FateMovementContext) => context?.locationOrder ?? FATE_LOCATION_ORDER;

const activeEventsAt = (core: FateDominationCore, locationId: LocationId) => {
    const location = core.battlefield[locationId];
    if (location.eventCards.length > 0) return location.eventCards;
    if (locationId === 'miyama') return core.currentEvents.miyama;
    if (locationId === 'shinto') return core.currentEvents.shinto;
    return [];
};

const hasIntrinsicBoundary = (core: FateDominationCore, locationId: LocationId) =>
    activeEventsAt(core, locationId).some((event) => event.name === '固有结界');

const activeLocationLocks = (core: FateDominationCore, locationId: LocationId, playerId?: string) =>
    (core.ruleState?.modifiers ?? []).filter((modifier): modifier is Extract<FateRuleModifier, { kind: 'location-lock' }> =>
        modifier.kind === 'location-lock'
        && modifier.locationId === locationId
        && (!modifier.playerIds || (playerId ? modifier.playerIds.includes(playerId) : true)),
    );

function deriveMovementContext(
    core: FateDominationCore,
    playerId: string,
    mode: MovementMode,
    context?: FateMovementContext,
): FateMovementContext {
    const next: FateMovementContext = { ...(context ?? {}) };
    const rules = (core.ruleState?.modifiers ?? []).filter((modifier): modifier is Extract<FateRuleModifier, { kind: 'movement' }> => {
        if (modifier.kind !== 'movement') return false;
        if (modifier.mode !== 'all' && modifier.mode !== mode) return false;
        return modifier.source.controllerId === playerId;
    });
    for (const rule of [...rules].sort((left, right) => (left.priority ?? 0) - (right.priority ?? 0))) {
        if (rule.route) next.locationOrder = rule.route;
        if (rule.allowAnyDestination) next.allowAnyDestination = true;
        if (rule.ignoreEngagement) next.ignoreEngagement = true;
        if (rule.free !== undefined) next.free = rule.free;
        if (rule.extraCostPerStep !== undefined) next.extraCostPerStep = (next.extraCostPerStep ?? 0) + rule.extraCostPerStep;
        if (rule.extraCost !== undefined) next.extraCost = (next.extraCost ?? 0) + rule.extraCost;
        if (rule.excludedLocations) next.excludedLocations = [...new Set([...(next.excludedLocations ?? []), ...rule.excludedLocations])];
        if (rule.fromLocations) next.fromLocations = rule.fromLocations;
        if (rule.toLocations) next.toLocations = rule.toLocations;
    }
    return next;
}

const currentLocation = (core: FateDominationCore, playerId: string): LocationId | null =>
    core.players[playerId]?.locationId ?? null;

export function resolveFateMovementPath(
    from: LocationId | null,
    to: LocationId,
    mode: MovementMode = 'normal',
    context?: FateMovementContext,
): readonly LocationId[] | null {
    if (context?.excludedLocations?.includes(to)) return null;
    if (from !== null && context?.fromLocations && !context.fromLocations.includes(from)) return null;
    if (context?.toLocations && !context.toLocations.includes(to)) return null;
    if (mode === 'effect' && context?.allowAnyDestination && from !== null && from !== to) return [from, to];
    const order = locationOrderFor(context);
    const next = (locationId: LocationId) => {
        const index = order.indexOf(locationId);
        return index >= 0 && index < order.length - 1 ? order[index + 1] : null;
    };
    return resolveMovementPath(from, to, next);
}

export function resolveFateMovementCost(
    path: readonly LocationId[] | null,
    mode: MovementMode = 'normal',
    context?: FateMovementContext,
): number | null {
    return resolveMovementCost(
        path,
        (from) => FATE_STEP_COST[from],
        {
            free: mode === 'effect' && context?.free !== false,
            perStepModifier: context?.extraCostPerStep,
            flatModifier: context?.extraCost,
        },
    );
}

const engaged = (core: FateDominationCore, player: PlayerState) => {
    if (!player.locationId) return false;
    return core.battlefield[player.locationId].playerIds.some((id) => id !== player.id && !core.players[id]?.eliminated);
};

export function canEnterLocation(
    core: FateDominationCore,
    playerId: string,
    locationId: LocationId,
    mode: MovementMode = 'normal',
): MovementCheck {
    const locks = activeLocationLocks(core, locationId, playerId).filter((modifier) => !modifier.bypassModes?.includes(mode));
    const location = core.battlefield[locationId];
    const blocker = locks.find((modifier) => modifier.denyEnter);
    if (hasIntrinsicBoundary(core, locationId) || blocker) {
        return canEnterMovementLocation({ allowed: false, failure: { code: 'cannotEnterLocation', source: blocker?.source.sourceId ?? '固有结界' } });
    }
    if (location.capacity !== null && location.playerIds.filter((id) => id !== playerId).length >= location.capacity) {
        return canEnterMovementLocation({ allowed: false, failure: { code: 'locationFull' } });
    }
    return canEnterMovementLocation({ allowed: true });
}

export function canLeaveLocation(
    core: FateDominationCore,
    playerId: string,
    locationId: LocationId,
    mode: MovementMode = 'normal',
): MovementCheck {
    const locks = activeLocationLocks(core, locationId, playerId).filter((modifier) => !modifier.bypassModes?.includes(mode));
    const blocker = locks.find((modifier) => modifier.denyLeave);
    if (hasIntrinsicBoundary(core, locationId) || blocker) {
        return canLeaveMovementLocation({ allowed: false, failure: { code: 'cannotLeaveLocation', source: blocker?.source.sourceId ?? '固有结界' } });
    }
    return canLeaveMovementLocation({ allowed: true });
}

export function resolveFateMovement(
    core: FateDominationCore,
    playerId: string,
    to: LocationId,
    mode: MovementMode = 'normal',
    context?: FateMovementContext,
): FateMovementResolution {
    const player = core.players[playerId];
    const from = currentLocation(core, playerId);
    const effectiveContext = deriveMovementContext(core, playerId, mode, context);
    const path = resolveFateMovementPath(from, to, mode, effectiveContext);
    const cost = resolveFateMovementCost(path, mode, effectiveContext);
    const leave = from === null
        ? canLeaveMovementLocation({ allowed: false, failure: { code: 'notDeployed' } })
        : canLeaveLocation(core, playerId, from, mode);
    const enter = canEnterLocation(core, playerId, to, mode);
    const pathCheck = path ? movementCheck(true) : movementCheck(false, { code: 'illegalRoute' });
    const query = {
        from,
        to,
        path,
        cost,
        availableResource: player?.mana ?? 0,
        enforceResource: mode === 'normal' || context?.free === false,
        engaged: player ? engaged(core, player) : false,
        ignoreEngagement: effectiveContext.ignoreEngagement ?? mode === 'effect',
        leave,
        enter,
        pathCheck,
    };
    const check = mode === 'normal' ? canNormalMove(query) : canEffectMove(query);
    return { ...check, mode, from, to, path, cost };
}

export function movementFailureToError(resolution: FateMovementResolution): string | undefined {
    const failure = resolution.failures[0];
    if (!failure) return undefined;
    if (failure.code === 'insufficientResource') return 'notEnoughMana';
    if (failure.code === 'pathBlocked') return 'moveNotAllowed';
    return failure.code;
}

export function legalMoveTargets(core: FateDominationCore, player: PlayerState, context?: FateMovementContext): LocationId[] {
    if (core.phase !== 'action' || !player.locationId) return [];
    const order = locationOrderFor(context);
    return order.filter((locationId) => resolveFateMovement(core, player.id, locationId, 'normal', context).valid);
}

export function movementCost(from: LocationId, to: LocationId): number | null {
    return resolveFateMovementCost(resolveFateMovementPath(from, to, 'normal'), 'normal');
}

export interface FateAttackCheck {
    valid: boolean;
    error?: 'notDeployed' | 'specialAttackForbidden' | 'defeatActive';
    source?: string;
}

export function canPlayAttack(
    core: FateDominationCore,
    playerId: string,
    card: AttackCardDefinition,
    locationId = currentLocation(core, playerId),
): FateAttackCheck {
    if (hasFateDefeat(core, playerId)) return { valid: false, error: 'defeatActive' };
    if (!locationId) return { valid: false, error: 'notDeployed' };
    const specialLocked = activeLocationLocks(core, locationId, playerId).some((modifier) => modifier.denySpecialAttack);
    if (card.type?.includes('特殊') && (hasIntrinsicBoundary(core, locationId) || specialLocked)) {
        const blocker = activeLocationLocks(core, locationId, playerId).find((modifier) => modifier.denySpecialAttack);
        return { valid: false, error: 'specialAttackForbidden', source: blocker?.source.sourceId ?? '固有结界' };
    }
    return { valid: true };
}

export type FateLocationKind = 'workshop' | 'battlefield' | 'recon';

export function resolveLocationKind(locationId: LocationId): FateLocationKind {
    if (locationId === 'workshop') return 'workshop';
    if (locationId === 'recon') return 'recon';
    return 'battlefield';
}

export function describeMovementFailures(resolution: FateMovementResolution): readonly MovementFailure[] {
    return resolution.failures;
}
