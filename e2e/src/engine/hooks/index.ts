/**
 * 引擎层 Hooks 导出
 * 
 * 这些 Hook 是游戏无关的，可以被任何游戏复用
 */

export { useSpectatorMoves } from './useSpectatorMoves';
export type { SpectatorMovesOptions } from './useSpectatorMoves';

export { useEventStreamCursor } from './useEventStreamCursor';
export type { UseEventStreamCursorConfig, UseEventStreamCursorReturn, ConsumeResult } from './useEventStreamCursor';

export { EventStreamRollbackContext, useEventStreamRollback } from './EventStreamRollbackContext';
export type { EventStreamRollbackValue } from './EventStreamRollbackContext';
