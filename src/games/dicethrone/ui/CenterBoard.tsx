import React from 'react';
import { useTranslation } from 'react-i18next';
import { OptimizedImage } from '../../../components/common/media/OptimizedImage';
import { UI_Z_INDEX } from '../../../core';
import { useCoarsePointer } from '../../../hooks/ui/useCoarsePointer';
import { AbilityOverlays } from './AbilityOverlays';
import type { AbilityOverlaysHandle } from './AbilityOverlays';
import { ASSETS } from './assets';

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
    const shellFrameClassName = 'absolute left-[15vw] right-[15vw] top-[-6.5vw] bottom-0 flex items-center justify-center pointer-events-auto';
    const boardGapClassName = 'gap-[0.5vw]';
    const overlayButtonIconClassName = 'w-[0.72vw] h-[0.72vw] fill-current';
    const overlayButtonClassName = `absolute flex items-center justify-center rounded-full border border-white/20 bg-black/60 p-0 text-white shadow-xl transition-[background-color,border-color,opacity] duration-300 hover:bg-amber-500/72 hover:border-amber-300/45 ${showTouchMagnifyButton ? 'opacity-100' : 'opacity-0 group-hover:opacity-100'}`;
    const overlayButtonVisualClassName = 'flex h-full w-full items-center justify-center';
    const overlayButtonStyle = {
        top: '0.48vw',
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

    return (
        <div className={shellFrameClassName}>
            <div className={`relative flex items-center justify-center ${boardGapClassName}`}>
                <div
                    className={`relative h-[35vw] w-auto shadow-2xl z-10 group transition-[outline] duration-300 rounded-[0.8vw] overflow-hidden ${coreAreaHighlighted ? 'outline outline-4 outline-dashed outline-amber-400 outline-offset-[0.1vw]' : ''}`}
                    data-tutorial-id="player-board"
                >
                    <OptimizedImage
                        src={playerBoardPath}
                        locale={locale}
                        className="w-auto h-full object-contain"
                        alt={t('imageAlt.playerBoard')}
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
                        aria-label="查看大图"
                    >
                        <span className={overlayButtonVisualClassName}>
                            <svg className={overlayButtonIconClassName} viewBox="0 0 20 20">
                                <path fillRule="evenodd" d="M8 4a4 4 0 100 8 4 4 0 000-8zM2 8a6 6 0 1110.89 3.476l4.817 4.817a1 1 0 01-1.414 1.414l-4.816-4.816A6 6 0 012 8z" clipRule="evenodd" />
                            </svg>
                        </span>
                    </button>
                </div>
                <div className="flex items-center relative h-[35vw]" data-tutorial-id="tip-board">
                    <button type="button" onClick={onToggleTip} className={tipToggleButtonClassName}>
                        {isTipOpen ? '<' : '>'}
                    </button>
                    <div className={`relative h-full transition-[width,opacity,transform] duration-500 overflow-hidden rounded-[0.8vw] ${isTipOpen ? 'w-auto opacity-100 scale-100' : 'w-0 opacity-0 scale-95'}`}>
                        <div className="relative h-full w-auto aspect-[1311/2048] group">
                            <OptimizedImage
                                src={tipBoardPath}
                                locale={locale}
                                className="w-auto h-full object-contain"
                                alt={t('imageAlt.tipBoard')}
                            />
                            <button
                                type="button"
                                onClick={(e) => { e.stopPropagation(); onMagnifyImage(tipBoardPath); }}
                                className={overlayButtonClassName}
                                style={{ ...overlayButtonStyle, zIndex: UI_Z_INDEX.hud + 10 }}
                                data-testid="tip-board-magnify-button"
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
