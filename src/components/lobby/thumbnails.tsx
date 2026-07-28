import React from 'react';
import { useTranslation } from 'react-i18next';
import type { GameManifestEntry } from '../../games/manifest.types';
import { OptimizedImage, SHIMMER_BG } from '../common/media/OptimizedImage';
import { resolveGameDisplayName } from './gameDetailsContent';

// 响应式缩略图组件：自适应父容器大小
export const NeonTicTacToeThumbnail = () => (
    <div className="w-full h-full bg-slate-900 relative overflow-hidden flex items-center justify-center">
        {/* 网格背景 */}
        <div className="absolute inset-0 opacity-20"
            style={{ backgroundImage: 'linear-gradient(#00F3FF 1px, transparent 1px), linear-gradient(90deg, #00F3FF 1px, transparent 1px)', backgroundSize: '20%' }}
        ></div>

        {/* 发光中心 */}
        <div className="absolute inset-0 bg-gradient-to-t from-slate-900 via-transparent to-transparent"></div>

        {/* 游戏元素 - 按容器比例缩放 */}
        <div className="w-[80%] h-[80%] grid grid-cols-3 gap-1 opacity-90 transform rotate-6">
            <div className="border-r border-b border-cyan-500/50 flex items-center justify-center">
                <span className="text-cyan-400 font-bold text-[1.5rem] leading-none" style={{ textShadow: '0 0 5px rgba(0,243,255,0.8)' }}>X</span>
            </div>
            <div className="border-b border-cyan-500/50"></div>
            <div className="border-l border-b border-cyan-500/50 flex items-center justify-center">
                <span className="text-fuchsia-500 font-bold text-[1.5rem] leading-none" style={{ textShadow: '0 0 5px rgba(188,19,254,0.8)' }}>O</span>
            </div>

            <div className="border-r border-cyan-500/50"></div>
            <div className="flex items-center justify-center">
                <span className="text-cyan-400 font-bold text-[1.5rem] leading-none" style={{ textShadow: '0 0 5px rgba(0,243,255,0.8)' }}>X</span>
            </div>
            <div className="border-l border-cyan-500/50"></div>

            <div className="border-t border-r border-cyan-500/50"></div>
            <div className="border-t border-cyan-500/50 flex items-center justify-center">
                <span className="text-fuchsia-500 font-bold text-[1.5rem] leading-none" style={{ textShadow: '0 0 5px rgba(188,19,254,0.8)' }}>O</span>
            </div>
            <div className="border-t border-l border-cyan-500/50"></div>
        </div>

        {/* 覆盖徽标 - 更小更紧凑（移除背景模糊） */}
        <div className="absolute top-1 right-1 bg-black/80 border border-white/10 px-1 py-0.5 rounded text-[8px] font-mono text-cyan-300">
            PRO
        </div>
    </div>
);

interface DefaultGameThumbnailProps {
    titleKey: string;
    icon?: string;
    fallbackId?: string;
}

export const DefaultGameThumbnail = ({ titleKey, icon, fallbackId }: DefaultGameThumbnailProps) => {
    const { t } = useTranslation('lobby');
    const resolvedFallbackId = fallbackId ?? titleKey;
    const title = resolveGameDisplayName({ id: resolvedFallbackId, titleKey }, t, resolvedFallbackId);
    return (
        <div className="w-full h-full bg-parchment-cream flex flex-col items-center justify-center gap-2">
            {icon && <span className="text-3xl">{icon}</span>}
            <span className="text-sm text-stone-600 font-medium px-2 text-center truncate max-w-full">
                {title}
            </span>
        </div>
    );
};

type ManifestGameThumbnailProps = {
    manifest: GameManifestEntry;
};

export const ManifestGameThumbnail = ({ manifest }: ManifestGameThumbnailProps) => {
    const { t } = useTranslation('lobby');
    const [imgFailed, setImgFailed] = React.useState(false);
    const [imgLoaded, setImgLoaded] = React.useState(false);
    const title = resolveGameDisplayName(manifest, t, manifest.id);

    React.useEffect(() => {
        setImgFailed(false);
        setImgLoaded(false);
    }, [manifest.id, manifest.thumbnailPath]);

    if (!manifest.thumbnailPath || imgFailed) {
        return <DefaultGameThumbnail titleKey={manifest.titleKey} icon={manifest.icon} fallbackId={manifest.id} />;
    }
    return (
        <div
            className="w-full h-full relative overflow-hidden bg-parchment-cream"
            style={imgLoaded ? undefined : SHIMMER_BG}
        >
            <OptimizedImage
                src={manifest.thumbnailPath}
                alt={title}
                className="absolute inset-0 w-full h-full object-cover"
                placeholder={false}
                onLoad={() => setImgLoaded(true)}
                onError={() => setImgFailed(true)}
            />
        </div>
    );
};
