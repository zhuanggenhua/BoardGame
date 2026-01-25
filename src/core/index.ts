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
    // 便捷工具 API
    assetsPath,
    getOptimizedImageUrls,
    getLocalizedAssetPath,
    getLocalizedImageUrls,
    buildLocalizedImageSet,
    buildOptimizedImageSet,
    getDirectAssetPath,
} from './AssetLoader';
