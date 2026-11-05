/**
 * Koa 日志中间件
 */

import type { Context, Next } from 'koa';
import logger from '../logger';

/**
 * HTTP 请求日志中间件
 */
export async function requestLogger(ctx: Context, next: Next) {
  const startTime = Date.now();

  try {
    await next();

    const duration = Date.now() - startTime;

    // 只记录非健康检查的请求
    if (ctx.path !== '/health' && ctx.path !== '/metrics') {
      logger.info('http_request', {
        method: ctx.method,
        path: ctx.path,
        status: ctx.status,
        duration_ms: duration,
        ip: ctx.ip,
        userAgent: ctx.get('user-agent'),
      });
    }
  } catch (error) {
    const duration = Date.now() - startTime;

    logger.error('http_request_error', {
      method: ctx.method,
      path: ctx.path,
      duration_ms: duration,
      error: error instanceof Error ? error.message : String(error),
      stack: error instanceof Error ? error.stack : undefined,
    });

    throw error;
  }
}

/**
 * 未捕获错误处理
 */
export async function errorHandler(ctx: Context, next: Next) {
  try {
    await next();
  } catch (error) {
    logger.error('unhandled_error', {
      path: ctx.path,
      method: ctx.method,
      error: error instanceof Error ? error.message : String(error),
      stack: error instanceof Error ? error.stack : undefined,
    });

    ctx.status = error instanceof Error && 'status' in error ? (error as any).status : 500;
    ctx.body = {
      error: process.env.NODE_ENV === 'production' ? 'Internal Server Error' : error instanceof Error ? error.message : String(error),
    };
  }
}
