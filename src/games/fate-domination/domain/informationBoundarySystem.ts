import type { GameEvent } from '../../../engine/types';
import type { EngineSystem } from '../../../engine/systems/types';
import type { FateDominationCore } from './types';

/** Knowledge cannot be undone even when the random cursor can be restored exactly. */
function revealsInformation(event: GameEvent, core: FateDominationCore): boolean {
    const payload = event.payload as Record<string, unknown>;
    if (event.type === 'INITIAL_ATTACK_HAND_DEALT') return true;
    if (event.type === 'SERVANT_SELECTED') return Array.isArray(payload.deck);
    if (event.type === 'FATE_CARDS_DRAWN') return Array.isArray(payload.drawn) && payload.drawn.length > 0;
    if (event.type === 'BATTLE_RESOLVED') return typeof payload.nextRound === 'number' && payload.nextRound <= 11;
    return event.type === 'PHASE_ADVANCED' && payload.phase === 'action' && core.currentEvents.shinto.length > 0;
}
export function createFateInformationBoundarySystem(): EngineSystem<FateDominationCore> {
    return {
        id: 'fate-information-boundary', name: 'Fate 新信息撤销边界', priority: 90,
        afterEvents: ({ state, events }) => {
            if (!events.some(event => revealsInformation(event, state.core))) return;
            const undo = state.sys.undo;
            if (!undo.snapshots.length && !undo.snapshotCursors?.length && !undo.pendingRequest && undo.restoredRandomCursor === undefined) return;
            const { pendingRequest: _request, restoredRandomCursor: _cursor, ...retained } = undo;
            return { state: { ...state, sys: { ...state.sys, undo: { ...retained, snapshots: [], snapshotCursors: [] } } } };
        },
    };
}
