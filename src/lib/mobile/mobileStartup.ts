type PackageManagerModule = {
    hydrateInstalledNativeGamePackages: () => Promise<void>;
};

type NativeMobileFeatureInitializerOptions = {
    notifyBundleReady: () => void | Promise<void>;
    loadPackageManager: () => Promise<PackageManagerModule>;
    logger?: Pick<Console, 'error' | 'warn'>;
};

export const createNativeMobileFeatureInitializer = ({
    notifyBundleReady,
    loadPackageManager,
    logger = console,
}: NativeMobileFeatureInitializerOptions) => async () => {
    try {
        void Promise.resolve(notifyBundleReady()).catch((error) => {
            logger.warn('[OTA] notifyAppReady 调用失败', error);
        });
    } catch (error) {
        logger.warn('[OTA] notifyAppReady 调用失败', error);
    }

    let packageManager: PackageManagerModule;
    try {
        packageManager = await loadPackageManager();
    } catch (error) {
        logger.error('[MobilePackages] 加载原生启动模块失败', error);
        return;
    }

    try {
        await packageManager.hydrateInstalledNativeGamePackages();
    } catch (error) {
        logger.warn('[MobilePackages] 同步原生已安装游戏包失败', error);
    }
};
