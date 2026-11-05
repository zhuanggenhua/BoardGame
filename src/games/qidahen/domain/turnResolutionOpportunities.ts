import type { TimingOpportunityDiscoveryArgs, TimingOpportunityDiscoveryResult } from '../../../engine/TimingOpportunity';
import { getActiveResolutionFrame } from '../../../engine/systems/resolutionStack';
import type { MatchState } from '../../../engine/types';
import { getCurrentFactionId } from './factionTurnAccessors';
import { getQidahenWheelPosition } from './wheelRules';
import { QIDAHEN_TURN_RESOLUTION_FRAME, type QidahenTurnResolutionData, type QidahenTurnResolutionFrame } from './turnResolutionTypes';
import type { QidahenCommand, QidahenCore, QidahenEvent } from './types';

export function getQidahenTurnResolutionFrame(state: MatchState<QidahenCore>): QidahenTurnResolutionFrame | null {
    const frame = getActiveResolutionFrame(state);
    return frame?.kind === QIDAHEN_TURN_RESOLUTION_FRAME ? frame as QidahenTurnResolutionFrame : null;
}

export function discoverQidahenTurnOpportunities({ state, timing }: TimingOpportunityDiscoveryArgs<QidahenCore, QidahenCommand, QidahenEvent>): TimingOpportunityDiscoveryResult {
    if (timing.event?.type !== 'WHEEL_MOVE_EXECUTED') return { opportunities: [] };
    const position = getQidahenWheelPosition(state.core.actionWheelPosition);
    if (!position) throw new Error('Wheel movement committed an unknown position');
    const factionId = getCurrentFactionId(state.core);
    const frameId = `qidahen:turn:${timing.id}`;
    const data: QidahenTurnResolutionData = {
        positionId: position.id, factionId,
        season: position.kind === 'midyear' || position.kind === 'new-year' ? position.kind : null,
        step: 'menu', completedSubactions: [], hireExecutions: 0, diplomacyRegionIds: [], paymentCardIds: [], incomeBonusIndex: 0, incomeBonusTasks: [],
        maintenanceIndex: 0, upkeepTasks: [], upkeepIndex: 0, judgementTasks: [], judgementIndex: 0,
        chronologyCandidates: [], chronologyIndex: 0, yearCharacterIndex: 0,
    };
    return { opportunities: [{
        id: frameId, timing, sourceRef: { kind: 'event', id: timing.id, ownerId: state.core.currentPlayer },
        controllerId: state.core.currentPlayer, class: 'mandatory', condition: true,
        visibility: { scope: 'public' },
        resolution: { type: 'child-frame', frameId, frameKind: QIDAHEN_TURN_RESOLUTION_FRAME,
            phase: 'wheel-action', phaseGate: 'block-advance-when-blocked', metadata: { qidahenTurn: data } },
    }] };
}
