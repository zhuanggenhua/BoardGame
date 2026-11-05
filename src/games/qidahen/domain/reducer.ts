import type { QidahenCore, QidahenEvent } from './types';
import { reduceQidahenResolvedEvent } from './resolvedEventReducers';
import { reduceQidahenDirectInputEvent } from './directInputEventReducers';
import { syncQidahenJadeCasketControlAfterRegionChange } from './jadeCasketControl';
import { applyQidahenVictoryStatus } from './victoryResolution';

export function reduceQidahenEvent(state: QidahenCore, event: QidahenEvent): QidahenCore {
    const reducedCore =
        reduceQidahenResolvedEvent(state, event) ?? reduceQidahenDirectInputEvent(state, event) ?? state;
    const syncedCore = syncQidahenJadeCasketControlAfterRegionChange(state, reducedCore);
    if (syncedCore === reducedCore) {
        return reducedCore;
    }
    const jadeCasketTransferred = syncedCore.activeEventCards !== reducedCore.activeEventCards;
    if (!jadeCasketTransferred || reducedCore.victoryStatus?.condition !== 'prestige') {
        return syncedCore;
    }
    return applyQidahenVictoryStatus({
        ...syncedCore,
        victoryStatus: state.victoryStatus,
    });
}
