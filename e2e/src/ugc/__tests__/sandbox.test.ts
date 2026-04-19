/**
 * UGC 服务端沙箱执行器测试
 * 
 * 注意：当前沙箱使用简化的 Function 构造函数实现，
 * 生产环境应使用 isolated-vm 获得更强隔离。
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { SandboxExecutor, createSandboxExecutor, DEFAULT_SANDBOX_CONFIG, DISABLED_GLOBALS } from '../server/sandbox';

describe('UGC 服务端沙箱', () => {
    describe('SandboxExecutor 基础功能', () => {
        let executor: SandboxExecutor;

        beforeEach(() => {
            executor = createSandboxExecutor({
                timeoutMs: 1000,
                allowConsole: true,
            });
        });

        it('应创建沙箱执行器', () => {
            expect(executor).toBeInstanceOf(SandboxExecutor);
            expect(executor.isCodeLoaded()).toBe(false);
        });

        it('应有正确的默认配置', () => {
            expect(DEFAULT_SANDBOX_CONFIG.timeoutMs).toBe(100);
            expect(DEFAULT_SANDBOX_CONFIG.memoryLimitMb).toBe(64);
            expect(DEFAULT_SANDBOX_CONFIG.allowConsole).toBe(false);
        });

        it('应有正确的禁用 API 列表', () => {
            expect(DISABLED_GLOBALS).toContain('require');
            expect(DISABLED_GLOBALS).toContain('process');
            expect(DISABLED_GLOBALS).toContain('eval');
            expect(DISABLED_GLOBALS).toContain('fs');
            expect(DISABLED_GLOBALS).toContain('child_process');
        });

        it('未加载代码时应返回错误', async () => {
            const result = await executor.setup(['p1'], 12345);
            expect(result.success).toBe(false);
            expect(result.error).toContain('未加载');
        });

        it('应能卸载代码', () => {
            expect(executor.isCodeLoaded()).toBe(false);
            expect(executor.getGameId()).toBeNull();
            
            executor.unload();
            expect(executor.isCodeLoaded()).toBe(false);
        });
    });

    describe('沙箱安全配置', () => {
        it('应禁用危险的全局 API', () => {
            const dangerousApis = [
                'require', 'import', 'eval', 'Function',
                'process', 'Buffer', '__dirname', '__filename',
                'fetch', 'XMLHttpRequest', 'WebSocket',
                'fs', 'net', 'child_process', 'os',
            ];

            for (const api of dangerousApis) {
                expect(DISABLED_GLOBALS).toContain(api);
            }
        });

        it('应有合理的默认超时时间', () => {
            expect(DEFAULT_SANDBOX_CONFIG.timeoutMs).toBeLessThanOrEqual(1000);
        });

        it('应有合理的默认内存限制', () => {
            expect(DEFAULT_SANDBOX_CONFIG.memoryLimitMb).toBeLessThanOrEqual(128);
        });
    });
});
