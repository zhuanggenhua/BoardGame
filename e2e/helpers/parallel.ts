/**
 * 并行测试辅助函数
 * 
 * 为每个 worker 提供独立的端口和服务器实例
 */

import { type TestInfo } from '@playwright/test';
import { loadWorkerPorts } from '../../scripts/infra/port-allocator.js';

/**
 * 获取当前 worker 的端口配置
 * @param testInfo - Playwright TestInfo 对象
 * @returns 端口配置或 null（如果未找到）
 */
export function getWorkerPorts(testInfo: TestInfo) {
  const workerId = testInfo.parallelIndex;
  const ports = loadWorkerPorts(workerId);
  
  if (!ports) {
    console.warn(`[Worker ${workerId}] 未找到端口配置，使用默认端口`);
    return {
      frontend: 3000,
      gameServer: 18000,
      apiServer: 18001,
    };
  }
  
  return ports;
}

/**
 * 获取当前 worker 的前端 URL
 */
export function getWorkerFrontendUrl(testInfo: TestInfo) {
  const ports = getWorkerPorts(testInfo);
  return `http://localhost:${ports.frontend}`;
}

/**
 * 获取当前 worker 的游戏服务器 URL
 */
export function getWorkerGameServerUrl(testInfo: TestInfo) {
  const ports = getWorkerPorts(testInfo);
  return `http://localhost:${ports.gameServer}`;
}

/**
 * 获取当前 worker 的 API 服务器 URL
 */
export function getWorkerApiServerUrl(testInfo: TestInfo) {
  const ports = getWorkerPorts(testInfo);
  return `http://localhost:${ports.apiServer}`;
}

/**
 * 在测试开始前注入当前 worker 的服务器 URL
 * 
 * 使用方式：
 * ```typescript
 * test.beforeEach(async ({ context }, testInfo) => {
 *   await injectWorkerUrls(context, testInfo);
 * });
 * ```
 */
export async function injectWorkerUrls(
  context: { addInitScript: (script: string | (() => void), arg?: unknown) => Promise<void> },
  testInfo: TestInfo,
) {
  const gameServerUrl = getWorkerGameServerUrl(testInfo);
  const apiServerUrl = getWorkerApiServerUrl(testInfo);
  
  await context.addInitScript(
    ({ gameServerUrl, apiServerUrl }) => {
      (window as Window & { 
        __FORCE_GAME_SERVER_URL__?: string;
        __FORCE_API_SERVER_URL__?: string;
      }).__FORCE_GAME_SERVER_URL__ = gameServerUrl;
      (window as Window & { 
        __FORCE_GAME_SERVER_URL__?: string;
        __FORCE_API_SERVER_URL__?: string;
      }).__FORCE_API_SERVER_URL__ = apiServerUrl;
    },
    { gameServerUrl, apiServerUrl },
  );
}
