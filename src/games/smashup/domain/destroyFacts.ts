import type { MinionDestroyedEvent, SmashUpCore } from './types';

export function shouldRedirectDestroyedMinionToDeckBottom(
    core: SmashUpCore,
    event: MinionDestroyedEvent,
): boolean {
    const { fromBaseIndex } = event.payload;
    const base = core.bases[fromBaseIndex];
    const destroyedAtBaseThisTurnCount = (core.turnDestroyedMinions ?? [])
        .filter(record => record.baseIndex === fromBaseIndex)
        .length;

    return (
        base?.defId === 'base_temple_of_goju_pod'
        || (base?.defId === 'base_tar_pits' && destroyedAtBaseThisTurnCount === 0)
    );
}

export function doesDestroyedMinionEnterOwnerDiscard(
    core: SmashUpCore,
    event: MinionDestroyedEvent,
): boolean {
    return !shouldRedirectDestroyedMinionToDeckBottom(core, event);
}
