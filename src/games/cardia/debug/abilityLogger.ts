/**
 * Cardia 能力执行日志系统
 * 
 * 用于调试和测试，记录：
 * - 能力执行开始和结束
 * - 每个效果的执行结果
 * - 交互请求和响应
 * - 错误和异常
 */

import type { PlayerId } from '../../../engine/types';
import type { AbilityId } from '../domain/ids';

/**
 * 日志级别
 */
export enum LogLevel {
    DEBUG = 'DEBUG',
    INFO = 'INFO',
    WARN = 'WARN',
    ERROR = 'ERROR',
}

/**
 * 日志条目
 */
export interface LogEntry {
    timestamp: number;
    level: LogLevel;
    category: string;
    message: string;
    data?: any;
}

/**
 * 能力执行日志
 */
export interface AbilityExecutionLog {
    abilityId: AbilityId;
    cardId: string;
    playerId: PlayerId;
    startTime: number;
    endTime?: number;
    status: 'started' | 'completed' | 'failed' | 'skipped';
    events: string[];
    interactions: string[];
    errors: string[];
}

/**
 * 能力日志记录器
 */
export class AbilityLogger {
    private logs: LogEntry[] = [];
    private executionLogs: Map<string, AbilityExecutionLog> = new Map();
    private enabled = true;
    
    /**
     * 启用/禁用日志
     */
    setEnabled(enabled: boolean): void {
        this.enabled = enabled;
    }
    
    /**
     * 记录日志
     */
    log(level: LogLevel, category: string, message: string, data?: any): void {
        if (!this.enabled) return;
        
        const entry: LogEntry = {
            timestamp: Date.now(),
            level,
            category,
            message,
            data,
        };
        
        this.logs.push(entry);
        
        // 控制台输出
        const prefix = `[${level}] [${category}]`;
        switch (level) {
            case LogLevel.DEBUG:
                console.debug(prefix, message, data || '');
                break;
            case LogLevel.INFO:
                console.info(prefix, message, data || '');
                break;
            case LogLevel.WARN:
                console.warn(prefix, message, data || '');
                break;
            case LogLevel.ERROR:
                console.error(prefix, message, data || '');
                break;
        }
    }
    
    /**
     * 记录能力执行开始
     */
    logAbilityStart(abilityId: AbilityId, cardId: string, playerId: PlayerId): void {
        const executionId = `${abilityId}_${cardId}_${Date.now()}`;
        
        const executionLog: AbilityExecutionLog = {
            abilityId,
            cardId,
            playerId,
            startTime: Date.now(),
            status: 'started',
            events: [],
            interactions: [],
            errors: [],
        };
        
        this.executionLogs.set(executionId, executionLog);
        
        this.log(
            LogLevel.INFO,
            'Ability',
            `能力执行开始: ${abilityId}`,
            { executionId, cardId, playerId }
        );
        
        return;
    }
    
    /**
     * 记录能力执行完成
     */
    logAbilityComplete(abilityId: AbilityId, cardId: string, events: string[]): void {
        const executionLog = this.findExecutionLog(abilityId, cardId);
        if (executionLog) {
            executionLog.endTime = Date.now();
            executionLog.status = 'completed';
            executionLog.events = events;
        }
        
        this.log(
            LogLevel.INFO,
            'Ability',
            `能力执行完成: ${abilityId}`,
            { cardId, eventCount: events.length, events }
        );
    }
    
    /**
     * 记录能力执行失败
     */
    logAbilityError(abilityId: AbilityId, cardId: string, error: Error): void {
        const executionLog = this.findExecutionLog(abilityId, cardId);
        if (executionLog) {
            executionLog.endTime = Date.now();
            executionLog.status = 'failed';
            executionLog.errors.push(error.message);
        }
        
        this.log(
            LogLevel.ERROR,
            'Ability',
            `能力执行失败: ${abilityId}`,
            { cardId, error: error.message, stack: error.stack }
        );
    }
    
    /**
     * 记录能力跳过
     */
    logAbilitySkipped(abilityId: AbilityId, cardId: string, reason: string): void {
        const executionLog = this.findExecutionLog(abilityId, cardId);
        if (executionLog) {
            executionLog.endTime = Date.now();
            executionLog.status = 'skipped';
        }
        
        this.log(
            LogLevel.INFO,
            'Ability',
            `能力跳过: ${abilityId}`,
            { cardId, reason }
        );
    }
    
    /**
     * 记录交互请求
     */
    logInteractionRequest(abilityId: AbilityId, cardId: string, interactionType: string): void {
        const executionLog = this.findExecutionLog(abilityId, cardId);
        if (executionLog) {
            executionLog.interactions.push(`请求: ${interactionType}`);
        }
        
        this.log(
            LogLevel.DEBUG,
            'Interaction',
            `交互请求: ${interactionType}`,
            { abilityId, cardId }
        );
    }
    
    /**
     * 记录交互响应
     */
    logInteractionResponse(abilityId: AbilityId, cardId: string, response: any): void {
        const executionLog = this.findExecutionLog(abilityId, cardId);
        if (executionLog) {
            executionLog.interactions.push(`响应: ${JSON.stringify(response)}`);
        }
        
        this.log(
            LogLevel.DEBUG,
            'Interaction',
            `交互响应`,
            { abilityId, cardId, response }
        );
    }
    
    /**
     * 查找执行日志
     */
    private findExecutionLog(abilityId: AbilityId, cardId: string): AbilityExecutionLog | undefined {
        for (const [, log] of this.executionLogs) {
            if (log.abilityId === abilityId && log.cardId === cardId && !log.endTime) {
                return log;
            }
        }
        return undefined;
    }
    
    /**
     * 获取所有日志
     */
    getLogs(): LogEntry[] {
        return [...this.logs];
    }
    
    /**
     * 获取能力执行日志
     */
    getExecutionLogs(): AbilityExecutionLog[] {
        return Array.from(this.executionLogs.values());
    }
    
    /**
     * 清空日志
     */
    clear(): void {
        this.logs = [];
        this.executionLogs.clear();
    }
    
    /**
     * 导出日志为 JSON
     */
    exportToJson(pretty = true): string {
        return JSON.stringify({
            logs: this.logs,
            executionLogs: Array.from(this.executionLogs.values()),
        }, null, pretty ? 2 : 0);
    }
    
    /**
     * 打印日志摘要
     */
    printSummary(): void {
        console.log('=== 能力执行日志摘要 ===');
        console.log(`总日志条目: ${this.logs.length}`);
        console.log(`能力执行次数: ${this.executionLogs.size}`);
        
        const byLevel = {
            [LogLevel.DEBUG]: 0,
            [LogLevel.INFO]: 0,
            [LogLevel.WARN]: 0,
            [LogLevel.ERROR]: 0,
        };
        
        for (const log of this.logs) {
            byLevel[log.level]++;
        }
        
        console.log('按级别统计:');
        console.log(`  DEBUG: ${byLevel[LogLevel.DEBUG]}`);
        console.log(`  INFO: ${byLevel[LogLevel.INFO]}`);
        console.log(`  WARN: ${byLevel[LogLevel.WARN]}`);
        console.log(`  ERROR: ${byLevel[LogLevel.ERROR]}`);
        
        const executionLogs = Array.from(this.executionLogs.values());
        const byStatus = {
            started: 0,
            completed: 0,
            failed: 0,
            skipped: 0,
        };
        
        for (const log of executionLogs) {
            byStatus[log.status]++;
        }
        
        console.log('能力执行状态:');
        console.log(`  已开始: ${byStatus.started}`);
        console.log(`  已完成: ${byStatus.completed}`);
        console.log(`  已失败: ${byStatus.failed}`);
        console.log(`  已跳过: ${byStatus.skipped}`);
        console.log('========================');
    }
}

/**
 * 全局日志记录器实例
 */
export const abilityLogger = new AbilityLogger();

/**
 * 便捷日志函数
 */
export function logDebug(category: string, message: string, data?: any): void {
    abilityLogger.log(LogLevel.DEBUG, category, message, data);
}

export function logInfo(category: string, message: string, data?: any): void {
    abilityLogger.log(LogLevel.INFO, category, message, data);
}

export function logWarn(category: string, message: string, data?: any): void {
    abilityLogger.log(LogLevel.WARN, category, message, data);
}

export function logError(category: string, message: string, data?: any): void {
    abilityLogger.log(LogLevel.ERROR, category, message, data);
}
