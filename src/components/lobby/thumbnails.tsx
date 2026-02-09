import { useTranslation } from 'react-i18next';
import type { GameManifestEntry } from '../../games/manifest.types';
import { OptimizedImage } from '../common/media/OptimizedImage';

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

type DefaultGameThumbnailProps = {
    titleKey: string;
    icon?: string;
};

export const DefaultGameThumbnail = ({ titleKey, icon }: DefaultGameThumbnailProps) => {
    const { t } = useTranslation('lobby');
    return (
        <div className="w-full h-full bg-[#fcfbf9] flex flex-col items-center justify-center text-[#433422] font-bold">
            <div className="text-4xl leading-none">{icon ?? '🎲'}</div>
            <div className="mt-1 text-[10px] tracking-widest text-[#8c7b64]">{t(titleKey)}</div>
        </div>
    );
};

type ManifestGameThumbnailProps = {
    manifest: GameManifestEntry;
};

export const ManifestGameThumbnail = ({ manifest }: ManifestGameThumbnailProps) => {
    const { t } = useTranslation('lobby');
    if (!manifest.thumbnailPath) {
        return <DefaultGameThumbnail titleKey={manifest.titleKey} icon={manifest.icon} />;
    }
    const title = t(manifest.titleKey);
    return (
        <OptimizedImage
            src={manifest.thumbnailPath}
            alt={title}
            className="w-full h-full object-cover"
        />
    );
};
