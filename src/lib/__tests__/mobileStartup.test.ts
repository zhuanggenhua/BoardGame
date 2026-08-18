import { describe, expect, it, vi } from 'vitest';
import { createNativeMobileFeatureInitializer } from '../mobile/mobileStartup';

describe('mobileStartup', () => {
    it('启动移动端能力时必须先确认 OTA bundle ready，再等待游戏包模块', async () => {
        const events: string[] = [];
        let resolvePackageManager!: (module: {
            hydrateInstalledNativeGamePackages: () => Promise<void>;
        }) => void;
        const loadPackageManagerPromise = new Promise<{
            hydrateInstalledNativeGamePackages: () => Promise<void>;
        }>((resolve) => {
            resolvePackageManager = resolve;
        });
        const hydrateInstalledNativeGamePackages = vi.fn(async () => {
            events.push('hydrate-packages');
        });

        const initialize = createNativeMobileFeatureInitializer({
            notifyBundleReady: () => {
                events.push('notify-ready');
            },
            loadPackageManager: () => {
                events.push('load-package-manager');
                return loadPackageManagerPromise;
            },
            logger: {
                error: vi.fn(),
                warn: vi.fn(),
            },
        });

        const initializePromise = initialize();

        expect(events).toEqual(['notify-ready', 'load-package-manager']);
        expect(hydrateInstalledNativeGamePackages).not.toHaveBeenCalled();

        resolvePackageManager({ hydrateInstalledNativeGamePackages });
        await initializePromise;

        expect(events).toEqual(['notify-ready', 'load-package-manager', 'hydrate-packages']);
    });

    it('游戏包启动模块加载失败时也不能阻止 OTA bundle ready 确认', async () => {
        const notifyBundleReady = vi.fn();
        const logger = {
            error: vi.fn(),
            warn: vi.fn(),
        };
        const initialize = createNativeMobileFeatureInitializer({
            notifyBundleReady,
            loadPackageManager: async () => {
                throw new Error('chunk load failed');
            },
            logger,
        });

        await initialize();

        expect(notifyBundleReady).toHaveBeenCalledTimes(1);
        expect(logger.error).toHaveBeenCalledWith(
            '[MobilePackages] 加载原生启动模块失败',
            expect.objectContaining({ message: 'chunk load failed' }),
        );
    });
});
