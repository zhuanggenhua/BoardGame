/**
 * 系统层导出
 */

// 类型
export * from './types';

// 系统实现
export { createFlowSystem, getCurrentPhase, setPhase, FLOW_COMMANDS, FLOW_EVENTS, type FlowHooks, type FlowSystemConfig, type PhaseChangedEvent, type PhaseExitResult, type PhaseEnterResult, type CanAdvanceResult } from './FlowSystem';
export { createUndoSystem, getUndoSnapshotCount, setUndoAiSeatIds, UNDO_COMMANDS, type UndoSystemConfig } from './UndoSystem';
export { createInteractionSystem, createSimpleChoice, createCompareRollChoice, createMultistepChoice, queueInteraction, resolveInteraction, asSimpleChoice, asCompareRollChoice, asMultistepChoice, INTERACTION_COMMANDS, INTERACTION_EVENTS, type InteractionDescriptor, type InteractionState, type SimpleChoiceData, type CompareRollChoiceData, type CompareRollChoiceParticipant, type MultistepChoiceData, type InteractionSystemConfig, type SimpleChoiceResponseValidationMode } from './InteractionSystem';
export { createSimpleChoiceFromChoiceRequest, type CreateSimpleChoiceFromChoiceRequestOptions } from './ChoiceRequestSimpleChoiceAdapter';
export { createSimpleChoiceSystem, type SimpleChoiceSystemConfig } from './SimpleChoiceSystem';
export { createCompareRollChoiceSystem, type CompareRollChoiceSystemConfig } from './CompareRollChoiceSystem';
export { createMultistepChoiceSystem, type MultistepChoiceSystemConfig } from './MultistepChoiceSystem';
export { useMultistepInteraction, type MultistepInteractionState } from './useMultistepInteraction';
export { createLogSystem, getCommands, getEvents, getEventsByType, getRecentLogs } from './LogSystem';
// ⚠️ LogSystem 已废弃，上述导出仅保留向后兼容。生产日志由 Winston 独立记录。
export { createEventStreamSystem, getEventStreamEntries, computeEventStreamDelta } from './EventStreamSystem';
export type { EventStreamDelta } from './EventStreamSystem';
export { createActionLogSystem, type ActionLogSystemConfig } from './ActionLogSystem';
export { createRematchSystem, resetRematchState, getPlayerVote, isRematchReady, getVotedPlayers, REMATCH_COMMANDS } from './RematchSystem';
export { createResponseWindowSystem, createResponseWindow, openResponseWindow, closeResponseWindow, hasActiveResponseWindow, getResponseWindowResponderId, RESPONSE_WINDOW_COMMANDS, RESPONSE_WINDOW_EVENTS } from './ResponseWindowSystem';
export {
    getResolutionState,
    getResolutionFrames,
    getResolutionFrameById,
    getActiveResolutionFrame,
    getActiveResolutionOwner,
    getResolutionOwnerToken,
    upsertResolutionFrame,
    upsertActiveResolutionFrame,
    pushResolutionFrame,
    updateResolutionFrame,
    updateActiveResolutionFrame,
    setResolutionFrameDeferredPayload,
    appendResolutionFrameDeferredPayload,
    consumeResolutionFrameDeferredPayload,
    setResolutionFrameOwner,
    setActiveResolutionOwner,
    completeResolutionFrame,
    clearResolutionFrame,
    setResolutionFrameBlock,
    setActiveResolutionBlock,
    clearResolutionFrameBlock,
    clearActiveResolutionBlock,
    syncActiveResolutionWithInteraction,
    syncActiveResolutionWithResponseWindow,
    hasBlockingResolutionFrame,
} from './resolutionStack';
export { createCheatSystem, CHEAT_COMMANDS, type CheatCommandHandler, type CheatResourceModifier, type AddResourcePayload, type SetResourcePayload, type SetPhasePayload, type SetDicePayload } from './CheatSystem';
export { createTutorialSystem, TUTORIAL_COMMANDS, TUTORIAL_EVENTS, TUTORIAL_ERRORS } from './TutorialSystem';
export { CharacterSelectionSystem, CHARACTER_SELECTION_COMMANDS, type CharacterSelectionSystemConfig, type SelectCharacterCommand, type PlayerReadyCommand, type PlayerUnreadyCommand, type HostStartGameCommand, type CharacterSelectedEvent, type PlayerReadyEvent, type PlayerUnreadyEvent, type HostStartedEvent } from './CharacterSelectionSystem';

// 默认系统集合
import { createUndoSystem } from './UndoSystem';
import { createInteractionSystem } from './InteractionSystem';
import { createSimpleChoiceSystem } from './SimpleChoiceSystem';
import { createCompareRollChoiceSystem } from './CompareRollChoiceSystem';
import { createEventStreamSystem } from './EventStreamSystem';
import { createRematchSystem } from './RematchSystem';
import { createActionLogSystem } from './ActionLogSystem';
import { createResponseWindowSystem, type ResponseWindowSystemConfig } from './ResponseWindowSystem';
import { createTutorialSystem } from './TutorialSystem';
import type { EngineSystem } from './types';
import type { ActionLogSystemConfig } from './ActionLogSystem';
import type { UndoSystemConfig } from './UndoSystem';

export interface BaseSystemsConfig {
    actionLog?: ActionLogSystemConfig;
    undo?: UndoSystemConfig;
    responseWindow?: ResponseWindowSystemConfig;
}

/**
 * 创建基础系统集合
 */
export function createBaseSystems<TCore>(config: BaseSystemsConfig = {}): EngineSystem<TCore>[] {
    const { actionLog, undo, responseWindow } = config;
    return [
        createActionLogSystem(actionLog),
        createUndoSystem(undo),
        createInteractionSystem(),
        createSimpleChoiceSystem(),
        createCompareRollChoiceSystem(),
        createRematchSystem(),
        createResponseWindowSystem(responseWindow),
        createTutorialSystem(),
        createEventStreamSystem(),
    ];
}
