import type { MatchState } from '../../../engine/types';
import type { InteractionDescriptor } from '../../../engine/systems/InteractionSystem';
import { QIDAHEN_BATTLE_RUNTIME_INTERACTION_BUILDERS } from './battleInteractionBuilders';
import type { QidahenInteractionSourceId } from './interactionSources';
import type { QidahenCore } from './types';
import type { QidahenRuntimeInteractionBuilder } from './runtimeInteractionBuilderContracts';
import type { QidahenRuntimeInteractionBuilderSpec } from './runtimeInteractionBuilderContracts';
import { QIDAHEN_TURN_ACTION_RUNTIME_INTERACTION_BUILDERS } from './turnActionInteractionBuilders';

const QIDAHEN_RUNTIME_INTERACTION_BUILDERS: readonly QidahenRuntimeInteractionBuilderSpec[] = [
    ...QIDAHEN_TURN_ACTION_RUNTIME_INTERACTION_BUILDERS,
    ...QIDAHEN_BATTLE_RUNTIME_INTERACTION_BUILDERS,
];

const QIDAHEN_RUNTIME_INTERACTION_SOURCE_IDS = QIDAHEN_RUNTIME_INTERACTION_BUILDERS.map(
    ({ sourceId }) => sourceId,
) as readonly QidahenInteractionSourceId[];

const QIDAHEN_RUNTIME_INTERACTION_BUILDERS_BY_SOURCE_ID = new Map<
    QidahenInteractionSourceId,
    QidahenRuntimeInteractionBuilder
>(
    QIDAHEN_RUNTIME_INTERACTION_BUILDERS.map(({ sourceId, buildInteraction }) => [sourceId, buildInteraction] as const),
);

export function getRegisteredQidahenRuntimeInteractionSourceIds():
readonly QidahenInteractionSourceId[] {
    return QIDAHEN_RUNTIME_INTERACTION_SOURCE_IDS;
}

export function buildQidahenRuntimeInteractionFromBuilders(
    state: MatchState<QidahenCore>,
    sourceId: QidahenInteractionSourceId,
): InteractionDescriptor | null {
    return QIDAHEN_RUNTIME_INTERACTION_BUILDERS_BY_SOURCE_ID.get(sourceId)?.(state) ?? null;
}
