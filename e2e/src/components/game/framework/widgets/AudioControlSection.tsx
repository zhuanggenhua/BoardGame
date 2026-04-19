import { useState, useMemo, useCallback, memo } from 'react';
import { useTranslation } from 'react-i18next';
import { motion, AnimatePresence } from 'framer-motion';
import {
    Volume2,
    VolumeX,
    Music,
    Disc,
    Speaker,
    SkipForward,
    SkipBack,
    ChevronDown,
    ChevronUp,
    Play,
} from 'lucide-react';
import { useAudio } from '../../../../contexts/AudioContext';
import clsx from 'clsx';

interface AudioControlSectionProps {
    isDark?: boolean;
}

/**
 * 从 i18n 获取曲目显示名
 * 注意：BGM registry key 含大量 `.`（如 bgm.fantasy.xxx），
 * 而 i18next 默认用 `.` 做 keySeparator，直接拼路径会解析失败。
 * 因此用 returnObjects 拿到整个 tracks map，再做直接属性查找。
 */
const useTrackLabel = (key: string, fallbackName?: string) => {
    const { t } = useTranslation('game');
    // 一次性获取 audio.tracks 下的扁平 map
    const tracksMap = t('audio.tracks', { returnObjects: true }) as Record<string, string> | string;
    // 如果 returnObjects 成功返回对象，直接用 key 查找
    if (typeof tracksMap === 'object' && tracksMap !== null) {
        const translated = tracksMap[key];
        if (translated) return translated;
    }
    if (fallbackName) return fallbackName;
    // 最后兜底：从 key 中提取可读名
    const parts = key.split('.');
    const last = parts[parts.length - 1] ?? key;
    return last.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase());
};

/** 单个曲目行 */
const TrackItem = memo(({ trackKey, name, isPlaying, isDark, onSelect }: {
    trackKey: string;
    name: string;
    isPlaying: boolean;
    isDark: boolean;
    onSelect: (key: string) => void;
}) => {
    const label = useTrackLabel(trackKey, name);
    return (
        <button
            onClick={() => onSelect(trackKey)}
            className={clsx(
                'w-full flex items-center gap-2 px-2.5 py-1.5 rounded-lg text-left transition-colors',
                isPlaying
                    ? isDark
                        ? 'bg-indigo-500/20 text-indigo-300'
                        : 'bg-indigo-500/10 text-indigo-600'
                    : isDark
                        ? 'hover:bg-white/5 text-white/70 hover:text-white/90'
                        : 'hover:bg-black/5 text-[#5a4a3a] hover:text-[#433422]',
            )}
        >
            {isPlaying ? (
                <motion.div
                    animate={{ rotate: 360 }}
                    transition={{ duration: 3, repeat: Infinity, ease: 'linear' }}
                    className="shrink-0"
                >
                    <Disc size={13} />
                </motion.div>
            ) : (
                <Play size={11} className="shrink-0 opacity-40" />
            )}
            <span className="text-[11px] font-medium truncate">{label}</span>
        </button>
    );
});
TrackItem.displayName = 'TrackItem';

export const AudioControlSection = ({ isDark = true }: AudioControlSectionProps) => {
    const { t } = useTranslation('game');
    const {
        muted,
        toggleMute,
        sfxVolume,
        setSfxVolume,
        bgmVolume,
        setBgmVolume,
        playlist,
        currentBgm,
        switchBgm,
        switchBgmPrev,
        playBgm,
        setBgmSelection,
        activeGameId,
        activeBgmGroup,
    } = useAudio();
    const [listExpanded, setListExpanded] = useState(false);

    const handleSwitchBgm = useCallback(() => {
        if (playlist.length === 0) return;
        switchBgm();
    }, [playlist.length, switchBgm]);

    const handleSwitchBgmPrev = useCallback(() => {
        if (playlist.length === 0) return;
        switchBgmPrev();
    }, [playlist.length, switchBgmPrev]);

    /** 点选曲目：立即播放 + 保存选择 */
    const handleSelectTrack = useCallback((key: string) => {
        playBgm(key);
        if (activeGameId && activeBgmGroup) {
            setBgmSelection(activeGameId, activeBgmGroup, key);
        }
    }, [playBgm, activeGameId, activeBgmGroup, setBgmSelection]);

    const currentTrack = useMemo(
        () => playlist.find(track => track.key === currentBgm),
        [playlist, currentBgm],
    );
    const currentTrackLabel = useTrackLabel(
        currentTrack?.key ?? '',
        currentTrack?.name,
    );
    const displayLabel = currentTrack ? currentTrackLabel : t('audio.nonePlaying');

    const labelClass = isDark ? 'text-white/60' : 'text-[#8c7b64]';
    const textClass = isDark ? 'text-white/90' : 'text-[#433422]';
    const borderClass = isDark ? 'border-white/10' : 'border-[#e5e0d0]';
    const cardBgClass = isDark ? 'bg-white/5 border-white/5' : 'bg-black/5 border-black/5';
    const sliderClass = isDark ? 'bg-white/10 hover:bg-white/20' : 'bg-black/10 hover:bg-black/20';
    const iconMutedClass = isDark ? 'hover:bg-white/10 text-white/40' : 'hover:bg-black/5 text-[#8c7b64]';
    const listBgClass = isDark ? 'bg-black/30' : 'bg-white/60';

    return (
        <div className={clsx('space-y-4 pt-2 border-t', borderClass)}>
            {/* 音量滑块 */}
            <div className="space-y-3">
                <div className="space-y-1.5">
                    <div className={clsx('flex items-center justify-between text-[10px] uppercase tracking-wider font-bold', labelClass)}>
                        <div className="flex items-center gap-1.5">
                            <Music size={12} />
                            <span>{t('audio.bgmVolume')}</span>
                        </div>
                        <span>{Math.round(bgmVolume * 100)}%</span>
                    </div>
                    <input
                        type="range"
                        min="0"
                        max="1"
                        step="0.01"
                        value={bgmVolume}
                        onChange={(e) => setBgmVolume(parseFloat(e.target.value))}
                        className={clsx('w-full h-1 rounded-full appearance-none cursor-pointer accent-indigo-400 transition-colors', sliderClass)}
                    />
                </div>

                <div className="space-y-1.5">
                    <div className={clsx('flex items-center justify-between text-[10px] uppercase tracking-wider font-bold', labelClass)}>
                        <div className="flex items-center gap-1.5">
                            <Speaker size={12} />
                            <span>{t('audio.sfxVolume')}</span>
                        </div>
                        <span>{Math.round(sfxVolume * 100)}%</span>
                    </div>
                    <input
                        type="range"
                        min="0"
                        max="1"
                        step="0.01"
                        value={sfxVolume}
                        onChange={(e) => setSfxVolume(parseFloat(e.target.value))}
                        className={clsx('w-full h-1 rounded-full appearance-none cursor-pointer accent-emerald-400 transition-colors', sliderClass)}
                    />
                </div>
            </div>

            {/* 正在播放 + 控制按钮 */}
            <div className={clsx('flex items-center justify-between p-2 rounded-xl border', cardBgClass)}>
                <div className="flex items-center gap-2 overflow-hidden">
                    <motion.div
                        animate={{ rotate: currentBgm ? 360 : 0 }}
                        transition={{ duration: 4, repeat: Infinity, ease: 'linear' }}
                        className={clsx('text-indigo-400/80', !currentBgm && 'opacity-40')}
                    >
                        <Disc size={18} />
                    </motion.div>
                    <div className="flex flex-col min-w-0">
                        <span className={clsx('text-[9px] font-bold uppercase tracking-tighter', labelClass)}>
                            {t('audio.nowPlaying')}
                        </span>
                        <span className={clsx('text-[11px] font-medium truncate', textClass)}>
                            {displayLabel}
                        </span>
                    </div>
                </div>

                <div className="flex items-center gap-1">
                    <button
                        onClick={toggleMute}
                        className={clsx('p-1.5 rounded-lg transition-all', muted ? 'bg-red-500/20 text-red-400' : iconMutedClass)}
                        title={muted ? t('audio.unmute') : t('audio.mute')}
                    >
                        {muted ? <VolumeX size={16} /> : <Volume2 size={16} />}
                    </button>
                    <button
                        onClick={handleSwitchBgmPrev}
                        disabled={playlist.length <= 1}
                        className={clsx('p-1.5 rounded-lg transition-all disabled:opacity-20 disabled:cursor-not-allowed', iconMutedClass)}
                        title={t('audio.prevTrack')}
                    >
                        <SkipBack size={16} />
                    </button>
                    <button
                        onClick={handleSwitchBgm}
                        disabled={playlist.length <= 1}
                        className={clsx('p-1.5 rounded-lg transition-all disabled:opacity-20 disabled:cursor-not-allowed', iconMutedClass)}
                        title={t('audio.switchTrack')}
                    >
                        <SkipForward size={16} />
                    </button>
                </div>
            </div>

            {/* 曲目列表（可折叠） */}
            {playlist.length > 1 && (
                <div>
                    <button
                        onClick={() => setListExpanded(prev => !prev)}
                        className={clsx(
                            'w-full flex items-center justify-between px-2 py-1.5 rounded-lg text-[10px] uppercase tracking-wider font-bold transition-colors',
                            isDark ? 'hover:bg-white/5 text-white/80' : 'hover:bg-black/5 text-[#8c7b64]',
                        )}
                    >
                        <span>{t('audio.trackList', { count: playlist.length })}</span>
                        {listExpanded ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
                    </button>

                    <AnimatePresence initial={false}>
                        {listExpanded && (
                            <motion.div
                                initial={{ height: 0, opacity: 0 }}
                                animate={{ height: 'auto', opacity: 1 }}
                                exit={{ height: 0, opacity: 0 }}
                                transition={{ duration: 0.2, ease: 'easeInOut' }}
                                className="overflow-hidden"
                            >
                                <div className={clsx(
                                    'mt-1 rounded-xl p-1 max-h-[200px] overflow-y-auto space-y-0.5',
                                    'scrollbar-thin scrollbar-thumb-white/10 scrollbar-track-transparent',
                                    listBgClass,
                                )}>
                                    {playlist.map(track => (
                                        <TrackItem
                                            key={track.key}
                                            trackKey={track.key}
                                            name={track.name}
                                            isPlaying={track.key === currentBgm}
                                            isDark={isDark}
                                            onSelect={handleSelectTrack}
                                        />
                                    ))}
                                </div>
                            </motion.div>
                        )}
                    </AnimatePresence>
                </div>
            )}
        </div>
    );
};
