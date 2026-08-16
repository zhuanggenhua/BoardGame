/**
 * Dice Throne 角色选择界面 - 物理架构还原版
 * 严格保留原始图片使用方式和布局比例，修复 fallbackSrc 缺失导致的图片破碎问题
 */

import React, { useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { motion, AnimatePresence } from 'framer-motion';
import { Check, MessageSquareWarning } from 'lucide-react';
import { OptimizedImage } from '../../../components/common/media/OptimizedImage';
import { MagnifyOverlay } from '../../../components/common/overlays/MagnifyOverlay';
import { CharacterSelectionBadge } from '../../../components/game/framework/CharacterSelectionBadge';
import { buildLocalizedImageSet, UI_Z_INDEX } from '../../../core';
import { playSound } from '../../../lib/audio/useGameAudio';
import { getPortraitStyle, ASSETS } from './assets';
import { getPlayerBoardAspectRatio } from './abilitySlotLayout';
import {
    DICETHRONE_CHARACTER_CATALOG,
    getDiceThroneCharacterNameKey,
    hasDiceThroneTipBoard,
    type CharacterDefinition,
    type SelectableCharacterId,
    type CharacterId,
    type PendingSeatSwapRequest,
    type SeatControllerKind,
} from '../domain/types';
import type { PlayerId } from '../../../engine/types';
import clsx from 'clsx';
import { buildRuntimeInlineUnitValue } from '../../../shared/runtimeLayoutUnits';
import { isSetupReadyToStart } from '../domain/rules';

export interface DiceThroneHeroSelectionProps {
    isOpen: boolean;
    currentPlayerId: PlayerId;
    hostPlayerId: PlayerId;
    selectedCharacters: Record<PlayerId, CharacterId>;
    readyPlayers: Record<PlayerId, boolean>;
    playerNames: Record<PlayerId, string>;
    seatingOrder?: PlayerId[];
    seatControllers?: Record<PlayerId, SeatControllerKind>;
    seatSwapRequest?: PendingSeatSwapRequest;
    onSelect: (characterId: SelectableCharacterId) => void;
    onReady: () => void;
    onUnready: () => void;
    onRequestSeatSwap: (targetPlayerId: PlayerId) => void;
    onRespondSeatSwap: (approve: boolean) => void;
    onCancelSeatSwap: () => void;
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

type MagnifyPreview =
    | { src: string; kind: 'player-board'; characterId: CharacterId }
    | { src: string; kind: 'tip-board'; characterId: CharacterId }
    | null;

export const DiceThroneHeroSelection: React.FC<DiceThroneHeroSelectionProps> = ({
    isOpen,
    currentPlayerId,
    hostPlayerId,
    selectedCharacters,
    readyPlayers,
    playerNames,
    seatingOrder,
    seatControllers,
    seatSwapRequest,
    onSelect,
    onReady,
    onUnready,
    onRequestSeatSwap,
    onRespondSeatSwap,
    onCancelSeatSwap,
    onStart,
    locale,
}) => {
    const { t } = useTranslation('game-dicethrone');
    const isHost = currentPlayerId === hostPlayerId;
    const playerIds = Object.keys(playerNames);
    const isFourPlayerMode = playerIds.length === 4;
    const inlineUnit = buildRuntimeInlineUnitValue;

    const everyoneReady = isSetupReadyToStart({
        playerIds,
        hostPlayerId,
        selectedCharacters,
        readyPlayers,
    });

    const hasSelectedChar = selectedCharacters[currentPlayerId] && selectedCharacters[currentPlayerId] !== 'unselected';

    const availableCharacters = useMemo(() => {
        return DICETHRONE_CHARACTER_CATALOG;
    }, []);

    const previewCharId = useMemo(() => {
        const mySelection = selectedCharacters[currentPlayerId];
        if (mySelection && mySelection !== 'unselected') return mySelection;
        return availableCharacters[0]?.id || 'monk';
    }, [selectedCharacters, currentPlayerId, availableCharacters]);

    const [magnifyPreview, setMagnifyPreview] = useState<MagnifyPreview>(null);
    const playerBoardAspectRatio = getPlayerBoardAspectRatio(previewCharId);
    const hasPreviewTipBoard = hasDiceThroneTipBoard(previewCharId);

    const effectiveSeatingOrder = useMemo(() => {
        const orderedPlayers = seatingOrder?.filter((pid) => playerIds.includes(pid)) ?? [];
        return orderedPlayers.length === playerIds.length ? orderedPlayers : playerIds;
    }, [seatingOrder, playerIds]);
    const teamAPlayers = effectiveSeatingOrder.filter((_, index) => index % 2 === 0);
    const teamBPlayers = effectiveSeatingOrder.filter((_, index) => index % 2 === 1);

    const getPlayerLabel = (pid: string) => PLAYER_LABELS[pid] ?? `P${Number(pid) + 1}`;
    const getPlayerDisplayName = (pid: PlayerId) => playerNames[pid] || getPlayerLabel(pid);
    const currentSeatSwapRequest = React.useMemo(() => {
        if (!seatSwapRequest) {
            return undefined;
        }
        if (
            !effectiveSeatingOrder.includes(seatSwapRequest.requesterId)
            || !effectiveSeatingOrder.includes(seatSwapRequest.targetPlayerId)
        ) {
            return undefined;
        }
        return seatSwapRequest;
    }, [seatSwapRequest, effectiveSeatingOrder]);
    const isRequester = currentSeatSwapRequest?.requesterId === currentPlayerId;
    const isTarget = currentSeatSwapRequest?.targetPlayerId === currentPlayerId;
    const isSeatSwapPending = Boolean(currentSeatSwapRequest);
    const startDisabled = !everyoneReady || isSeatSwapPending;

    const handleSelectCharacter = (characterId: SelectableCharacterId) => {
        playSound(HERO_SELECTION_CLICK_SOUND_KEY);
        onSelect(characterId);
    };

    const handleReady = () => {
        playSound(HERO_SELECTION_CLICK_SOUND_KEY);
        onReady();
    };

    const handleUnready = () => {
        playSound(HERO_SELECTION_CLICK_SOUND_KEY);
        onUnready();
    };

    const handleStart = () => {
        playSound(HERO_SELECTION_CLICK_SOUND_KEY);
        onStart();
    };

    const handleSeatSwapAvatarClick = (pid: PlayerId) => {
        if (!isFourPlayerMode || isSeatSwapPending || pid === currentPlayerId) {
            return;
        }
        playSound(HERO_SELECTION_CLICK_SOUND_KEY);
        onRequestSeatSwap(pid);
    };

    const seatHintText = (() => {
        if (!isFourPlayerMode) {
            return null;
        }
        if (!currentSeatSwapRequest) {
            return t('selection.seating.swapHint');
        }
        if (isRequester) {
            return t('selection.seating.swapWaiting', {
                player: getPlayerDisplayName(currentSeatSwapRequest.targetPlayerId),
            });
        }
        if (isTarget) {
            return t('selection.seating.swapIncoming', {
                player: getPlayerDisplayName(currentSeatSwapRequest.requesterId),
            });
        }
        return t('selection.seating.swapPendingOther', {
            requester: getPlayerDisplayName(currentSeatSwapRequest.requesterId),
            target: getPlayerDisplayName(currentSeatSwapRequest.targetPlayerId),
        });
    })();

    const renderSeatPlayerCard = (pid: PlayerId, seatIndex: number) => {
        const colors = PLAYER_COLORS[pid] || PLAYER_COLORS['0'];
        const hasSelected = selectedCharacters[pid] && selectedCharacters[pid] !== 'unselected';
        const selectedCharacterNameKey = getDiceThroneCharacterNameKey(selectedCharacters[pid]);
        const isMe = pid === currentPlayerId;
        const controller = seatControllers?.[pid];
        const controllerType = controller?.type ?? 'human';
        const isAiSeat = controllerType !== 'human';
        const isRequesterSeat = currentSeatSwapRequest?.requesterId === pid;
        const isTargetSeat = currentSeatSwapRequest?.targetPlayerId === pid;
        const avatarDisabled = !isFourPlayerMode || isSeatSwapPending || isMe;

        return (
            <div
                key={`seat-player-${pid}-${seatIndex}`}
                data-testid={`dt-seat-swap-seat-${pid}`}
                className={clsx(
                    'border text-left transition-all',
                    isRequesterSeat || isTargetSeat
                        ? 'border-amber-300/70 bg-amber-500/12'
                        : isMe
                            ? 'border-white/28 bg-white/10'
                            : 'border-white/12 bg-black/25'
                )}
                style={{
                    minWidth: inlineUnit(8.6),
                    borderRadius: inlineUnit(0.9),
                    paddingLeft: inlineUnit(0.8),
                    paddingRight: inlineUnit(0.8),
                    paddingTop: inlineUnit(0.68),
                    paddingBottom: inlineUnit(0.68),
                    ...(isRequesterSeat || isTargetSeat
                        ? { boxShadow: `0 0 ${inlineUnit(1)} rgba(245,158,11,0.22)` }
                        : {}),
                }}
            >
                <div className="flex items-center" style={{ gap: inlineUnit(0.55) }}>
                    <button
                        type="button"
                        onClick={() => handleSeatSwapAvatarClick(pid)}
                        disabled={avatarDisabled}
                        data-testid={`dt-seat-swap-avatar-${pid}`}
                        className={clsx(
                            'relative flex items-center justify-center rounded-full font-black transition-all',
                            avatarDisabled
                                ? 'cursor-default opacity-95'
                                : 'cursor-pointer hover:scale-105 hover:ring-2 hover:ring-amber-300/55'
                        )}
                        style={{
                            width: inlineUnit(1.7),
                            height: inlineUnit(1.7),
                            fontSize: inlineUnit(0.62),
                            backgroundColor: colors.bg,
                            color: colors.text,
                            boxShadow: `0 0 12px ${colors.glow}`,
                        }}
                    >
                        {getPlayerLabel(pid)}
                        {isAiSeat && (
                            <span
                                className="absolute rounded-full border border-sky-200/45 bg-sky-500 font-black uppercase tracking-[0.08em] text-white"
                                style={{
                                    right: `-${inlineUnit(0.16)}`,
                                    bottom: `-${inlineUnit(0.12)}`,
                                    paddingLeft: inlineUnit(0.16),
                                    paddingRight: inlineUnit(0.16),
                                    paddingTop: inlineUnit(0.02),
                                    paddingBottom: inlineUnit(0.02),
                                    fontSize: inlineUnit(0.34),
                                    boxShadow: `0 0 ${inlineUnit(0.35)} rgba(14,165,233,0.45)`,
                                }}
                            >
                                {t('selection.seating.aiBadge')}
                            </span>
                        )}
                    </button>
                    <div className="min-w-0">
                        <div className="font-black text-white/90" style={{ fontSize: inlineUnit(0.56) }}>
                            {t('selection.seating.seatNumber', { seat: seatIndex + 1 })}
                        </div>
                        <div className="truncate text-white/60" style={{ fontSize: inlineUnit(0.52) }}>
                            {getPlayerDisplayName(pid)}
                        </div>
                    </div>
                </div>
                <div
                    className={clsx('truncate font-bold', hasSelected ? 'text-amber-300' : 'text-white/35')}
                    style={{ marginTop: inlineUnit(0.35), fontSize: inlineUnit(0.5) }}
                >
                    {hasSelected && selectedCharacterNameKey ? t(selectedCharacterNameKey) : t('selection.notSelected')}
                </div>
            </div>
        );
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
                        'rounded-full',
                        isReady
                            ? 'bg-emerald-400'
                            : 'bg-white/30'
                    )}
                    style={isReady
                        ? {
                            width: inlineUnit(0.55),
                            height: inlineUnit(0.55),
                            boxShadow: `0 0 ${inlineUnit(0.6)} rgba(16,185,129,0.6)`,
                        }
                        : {
                            width: inlineUnit(0.55),
                            height: inlineUnit(0.55),
                        }}
                />
            );
        });
    }, [hostPlayerId, inlineUnit, playerIds, readyPlayers, selectedCharacters]);

    const getOverlayBadge = (character: CharacterDefinition) => {
        return character.badges?.find((badge) => badge.variant === 'disabled-overlay');
    };

    if (!isOpen) return null;

    return (
        <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            data-testid="character-selection-overlay"
            className="absolute inset-0 flex h-full w-full max-h-full max-w-full overflow-hidden bg-[#050510] select-none text-white font-sans"
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
            <div
                className="h-full border-r border-white/5 flex flex-col z-10 bg-black/15 backdrop-blur-2xl relative flex-shrink-0"
                style={{ width: inlineUnit(18) }}
            >
                <div
                    className="border-b border-white/10"
                    style={{
                        paddingLeft: inlineUnit(1),
                        paddingRight: inlineUnit(1),
                        paddingTop: inlineUnit(1.2),
                        paddingBottom: inlineUnit(0.6),
                    }}
                >
                    <h2 className="font-bold text-white/90 uppercase tracking-wider" style={{ fontSize: inlineUnit(1) }}>
                        {t('selection.title')}
                    </h2>
                </div>
                <div
                    className="flex-1 overflow-y-auto custom-scrollbar grid grid-cols-2 content-start"
                    style={{
                        padding: inlineUnit(1),
                        columnGap: inlineUnit(0.8),
                        rowGap: inlineUnit(0.9),
                    }}
                >
                    {availableCharacters.map((char, index) => {
                        const isSelectedByMe = selectedCharacters[currentPlayerId] === char.id;
                        const overlayBadge = getOverlayBadge(char);

                        return (
                            <motion.div
                                key={char.id}
                                data-character-id={char.id}
                                initial={{ opacity: 0, scale: 0.8 }}
                                animate={{ opacity: 1, scale: 1 }}
                                transition={{ delay: index * 0.03 }}
                                className={clsx(
                                    "relative border-2 transition-all duration-300 overflow-hidden cursor-pointer group",
                                    isSelectedByMe
                                        ? "border-amber-400 shadow-[0_0_1.5vw_rgba(251,191,36,0.4)] z-20 scale-[1.02]"
                                        : "border-white/10 hover:border-white/30 hover:scale-[1.02]"
                                )}
                                style={{ borderRadius: inlineUnit(0.4), height: 0, paddingTop: `${100 / 0.75}%`, aspectRatio: '3 / 4' }}
                                onClick={() => handleSelectCharacter(char.id as SelectableCharacterId)}
                            >
                                <div className={clsx(
                                    "absolute inset-0 z-0 transition-all duration-500",
                                    isSelectedByMe ? "grayscale-0 scale-110" : "grayscale opacity-60 group-hover:grayscale-0 group-hover:opacity-100 group-hover:scale-105"
                                )}
                                    style={getPortraitStyle(char.id, locale)} />

                                <div className="absolute inset-0 bg-gradient-to-t from-black via-transparent to-transparent opacity-80" />

                                {overlayBadge ? (
                                    <div className="absolute inset-0 z-20 pointer-events-none">
                                        <div className="absolute inset-0 overflow-hidden">
                                            <CharacterSelectionBadge
                                                badge={overlayBadge}
                                                label={t(overlayBadge.labelKey)}
                                                inlineUnit={inlineUnit}
                                                testId={`character-badge-${char.id}-${overlayBadge.id}`}
                                            />
                                        </div>
                                    </div>
                                ) : null}

                                <div
                                    className="absolute"
                                    style={{
                                        bottom: inlineUnit(0.5),
                                        left: inlineUnit(0.5),
                                        right: inlineUnit(0.5),
                                    }}
                                >
                                    <div className="font-black truncate uppercase tracking-tight text-white/90" style={{ fontSize: inlineUnit(0.7) }}>
                                        {t(char.nameKey)}
                                    </div>
                                </div>

                                <div
                                    className="absolute flex"
                                    style={{
                                        top: inlineUnit(0.3),
                                        right: inlineUnit(0.3),
                                        marginLeft: `-${inlineUnit(0.3)}`,
                                    }}
                                >
                                    {playerIds.filter(pid => selectedCharacters[pid as PlayerId] === char.id).map(pid => (
                                        <div
                                            key={pid}
                                            className="rounded-full border border-white/80 flex items-center justify-center font-black shadow-lg"
                                            style={{
                                                width: inlineUnit(1.2),
                                                height: inlineUnit(1.2),
                                                fontSize: inlineUnit(0.5),
                                                backgroundColor: PLAYER_COLORS[pid]?.bg,
                                            }}
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
                <div
                    className="flex-1 flex items-center justify-center overflow-hidden"
                    style={{ padding: inlineUnit(1) }}
                >
                    <AnimatePresence mode="wait">
                        <motion.div
                            key={previewCharId}
                            initial={{ opacity: 0, scale: 0.98, y: 20 }}
                            animate={{ opacity: 1, scale: 1, y: 0 }}
                            exit={{ opacity: 0, scale: 1.02, y: -20 }}
                            className="relative w-full h-full flex items-center justify-center"
                        >
                            <div
                                className="flex items-center justify-center h-full"
                                style={{ gap: inlineUnit(1) }}
                            >
                                {/* 物理面板预览 - OptimizedImage 自动处理本地化路径 */}
                                <div
                                    className="relative h-[85%] w-auto shadow-2xl overflow-hidden cursor-zoom-in hover:ring-2 hover:ring-amber-400/50 transition-all"
                                    style={{
                                        aspectRatio: String(playerBoardAspectRatio),
                                        borderRadius: inlineUnit(0.6),
                                    }}
                                    onClick={() => setMagnifyPreview({
                                        src: ASSETS.PLAYER_BOARD(previewCharId as CharacterId),
                                        kind: 'player-board',
                                        characterId: previewCharId as CharacterId,
                                    })}
                                >
                                    <OptimizedImage
                                        src={ASSETS.PLAYER_BOARD(previewCharId as CharacterId)}
                                        locale={locale}
                                        className="block h-full w-auto object-contain"
                                        alt={t('imageAlt.playerBoard')}
                                        data-testid="character-selection-player-board-image"
                                    />
                                </div>

                                {hasPreviewTipBoard && <div
                                    className="relative h-[85%] w-auto overflow-hidden shadow-2xl cursor-zoom-in hover:ring-2 hover:ring-amber-400/50 transition-all"
                                    style={{ borderRadius: inlineUnit(0.6) }}
                                    onClick={() => setMagnifyPreview({
                                        src: ASSETS.TIP_BOARD(previewCharId as CharacterId),
                                        kind: 'tip-board',
                                        characterId: previewCharId as CharacterId,
                                    })}
                                >
                                    <OptimizedImage
                                        src={ASSETS.TIP_BOARD(previewCharId as CharacterId)}
                                        locale={locale}
                                        className="h-full w-auto object-contain"
                                        alt={t('imageAlt.tipBoard')}
                                        data-testid="tip-board-image"
                                    />
                                </div>}
                            </div>
                        </motion.div>
                    </AnimatePresence>
                </div>

                {isFourPlayerMode && (
                    <div
                        className="absolute border border-white/12 bg-black/45 backdrop-blur-xl"
                        style={{
                            right: inlineUnit(2),
                            bottom: inlineUnit(10.2),
                            width: inlineUnit(22),
                            borderRadius: inlineUnit(1),
                            padding: inlineUnit(0.95),
                            boxShadow: `0 ${inlineUnit(1.2)} ${inlineUnit(3)} rgba(0,0,0,0.35)`,
                        }}
                    >
                        <div>
                            <div className="font-black uppercase tracking-[0.18em] text-white/88" style={{ fontSize: inlineUnit(0.72) }}>
                                {t('selection.seating.title')}
                            </div>
                            <div className="leading-relaxed text-white/56" style={{ marginTop: inlineUnit(0.2), fontSize: inlineUnit(0.5) }}>
                                {seatHintText}
                            </div>
                        </div>

                        <div className="mt-[0.85vw] flex flex-wrap" style={{ marginTop: inlineUnit(0.85), gap: inlineUnit(0.45) }}>
                            {effectiveSeatingOrder.map((pid, seatIndex) => renderSeatPlayerCard(pid, seatIndex))}
                        </div>

                        {isSeatSwapPending && (
                            <div className="mt-[0.85vw] rounded-[0.9vw] border border-white/14 bg-black/35 p-[0.8vw] shadow-[0_0.8vw_2vw_rgba(0,0,0,0.22)]">
                                {isTarget ? (
                                    <div className="flex flex-col gap-[0.65vw]">
                                        <div className="rounded-[0.72vw] border border-sky-400/28 bg-sky-500/10 p-[0.7vw]">
                                            <div className="flex items-center gap-[0.45vw]">
                                                <MessageSquareWarning className="h-[0.95vw] w-[0.95vw] text-sky-300" />
                                                <span className="text-[0.62vw] font-black text-sky-200">
                                                    {t('selection.seating.swapIncoming', {
                                                        player: getPlayerDisplayName(currentSeatSwapRequest!.requesterId),
                                                    })}
                                                </span>
                                            </div>
                                            <p className="mt-[0.3vw] text-[0.48vw] leading-relaxed text-white/68">
                                                {t('selection.seating.swapReviewHint')}
                                            </p>
                                        </div>
                                        <div className="flex gap-[0.45vw]">
                                            <button
                                                type="button"
                                                onClick={() => {
                                                    playSound(HERO_SELECTION_CLICK_SOUND_KEY);
                                                    onRespondSeatSwap(true);
                                                }}
                                                data-testid="dt-seat-swap-approve"
                                                className="flex-1 rounded-[0.65vw] border border-emerald-500/50 bg-emerald-500/20 px-[0.8vw] py-[0.62vw] text-[0.58vw] font-black text-emerald-300 transition hover:bg-emerald-500/38 hover:text-white"
                                            >
                                                {t('selection.seating.swapApprove')}
                                            </button>
                                            <button
                                                type="button"
                                                onClick={() => {
                                                    playSound(HERO_SELECTION_CLICK_SOUND_KEY);
                                                    onRespondSeatSwap(false);
                                                }}
                                                data-testid="dt-seat-swap-reject"
                                                className="flex-1 rounded-[0.65vw] border border-rose-500/50 bg-rose-500/20 px-[0.8vw] py-[0.62vw] text-[0.58vw] font-black text-rose-300 transition hover:bg-rose-500/38 hover:text-white"
                                            >
                                                {t('selection.seating.swapReject')}
                                            </button>
                                        </div>
                                    </div>
                                ) : isRequester ? (
                                    <div className="flex flex-col gap-[0.65vw]">
                                        <div className="rounded-[0.72vw] border border-amber-400/30 bg-amber-500/10 p-[0.7vw]">
                                            <div className="flex items-center gap-[0.45vw]">
                                                <div className="h-[0.6vw] w-[0.6vw] rounded-full bg-amber-400 animate-pulse" />
                                                <span className="text-[0.62vw] font-black text-amber-300">
                                                    {t('selection.seating.swapWaiting', {
                                                        player: getPlayerDisplayName(currentSeatSwapRequest!.targetPlayerId),
                                                    })}
                                                </span>
                                            </div>
                                            <p className="mt-[0.3vw] text-[0.48vw] leading-relaxed text-white/68">
                                                {t('selection.seating.swapWaitingHint')}
                                            </p>
                                        </div>
                                        <button
                                            type="button"
                                            onClick={() => {
                                                playSound(HERO_SELECTION_CLICK_SOUND_KEY);
                                                onCancelSeatSwap();
                                            }}
                                            data-testid="dt-seat-swap-cancel"
                                            className="w-full rounded-[0.65vw] border border-white/12 bg-white/5 px-[0.8vw] py-[0.62vw] text-[0.58vw] font-black text-white/82 transition hover:border-white/22 hover:bg-white/10 hover:text-white"
                                        >
                                            {t('selection.seating.swapCancel')}
                                        </button>
                                    </div>
                                ) : (
                                    <div className="rounded-[0.72vw] border border-white/10 bg-white/5 p-[0.7vw] text-[0.5vw] leading-relaxed text-white/72">
                                        <div className="text-[0.58vw] font-black uppercase tracking-[0.14em] text-white/52">
                                            {t('selection.seating.swapResolving')}
                                        </div>
                                        <div className="mt-[0.28vw]">
                                            {t('selection.seating.swapIncoming', {
                                                player: getPlayerDisplayName(currentSeatSwapRequest!.requesterId),
                                            })}
                                        </div>
                                        <div className="mt-[0.22vw] text-white/60">
                                            {t('selection.seating.swapPendingOther', {
                                            requester: getPlayerDisplayName(currentSeatSwapRequest!.requesterId),
                                            target: getPlayerDisplayName(currentSeatSwapRequest!.targetPlayerId),
                                        })}
                                    </div>
                                    </div>
                                )}
                            </div>
                        )}

                        <div className="mt-[0.8vw] grid grid-cols-2 gap-[0.45vw] text-[0.48vw] text-white/72">
                            <div className="rounded-[0.8vw] border border-sky-400/22 bg-sky-500/10 px-[0.7vw] py-[0.55vw]">
                                <div className="font-black uppercase tracking-[0.16em] text-sky-200/90">
                                    {t('selection.seating.teamA')}
                                </div>
                                <div className="mt-[0.18vw] text-white/78">
                                    {teamAPlayers.map(getPlayerLabel).join(' / ')}
                                </div>
                            </div>
                            <div className="rounded-[0.8vw] border border-rose-400/22 bg-rose-500/10 px-[0.7vw] py-[0.55vw]">
                                <div className="font-black uppercase tracking-[0.16em] text-rose-200/90">
                                    {t('selection.seating.teamB')}
                                </div>
                                <div className="mt-[0.18vw] text-white/78">
                                    {teamBPlayers.map(getPlayerLabel).join(' / ')}
                                </div>
                            </div>
                        </div>
                    </div>
                )}

                {/* 底部玩家面板 (8vw) */}
                <div
                    className="bg-gradient-to-t from-black/25 via-black/10 to-transparent backdrop-blur-xl flex items-center justify-center flex-shrink-0"
                    style={{
                        zIndex: UI_Z_INDEX.hud,
                        height: inlineUnit(8),
                        gap: inlineUnit(3),
                        paddingLeft: inlineUnit(4),
                        paddingRight: inlineUnit(4),
                    }}
                >
                    <div
                        className="flex items-center justify-center"
                        style={{ gap: inlineUnit(1.5) }}
                    >
                        {playerIds.map(pid => {
                            const charId = selectedCharacters[pid as PlayerId];
                            const isMe = pid === currentPlayerId;
                            const hasSelected = charId && charId !== 'unselected';
                            const colors = PLAYER_COLORS[pid] || PLAYER_COLORS['0'];

                            return (
                                <motion.div
                                    key={pid}
                                    className={clsx(
                                        "flex items-center rounded-full transition-all duration-300",
                                        isMe ? "bg-white/15 ring-2 ring-amber-400/50" : "bg-white/8"
                                    )}
                                    style={{
                                        gap: inlineUnit(0.8),
                                        paddingLeft: inlineUnit(1.5),
                                        paddingRight: inlineUnit(1.5),
                                        paddingTop: inlineUnit(0.6),
                                        paddingBottom: inlineUnit(0.6),
                                    }}
                                    initial={{ opacity: 0, y: 20 }}
                                    animate={{ opacity: 1, y: 0 }}
                                    transition={{ delay: Number(pid) * 0.08 }}
                                >
                                    <div
                                        className="rounded-full flex items-center justify-center font-black"
                                        style={{
                                            width: inlineUnit(2.5),
                                            height: inlineUnit(2.5),
                                            fontSize: inlineUnit(1),
                                            backgroundColor: colors.bg,
                                            color: colors.text,
                                            boxShadow: `0 0 15px ${colors.glow}`
                                        }}
                                    >
                                        {PLAYER_LABELS[pid]}
                                    </div>

                                    <div className="flex flex-col">
                                    <div className={clsx(
                                            "font-black uppercase tracking-wide leading-tight",
                                            hasSelected ? "text-amber-400" : "text-white/50"
                                        )} style={{ fontSize: inlineUnit(0.9) }}>
                                            {hasSelected
                                                ? t(getDiceThroneCharacterNameKey(charId) ?? 'selection.notSelected')
                                                : t('selection.notSelected')}
                                        </div>
                                        <div className="text-white/50 truncate" style={{ fontSize: inlineUnit(0.6), maxWidth: inlineUnit(8) }}>
                                            {playerNames[pid as PlayerId]}
                                            {isMe && <span style={{ marginLeft: inlineUnit(0.2) }} className="text-amber-400/80 font-bold">({t('selection.you')})</span>}
                                        </div>
                                    </div>

                                    {readyPlayers[pid as PlayerId] && (
                                        <div
                                            className="rounded-full bg-emerald-500 flex items-center justify-center text-white"
                                            style={{ width: inlineUnit(1.2), height: inlineUnit(1.2) }}
                                        >
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
                                className="rounded-full font-black uppercase tracking-[0.2em] transition-all duration-300 border-2 bg-emerald-500 text-white border-emerald-400 hover:bg-emerald-400 hover:scale-105 active:scale-95 cursor-pointer"
                                style={{
                                    paddingLeft: inlineUnit(3),
                                    paddingRight: inlineUnit(3),
                                    paddingTop: inlineUnit(1),
                                    paddingBottom: inlineUnit(1),
                                    fontSize: inlineUnit(1.2),
                                    boxShadow: '0 0 30px rgba(16,185,129,0.5)',
                                }}
                            >
                                {t('selection.ready')}
                            </motion.button>
                        )}

                        {!isHost && readyPlayers[currentPlayerId] && (
                            <motion.button
                                initial={{ scale: 0.9, opacity: 0 }}
                                animate={{ scale: 1, opacity: 1 }}
                                onClick={handleUnready}
                                className="rounded-full font-black uppercase tracking-[0.2em] transition-all duration-300 border-2 bg-white/5 text-emerald-400/70 border-emerald-400/30 hover:bg-red-500/20 hover:text-red-400 hover:border-red-400/50 cursor-pointer"
                                style={{
                                    paddingLeft: inlineUnit(3),
                                    paddingRight: inlineUnit(3),
                                    paddingTop: inlineUnit(1),
                                    paddingBottom: inlineUnit(1),
                                    fontSize: inlineUnit(1.2),
                                }}
                            >
                                {t('selection.cancelReady')}
                            </motion.button>
                        )}

                        {isHost && hasSelectedChar && (
                            <motion.button
                                initial={{ scale: 0.9, opacity: 0 }}
                                animate={{ scale: 1, opacity: 1 }}
                                disabled={startDisabled}
                                onClick={handleStart}
                                className={clsx(
                                    "rounded-full font-black uppercase tracking-[0.2em] transition-all duration-300 border-2",
                                    !startDisabled
                                        ? "bg-amber-500 text-black border-amber-400 hover:bg-amber-400 hover:scale-105 active:scale-95 cursor-pointer shadow-[0_0_30px_rgba(245,158,11,0.5)]"
                                        : "bg-white/5 text-white/30 border-white/10 cursor-not-allowed"
                                )}
                                style={{
                                    paddingLeft: inlineUnit(3),
                                    paddingRight: inlineUnit(3),
                                    paddingTop: inlineUnit(1),
                                    paddingBottom: inlineUnit(1),
                                    fontSize: inlineUnit(1.2),
                                }}
                            >
                                <span className="inline-flex items-center" style={{ gap: inlineUnit(0.8) }}>
                                    <span>
                                        {isSeatSwapPending
                                            ? t('selection.seating.swapResolving')
                                            : everyoneReady
                                                ? t('selection.pressStart')
                                                : t('selection.waitingAll')}
                                    </span>
                                    <span className="flex items-center" style={{ gap: inlineUnit(0.35) }}>{readyProgressDots}</span>
                                </span>
                            </motion.button>
                        )}
                    </div>
                </div>
            </div>

            {/* 资源预加载已由 CriticalImageGate 统一处理，无需额外离屏渲染 */}

            {/* 放大预览弹窗 - OptimizedImage 自动处理本地化路径 */}
            <MagnifyOverlay
                isOpen={!!magnifyPreview}
                onClose={() => setMagnifyPreview(null)}
                containerClassName="max-h-[90vh] max-w-[90vw]"
                closeLabel={t('actions.closePreview')}
                overlayTestId="character-selection-magnify-overlay"
            >
                {magnifyPreview && (
                    <div
                        className="relative"
                        style={magnifyPreview.kind === 'player-board'
                            ? { aspectRatio: String(getPlayerBoardAspectRatio(magnifyPreview.characterId)) }
                            : undefined}
                    >
                    <OptimizedImage
                        src={magnifyPreview.src}
                        locale={locale}
                        className="block max-h-[90vh] max-w-[90vw] w-auto h-auto object-contain"
                        alt={t('imageAlt.magnifiedView')}
                    />
                    </div>
                )}
            </MagnifyOverlay>
        </motion.div>
    );
};
