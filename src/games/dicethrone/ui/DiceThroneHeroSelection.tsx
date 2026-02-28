/**
 * Dice Throne 角色选择界面 - 物理架构还原版
 * 严格保留原始图片使用方式和布局比例，修复 fallbackSrc 缺失导致的图片破碎问题
 */

import React, { useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { motion, AnimatePresence } from 'framer-motion';
import { Check } from 'lucide-react';
import { OptimizedImage } from '../../../components/common/media/OptimizedImage';
import { MagnifyOverlay } from '../../../components/common/overlays/MagnifyOverlay';
import { buildLocalizedImageSet, UI_Z_INDEX } from '../../../core';
import { playSound } from '../../../lib/audio/useGameAudio';
import { getPortraitStyle, ASSETS } from './assets';
import { DICETHRONE_CHARACTER_CATALOG, type SelectableCharacterId, type CharacterId } from '../domain/types';
import type { PlayerId } from '../../../engine/types';
import clsx from 'clsx';

export interface DiceThroneHeroSelectionProps {
    isOpen: boolean;
    currentPlayerId: PlayerId;
    hostPlayerId: PlayerId;
    selectedCharacters: Record<PlayerId, CharacterId>;
    readyPlayers: Record<PlayerId, boolean>;
    playerNames: Record<PlayerId, string>;
    onSelect: (characterId: SelectableCharacterId) => void;
    onReady: () => void;
    onStart: () => void;
    locale: string;
}

const PLAYER_COLORS: Record<string, { bg: string; text: string; glow: string; shadow: string }> = {
    '0': { bg: '#F43F5E', text: 'white', glow: 'rgba(244,63,94,0.6)', shadow: '#9F1239' },
    '1': { bg: '#3B82F6', text: 'white', glow: 'rgba(59,130,246,0.6)', shadow: '#1E40AF' },
    '2': { bg: '#10B981', text: 'white', glow: 'rgba(16,185,129,0.6)', shadow: '#065F46' },
    '3': { bg: '#F59E0B', text: 'black', glow: 'rgba(245,158,11,0.6)', shadow: '#92400E' },
};

const PLAYER_LABELS: Record<string, string> = {
    '0': 'P1',
    '1': 'P2',
    '2': 'P3',
    '3': 'P4',
};

const HERO_SELECTION_CLICK_SOUND_KEY = 'ui.general.khron_studio_rpg_interface_essentials_inventory_dialog_ucs_system_192khz.dialog.dialog_choice.uiclick_dialog_choice_01_krst_none';

export const DiceThroneHeroSelection: React.FC<DiceThroneHeroSelectionProps> = ({
    isOpen,
    currentPlayerId,
    hostPlayerId,
    selectedCharacters,
    readyPlayers,
    playerNames,
    onSelect,
    onReady,
    onStart,
    locale,
}) => {
    const { t } = useTranslation('game-dicethrone');
    const isHost = currentPlayerId === hostPlayerId;
    const playerIds = Object.keys(playerNames);

    const everyoneReady = playerIds.every(pid => {
        const char = selectedCharacters[pid as PlayerId];
        const hasSelected = char && char !== 'unselected';
        if (pid === hostPlayerId) return hasSelected;
        return hasSelected && readyPlayers[pid as PlayerId];
    });

    const hasSelectedChar = selectedCharacters[currentPlayerId] && selectedCharacters[currentPlayerId] !== 'unselected';

    const availableCharacters = useMemo(() => {
        return DICETHRONE_CHARACTER_CATALOG.filter(char =>
            ['monk', 'barbarian', 'pyromancer', 'moon_elf', 'shadow_thief', 'paladin'].includes(char.id)
        );
    }, []);

    const previewCharId = useMemo(() => {
        const mySelection = selectedCharacters[currentPlayerId];
        if (mySelection && mySelection !== 'unselected') return mySelection;
        return availableCharacters[0]?.id || 'monk';
    }, [selectedCharacters, currentPlayerId, availableCharacters]);

    const [magnifyImage, setMagnifyImage] = useState<string | null>(null);

    const handleSelectCharacter = (characterId: SelectableCharacterId) => {
        playSound(HERO_SELECTION_CLICK_SOUND_KEY);
        onSelect(characterId);
    };

    const handleReady = () => {
        playSound(HERO_SELECTION_CLICK_SOUND_KEY);
        onReady();
    };

    const handleStart = () => {
        playSound(HERO_SELECTION_CLICK_SOUND_KEY);
        onStart();
    };

    const readyProgressDots = useMemo(() => {
        return playerIds.map(pid => {
            const charId = selectedCharacters[pid as PlayerId];
            const hasSelected = charId && charId !== 'unselected';
            const isReady = pid === hostPlayerId ? hasSelected : hasSelected && readyPlayers[pid as PlayerId];

            return (
                <span
                    key={`ready-dot-${pid}`}
                    className={clsx(
                        'w-[0.55vw] h-[0.55vw] rounded-full',
                        isReady
                            ? 'bg-emerald-400 shadow-[0_0_0.6vw_rgba(16,185,129,0.6)]'
                            : 'bg-white/30'
                    )}
                />
            );
        });
    }, [playerIds, selectedCharacters, readyPlayers, hostPlayerId]);

    if (!isOpen) return null;

    return (
        <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 h-full flex bg-[#050510] overflow-hidden select-none text-white font-sans"
            style={{ zIndex: UI_Z_INDEX.overlay }}
        >
            {/* 动态氛围背景（铺满整个 overlay） */}
            <div
                className="absolute inset-0 pointer-events-none"
                style={{
                    zIndex: 0,
                    backgroundImage: buildLocalizedImageSet('dicethrone/images/Common/background', locale),
                    backgroundSize: 'cover',
                    backgroundPosition: 'center',
                    backgroundRepeat: 'no-repeat',
                    opacity: 0.85,
                }}
            />
            <div className="absolute inset-0 bg-indigo-950/3 pointer-events-none" style={{ zIndex: 1 }} />

            {/* 左侧：英雄选择列表 (18vw) */}
            <div className="w-[18vw] h-full border-r border-white/5 flex flex-col z-10 bg-black/15 backdrop-blur-2xl relative flex-shrink-0">
                <div className="px-[1vw] pt-[1.2vw] pb-[0.6vw] border-b border-white/10">
                    <h2 className="text-[1vw] font-bold text-white/90 uppercase tracking-wider">
                        {t('selection.title')}
                    </h2>
                </div>
                <div className="flex-1 overflow-y-auto custom-scrollbar p-[1vw] grid grid-cols-2 gap-[0.8vw] content-start pt-[1vw]">
                    {availableCharacters.map((char, index) => {
                        const isSelectedByMe = selectedCharacters[currentPlayerId] === char.id;

                        return (
                            <motion.div
                                key={char.id}
                                data-character-id={char.id}
                                initial={{ opacity: 0, scale: 0.8 }}
                                animate={{ opacity: 1, scale: 1 }}
                                transition={{ delay: index * 0.03 }}
                                className={clsx(
                                    "relative aspect-[3/4] rounded-[0.4vw] border-2 transition-all duration-300 overflow-hidden cursor-pointer group",
                                    isSelectedByMe
                                        ? "border-amber-400 shadow-[0_0_1.5vw_rgba(251,191,36,0.4)] z-20 scale-[1.02]"
                                        : "border-white/10 hover:border-white/30 hover:scale-[1.02]"
                                )}
                                onClick={() => handleSelectCharacter(char.id as SelectableCharacterId)}
                            >
                                <div className={clsx(
                                    "absolute inset-0 z-0 transition-all duration-500",
                                    isSelectedByMe ? "grayscale-0 scale-110" : "grayscale opacity-60 group-hover:grayscale-0 group-hover:opacity-100 group-hover:scale-105"
                                )}
                                    style={getPortraitStyle(char.id, locale)} />

                                <div className="absolute inset-0 bg-gradient-to-t from-black via-transparent to-transparent opacity-80" />

                                <div className="absolute bottom-[0.5vw] left-[0.5vw] right-[0.5vw]">
                                    <div className="text-[0.7vw] font-black truncate uppercase tracking-tight text-white/90">
                                        {t(char.nameKey)}
                                    </div>
                                </div>

                                <div className="absolute top-[0.3vw] right-[0.3vw] flex -space-x-[0.3vw]">
                                    {playerIds.filter(pid => selectedCharacters[pid as PlayerId] === char.id).map(pid => (
                                        <div
                                            key={pid}
                                            className="w-[1.2vw] h-[1.2vw] rounded-full border border-white/80 flex items-center justify-center text-[0.5vw] font-black shadow-lg"
                                            style={{ backgroundColor: PLAYER_COLORS[pid]?.bg }}
                                        >
                                            {PLAYER_LABELS[pid]}
                                        </div>
                                    ))}
                                </div>
                            </motion.div>
                        );
                    })}
                </div>
            </div>

            {/* 右侧：角色预览区 */}
            <div className="flex-1 h-full relative flex flex-col z-10 overflow-hidden bg-gradient-to-br from-slate-900/5 to-black/12">
                <div className="flex-1 flex items-center justify-center p-[1vw] overflow-hidden">
                    <AnimatePresence mode="wait">
                        <motion.div
                            key={previewCharId}
                            initial={{ opacity: 0, scale: 0.98, y: 20 }}
                            animate={{ opacity: 1, scale: 1, y: 0 }}
                            exit={{ opacity: 0, scale: 1.02, y: -20 }}
                            className="relative w-full h-full flex items-center justify-center"
                        >
                            <div className="flex items-center justify-center gap-[1vw] h-full">
                                {/* 物理面板预览 - OptimizedImage 自动处理本地化路径 */}
                                <div
                                    className="relative h-[85%] w-auto shadow-2xl rounded-[0.6vw] overflow-hidden cursor-zoom-in hover:ring-2 hover:ring-amber-400/50 transition-all"
                                    onClick={() => setMagnifyImage(ASSETS.PLAYER_BOARD(previewCharId as CharacterId))}
                                >
                                    <OptimizedImage
                                        src={ASSETS.PLAYER_BOARD(previewCharId as CharacterId)}
                                        locale={locale}
                                        className="h-full w-auto object-contain"
                                        alt="Player Board"
                                    />
                                </div>

                                <div
                                    className="relative h-[85%] w-auto rounded-[0.6vw] overflow-hidden shadow-2xl cursor-zoom-in hover:ring-2 hover:ring-amber-400/50 transition-all"
                                    onClick={() => setMagnifyImage(ASSETS.TIP_BOARD(previewCharId as CharacterId))}
                                >
                                    <OptimizedImage
                                        src={ASSETS.TIP_BOARD(previewCharId as CharacterId)}
                                        locale={locale}
                                        className="h-full w-auto object-contain"
                                        alt="Tip Board"
                                    />
                                </div>
                            </div>
                        </motion.div>
                    </AnimatePresence>
                </div>

                {/* 底部玩家面板 (8vw) */}
                <div
                    className="h-[8vw] bg-gradient-to-t from-black/25 via-black/10 to-transparent backdrop-blur-xl flex items-center justify-center gap-[3vw] px-[4vw] flex-shrink-0"
                    style={{ zIndex: UI_Z_INDEX.hud }}
                >
                    <div className="flex items-center justify-center gap-[1.5vw]">
                        {playerIds.map(pid => {
                            const charId = selectedCharacters[pid as PlayerId];
                            const isMe = pid === currentPlayerId;
                            const hasSelected = charId && charId !== 'unselected';
                            const colors = PLAYER_COLORS[pid] || PLAYER_COLORS['0'];

                            return (
                                <motion.div
                                    key={pid}
                                    className={clsx(
                                        "flex items-center gap-[0.8vw] px-[1.5vw] py-[0.6vw] rounded-full transition-all duration-300",
                                        isMe ? "bg-white/15 ring-2 ring-amber-400/50" : "bg-white/8"
                                    )}
                                    initial={{ opacity: 0, y: 20 }}
                                    animate={{ opacity: 1, y: 0 }}
                                    transition={{ delay: Number(pid) * 0.08 }}
                                >
                                    <div
                                        className="w-[2.5vw] h-[2.5vw] rounded-full flex items-center justify-center text-[1vw] font-black"
                                        style={{
                                            backgroundColor: colors.bg,
                                            color: colors.text,
                                            boxShadow: `0 0 15px ${colors.glow}`
                                        }}
                                    >
                                        {PLAYER_LABELS[pid]}
                                    </div>

                                    <div className="flex flex-col">
                                        <div className={clsx(
                                            "text-[0.9vw] font-black uppercase tracking-wide leading-tight",
                                            hasSelected ? "text-amber-400" : "text-white/50"
                                        )}>
                                            {hasSelected ? t(`characters.${charId}`) : t('selection.notSelected')}
                                        </div>
                                        <div className="text-[0.6vw] text-white/50 truncate max-w-[8vw]">
                                            {playerNames[pid as PlayerId]}
                                            {isMe && <span className="ml-[0.2vw] text-amber-400/80 font-bold">({t('selection.you')})</span>}
                                        </div>
                                    </div>

                                    {readyPlayers[pid as PlayerId] && (
                                        <div className="w-[1.2vw] h-[1.2vw] rounded-full bg-emerald-500 flex items-center justify-center text-white">
                                            <Check size={14} className="text-white" strokeWidth={3} />
                                        </div>
                                    )}
                                </motion.div>
                            );
                        })}
                    </div>

                    <div className="flex items-center">
                        {!isHost && hasSelectedChar && !readyPlayers[currentPlayerId] && (
                            <motion.button
                                initial={{ scale: 0.9, opacity: 0 }}
                                animate={{ scale: 1, opacity: 1 }}
                                onClick={handleReady}
                                className="px-[3vw] py-[1vw] rounded-full text-[1.2vw] font-black uppercase tracking-[0.2em] transition-all duration-300 border-2 bg-emerald-500 text-white border-emerald-400 hover:bg-emerald-400 hover:scale-105 active:scale-95 cursor-pointer shadow-[0_0_30px_rgba(16,185,129,0.5)]"
                            >
                                {t('selection.ready')}
                            </motion.button>
                        )}

                        {!isHost && readyPlayers[currentPlayerId] && (
                            <div className="px-[3vw] py-[1vw] rounded-full text-[1.2vw] font-black uppercase tracking-[0.2em] border-2 bg-white/5 text-emerald-400 border-emerald-400/50">
                                <span className="inline-flex items-center gap-[0.8vw]">
                                    <span>{t('selection.readyWaiting')}</span>
                                    <span className="flex items-center gap-[0.35vw]">{readyProgressDots}</span>
                                </span>
                            </div>
                        )}

                        {isHost && hasSelectedChar && (
                            <motion.button
                                initial={{ scale: 0.9, opacity: 0 }}
                                animate={{ scale: 1, opacity: 1 }}
                                disabled={!everyoneReady}
                                onClick={handleStart}
                                className={clsx(
                                    "px-[3vw] py-[1vw] rounded-full text-[1.2vw] font-black uppercase tracking-[0.2em] transition-all duration-300 border-2",
                                    everyoneReady
                                        ? "bg-amber-500 text-black border-amber-400 hover:bg-amber-400 hover:scale-105 active:scale-95 cursor-pointer shadow-[0_0_30px_rgba(245,158,11,0.5)]"
                                        : "bg-white/5 text-white/30 border-white/10 cursor-not-allowed"
                                )}
                            >
                                <span className="inline-flex items-center gap-[0.8vw]">
                                    <span>{everyoneReady ? t('selection.pressStart') : t('selection.waitingAll')}</span>
                                    <span className="flex items-center gap-[0.35vw]">{readyProgressDots}</span>
                                </span>
                            </motion.button>
                        )}
                    </div>
                </div>
            </div>

            {/* 资源预加载已由 CriticalImageGate 统一处理，无需额外离屏渲染 */}

            {/* 放大预览弹窗 - OptimizedImage 自动处理本地化路径 */}
            <MagnifyOverlay
                isOpen={!!magnifyImage}
                onClose={() => setMagnifyImage(null)}
                containerClassName="max-h-[90vh] max-w-[90vw]"
                closeLabel={t('actions.closePreview')}
            >
                {magnifyImage && (
                    <OptimizedImage
                        src={magnifyImage}
                        locale={locale}
                        className="max-h-[90vh] max-w-[90vw] w-auto h-auto object-contain"
                        alt="Preview"
                    />
                )}
            </MagnifyOverlay>
        </motion.div>
    );
};
