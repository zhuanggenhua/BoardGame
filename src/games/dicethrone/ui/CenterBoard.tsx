import React from 'react';
import { useTranslation } from 'react-i18next';
import { OptimizedImage } from '../../../components/common/media/OptimizedImage';
import { UI_Z_INDEX } from '../../../core';
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
    /** ref 转发给 AbilityOverlays，供调试面板调用保存布局 */
    abilityOverlaysRef?: React.Ref<AbilityOverlaysHandle>;
    /** 玩家的 token 状态（用于显示被动能力激活状态） */
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

    const playerBoardPath = ASSETS.PLAYER_BOARD(characterId);
    const tipBoardPath = ASSETS.TIP_BOARD(characterId);

    return (
        <div className="absolute left-[15vw] right-[15vw] top-[-6.5vw] bottom-0 flex items-center justify-center pointer-events-auto">
            <div className="relative flex items-center justify-center gap-[0.5vw]">
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
                        onClick={(e) => { e.stopPropagation(); onMagnifyImage(playerBoardPath); }}
                        className="absolute top-[1vw] right-[1vw] w-[2.2vw] h-[2.2vw] flex items-center justify-center bg-black/60 hover:bg-amber-500/80 text-white rounded-full opacity-0 group-hover:opacity-100 transition-[opacity,background-color] duration-300 shadow-xl border border-white/20"
                        style={{ zIndex: UI_Z_INDEX.hud + 10 }}
                    >
                        <svg className="w-[1.2vw] h-[1.2vw] fill-current" viewBox="0 0 20 20">
                            <path fillRule="evenodd" d="M8 4a4 4 0 100 8 4 4 0 000-8zM2 8a6 6 0 1110.89 3.476l4.817 4.817a1 1 0 01-1.414 1.414l-4.816-4.816A6 6 0 012 8z" clipRule="evenodd" />
                        </svg>
                    </button>
                </div>
                <div className="flex items-center relative h-[35vw]" data-tutorial-id="tip-board">
                    <button
                        onClick={onToggleTip}
                        className={`absolute top-[55%] -translate-y-1/2 z-50 p-[0.5vw] bg-black/30 hover:bg-black/60 text-white/50 hover:text-white rounded-full transition-[background-color,color] duration-500 border border-white/10 ${isTipOpen ? 'right-[0.8vw]' : 'left-[0.1vw]'}`}
                    >{isTipOpen ? '‹' : '›'}</button>
                    <div className={`relative h-full transition-[width,opacity,transform] duration-500 overflow-hidden rounded-[0.8vw] ${isTipOpen ? 'w-auto opacity-100 scale-100' : 'w-0 opacity-0 scale-95'}`}>
                        <div className="relative h-full w-auto aspect-[1311/2048] group">
                            <OptimizedImage
                                src={tipBoardPath}
                                locale={locale}
                                className="w-auto h-full object-contain"
                                alt={t('imageAlt.tipBoard')}
                            />
                            <button
                                onClick={(e) => { e.stopPropagation(); onMagnifyImage(tipBoardPath); }}
                                className="absolute top-[1vw] right-[1vw] w-[2.2vw] h-[2.2vw] flex items-center justify-center bg-black/60 hover:bg-amber-500/80 text-white rounded-full opacity-0 group-hover:opacity-100 transition-[opacity,background-color] duration-300 shadow-xl border border-white/20"
                                style={{ zIndex: UI_Z_INDEX.hud + 10 }}
                            >
                                <svg className="w-[1.2vw] h-[1.2vw] fill-current" viewBox="0 0 20 20">
                                    <path fillRule="evenodd" d="M8 4a4 4 0 100 8 4 4 0 000-8zM2 8a6 6 0 1110.89 3.476l4.817 4.817a1 1 0 01-1.414 1.414l-4.816-4.816A6 6 0 012 8z" clipRule="evenodd" />
                                </svg>
                            </button>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
};
