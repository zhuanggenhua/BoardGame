/**
 * @deprecated 此组件已废弃，请使用 CharacterSelectionAdapter 代替
 * 该组件将在未来版本中移除
 * 
 * 迁移路径：
 * - 框架层：CharacterSelectionSkeleton (src/components/game/framework/)
 * - 游戏层：CharacterSelectionAdapter (src/games/dicethrone/ui/)
 */

import React, { useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { motion, AnimatePresence } from 'framer-motion';
import { OptimizedImage } from '../../../components/common/media/OptimizedImage';
import { MagnifyOverlay } from '../../../components/common/overlays/MagnifyOverlay';
import { getLocalizedAssetPath } from '../../../core';
import { getPortraitStyle, ASSETS } from './assets';
import { DICETHRONE_CHARACTER_CATALOG, type SelectableCharacterId, type CharacterId } from '../domain/types';
import type { PlayerId } from '../../../engine/types';
import clsx from 'clsx';

export interface HeroSelectionOverlayProps {
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

// Gaming 风格配色（基于 UI Skill 设计系统）
const PLAYER_COLORS: Record<string, { bg: string; text: string; glow: string }> = {
    '0': { bg: '#F43F5E', text: 'white', glow: 'rgba(244,63,94,0.5)' },  // Rose - P1
    '1': { bg: '#3B82F6', text: 'white', glow: 'rgba(59,130,246,0.5)' }, // Blue - P2
    '2': { bg: '#10B981', text: 'white', glow: 'rgba(16,185,129,0.5)' }, // Emerald - P3
    '3': { bg: '#F59E0B', text: 'black', glow: 'rgba(245,158,11,0.5)' }, // Amber - P4
};

const PLAYER_LABELS: Record<string, string> = {
    '0': 'P1',
    '1': 'P2',
    '2': 'P3',
    '3': 'P4',
};

export const HeroSelectionOverlay: React.FC<HeroSelectionOverlayProps> = ({
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
    // 全员准备完毕：所有玩家都选好角色，且非房主玩家都点击了准备
    const everyoneReady = playerIds.every(pid => {
        const char = selectedCharacters[pid];
        const hasSelected = char && char !== 'unselected';
        // 房主只需选好角色，不需要点击准备
        if (pid === hostPlayerId) {
            return hasSelected;
        }
        // 非房主需要选好角色且点击准备
        return hasSelected && readyPlayers[pid];
    });
    
    // 当前玩家是否已选角色
    const myChar = selectedCharacters[currentPlayerId];
    const hasSelectedChar = myChar && myChar !== 'unselected';

    const readyProgressDots = useMemo(() => {
        return playerIds.map(pid => {
            const charId = selectedCharacters[pid];
            const hasSelected = charId && charId !== 'unselected';
            const isReady = pid === hostPlayerId ? hasSelected : hasSelected && readyPlayers[pid];

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

    // 仅显示目前已实现的英雄
    const availableCharacters = useMemo(() => {
        return DICETHRONE_CHARACTER_CATALOG.filter(char => ['monk', 'barbarian'].includes(char.id));
    }, []);

    // 预览的角色 ID：当前玩家已选的，或默认第一个
    const previewCharId = useMemo(() => {
        const mySelection = selectedCharacters[currentPlayerId];
        if (mySelection && mySelection !== 'unselected') return mySelection;
        return availableCharacters[0]?.id || 'monk'; 
    }, [selectedCharacters, currentPlayerId, availableCharacters]);

    // 放大预览状态
    const [magnifyImage, setMagnifyImage] = useState<string | null>(null);

    if (!isOpen) return null;

    return (
        <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[100] flex bg-[#0F0F23] overflow-hidden select-none text-white font-sans w-screen h-screen"
        >
            {/* 背景层：动态氛围 */}
            <div className="absolute inset-0 z-0 pointer-events-none overflow-hidden">
                <div className="absolute inset-0 bg-black/40 z-10" />
                <OptimizedImage
                    src={getLocalizedAssetPath('dicethrone/images/Common/background', locale)}
                    fallbackSrc="dicethrone/images/Common/background"
                    className="w-full h-full object-cover opacity-20"
                    alt=""
                />
                <div className="absolute inset-0 bg-[radial-gradient(circle_at_50%_50%,_rgba(255,255,255,0.05)_0%,_transparent_70%)] animate-pulse" />
            </div>

            {/* 左侧：英雄选择列表 */}
            <div className="w-[18vw] h-full border-r border-white/5 flex flex-col z-10 bg-black/60 backdrop-blur-xl relative flex-shrink-0">
                {/* 标题 */}
                <div className="px-[1vw] pt-[1.2vw] pb-[0.6vw] border-b border-white/10">
                    <h2 className="text-[1vw] font-bold text-white/90 uppercase tracking-wider">
                        {t('selection.title', '选择你的英雄')}
                    </h2>
                </div>
                <div className="flex-1 overflow-y-auto custom-scrollbar p-[1vw] pt-[1vw] grid grid-cols-2 gap-[0.8vw] content-start">
                    {availableCharacters.map((char, index) => {
                        const isSelectedByMe = selectedCharacters[currentPlayerId] === char.id;

                        return (
                            <motion.div
                                key={char.id}
                                initial={{ opacity: 0, scale: 0.8 }}
                                animate={{ opacity: 1, scale: 1 }}
                                transition={{ delay: index * 0.03 }}
                                data-char-id={char.id}
                                className={clsx(
                                    "relative aspect-[3/4] rounded-[0.4vw] border-2 transition-all duration-300 overflow-hidden cursor-pointer group",
                                    isSelectedByMe ? "border-amber-400 shadow-[0_0_1.5vw_rgba(251,191,36,0.4)] z-20 scale-[1.02]" : 
                                    "border-white/10 hover:border-white/30 hover:scale-[1.02]"
                                )}
                                onClick={() => onSelect(char.id as SelectableCharacterId)}
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

                                {/* 玩家占用标签 */}
                                <div className="absolute top-[0.3vw] right-[0.3vw] flex -space-x-[0.3vw]">
                                    {playerIds.filter(pid => selectedCharacters[pid] === char.id).map(pid => (
                                        <motion.div 
                                            key={pid}
                                            layoutId={`occupied-${pid}`}
                                            className="w-[1.2vw] h-[1.2vw] rounded-full border border-white/80 flex items-center justify-center text-[0.5vw] font-black shadow-lg"
                                            style={{ backgroundColor: PLAYER_COLORS[pid]?.bg }}
                                        >
                                            {PLAYER_LABELS[pid]}
                                        </motion.div>
                                    ))}
                                </div>
                            </motion.div>
                        );
                    })}
                </div>

            </div>

            {/* 右侧：角色预览 */}
            <div className="flex-1 h-full relative flex flex-col z-10 overflow-hidden bg-gradient-to-br from-slate-900/20 to-black">

                {/* 中央预览区域 */}
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
                                {/* 玩家面板：点击放大 */}
                                <div 
                                    className="relative h-[85%] w-auto shadow-2xl rounded-[0.6vw] overflow-hidden cursor-zoom-in hover:ring-2 hover:ring-amber-400/50 transition-all"
                                    onClick={() => setMagnifyImage(ASSETS.PLAYER_BOARD(previewCharId as CharacterId))}
                                >
                                    <OptimizedImage
                                        src={getLocalizedAssetPath(ASSETS.PLAYER_BOARD(previewCharId as CharacterId), locale)}
                                        fallbackSrc={ASSETS.PLAYER_BOARD(previewCharId as CharacterId)}
                                        className="h-full w-auto object-contain"
                                        alt="Player Board"
                                    />
                                </div>

                                {/* 提示板：点击放大 */}
                                <div 
                                    className="relative h-[85%] w-auto rounded-[0.6vw] overflow-hidden shadow-2xl cursor-zoom-in hover:ring-2 hover:ring-amber-400/50 transition-all"
                                    onClick={() => setMagnifyImage(ASSETS.TIP_BOARD(previewCharId as CharacterId))}
                                >
                                    <OptimizedImage
                                        src={getLocalizedAssetPath(ASSETS.TIP_BOARD(previewCharId as CharacterId), locale)}
                                        fallbackSrc={ASSETS.TIP_BOARD(previewCharId as CharacterId)}
                                        className="h-full w-auto object-contain"
                                        alt="Tip Board"
                                    />
                                </div>
                            </div>
                        </motion.div>
                    </AnimatePresence>
                </div>

                {/* 底部玩家面板区域：居中布局 */}
                <div className="h-[8vw] bg-gradient-to-t from-black/95 to-black/80 backdrop-blur-xl flex items-center justify-center gap-[3vw] px-[4vw] z-[200] flex-shrink-0 border-t border-white/5">
                    {/* 玩家卡片列表 */}
                    <div className="flex items-center justify-center gap-[1.5vw]">
                        {playerIds.map(pid => {
                            const charId = selectedCharacters[pid];
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
                                    {/* 玩家标签 */}
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

                                    {/* 玩家信息 */}
                                    <div className="flex flex-col">
                                        <div className={clsx(
                                            "text-[0.9vw] font-black uppercase tracking-wide leading-tight",
                                            hasSelected ? "text-amber-400" : "text-white/50"
                                        )}>
                                            {hasSelected ? t(`characters.${charId}`) : t('selection.notSelected', '未选择')}
                                        </div>
                                        <div className="text-[0.6vw] text-white/50 truncate max-w-[8vw]">
                                            {playerNames[pid]}
                                            {isMe && <span className="ml-[0.2vw] text-amber-400/80 font-bold">(YOU)</span>}
                                        </div>
                                    </div>

                                    {/* 准备状态指示：只有点击准备后才显示绿色勾 */}
                                    {readyPlayers[pid] && (
                                        <motion.div 
                                            initial={{ scale: 0 }}
                                            animate={{ scale: 1 }}
                                            className="w-[1.2vw] h-[1.2vw] rounded-full bg-emerald-500 flex items-center justify-center text-white"
                                        >
                                            <span className="text-[0.7vw] font-bold">✓</span>
                                        </motion.div>
                                    )}
                                </motion.div>
                            );
                        })}
                    </div>

                    {/* 准备按钮：只有非房主玩家需要点击准备 */}
                    {!isHost && hasSelectedChar && !readyPlayers[currentPlayerId] && (
                        <motion.button
                            initial={{ scale: 0.9, opacity: 0 }}
                            animate={{ scale: 1, opacity: 1 }}
                            onClick={onReady}
                            className="px-[3vw] py-[1vw] rounded-full text-[1.2vw] font-black uppercase tracking-[0.2em] transition-all duration-300 border-2 bg-emerald-500 text-white border-emerald-400 hover:bg-emerald-400 hover:scale-105 active:scale-95 cursor-pointer shadow-[0_0_30px_rgba(16,185,129,0.5)]"
                        >
                            {t('selection.ready', '准备')}
                        </motion.button>
                    )}
                    
                    {/* 已准备状态：非房主玩家准备后等待 */}
                    {!isHost && readyPlayers[currentPlayerId] && (
                        <div className="px-[3vw] py-[1vw] rounded-full text-[1.2vw] font-black uppercase tracking-[0.2em] border-2 bg-white/5 text-emerald-400 border-emerald-400/50">
                            <span className="inline-flex items-center gap-[0.8vw]">
                                <span>{t('selection.readyWaiting', '等待其他玩家...')}</span>
                                <span className="flex items-center gap-[0.35vw]">
                                    {readyProgressDots}
                                </span>
                            </span>
                        </div>
                    )}

                    {/* 开始游戏按钮：只有房主可见，选好角色后立即显示 */}
                    {isHost && hasSelectedChar && (
                        <motion.button
                            initial={{ scale: 0.9, opacity: 0 }}
                            animate={{ scale: 1, opacity: 1 }}
                            disabled={!everyoneReady}
                            onClick={onStart}
                            className={clsx(
                                "px-[3vw] py-[1vw] rounded-full text-[1.2vw] font-black uppercase tracking-[0.2em] transition-all duration-300 border-2",
                                everyoneReady 
                                    ? "bg-amber-500 text-black border-amber-400 hover:bg-amber-400 hover:scale-105 active:scale-95 cursor-pointer shadow-[0_0_30px_rgba(245,158,11,0.5)]" 
                                    : "bg-white/5 text-white/30 border-white/10 cursor-not-allowed"
                            )}
                        >
                            <span className="inline-flex items-center gap-[0.8vw]">
                                <span>{everyoneReady ? t('selection.pressStart', 'Press Start') : t('selection.waitingAll', '等待全员就绪')}</span>
                                <span className="flex items-center gap-[0.35vw]">
                                    {readyProgressDots}
                                </span>
                            </span>
                        </motion.button>
                    )}
                </div>
            </div>

            {/* 资源预加载层 */}
            <div className="fixed bottom-[-2000px] left-0 pointer-events-none opacity-0">
                {availableCharacters.map(char => (
                    <React.Fragment key={char.id}>
                        <img src={getLocalizedAssetPath(ASSETS.PLAYER_BOARD(char.id), locale)} alt="" />
                        <img src={getLocalizedAssetPath(ASSETS.TIP_BOARD(char.id), locale)} alt="" />
                    </React.Fragment>
                ))}
            </div>

            {/* 放大预览弹窗 */}
            <MagnifyOverlay
                isOpen={!!magnifyImage}
                onClose={() => setMagnifyImage(null)}
                containerClassName="max-h-[90vh] max-w-[90vw]"
                closeLabel={t('actions.closePreview', '关闭预览')}
            >
                {magnifyImage && (
                    <OptimizedImage
                        src={getLocalizedAssetPath(magnifyImage, locale)}
                        fallbackSrc={magnifyImage}
                        className="max-h-[90vh] max-w-[90vw] w-auto h-auto object-contain"
                        alt="Preview"
                    />
                )}
            </MagnifyOverlay>
        </motion.div>
    );
};
