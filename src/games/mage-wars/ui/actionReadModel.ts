import type { PlayerId } from '../../../engine/types';
import type { MageWarsArenaObjectState } from '../domain';
import { hasMageWarsStunStatus, isMageWarsBanishedArenaObject } from '../domain/spellRules';
import { hasTemporaryQuickActionAfterMove } from '../domain/temporaryTraits';

export const MAGE_WARS_CAST_PHASES = [
    'deployment',
    'initiativeQuickcast',
    'creatureAction',
    'finalQuickcast',
] as const;

export type MageWarsArenaObjectActionableOptions = {
    canAct: boolean;
    activePlayerId: PlayerId | undefined;
    phase: string;
    objectAbilitySourceIds?: ReadonlySet<string>;
    targetingBusy?: boolean;
    activeCreatureObjectId?: string | null;
};

export function isCreatureActionPhase(phase: string): boolean {
    return phase === 'creatureAction';
}

export function isMageWarsCastPhase(phase: string): boolean {
    return (MAGE_WARS_CAST_PHASES as readonly string[]).includes(phase);
}

export function isMageWarsActionableCreatureObject(
    object: MageWarsArenaObjectState | undefined,
    ownerId: PlayerId | undefined,
): object is MageWarsArenaObjectState {
    return Boolean(
        object
        && ownerId
        && object.ownerId === ownerId
        && object.kind === 'creature'
        && !hasMageWarsStunStatus(object),
    );
}

export function canMageWarsObjectStartAction(
    object: MageWarsArenaObjectState | undefined,
    ownerId: PlayerId | undefined,
): object is MageWarsArenaObjectState {
    if (!isMageWarsActionableCreatureObject(object, ownerId)) return false;
    return object.actionReady || hasTemporaryQuickActionAfterMove(object);
}

export function canMageWarsObjectCastBoundSpell(
    object: MageWarsArenaObjectState | undefined,
    options: Pick<MageWarsArenaObjectActionableOptions, 'canAct' | 'activePlayerId' | 'phase'>,
): object is MageWarsArenaObjectState {
    return Boolean(
        object
        && object.boundSpellCardId != null
        && options.canAct
        && options.activePlayerId
        && object.ownerId === options.activePlayerId
        && isMageWarsCastPhase(options.phase),
    );
}

export function isMageWarsArenaObjectActionable(
    object: MageWarsArenaObjectState | undefined,
    options: MageWarsArenaObjectActionableOptions,
): object is MageWarsArenaObjectState {
    if (!object) return false;
    if (options.targetingBusy) return false;
    if (options.objectAbilitySourceIds?.has(object.id)) return true;
    const canCastBoundSpell = Boolean(canMageWarsObjectCastBoundSpell(object, options));
    if (canCastBoundSpell) return true;
    if (options.activeCreatureObjectId !== undefined && options.activeCreatureObjectId !== object.id) return false;
    return options.canAct
        && isCreatureActionPhase(options.phase)
        && (Boolean(canMageWarsObjectStartAction(object, options.activePlayerId))
            || (object.kind === 'creature' && object.ownerId === options.activePlayerId
                && object.actionReady && !isMageWarsBanishedArenaObject(object)));
}
