/**
 * 引擎层 Hooks 导出
 * 
 * 这些 Hook 是游戏无关的，可以被任何游戏复用
 */

export { useEventStreamCursor } from './useEventStreamCursor';
export type { UseEventStreamCursorConfig, UseEventStreamCursorReturn, ConsumeResult } from './useEventStreamCursor';

export { EventStreamRollbackContext, useEventStreamRollback } from './EventStreamRollbackContext';
export type { EventStreamRollbackValue } from './EventStreamRollbackContext';
