/**
 * 生产环境日志系统
 * 
 * 功能：
 * - 结构化日志（JSON 格式）
 * - 按日期自动轮转
 * - 错误日志单独存储
 * - 游戏业务日志专用方法
 */

import winston from 'winston';
import DailyRotateFile from 'winston-daily-rotate-file';
import path from 'path';

const LOG_DIR = process.env.LOG_DIR || path.join(process.cwd(), 'logs');
const NODE_ENV = process.env.NODE_ENV || 'development';
const isProduction = NODE_ENV === 'production';

function parseBooleanEnv(value: string | undefined): boolean | undefined {
  if (value == null) {
    return undefined;
  }

  const normalized = value.trim().toLowerCase();
  if (['1', 'true', 'yes', 'on'].includes(normalized)) {
    return true;
  }
  if (['0', 'false', 'no', 'off'].includes(normalized)) {
    return false;
  }

  return undefined;
}

// 本地开发默认不写入磁盘，避免异常刷屏时快速堆积几十 GB 日志。
const enableFileLogging = parseBooleanEnv(process.env.LOG_TO_FILE) ?? isProduction;

// 日志格式
const logFormat = winston.format.combine(
  winston.format.timestamp({ format: 'YYYY-MM-DD HH:mm:ss' }),
  winston.format.errors({ stack: true }),
  winston.format.json()
);

// 控制台格式（开发环境）
const consoleFormat = winston.format.combine(
  winston.format.colorize(),
  winston.format.timestamp({ format: 'HH:mm:ss' }),
  winston.format.printf(({ timestamp, level, message, ...meta }) => {
    const metaStr = Object.keys(meta).length ? JSON.stringify(meta) : '';
    return `${timestamp} ${level}: ${message} ${metaStr}`;
  })
);

const transports: winston.transport[] = [
  // 控制台输出
  new winston.transports.Console({
    format: consoleFormat,
    level: isProduction ? 'warn' : 'debug',
    // 防止 EPIPE 错误导致无限循环（nodemon 重启时 stdout 管道会关闭）
    handleExceptions: false,
    handleRejections: false,
    silent: false,
  }),
];

if (enableFileLogging) {
  transports.push(
    // 所有日志（按日期轮转，保留 30 天，旧日志自动压缩）
    new DailyRotateFile({
      dirname: LOG_DIR,
      filename: 'app-%DATE%.log',
      datePattern: 'YYYY-MM-DD',
      maxSize: '100m',
      maxFiles: '30d',
      zippedArchive: true,
      format: logFormat,
    }),

    // 错误日志单独存储（旧日志自动压缩）
    new DailyRotateFile({
      dirname: LOG_DIR,
      filename: 'error-%DATE%.log',
      datePattern: 'YYYY-MM-DD',
      level: 'error',
      maxSize: '100m',
      maxFiles: '90d',
      zippedArchive: true,
      format: logFormat,
    })
  );
}

// 创建 logger
const logger = winston.createLogger({
  level: process.env.LOG_LEVEL || 'info',
  format: logFormat,
  defaultMeta: {
    service: 'boardgame-server',
    environment: NODE_ENV,
    version: process.env.npm_package_version,
  },
  transports,
});

// 游戏业务日志方法
export const gameLogger = {
  /**
   * 房间创建
   */
  matchCreated(matchId: string, gameId: string, players: string[]) {
    logger.info('match_created', {
      matchId,
      gameId,
      playerCount: players.length,
      players,
    });
  },

  /**
   * 命令执行成功
   */
  commandExecuted(matchId: string, command: string, playerId: string, duration: number) {
    logger.info('command_executed', {
      matchId,
      command,
      playerId,
      duration_ms: duration,
    });
  },

  /**
   * 命令执行失败
   */
  commandFailed(matchId: string, command: string, playerId: string, error: Error) {
    logger.error('command_failed', {
      matchId,
      command,
      playerId,
      error: error.message,
      stack: error.stack,
    });
  },

  /**
   * 游戏结束
   */
  matchEnded(matchId: string, gameId: string, winner: string | null, duration: number) {
    logger.info('match_ended', {
      matchId,
      gameId,
      winner,
      duration_seconds: duration,
    });
  },

  /**
   * WebSocket 连接
   */
  socketConnected(socketId: string, playerId: string) {
    logger.info('socket_connected', {
      socketId,
      playerId,
    });
  },

  /**
   * WebSocket 断开
   */
  socketDisconnected(socketId: string, matchId: string | null, reason: string) {
    logger.warn('socket_disconnected', {
      socketId,
      matchId,
      reason,
    });
  },

  /**
   * 作弊检测
   */
  cheatDetected(matchId: string, playerId: string, reason: string, details?: any) {
    logger.warn('cheat_detected', {
      matchId,
      playerId,
      reason,
      details,
      severity: 'high',
    });
  },

  /**
   * 状态同步失败
   */
  stateSyncFailed(matchId: string, playerId: string, error: Error) {
    logger.error('state_sync_failed', {
      matchId,
      playerId,
      error: error.message,
    });
  },
};

export default logger;
