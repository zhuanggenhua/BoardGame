import { describe, expect, it } from 'vitest';
import { buildSharedAudioDependencyState } from '../../features/mobile-packages/packageManagerService';
import type { StoredGamePackageState } from '../../features/mobile-packages/types';

const createBaseState = (): StoredGamePackageState => ({
    gameId: 'dicethrone',
    runtimeChannel: 'stable',
    status: 'queued',
    modulePackId: 'dicethrone',
    assetPackId: 'dicethrone',
    updatedAt: 1,
});

describe('buildSharedAudioDependencyState', () => {
    it('公共音频包下载中时透传真实百分比到当前游戏卡片', () => {
        const merged = buildSharedAudioDependencyState(createBaseState(), {
            gameId: 'common-audio',
            runtimeChannel: 'stable',
            status: 'downloading',
            progressMode: 'determinate',
            progressPercent: 100,
            updatedAt: 2,
        });

        expect(merged.status).toBe('downloading');
        expect(merged.progressMode).toBe('determinate');
        expect(merged.progressPercent).toBe(100);
    });

    it('公共音频包失败时仍保留真实失败信息', () => {
        const merged = buildSharedAudioDependencyState(createBaseState(), {
            gameId: 'common-audio',
            runtimeChannel: 'stable',
            status: 'failed',
            progressMode: 'determinate',
            progressPercent: 42,
            errorCode: 'network-timeout',
            errorMessage: '网络超时',
            updatedAt: 2,
        });

        expect(merged.status).toBe('failed');
        expect(merged.progressMode).toBe('determinate');
        expect(merged.progressPercent).toBe(42);
        expect(merged.errorCode).toBe('network-timeout');
        expect(merged.errorMessage).toContain('公共音频包安装失败');
    });
});
