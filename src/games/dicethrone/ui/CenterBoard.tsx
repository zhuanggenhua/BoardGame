import React from 'react';
import { motion } from 'framer-motion';
import { useTranslation } from 'react-i18next';
import { UI_Z_INDEX } from '../../../core';
import { OptimizedImage } from '../../../components/common/media/OptimizedImage';
import { useCoarsePointer } from '../../../hooks/ui/useCoarsePointer';
import { AbilityOverlays } from './AbilityOverlays';
import type { AbilityOverlaysHandle } from './AbilityOverlays';
import { ASSETS } from './assets';
import { getPlayerBoardAspectRatio, getPlayerBoardUiTuning } from './abilitySlotLayout';
import type { AbilityCard } from '../types';
import { hasDiceThroneTipBoard, type HeroState } from '../domain/types';

export interface CenterBoardProps {
    coreAreaHighlighted: boolean;
    isTipOpen: boolean;
    onToggleTip: () => void;
    isLayoutEditing: boolean;
    isSelfView: boolean;
    availableAbilityIds: string[];
    canSelectAbility: boolean;
    canHighlightAbility: boolean;
    onSelectAbility: (abilityId: string) => void;
    onHighlightedAbilityClick?: () => void;
    selectedAbilityId?: string;
    activatingAbilityId?: string;
    abilityLevels?: Record<string, number>;
    characterId?: string;
    playerBoardFace?: HeroState['playerBoardFace'];
    locale?: string;
    onMagnifyImage: (image: string) => void;
    onMagnifyCard: (card: AbilityCard) => void;
    abilityOverlaysRef?: React.Ref<AbilityOverlaysHandle>;
    playerTokens?: Record<string, number>;
    leftResponseDockActive?: boolean;
}

export const CenterBoard = ({
    coreAreaHighlighted,
    isTipOpen,
    onToggleTip,
    isLayoutEditing,
    isSelfView,
    availableAbilityIds,
    canSelectAbility,
    canHighlightAbility,
    onSelectAbility,
    onHighlightedAbilityClick,
    selectedAbilityId,
    activatingAbilityId,
    abilityLevels,
    characterId = 'monk',
    playerBoardFace,
    locale,
    onMagnifyImage,
    onMagnifyCard,
    abilityOverlaysRef,
    playerTokens,
    leftResponseDockActive = false,
}: CenterBoardProps) => {
    const { t } = useTranslation('game-dicethrone');
    const showTouchMagnifyButton = useCoarsePointer();
    const boardUiTuning = getPlayerBoardUiTuning(characterId);
    const playerBoardAspectRatio = getPlayerBoardAspectRatio(characterId);
    const playerBoardHeightVw = boardUiTuning.playerBoardBaseHeightVw;
    const tipBoardHeightVw = boardUiTuning.tipBoardHeightVw;
    const hasTipBoard = hasDiceThroneTipBoard(characterId);
    const shellTranslateX = boardUiTuning.shellTranslateX + (leftResponseDockActive ? 10 : 0);
    const shellScale = leftResponseDockActive ? 0.88 : 1;
    const shellTransform = [
        shellTranslateX === 0 ? null : `translateX(${shellTranslateX}vw)`,
        shellScale === 1 ? null : `scale(${shellScale})`,
    ].filter(Boolean).join(' ');
    const shellFrameClassName = 'absolute left-[15vw] right-[15vw] top-[-6.5vw] bottom-0 flex items-center justify-center pointer-events-auto';
    const overlayButtonIconClassName = 'w-[0.72vw] h-[0.72vw] fill-current';
    const overlayButtonClassName = `absolute flex items-center justify-center rounded-full border border-white/20 bg-black/60 p-0 text-white shadow-xl transition-[background-color,border-color,opacity] duration-300 hover:bg-amber-500/72 hover:border-amber-300/45 ${showTouchMagnifyButton ? 'opacity-100' : 'opacity-0 group-hover:opacity-100'}`;
    const overlayButtonVisualClassName = 'flex h-full w-full items-center justify-center';
    const overlayButtonStyle = {
        top: `${boardUiTuning.magnifyButtonTop}vw`,
        right: '0.9vw',
        width: '2.6vw',
        height: '2.6vw',
        minWidth: '0',
        minHeight: '0',
        maxWidth: '2.6vw',
        maxHeight: '2.6vw',
        appearance: 'none',
        WebkitAppearance: 'none',
        fontSize: '0',
        lineHeight: '0',
    } as const;
    const tipToggleButtonOffsetClassName = isTipOpen ? 'right-[0.8vw]' : 'left-[0.1vw]';
    const tipToggleButtonClassName = `absolute top-[55%] z-50 flex p-[0.5vw] text-[inherit] -translate-y-1/2 items-center justify-center rounded-full bg-black/30 text-white/50 transition-[background-color,color,border-color] duration-500 border border-white/8 hover:bg-black/50 hover:text-white hover:border-white/16 ${tipToggleButtonOffsetClassName}`;

    const playerBoardPath = ASSETS.PLAYER_BOARD(characterId, playerBoardFace);
    const tipBoardPath = ASSETS.TIP_BOARD(characterId);
    const shouldAnimateBoardFlip = characterId === 'cursed_pirate';
    const cursedPirateVisibleFace = playerBoardFace === 'normal' ? 'normal' : 'cursed';
    const cursedPirateNormalBoardPath = shouldAnimateBoardFlip
        ? ASSETS.PLAYER_BOARD(characterId, 'normal')
        : playerBoardPath;
    const cursedPirateCursedBoardPath = shouldAnimateBoardFlip
        ? ASSETS.PLAYER_BOARD(characterId, 'cursed')
        : playerBoardPath;
    const true3DBoardFlipMotion = {
        rotateY: cursedPirateVisibleFace === 'normal' ? 0 : 180,
        transition: { duration: 0.72, ease: [0.22, 1, 0.36, 1] as const },
    };

    const handleMagnifySurfaceClick = React.useCallback((
        event: React.MouseEvent<HTMLElement>,
        imagePath: string,
    ) => {
        if (isLayoutEditing) {
            return;
        }

        const target = event.target as HTMLElement | null;
        if (target?.closest('[data-ability-slot], [data-board-magnify-ignore="true"]')) {
            return;
        }

        onMagnifyImage(imagePath);
    }, [isLayoutEditing, onMagnifyImage]);

    return (
        <>
            <div
                className={shellFrameClassName}
                style={shellTransform.length === 0
                    ? undefined
                    : { transform: shellTransform, transformOrigin: 'center center' }}
            >
                <div
                    className="relative flex items-center justify-center"
                    style={{ gap: `${boardUiTuning.centerBoardGapVw}vw` }}
                >
                <div
                    className={`relative w-auto shadow-2xl z-0 group transition-[outline] duration-300 rounded-[0.8vw] overflow-visible ${isLayoutEditing ? '' : 'cursor-zoom-in'} ${coreAreaHighlighted ? 'outline outline-4 outline-dashed outline-amber-400 outline-offset-[0.1vw]' : ''}`}
                    style={{
                        height: `${playerBoardHeightVw}vw`,
                        ...(boardUiTuning.playerBoardTranslateY === 0
                            ? {}
                            : { transform: `translateY(${boardUiTuning.playerBoardTranslateY}vw)` }),
                    }}
                    data-tutorial-id="player-board"
                    data-testid="player-board-surface"
                    data-character-id={characterId}
                    onClick={(event) => handleMagnifySurfaceClick(event, playerBoardPath)}
                >
                    {shouldAnimateBoardFlip ? (
                        <div
                            className="relative h-full"
                            style={{
                                width: `calc(${playerBoardHeightVw}vw * ${playerBoardAspectRatio})`,
                                perspective: '2200px',
                                WebkitPerspective: '2200px',
                                perspectiveOrigin: '50% 50%',
                                WebkitPerspectiveOrigin: '50% 50%',
                            }}
                        >
                            <motion.div
                                className="relative h-full"
                                data-testid="player-board-face-shell"
                                data-player-board-face={cursedPirateVisibleFace}
                                style={{
                                    width: '100%',
                                    transformStyle: 'preserve-3d',
                                    WebkitTransformStyle: 'preserve-3d',
                                    transformOrigin: '50% 50%',
                                }}
                                initial={false}
                                animate={true3DBoardFlipMotion}
                            >
                                <div
                                    className="absolute inset-0 overflow-hidden rounded-[0.8vw]"
                                    style={{
                                        backfaceVisibility: 'hidden',
                                        WebkitBackfaceVisibility: 'hidden',
                                        transform: 'rotateY(0deg)',
                                        pointerEvents: cursedPirateVisibleFace === 'normal' ? 'auto' : 'none',
                                    }}
                                >
                                    <OptimizedImage
                                        src={cursedPirateNormalBoardPath}
                                        locale={locale}
                                        alt={t('imageAlt.playerBoard')}
                                        className="h-full w-full"
                                        placeholder={false}
                                        data-testid={cursedPirateVisibleFace === 'normal' ? 'player-board-image' : 'player-board-image-hidden'}
                                        style={{
                                            display: 'block',
                                            objectFit: 'contain',
                                            width: '100%',
                                            height: '100%',
                                        }}
                                    />
                                    {cursedPirateVisibleFace === 'normal' && (
                                        <AbilityOverlays
                                            ref={abilityOverlaysRef}
                                            isEditing={isLayoutEditing && isSelfView}
                                            availableAbilityIds={availableAbilityIds}
                                            canSelect={canSelectAbility}
                                            canHighlight={canHighlightAbility}
                                            onSelectAbility={onSelectAbility}
                                            onHighlightedAbilityClick={onHighlightedAbilityClick}
                                            selectedAbilityId={selectedAbilityId}
                                            activatingAbilityId={activatingAbilityId}
                                            abilityLevels={abilityLevels}
                                            characterId={characterId}
                                            playerBoardFace="normal"
                                            locale={locale}
                                            onMagnifyCard={onMagnifyCard}
                                            playerTokens={playerTokens}
                                        />
                                    )}
                                </div>
                                <div
                                    className="absolute inset-0 overflow-hidden rounded-[0.8vw]"
                                    style={{
                                        backfaceVisibility: 'hidden',
                                        WebkitBackfaceVisibility: 'hidden',
                                        transform: 'rotateY(180deg)',
                                        pointerEvents: cursedPirateVisibleFace === 'cursed' ? 'auto' : 'none',
                                    }}
                                >
                                    <OptimizedImage
                                        src={cursedPirateCursedBoardPath}
                                        locale={locale}
                                        alt={t('imageAlt.playerBoard')}
                                        className="h-full w-full"
                                        placeholder={false}
                                        data-testid={cursedPirateVisibleFace === 'cursed' ? 'player-board-image' : 'player-board-image-hidden'}
                                        style={{
                                            display: 'block',
                                            objectFit: 'contain',
                                            width: '100%',
                                            height: '100%',
                                        }}
                                    />
                                    {cursedPirateVisibleFace === 'cursed' && (
                                        <AbilityOverlays
                                            ref={abilityOverlaysRef}
                                            isEditing={isLayoutEditing && isSelfView}
                                            availableAbilityIds={availableAbilityIds}
                                            canSelect={canSelectAbility}
                                            canHighlight={canHighlightAbility}
                                            onSelectAbility={onSelectAbility}
                                            onHighlightedAbilityClick={onHighlightedAbilityClick}
                                            selectedAbilityId={selectedAbilityId}
                                            activatingAbilityId={activatingAbilityId}
                                            abilityLevels={abilityLevels}
                                            characterId={characterId}
                                            playerBoardFace="cursed"
                                            locale={locale}
                                            onMagnifyCard={onMagnifyCard}
                                            playerTokens={playerTokens}
                                        />
                                    )}
                                </div>
                            </motion.div>
                        </div>
                    ) : (
                        <motion.div
                            className="relative h-full overflow-hidden rounded-[0.8vw]"
                            data-testid="player-board-face-shell"
                            data-player-board-face={playerBoardFace ?? 'default'}
                            style={{
                                width: `calc(${playerBoardHeightVw}vw * ${playerBoardAspectRatio})`,
                            }}
                            initial={{ opacity: 0.96 }}
                            animate={{ opacity: 1 }}
                            transition={{ duration: 0.12 }}
                        >
                            <OptimizedImage
                                src={playerBoardPath}
                                locale={locale}
                                alt={t('imageAlt.playerBoard')}
                                className="h-full w-full"
                                placeholder={false}
                                data-testid="player-board-image"
                                style={{
                                    display: 'block',
                                    objectFit: 'contain',
                                    width: '100%',
                                    height: '100%',
                                }}
                            />
                            <AbilityOverlays
                                ref={abilityOverlaysRef}
                                isEditing={isLayoutEditing && isSelfView}
                                availableAbilityIds={availableAbilityIds}
                                canSelect={canSelectAbility}
                                canHighlight={canHighlightAbility}
                                onSelectAbility={onSelectAbility}
                                onHighlightedAbilityClick={onHighlightedAbilityClick}
                                selectedAbilityId={selectedAbilityId}
                                activatingAbilityId={activatingAbilityId}
                                abilityLevels={abilityLevels}
                                characterId={characterId}
                                playerBoardFace={playerBoardFace}
                                locale={locale}
                                onMagnifyCard={onMagnifyCard}
                                playerTokens={playerTokens}
                            />
                        </motion.div>
                    )}
                    <button
                        type="button"
                        onClick={(e) => { e.stopPropagation(); onMagnifyImage(playerBoardPath); }}
                        className={overlayButtonClassName}
                        style={{ ...overlayButtonStyle, zIndex: UI_Z_INDEX.hud + 10 }}
                        data-testid="player-board-magnify-button"
                        data-board-magnify-ignore="true"
                        aria-label={t('actions.magnify')}
                    >
                        <span className={overlayButtonVisualClassName}>
                            <svg className={overlayButtonIconClassName} viewBox="0 0 20 20">
                                <path fillRule="evenodd" d="M8 4a4 4 0 100 8 4 4 0 000-8zM2 8a6 6 0 1110.89 3.476l4.817 4.817a1 1 0 01-1.414 1.414l-4.816-4.816A6 6 0 012 8z" clipRule="evenodd" />
                            </svg>
                        </span>
                    </button>
                </div>
                {hasTipBoard && <div
                    className="flex items-center relative"
                    style={{ height: `${tipBoardHeightVw}vw` }}
                    data-tutorial-id="tip-board"
                >
                    <button
                        type="button"
                        onClick={onToggleTip}
                        className={tipToggleButtonClassName}
                        data-board-magnify-ignore="true"
                    >
                        {isTipOpen ? '<' : '>'}
                    </button>
                    <div className={`relative h-full transition-[width,opacity,transform] duration-500 overflow-hidden rounded-[0.8vw] ${isTipOpen ? 'w-auto opacity-100 scale-100' : 'w-0 opacity-0 scale-95'}`}>
                        <div
                            className={`relative h-full group ${isLayoutEditing ? '' : 'cursor-zoom-in'}`}
                            style={{
                                width: `calc(${tipBoardHeightVw}vw * ${1311 / 2048})`,
                            }}
                            data-testid="tip-board-surface"
                            onClick={(event) => handleMagnifySurfaceClick(event, tipBoardPath)}
                        >
                            <div
                                className="w-full h-full"
                            >
                                <OptimizedImage
                                    src={tipBoardPath}
                                    locale={locale}
                                    alt={t('imageAlt.tipBoard')}
                                    className="h-full w-full"
                                    placeholder={false}
                                    data-testid="tip-board-image"
                                    style={{
                                        display: 'block',
                                        objectFit: 'contain',
                                        width: '100%',
                                        height: '100%',
                                    }}
                                />
                            </div>
                            <button
                                type="button"
                                onClick={(e) => { e.stopPropagation(); onMagnifyImage(tipBoardPath); }}
                                className={overlayButtonClassName}
                                style={{ ...overlayButtonStyle, zIndex: UI_Z_INDEX.hud + 10 }}
                                data-testid="tip-board-magnify-button"
                                data-board-magnify-ignore="true"
                                aria-label={t('actions.magnify')}
                            >
                                <span className={overlayButtonVisualClassName}>
                                    <svg className={overlayButtonIconClassName} viewBox="0 0 20 20">
                                        <path fillRule="evenodd" d="M8 4a4 4 0 100 8 4 4 0 000-8zM2 8a6 6 0 1110.89 3.476l4.817 4.817a1 1 0 01-1.414 1.414l-4.816-4.816A6 6 0 012 8z" clipRule="evenodd" />
                                    </svg>
                                </span>
                            </button>
                        </div>
                    </div>
                </div>}
                </div>
            </div>
        </>
    );
};
