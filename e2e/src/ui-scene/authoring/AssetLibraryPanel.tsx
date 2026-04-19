import React from 'react';
import type { UISceneAssetRegistrySource } from '../types';
import { getOptimizedImageUrls } from '../../core/AssetLoader';

export interface AssetLibraryPanelProps {
    assetRegistry: UISceneAssetRegistrySource;
    selectedNodeSupportsAsset: boolean;
    onApplyAsset: (assetRef: string) => void;
}

function resolveAssetSourceLabel(entry: UISceneAssetRegistrySource['assets'][string]) {
    if (entry.remoteUrl && !entry.path) {
        return '仅 R2';
    }
    if (entry.remoteUrl && entry.path) {
        return '本地 + R2';
    }
    return '仅本地';
}

export function AssetLibraryPanel({
    assetRegistry,
    selectedNodeSupportsAsset,
    onApplyAsset,
}: AssetLibraryPanelProps) {
    const entries = Object.entries(assetRegistry.assets);

    return (
        <div
            data-testid="home-v2-asset-panel"
            className="flex h-full flex-col overflow-hidden rounded-[18px] border border-white/10 bg-[#17110e]/98 shadow-[0_18px_48px_rgba(0,0,0,0.24)]"
        >
            <div className="border-b border-white/10 px-4 py-3">
                <div className="text-[11px] font-semibold tracking-[0.22em] text-amber-200/70">资源</div>
                <div className="mt-1 text-sm font-semibold text-amber-50">本地素材 / R2 素材</div>
            </div>
            <div className="flex-1 space-y-2 overflow-y-auto px-3 py-3">
                {entries.map(([assetRef, entry]) => (
                    <div
                        key={assetRef}
                        className="rounded-[16px] border border-white/8 bg-white/5 px-3 py-3"
                    >
                        <div className="mb-3 overflow-hidden rounded-[12px] border border-white/8 bg-black/20">
                            {entry.path || entry.remoteUrl ? (
                                <img
                                    src={entry.path ? getOptimizedImageUrls(entry.path).webp : entry.remoteUrl}
                                    alt={assetRef}
                                    className="h-28 w-full object-contain"
                                />
                            ) : (
                                <div className="flex h-28 items-center justify-center text-[12px] text-white/40">
                                    暂无预览
                                </div>
                            )}
                        </div>
                        <div className="flex items-center justify-between gap-3">
                            <div className="min-w-0">
                                <div className="truncate text-sm font-semibold text-amber-50">{assetRef}</div>
                                <div className="mt-1 text-[12px] leading-[1.6] text-white/55">
                                    {entry.path ?? entry.remoteUrl ?? '未配置路径'}
                                </div>
                            </div>
                            <span className="rounded-full border border-white/10 bg-black/20 px-2 py-0.5 text-[10px] text-white/60">
                                {resolveAssetSourceLabel(entry)}
                            </span>
                        </div>
                        <button
                            type="button"
                            disabled={!selectedNodeSupportsAsset}
                            onClick={() => onApplyAsset(assetRef)}
                            className="mt-3 rounded-full bg-amber-200 px-3 py-1.5 text-[12px] font-semibold text-[#3f2a17] disabled:cursor-not-allowed disabled:opacity-45"
                        >
                            {selectedNodeSupportsAsset ? '应用到当前图片节点' : '先选中图片节点'}
                        </button>
                    </div>
                ))}
            </div>
        </div>
    );
}
