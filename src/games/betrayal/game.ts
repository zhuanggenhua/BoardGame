
import { createBaseSystems, createGameEngine } from '../../engine';
import type { BetrayalCore } from './domain/types';
import { BETRAYAL_ACTION_LOG_ALLOWLIST, formatBetrayalActionEntry, BETRAYAL_UNDO_ALLOWLIST } from './actionLog';
import { createCheatSystem } from '../../engine/systems';
import type { BetrayalCommand } from './commandTypes';
import type { BetrayalEvent } from './events';
import { BetrayalDomain } from './domain/index';
import { BETRAYAL_COMMANDS } from './commands';
import { resolveBetrayalSeatLegalOnlyRecovery, shouldSuppressBetrayalActiveTurnRecovery } from './domain/recovery';
import { createBetrayalAiRuntime } from './ai';
import type { MatchState } from '../../engine/types';
import { registerGameAiRuntime } from '../../engine/ai';

export { type BetrayalTraitKey, type BetrayalInventoryKind, type BetrayalDeckKind, type BetrayalPhase, type BetrayalRecommendedAction, type BetrayalRoomMarkerToken, type BetrayalHauntAttackTarget, type BetrayalInventoryCard, type BetrayalExplorerTemplate, type BetrayalTraitTrackState, type BetrayalTraitTrackMap, type BetrayalExplorerSummary, type BetrayalMonsterSummary, type BetrayalMonsterStatusKind, type BetrayalMonsterTraitReadModel, type BetrayalMonsterStatusSummary, type BetrayalCorpseSummary, type BetrayalDeathStateSummary, type BetrayalRoomNode, type BetrayalRoomPlacementPreview, type BetrayalRoomDiscoveryDeckEntry, type BetrayalBuriedRoomTileSummary, type BetrayalRoomDrawResolution, type BetrayalRoomTileAdjustmentSelection, type BetrayalRoomTileAdjustmentOption, type BetrayalDiscoverySummary, type BetrayalDiscoveryResolutionStepKind, type BetrayalDiscoveryResolutionStep, type BetrayalActivityEntry, type BetrayalRecentRollState, type BetrayalPendingEventRollResolutionState, type BetrayalPendingEventRollStartState, type BetrayalMonsterMovementRollResult, type BetrayalHelpingHandsMonsterTurnStartedPayload, type BetrayalTurnEndedPayload, type BetrayalPendingEventChoiceState, type BetrayalPendingCardResolutionStepKind, type BetrayalPendingCardResolutionProcessCard, type BetrayalPendingCardResolutionState, type BetrayalPendingTradeAgreementState, type BetrayalPendingDamageAllocationState, type BetrayalAllTraitCheckResult, type BetrayalEndgameResult, type BetrayalDustSicknessToken, type BetrayalDustRuntimeState, type BetrayalMagicCameraRuntimeState, type BetrayalMummyRuntimeState, type BetrayalHelpingHandsRuntimeState, type BetrayalDustSicknessSwapResult, type BetrayalUponReflectionSecretCombination, type BetrayalUponReflectionBreakAttempt, type BetrayalUponReflectionHintedEvent, type BetrayalUponReflectionRuntimeState, type BetrayalScenarioRuntimeStatus, type BetrayalCore } from './domain/types';
export { EXPLORER_CATALOG, getBetrayalScenarioConfig, createBetrayalCharacterSelectCore, createBetrayalFoundationCore, createBetrayalMonsterEncounterCore } from './domain/stateFactory';
export { BetrayalDomain } from './domain/index';

export { resolveUseEffect } from './possessionEffects';

export { resolveInventoryEffectId } from './possessionEffects';

export type { PossessionUseEffectProfile, UseEffectProfile } from './possessionEffects';

export {
    BETRAYAL_MONSTER_DEFINITIONS,
    createBetrayalMonsterFromDefinition,
    getBetrayalMonsterDefinition,
} from './domain/monsterDefinitions';

export type {
    BetrayalMonsterDefinition,
    BetrayalMonsterDefinitionId,
} from './domain/monsterDefinitions';

export type { BetrayalRoomDiscoverySymbol } from './scenarioConfig';

export type { BetrayalRoomEdge, BetrayalRoomVisualId, BetrayalRoomFloor } from './scenarioConfig';

const systems = [
    ...createBaseSystems<BetrayalCore>({
        actionLog: {
            commandAllowlist: BETRAYAL_ACTION_LOG_ALLOWLIST,
            formatEntry: formatBetrayalActionEntry,
        },
        undo: {
            snapshotCommandAllowlist: BETRAYAL_UNDO_ALLOWLIST,
        },
    }),
    createCheatSystem<BetrayalCore>(),
];

const baseEngineConfig = createGameEngine<BetrayalCore, BetrayalCommand, BetrayalEvent>({
    domain: BetrayalDomain,
    systems,
    minPlayers: 3,
    maxPlayers: 6,
    commandTypes: Object.values(BETRAYAL_COMMANDS),
});

export const engineConfig = {
    ...baseEngineConfig,
    onlineAiRecovery: {
        publicPregameLegalActionPhases: ['characterSelect'],
        resolveSeatLegalOnlyRecovery: resolveBetrayalSeatLegalOnlyRecovery,
        shouldSuppressActiveTurnCandidate: shouldSuppressBetrayalActiveTurnRecovery,
    },
};

export const betrayalAiRuntime = createBetrayalAiRuntime({
    validate: (state, command) => BetrayalDomain.validate(
        state as MatchState<BetrayalCore>,
        command as BetrayalCommand,
    ),
});

registerGameAiRuntime(betrayalAiRuntime);

export default engineConfig;

export { BETRAYAL_AUDIO_CONFIG as audioConfig } from './audio.config';
