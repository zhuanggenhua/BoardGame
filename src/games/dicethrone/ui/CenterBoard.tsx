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
import { NyraCompanionPanel, type NyraDamageResponse } from './NyraCompanionPanel';
import { buildBoardShellInlineUnitValue } from '../../../shared/runtimeLayoutUnits';

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
    nyraPlayer?: HeroState;
    nyraDamageResponse?: NyraDamageResponse;
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
    nyraPlayer,
    nyraDamageResponse,
}: CenterBoardProps) => {
    const { t } = useTranslation('game-dicethrone');
    const showTouchMagnifyButton = useCoarsePointer();
    const boardUiTuning = getPlayerBoardUiTuning(characterId);
    const playerBoardAspectRatio = getPlayerBoardAspectRatio(characterId);
    const playerBoardHeightUnits = boardUiTuning.playerBoardBaseHeightUnits;
    const tipBoardHeightUnits = boardUiTuning.tipBoardHeightUnits;
    const hasTipBoard = hasDiceThroneTipBoard(characterId);
    // 女猎手提示卡恢复显示后，组合宽度增加；右移少量以保持妮拉面板不侵入左侧回合栏。
    const shellTranslateX = boardUiTuning.shellTranslateX + (characterId === 'lieren' ? 0.5 : 0);
    const shellTransform = shellTranslateX === 0 ? '' : `translateX(${buildBoardShellInlineUnitValue(shellTranslateX)})`;
    const shellFrameClassName = 'absolute bottom-0 flex items-center justify-center pointer-events-auto';
    const overlayButtonIconClassName = 'fill-current';
    const overlayButtonClassName = `absolute flex items-center justify-center rounded-full border border-white/20 bg-black/60 p-0 text-white shadow-xl transition-[background-color,border-color,opacity] duration-300 hover:bg-amber-500/72 hover:border-amber-300/45 ${showTouchMagnifyButton ? 'opacity-100' : 'opacity-0 group-hover:opacity-100'}`;
    const overlayButtonVisualClassName = 'flex h-full w-full items-center justify-center';
    const overlayButtonStyle = {
        top: buildBoardShellInlineUnitValue(boardUiTuning.magnifyButtonTop),
        right: buildBoardShellInlineUnitValue(0.9),
        width: buildBoardShellInlineUnitValue(2.6),
        height: buildBoardShellInlineUnitValue(2.6),
        minWidth: '0',
        minHeight: '0',
        maxWidth: buildBoardShellInlineUnitValue(2.6),
        maxHeight: buildBoardShellInlineUnitValue(2.6),
        appearance: 'none',
        WebkitAppearance: 'none',
        fontSize: '0',
        lineHeight: '0',
    } as const;
    const tipToggleButtonStyle = {
        [isTipOpen ? 'right' : 'left']: isTipOpen ? buildBoardShellInlineUnitValue(0.8) : buildBoardShellInlineUnitValue(0.1),
        padding: buildBoardShellInlineUnitValue(0.5),
    } as const;
    const tipToggleButtonClassName = 'absolute top-[55%] z-50 flex text-[inherit] -translate-y-1/2 items-center justify-center rounded-full bg-black/30 text-white/50 transition-[background-color,color,border-color] duration-500 border border-white/8 hover:bg-black/50 hover:text-white hover:border-white/16';

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

    const renderNyraBoardBadge = () => {
        if (nyraPlayer?.characterId !== 'lieren') {
            return null;
        }

        return (
            <div
                className="absolute top-[1.7%] left-[1.6%] z-30 w-[31.4%] pointer-events-auto"
                data-testid="nyra-player-panel-anchor"
                data-player-panel-slot="player-board-image-top-left-blank"
            >
                <NyraCompanionPanel
                    player={nyraPlayer}
                    locale={locale}
                    damageResponse={nyraDamageResponse}
                    variant="boardBadge"
                />
            </div>
        );
    };

    return (
        <>
            <div
                className={shellFrameClassName}
                style={{
                    left: buildBoardShellInlineUnitValue(15),
                    right: buildBoardShellInlineUnitValue(15),
                    top: buildBoardShellInlineUnitValue(-6.5),
                    ...(shellTransform.length === 0 ? {} : { transform: shellTransform }),
                }}
            >
                <div
                    className="relative flex items-center justify-center"
                    style={{ gap: buildBoardShellInlineUnitValue(boardUiTuning.centerBoardGapUnits) }}
                >
                <div
                    className={`relative w-auto shadow-2xl z-0 group transition-[outline] duration-300 overflow-visible ${isLayoutEditing ? '' : 'cursor-zoom-in'} ${coreAreaHighlighted ? 'outline outline-4 outline-dashed outline-amber-400' : ''}`}
                    style={{
                        height: buildBoardShellInlineUnitValue(playerBoardHeightUnits),
                        borderRadius: buildBoardShellInlineUnitValue(0.8),
                        outlineOffset: coreAreaHighlighted ? buildBoardShellInlineUnitValue(0.1) : undefined,
                        ...(boardUiTuning.playerBoardTranslateY === 0
                            ? {}
                            : { transform: `translateY(${buildBoardShellInlineUnitValue(boardUiTuning.playerBoardTranslateY)})` }),
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
                                width: `calc(${buildBoardShellInlineUnitValue(playerBoardHeightUnits)} * ${playerBoardAspectRatio})`,
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
                                    className="absolute inset-0 overflow-hidden"
                                    style={{
                                        backfaceVisibility: 'hidden',
                                        WebkitBackfaceVisibility: 'hidden',
                                        transform: 'rotateY(0deg)',
                                        pointerEvents: cursedPirateVisibleFace === 'normal' ? 'auto' : 'none',
                                        borderRadius: buildBoardShellInlineUnitValue(0.8),
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
                                    {renderNyraBoardBadge()}
                                </div>
                                <div
                                    className="absolute inset-0 overflow-hidden"
                                    style={{
                                        backfaceVisibility: 'hidden',
                                        WebkitBackfaceVisibility: 'hidden',
                                        transform: 'rotateY(180deg)',
                                        pointerEvents: cursedPirateVisibleFace === 'cursed' ? 'auto' : 'none',
                                        borderRadius: buildBoardShellInlineUnitValue(0.8),
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
                                    {renderNyraBoardBadge()}
                                </div>
                            </motion.div>
                        </div>
                    ) : (
                        <motion.div
                            className="relative h-full overflow-hidden"
                            data-testid="player-board-face-shell"
                            data-player-board-face={playerBoardFace ?? 'default'}
                            style={{
                                width: `calc(${buildBoardShellInlineUnitValue(playerBoardHeightUnits)} * ${playerBoardAspectRatio})`,
                                borderRadius: buildBoardShellInlineUnitValue(0.8),
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
                            {renderNyraBoardBadge()}
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
                            <svg
                                className={overlayButtonIconClassName}
                                style={{ width: buildBoardShellInlineUnitValue(0.72), height: buildBoardShellInlineUnitValue(0.72) }}
                                viewBox="0 0 20 20"
                            >
                                <path fillRule="evenodd" d="M8 4a4 4 0 100 8 4 4 0 000-8zM2 8a6 6 0 1110.89 3.476l4.817 4.817a1 1 0 01-1.414 1.414l-4.816-4.816A6 6 0 012 8z" clipRule="evenodd" />
                            </svg>
                        </span>
                    </button>
                </div>
                {hasTipBoard && <div
                    className="flex items-center relative"
                    style={{ height: buildBoardShellInlineUnitValue(tipBoardHeightUnits) }}
                    data-tutorial-id="tip-board"
                >
                    <button
                        type="button"
                        onClick={onToggleTip}
                        className={tipToggleButtonClassName}
                        style={tipToggleButtonStyle}
                        data-board-magnify-ignore="true"
                    >
                        {isTipOpen ? '<' : '>'}
                    </button>
                    <div
                        className={`relative h-full transition-[width,opacity,transform] duration-500 overflow-hidden ${isTipOpen ? 'w-auto opacity-100 scale-100' : 'w-0 opacity-0 scale-95'}`}
                        style={{ borderRadius: buildBoardShellInlineUnitValue(0.8) }}
                    >
                        <div
                            className={`relative h-full group ${isLayoutEditing ? '' : 'cursor-zoom-in'}`}
                            style={{
                                width: `calc(${buildBoardShellInlineUnitValue(tipBoardHeightUnits)} * ${1311 / 2048})`,
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
                                    <svg
                                        className={overlayButtonIconClassName}
                                        style={{ width: buildBoardShellInlineUnitValue(0.72), height: buildBoardShellInlineUnitValue(0.72) }}
                                        viewBox="0 0 20 20"
                                    >
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
