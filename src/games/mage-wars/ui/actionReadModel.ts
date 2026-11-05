import type { PlayerId } from '../../../engine/types';
import type { MageWarsArenaObjectState } from '../domain';
import {
    canMageWarsObjectUsePostMoveQuickAction,
    getMageWarsObjectAttackProfiles,
    hasMageWarsStunStatus,
} from '../domain/spellRules';

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
    if (object.actionReady) return true;
    return getMageWarsObjectAttackProfiles(object)
        .some((profile) => canMageWarsObjectUsePostMoveQuickAction(object, profile));
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
    if (canMageWarsObjectCastBoundSpell(object, options)) return true;
    return options.canAct
        && isCreatureActionPhase(options.phase)
        && canMageWarsObjectStartAction(object, options.activePlayerId);
}
