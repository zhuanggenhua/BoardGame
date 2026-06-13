import type { MatchState } from '../../../engine/types';
import type { InteractionDescriptor } from '../../../engine/systems/InteractionSystem';
import type { QidahenInteractionSourceId } from './interactionSources';
import type { QidahenCore } from './types';

export type QidahenRuntimeInteractionBuilder = (
    state: MatchState<QidahenCore>,
) => InteractionDescriptor | null;

export interface QidahenRuntimeInteractionBuilderSpec {
    sourceId: QidahenInteractionSourceId;
    buildInteraction: QidahenRuntimeInteractionBuilder;
}
