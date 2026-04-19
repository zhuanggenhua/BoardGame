/**
 * 框架核心模块导出
 */

export * from './types';
export * from './ui';
export * from './WarmPreloadScheduler';
export {
    // 注册表 API
    registerGameAssets,
    getImagePath,
    getAudioPath,
    getSpriteAtlas,
    preloadGameAssets,
    clearGameAssetsCache,
    setAssetsBaseUrl,
    getAssetsBaseUrl,
    setCommonAudioAssetBaseOverride,
    setGameAssetBaseOverride,
    clearGameAssetBaseOverrides,
    // 两阶段预加载 API
    preloadCriticalImages,
    preloadWarmImages,
    cancelWarmPreload,
    areAllCriticalImagesCached,
    isImagePreloaded,
    getPreloadedImageElement,
    markImageLoaded,
    waitForCriticalImages,
    signalCriticalImagesReady,
    getCriticalImagesEpoch,
    isCriticalImagesReady,
    onImageReady,
    // 便捷工具 API
    assetsPath,
    getOptimizedImageUrls,
    getOptimizedAudioUrl,
    getLocalizedAssetPath,
    getLocalizedImageCandidateUrls,
    getLocalizedImageUrls,
    buildLocalizedImageSet,
    buildOptimizedImageSet,
    getDirectAssetPath,
    getLocalAssetPath,
    getLocalizedLocalAssetPath,
} from './AssetLoader';
export {
    registerCriticalImageResolver,
    getCriticalImageResolver,
    resolveCriticalImages,
} from './CriticalImageResolverRegistry';
