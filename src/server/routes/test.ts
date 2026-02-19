/**
 * 测试专用路由（仅在测试环境启用）
 * 
 * 提供状态注入、快照管理等测试辅助功能
 */

import Router from '@koa/router';
import type { GameTransportServer } from '../../engine/transport/server';
import type { MatchStorage, StoredMatchState } from '../../engine/transport/storage';
import type { MatchState } from '../../core/types';
import { validateMatchState, deepMerge } from '../../engine/transport/stateValidator';

/**
 * 快照存储（内存实现，测试环境使用）
 */
class SnapshotStorage {
    private snapshots: Map<string, StoredMatchState> = new Map();

    async save(snapshotId: string, state: StoredMatchState): Promise<void> {
        this.snapshots.set(snapshotId, structuredClone(state));
    }

    async load(snapshotId: string): Promise<StoredMatchState | undefined> {
        const snapshot = this.snapshots.get(snapshotId);
        return snapshot ? structuredClone(snapshot) : undefined;
    }

    async delete(snapshotId: string): Promise<void> {
        this.snapshots.delete(snapshotId);
    }

    async clear(): Promise<void> {
        this.snapshots.clear();
    }
}

const snapshotStorage = new SnapshotStorage();

/**
 * 创建测试路由
 * 
 * @param transportServer GameTransportServer 实例
 * @param storage MatchStorage 实例
 * @returns Koa Router 实例
 */
export function createTestRoutes(
    transportServer: GameTransportServer,
    storage: MatchStorage
): Router {
    const router = new Router({ prefix: '/test' });

    // 环境检查中间件
    router.use(async (ctx, next) => {
        if (process.env.NODE_ENV !== 'test' && process.env.NODE_ENV !== 'development') {
            ctx.status = 403;
            ctx.body = { error: 'Test endpoints are disabled in production' };
            return;
        }
        await next();
    });

    // 认证中间件（可选，测试环境可能不需要）
    router.use(async (ctx, next) => {
        const token = ctx.headers['x-test-token'];
        if (!token || token !== process.env.TEST_API_TOKEN) {
            ctx.status = 401;
            ctx.body = { error: 'Unauthorized' };
            return;
        }
        await next();
    });

    /**
     * POST /test/inject-state
     * 完整状态注入
     */
    router.post('/inject-state', async (ctx) => {
        const { matchId, state } = ctx.request.body as {
            matchId: string;
            state: MatchState<unknown>;
        };

        if (!matchId || !state) {
            ctx.status = 400;
            ctx.body = { error: 'Missing matchId or state' };
            return;
        }

        try {
            // 验证状态结构
            const validation = await validateMatchState(matchId, state, storage);
            if (!validation.valid) {
                ctx.status = 400;
                ctx.body = { error: 'Invalid state', details: validation.errors };
                return;
            }

            // 注入状态
            await transportServer.injectState(matchId, state);

            // 返回更新后的状态
            const result = await storage.fetch(matchId, { state: true });
            ctx.status = 200;
            ctx.body = { success: true, state: result.state?.G };
        } catch (error) {
            ctx.status = 500;
            ctx.body = { error: 'Internal server error', message: (error as Error).message };
        }
    });

    /**
     * PATCH /test/patch-state
     * 部分状态注入
     */
    router.patch('/patch-state', async (ctx) => {
        const { matchId, patch } = ctx.request.body as {
            matchId: string;
            patch: Partial<MatchState<unknown>>;
        };

        if (!matchId || !patch) {
            ctx.status = 400;
            ctx.body = { error: 'Missing matchId or patch' };
            return;
        }

        try {
            // 获取当前状态
            const current = await storage.fetch(matchId, { state: true });
            if (!current.state) {
                ctx.status = 404;
                ctx.body = { error: 'Match not found' };
                return;
            }

            // 合并状态
            const merged = deepMerge(current.state.G as MatchState<unknown>, patch);

            // 验证合并后的状态
            const validation = await validateMatchState(matchId, merged, storage);
            if (!validation.valid) {
                ctx.status = 400;
                ctx.body = { error: 'Invalid merged state', details: validation.errors };
                return;
            }

            // 注入状态
            await transportServer.injectState(matchId, merged);

            // 返回更新后的状态
            const result = await storage.fetch(matchId, { state: true });
            ctx.status = 200;
            ctx.body = { success: true, state: result.state?.G };
        } catch (error) {
            ctx.status = 500;
            ctx.body = { error: 'Internal server error', message: (error as Error).message };
        }
    });

    /**
     * GET /test/get-state/:matchId
     * 获取当前服务器状态
     */
    router.get('/get-state/:matchId', async (ctx) => {
        const { matchId } = ctx.params;

        try {
            const result = await storage.fetch(matchId, { state: true, metadata: true });
            if (!result.state) {
                ctx.status = 404;
                ctx.body = { error: 'Match not found' };
                return;
            }

            ctx.status = 200;
            ctx.body = {
                state: result.state.G,
                metadata: result.metadata,
                _stateID: result.state._stateID,
            };
        } catch (error) {
            ctx.status = 500;
            ctx.body = { error: 'Internal server error', message: (error as Error).message };
        }
    });

    /**
     * POST /test/snapshot-state
     * 保存状态快照
     */
    router.post('/snapshot-state', async (ctx) => {
        const { matchId } = ctx.request.body as { matchId: string };

        if (!matchId) {
            ctx.status = 400;
            ctx.body = { error: 'Missing matchId' };
            return;
        }

        try {
            const result = await storage.fetch(matchId, { state: true });
            if (!result.state) {
                ctx.status = 404;
                ctx.body = { error: 'Match not found' };
                return;
            }

            // 生成快照 ID
            const snapshotId = `${matchId}_snapshot_${Date.now()}`;

            // 保存快照
            await snapshotStorage.save(snapshotId, result.state);

            ctx.status = 200;
            ctx.body = { success: true, snapshotId };
        } catch (error) {
            ctx.status = 500;
            ctx.body = { error: 'Internal server error', message: (error as Error).message };
        }
    });

    /**
     * POST /test/restore-state
     * 恢复状态快照
     */
    router.post('/restore-state', async (ctx) => {
        const { matchId, snapshotId } = ctx.request.body as {
            matchId: string;
            snapshotId: string;
        };

        if (!matchId || !snapshotId) {
            ctx.status = 400;
            ctx.body = { error: 'Missing matchId or snapshotId' };
            return;
        }

        try {
            const snapshot = await snapshotStorage.load(snapshotId);
            if (!snapshot) {
                ctx.status = 404;
                ctx.body = { error: 'Snapshot not found' };
                return;
            }

            // 注入快照状态
            await transportServer.injectState(matchId, snapshot.G as MatchState<unknown>);

            ctx.status = 200;
            ctx.body = { success: true };
        } catch (error) {
            ctx.status = 500;
            ctx.body = { error: 'Internal server error', message: (error as Error).message };
        }
    });

    return router;
}
