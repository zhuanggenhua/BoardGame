import { getOptimizedImageUrls } from '../../core/AssetLoader';
import type { UISceneResolvedAsset } from '../types';

export function resolveCompiledAssetUrl(asset?: UISceneResolvedAsset): string {
    if (!asset) {
        return '';
    }

    if (asset.sourceMode === 'remote') {
        return asset.remoteUrl ?? '';
    }

    return asset.path ? getOptimizedImageUrls(asset.path).webp : '';
}
