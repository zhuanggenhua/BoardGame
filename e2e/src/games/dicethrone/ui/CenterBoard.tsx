import React from 'react';
import { useTranslation } from 'react-i18next';
import { UI_Z_INDEX, buildLocalizedImageSet } from '../../../core';
import { useCoarsePointer } from '../../../hooks/ui/useCoarsePointer';
import { AbilityOverlays } from './AbilityOverlays';
import type { AbilityOverlaysHandle } from './AbilityOverlays';
import { ASSETS } from './assets';
import { getPlayerBoardAspectRatio, getPlayerBoardUiTuning } from './abilitySlotLayout';

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
    locale?: string;
    onMagnifyImage: (image: string) => void;
    abilityOverlaysRef?: React.Ref<AbilityOverlaysHandle>;
    playerTokens?: Record<string, number>;
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
    locale,
    onMagnifyImage,
    abilityOverlaysRef,
    playerTokens,
}: CenterBoardProps) => {
    const { t } = useTranslation('game-dicethrone');
    const showTouchMagnifyButton = useCoarsePointer();
    const boardUiTuning = getPlayerBoardUiTuning(characterId);
    const playerBoardAspectRatio = getPlayerBoardAspectRatio(characterId);
    const playerBoardHeightVw = boardUiTuning.playerBoardBaseHeightVw;
    const tipBoardHeightVw = boardUiTuning.tipBoardHeightVw;
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

    const playerBoardPath = ASSETS.PLAYER_BOARD(characterId);
    const tipBoardPath = ASSETS.TIP_BOARD(characterId);
    const playerBoardBackground = buildLocalizedImageSet(playerBoardPath, locale);
    const tipBoardBackground = buildLocalizedImageSet(tipBoardPath, locale);

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
        <div
            className={shellFrameClassName}
            style={boardUiTuning.shellTranslateX === 0
                ? undefined
                : { transform: `translateX(${boardUiTuning.shellTranslateX}vw)` }}
        >
            <div
                className="relative flex items-center justify-center"
                style={{ gap: `${boardUiTuning.centerBoardGapVw}vw` }}
            >
                <div
                    className={`relative w-auto shadow-2xl z-10 group transition-[outline] duration-300 rounded-[0.8vw] overflow-hidden ${isLayoutEditing ? '' : 'cursor-zoom-in'} ${coreAreaHighlighted ? 'outline outline-4 outline-dashed outline-amber-400 outline-offset-[0.1vw]' : ''}`}
                    style={{
                        height: `${playerBoardHeightVw}vw`,
                        ...(boardUiTuning.playerBoardTranslateY === 0
                            ? {}
                            : { transform: `translateY(${boardUiTuning.playerBoardTranslateY}vw)` }),
                    }}
                    data-tutorial-id="player-board"
                    data-testid="player-board-surface"
                    onClick={(event) => handleMagnifySurfaceClick(event, playerBoardPath)}
                >
                    <div
                        className="h-full"
                        role="img"
                        aria-label={t('imageAlt.playerBoard')}
                        style={{
                            width: `calc(${playerBoardHeightVw}vw * ${playerBoardAspectRatio})`,
                            backgroundImage: playerBoardBackground,
                            backgroundRepeat: 'no-repeat',
                            backgroundPosition: 'center',
                            backgroundSize: 'contain',
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
                        locale={locale}
                        playerTokens={playerTokens}
                    />
                    <button
                        type="button"
                        onClick={(e) => { e.stopPropagation(); onMagnifyImage(playerBoardPath); }}
                        className={overlayButtonClassName}
                        style={{ ...overlayButtonStyle, zIndex: UI_Z_INDEX.hud + 10 }}
                        data-testid="player-board-magnify-button"
                        data-board-magnify-ignore="true"
                        aria-label="查看大图"
                    >
                        <span className={overlayButtonVisualClassName}>
                            <svg className={overlayButtonIconClassName} viewBox="0 0 20 20">
                                <path fillRule="evenodd" d="M8 4a4 4 0 100 8 4 4 0 000-8zM2 8a6 6 0 1110.89 3.476l4.817 4.817a1 1 0 01-1.414 1.414l-4.816-4.816A6 6 0 012 8z" clipRule="evenodd" />
                            </svg>
                        </span>
                    </button>
                </div>
                <div
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
                            className={`relative h-full w-auto aspect-[1311/2048] group ${isLayoutEditing ? '' : 'cursor-zoom-in'}`}
                            data-testid="tip-board-surface"
                            onClick={(event) => handleMagnifySurfaceClick(event, tipBoardPath)}
                        >
                            <div
                                className="w-full h-full"
                                role="img"
                                aria-label={t('imageAlt.tipBoard')}
                                style={{
                                    backgroundImage: tipBoardBackground,
                                    backgroundRepeat: 'no-repeat',
                                    backgroundPosition: 'center',
                                    backgroundSize: 'contain',
                                }}
                            />
                            <button
                                type="button"
                                onClick={(e) => { e.stopPropagation(); onMagnifyImage(tipBoardPath); }}
                                className={overlayButtonClassName}
                                style={{ ...overlayButtonStyle, zIndex: UI_Z_INDEX.hud + 10 }}
                                data-testid="tip-board-magnify-button"
                                data-board-magnify-ignore="true"
                                aria-label="查看大图"
                            >
                                <span className={overlayButtonVisualClassName}>
                                    <svg className={overlayButtonIconClassName} viewBox="0 0 20 20">
                                        <path fillRule="evenodd" d="M8 4a4 4 0 100 8 4 4 0 000-8zM2 8a6 6 0 1110.89 3.476l4.817 4.817a1 1 0 01-1.414 1.414l-4.816-4.816A6 6 0 012 8z" clipRule="evenodd" />
                                    </svg>
                                </span>
                            </button>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
};
