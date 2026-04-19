/**
 * Cardia 调试工具集
 * 
 * 导出所有调试和测试工具
 */

// 状态快照
export {
    createSnapshot,
    saveStateToJson,
    compareSnapshots,
    formatDiffs,
    printSnapshot,
    createDetailedSnapshot,
    saveDetailedSnapshotToJson,
    type StateSnapshot,
    type PlayerSnapshot,
    type StateDiff,
    type DetailedSnapshot,
} from './stateSnapshot';

// 能力日志
export {
    AbilityLogger,
    abilityLogger,
    logDebug,
    logInfo,
    logWarn,
    logError,
    LogLevel,
    type LogEntry,
    type AbilityExecutionLog,
} from './abilityLogger';

// 调试辅助函数
import type { CardiaCore } from '../domain/core-types';
import { createSnapshot, printSnapshot, saveDetailedSnapshotToJson } from './stateSnapshot';
import { abilityLogger } from './abilityLogger';

/**
 * 快速调试：打印当前状态
 */
export function debugPrintState(core: CardiaCore): void {
    const snapshot = createSnapshot(core);
    printSnapshot(snapshot);
}

/**
 * 快速调试：保存状态到文件（浏览器环境下载）
 */
export function debugSaveState(core: CardiaCore, filename = 'cardia-state.json'): void {
    const json = saveDetailedSnapshotToJson(core);
    
    // 浏览器环境：创建下载链接
    if (typeof window !== 'undefined' && typeof document !== 'undefined') {
        const blob = new Blob([json], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = filename;
        a.click();
        URL.revokeObjectURL(url);
        console.log(`状态已保存到: ${filename}`);
    } else {
        // Node.js 环境：输出到控制台
        console.log('=== 状态 JSON ===');
        console.log(json);
    }
}

/**
 * 快速调试：打印能力日志摘要
 */
export function debugPrintLogs(): void {
    abilityLogger.printSummary();
}

/**
 * 快速调试：清空所有日志
 */
export function debugClearLogs(): void {
    abilityLogger.clear();
    console.log('日志已清空');
}

/**
 * 快速调试：导出日志到文件
 */
export function debugSaveLogs(filename = 'cardia-logs.json'): void {
    const json = abilityLogger.exportToJson();
    
    // 浏览器环境：创建下载链接
    if (typeof window !== 'undefined' && typeof document !== 'undefined') {
        const blob = new Blob([json], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = filename;
        a.click();
        URL.revokeObjectURL(url);
        console.log(`日志已保存到: ${filename}`);
    } else {
        // Node.js 环境：输出到控制台
        console.log('=== 日志 JSON ===');
        console.log(json);
    }
}

/**
 * 在浏览器控制台中暴露调试工具
 */
export function exposeDebugTools(): void {
    if (typeof window !== 'undefined') {
        (window as any).__CARDIA_DEBUG__ = {
            // 状态快照
            createSnapshot,
            printState: debugPrintState,
            saveState: debugSaveState,
            // 日志
            printLogs: debugPrintLogs,
            clearLogs: debugClearLogs,
            saveLogs: debugSaveLogs,
            logger: abilityLogger,
        };
        console.log('Cardia 调试工具已加载到 window.__CARDIA_DEBUG__');
        console.log('可用命令:');
        console.log('  __CARDIA_DEBUG__.createSnapshot(core) - 创建状态快照');
        console.log('  __CARDIA_DEBUG__.printState(core) - 打印当前状态');
        console.log('  __CARDIA_DEBUG__.saveState(core) - 保存状态到文件');
        console.log('  __CARDIA_DEBUG__.printLogs() - 打印日志摘要');
        console.log('  __CARDIA_DEBUG__.clearLogs() - 清空日志');
        console.log('  __CARDIA_DEBUG__.saveLogs() - 保存日志到文件');
    }
}
