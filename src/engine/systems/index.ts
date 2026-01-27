/**
 * 系统层导出
 */

// 类型
export * from './types';

// 系统实现
export { createFlowSystem, getCurrentPhase, setPhase, FLOW_COMMANDS, FLOW_EVENTS, type FlowHooks, type FlowSystemConfig, type PhaseChangedEvent, type PhaseExitResult, type CanAdvanceResult } from './FlowSystem';
export { createUndoSystem, UNDO_COMMANDS } from './UndoSystem';
export { createPromptSystem, createPrompt, queuePrompt, resolvePrompt, PROMPT_COMMANDS, PROMPT_EVENTS } from './PromptSystem';
export { createLogSystem, getCommands, getEvents, getEventsByType, getRecentLogs } from './LogSystem';
export { createRematchSystem, resetRematchState, getPlayerVote, isRematchReady, getVotedPlayers, REMATCH_COMMANDS } from './RematchSystem';
export { createResponseWindowSystem, createResponseWindow, openResponseWindow, closeResponseWindow, hasActiveResponseWindow, getResponseWindowResponderId, RESPONSE_WINDOW_COMMANDS, RESPONSE_WINDOW_EVENTS } from './ResponseWindowSystem';
export { createCheatSystem, CHEAT_COMMANDS, type CheatResourceModifier, type AddResourcePayload, type SetResourcePayload, type SetPhasePayload, type SetDicePayload } from './CheatSystem';

// 默认系统集合
import { createUndoSystem } from './UndoSystem';
import { createPromptSystem } from './PromptSystem';
import { createLogSystem } from './LogSystem';
import { createRematchSystem } from './RematchSystem';
import { createResponseWindowSystem } from './ResponseWindowSystem';
import type { EngineSystem } from './types';

/**
 * 创建默认系统集合
 */
export function createDefaultSystems<TCore>(): EngineSystem<TCore>[] {
    return [
        createLogSystem(),
        createUndoSystem(),
        createPromptSystem(),
        createRematchSystem(),
        createResponseWindowSystem(),
    ];
}
