/**
 * 框架核心模块导出
 */

export * from './types';
export * from './ui';
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
    // 便捷工具 API
    assetsPath,
    getOptimizedImageUrls,
    getOptimizedAudioUrl,
    getLocalizedAssetPath,
    getLocalizedImageUrls,
    buildLocalizedImageSet,
    buildOptimizedImageSet,
    getDirectAssetPath,
} from './AssetLoader';
