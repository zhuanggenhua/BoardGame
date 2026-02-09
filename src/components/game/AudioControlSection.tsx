import React from 'react';
import { useTranslation } from 'react-i18next';
import { motion } from 'framer-motion';
import {
    Volume2,
    VolumeX,
    Music,
    Disc,
    Speaker,
    SkipForward
} from 'lucide-react';
import { useAudio } from '../../contexts/AudioContext';
import clsx from 'clsx';

interface AudioControlSectionProps {
    isDark?: boolean;
}

export const AudioControlSection: React.FC<AudioControlSectionProps> = ({ isDark = true }) => {
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
        playBgm
    } = useAudio();

    const handleSwitchBgm = () => {
        if (playlist.length === 0) return;
        const currentIndex = playlist.findIndex(track => track.key === currentBgm);
        const nextIndex = (currentIndex + 1) % playlist.length;
        playBgm(playlist[nextIndex].key);
    };

    const currentTrack = playlist.find(track => track.key === currentBgm);
    const currentTrackLabel = currentTrack
        ? t(`audio.tracks.${currentTrack.key}`)
        : t('audio.nonePlaying');

    const labelClass = isDark ? "text-white/40" : "text-[#8c7b64]";
    const textClass = isDark ? "text-white/90" : "text-[#433422]";
    const borderClass = isDark ? "border-white/10" : "border-[#e5e0d0]";
    const cardBgClass = isDark ? "bg-white/5 border-white/5" : "bg-black/5 border-black/5";
    const sliderClass = isDark ? "bg-white/10 hover:bg-white/20" : "bg-black/10 hover:bg-black/20";
    const iconMutedClass = isDark ? "hover:bg-white/10 text-white/40" : "hover:bg-black/5 text-[#8c7b64]";

    return (
        <div className={clsx("space-y-4 pt-2 border-t", borderClass)}>
            {/* 音量滑块 */}
            <div className="space-y-3">
                <div className="space-y-1.5">
                    <div className={clsx("flex items-center justify-between text-[10px] uppercase tracking-wider font-bold", labelClass)}>
                        <div className="flex items-center gap-1.5">
                            <Music size={12} />
                            <span>{t('audio.bgmVolume')}</span>
                        </div>
                        <span>{Math.round(bgmVolume * 100)}%</span>
                    </div>
                    <div className="flex items-center gap-3">
                        <input
                            type="range"
                            min="0"
                            max="1"
                            step="0.01"
                            value={bgmVolume}
                            onChange={(e) => setBgmVolume(parseFloat(e.target.value))}
                            className={clsx("flex-1 h-1 rounded-full appearance-none cursor-pointer accent-indigo-400 transition-colors", sliderClass)}
                        />
                    </div>
                </div>

                <div className="space-y-1.5">
                    <div className={clsx("flex items-center justify-between text-[10px] uppercase tracking-wider font-bold", labelClass)}>
                        <div className="flex items-center gap-1.5">
                            <Speaker size={12} />
                            <span>{t('audio.sfxVolume')}</span>
                        </div>
                        <span>{Math.round(sfxVolume * 100)}%</span>
                    </div>
                    <div className="flex items-center gap-3">
                        <input
                            type="range"
                            min="0"
                            max="1"
                            step="0.01"
                            value={sfxVolume}
                            onChange={(e) => setSfxVolume(parseFloat(e.target.value))}
                            className={clsx("flex-1 h-1 rounded-full appearance-none cursor-pointer accent-emerald-400 transition-colors", sliderClass)}
                        />
                    </div>
                </div>
            </div>

            {/* 背景音乐信息与切换 */}
            <div className={clsx("flex items-center justify-between p-2 rounded-xl border", cardBgClass)}>
                <div className="flex items-center gap-2 overflow-hidden">
                    <motion.div
                        animate={{ rotate: currentBgm ? 360 : 0 }}
                        transition={{ duration: 4, repeat: Infinity, ease: "linear" }}
                        className={clsx("text-indigo-400/80", !currentBgm && 'opacity-40')}
                    >
                        <Disc size={18} />
                    </motion.div>
                    <div className="flex flex-col min-w-0">
                        <span className={clsx("text-[9px] font-bold uppercase tracking-tighter", labelClass)}>{t('audio.nowPlaying')}</span>
                        <span className={clsx("text-[11px] font-medium truncate", textClass)}>
                            {currentTrackLabel}
                        </span>
                    </div>
                </div>

                <div className="flex items-center gap-1">
                    <button
                        onClick={toggleMute}
                        className={clsx("p-1.5 rounded-lg transition-all", muted ? 'bg-red-500/20 text-red-400' : iconMutedClass)}
                        title={muted ? t('audio.unmute') : t('audio.mute')}
                    >
                        {muted ? <VolumeX size={16} /> : <Volume2 size={16} />}
                    </button>
                    <button
                        onClick={handleSwitchBgm}
                        disabled={playlist.length <= 1}
                        className={clsx("p-1.5 rounded-lg transition-all disabled:opacity-20 disabled:cursor-not-allowed", iconMutedClass)}
                        title={t('audio.switchTrack')}
                    >
                        <SkipForward size={16} />
                    </button>
                </div>
            </div>
        </div>
    );
};
