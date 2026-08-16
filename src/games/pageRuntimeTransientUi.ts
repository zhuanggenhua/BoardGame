import { defaultGameRuntimeAdapter } from './gameRuntimeAdapter';
import { getGameImplementation } from './registry';

export function dismissGamePageTransientUi(gameId?: string | null): boolean {
    return getGameImplementation(gameId ?? '')?.runtimeAdapter?.dismissTransientUi?.()
        ?? defaultGameRuntimeAdapter.dismissTransientUi?.()
        ?? false;
}
