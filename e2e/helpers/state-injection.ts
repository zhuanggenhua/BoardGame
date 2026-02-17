/**
 * E2E 测试状态注入辅助工具
 * 
 * 提供状态注入、快照管理等测试辅助功能
 */

import type { Page } from '@playwright/test';
import type { MatchState } from '../../src/core/types';

/**
 * 测试环境配置
 */
const TEST_API_BASE = process.env.TEST_API_BASE || 'http://localhost:18001';
const TEST_API_TOKEN = process.env.TEST_API_TOKEN || 'test-token-12345';

/**
 * 完整状态注入
 * 
 * 通过服务器 API 注入完整的对局状态，并等待客户端同步完成。
 * 
 * @param matchId 对局 ID
 * @param state 新的对局状态
 * @param page 可选的 Page 对象，用于等待客户端同步
 */
export async function injectMatchState(
    matchId: string,
    state: MatchState<unknown>,
    page?: Page
): Promise<void> {
    const response = await fetch(`${TEST_API_BASE}/test/inject-state`, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            'X-Test-Token': TEST_API_TOKEN,
        },
        body: JSON.stringify({ matchId, state }),
    });

    if (!response.ok) {
        const error = await response.json();
        throw new Error(`State injection failed: ${JSON.stringify(error)}`);
    }

    // 如果提供了 page，等待客户端同步完成
    if (page) {
        await waitForStateSync(page, 5000);
    }
}

/**
 * 部分状态注入
 * 
 * 只修改状态的特定字段，其他字段保持不变。
 * 
 * @param matchId 对局 ID
 * @param patch 要修改的字段
 * @param page 可选的 Page 对象，用于等待客户端同步
 */
export async function patchMatchState(
    matchId: string,
    patch: Partial<MatchState<unknown>>,
    page?: Page
): Promise<void> {
    const response = await fetch(`${TEST_API_BASE}/test/patch-state`, {
        method: 'PATCH',
        headers: {
            'Content-Type': 'application/json',
            'X-Test-Token': TEST_API_TOKEN,
        },
        body: JSON.stringify({ matchId, patch }),
    });

    if (!response.ok) {
        const error = await response.json();
        throw new Error(`State patch failed: ${JSON.stringify(error)}`);
    }

    // 如果提供了 page，等待客户端同步完成
    if (page) {
        await waitForStateSync(page, 5000);
    }
}

/**
 * 获取当前服务器状态
 * 
 * @param matchId 对局 ID
 * @returns 当前服务器状态
 */
export async function getMatchState(matchId: string): Promise<MatchState<unknown>> {
    const response = await fetch(`${TEST_API_BASE}/test/get-state/${matchId}`, {
        headers: {
            'X-Test-Token': TEST_API_TOKEN,
        },
    });

    if (!response.ok) {
        const error = await response.json();
        throw new Error(`Failed to get state: ${JSON.stringify(error)}`);
    }

    const data = await response.json();
    return data.state;
}

/**
 * 等待客户端状态同步完成
 * 
 * 通过监听 WebSocket 消息或轮询状态变化来确认同步完成。
 * 
 * @param page Playwright Page 对象
 * @param timeout 超时时间（毫秒）
 */
export async function waitForStateSync(page: Page, timeout = 5000): Promise<void> {
    // 方案 1：等待 state:update 事件（需要在客户端注入监听器）
    // 方案 2：轮询状态变化
    // 方案 3：等待固定时间（最简单但不可靠）

    // 这里使用方案 3 作为初始实现，后续可以优化为方案 1
    await page.waitForTimeout(500);

    // TODO: 实现更可靠的同步检测机制
    // 可以在客户端注入一个全局标志，当收到 state:update 时设置为 true
    // 然后在这里轮询该标志
}

/**
 * 保存状态快照
 * 
 * @param matchId 对局 ID
 * @returns 快照 ID
 */
export async function snapshotMatchState(matchId: string): Promise<string> {
    const response = await fetch(`${TEST_API_BASE}/test/snapshot-state`, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            'X-Test-Token': TEST_API_TOKEN,
        },
        body: JSON.stringify({ matchId }),
    });

    if (!response.ok) {
        const error = await response.json();
        throw new Error(`Snapshot failed: ${JSON.stringify(error)}`);
    }

    const data = await response.json();
    return data.snapshotId;
}

/**
 * 恢复状态快照
 * 
 * @param matchId 对局 ID
 * @param snapshotId 快照 ID
 * @param page 可选的 Page 对象，用于等待客户端同步
 */
export async function restoreMatchState(
    matchId: string,
    snapshotId: string,
    page?: Page
): Promise<void> {
    const response = await fetch(`${TEST_API_BASE}/test/restore-state`, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            'X-Test-Token': TEST_API_TOKEN,
        },
        body: JSON.stringify({ matchId, snapshotId }),
    });

    if (!response.ok) {
        const error = await response.json();
        throw new Error(`Restore failed: ${JSON.stringify(error)}`);
    }

    // 如果提供了 page，等待客户端同步完成
    if (page) {
        await waitForStateSync(page, 5000);
    }
}

/**
 * 启用状态注入调试日志
 * 
 * 设置环境变量以启用详细的调试日志。
 */
export function enableStateInjectionDebugLog(): void {
    process.env.DEBUG_STATE_INJECTION = 'true';
}
