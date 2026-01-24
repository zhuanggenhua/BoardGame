/**
 * 系统层导出
 */

// 类型
export * from './types';

// 系统实现
export { createUndoSystem, UNDO_COMMANDS } from './UndoSystem';
export { createPromptSystem, createPrompt, queuePrompt, resolvePrompt, PROMPT_COMMANDS, PROMPT_EVENTS } from './PromptSystem';
export { createLogSystem, getCommands, getEvents, getEventsByType, getRecentLogs } from './LogSystem';
export { createRematchSystem, resetRematchState, getPlayerVote, isRematchReady, getVotedPlayers, REMATCH_COMMANDS } from './RematchSystem';

// 默认系统集合
import { createUndoSystem } from './UndoSystem';
import { createPromptSystem } from './PromptSystem';
import { createLogSystem } from './LogSystem';
import { createRematchSystem } from './RematchSystem';
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
    ];
}
