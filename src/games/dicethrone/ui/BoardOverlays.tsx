/**
 * BoardOverlays 组件
 * 
 * 统一管理所有弹窗和覆盖层，简化主组件结构
 */

import React from 'react';
import { useTranslation } from 'react-i18next';
import { AnimatePresence } from 'framer-motion';
import { CardPreview } from '../../../components/common/media/CardPreview';
import { OptimizedImage } from '../../../components/common/media/OptimizedImage';
import { MagnifyOverlay } from '../../../components/common/overlays/MagnifyOverlay';
import { CardSpotlightOverlay } from './CardSpotlightOverlay';
import { AbilityOverlays } from './AbilityOverlays';
import { EndgameOverlay } from '../../../components/game/framework/widgets/EndgameOverlay';
import { RematchActions } from '../../../components/game/framework/widgets/RematchActions';
import { DiceThroneEndgameContent, renderDiceThroneButton } from './DiceThroneEndgame';
import type { StatusAtlases } from './statusEffects';
import type { AbilityCard, HeroState, CharacterId, TurnPhase } from '../domain/types';
import type { PlayerId } from '../../../engine/types';
import type { CardSpotlightItem } from './CardSpotlightOverlay';
import {
    getPlayerBoardAspectRatio,
} from './abilitySlotLayout';
import { getPendingBonusSettlementDice } from '../domain/rules';
import { useHorizontalDragScroll } from '../../../hooks/ui/useHorizontalDragScroll';
import { createScopedLogger } from '../../../lib/logger';

const boardOverlaysLogger = createScopedLogger('DT_BOARD_OVERLAYS');

export interface BoardOverlaysProps {
    // 放大预览
    isMagnifyOpen: boolean;
    magnifiedImage: string | null;
    magnifiedCard: AbilityCard | null;
    magnifiedCards: AbilityCard[];
    onCloseMagnify: () => void;
    availableAbilityIds: string[];
    canSelectAbility: boolean;
    canHighlightAbility: boolean;
    onSelectAbility: (abilityId: string) => void;
    onHighlightedAbilityClick?: () => void;
    selectedAbilityId?: string;
    activatingAbilityId?: string;
    /** 当前视角玩家的技能等级（用于放大预览叠加升级卡） */
    abilityLevels?: Record<string, number>;
    /** 当前视角玩家的角色 ID */
    viewCharacterId?: string;
    /** 当前视角玩家的面板朝向 */
    viewPlayerBoardFace?: HeroState['playerBoardFace'];

    players: Record<PlayerId, HeroState>;
    currentPlayerId: PlayerId;
    playerNames: Record<PlayerId, string>;
    seatingOrder?: PlayerId[];
    teamIdByPlayerId?: Record<PlayerId, string>;

    // 卡牌特写
    cardSpotlightQueue: CardSpotlightItem[];
    onCardSpotlightClose: (id: string) => void;
    opponentHeaderRef: React.RefObject<HTMLDivElement | null>;


    // 游戏结束
    isGameOver: boolean;
    gameoverResult: any;
    playerID?: string;
    reset?: () => void;
    rematchState: any;
    onRematchVote: () => void;

    // 其他
    statusIconAtlas?: StatusAtlases | null;
    locale: string;
    currentPhase: TurnPhase;

    // 选角相关
    selectedCharacters: Record<PlayerId, CharacterId>;
    hostPlayerId: PlayerId;

    /** 教程模式下特写强制自动关闭延迟（毫秒） */
    tutorialSpotlightAutoCloseDelayMs?: number;
}

export const BoardOverlays: React.FC<BoardOverlaysProps> = (props) => {
    const { t } = useTranslation('game-dicethrone');
    const { ref: multiCardScrollRef, dragProps: multiCardDragProps } = useHorizontalDragScroll();
    const isPlayerBoardPreview = Boolean(props.magnifiedImage?.includes('player-board'));
    const isMultiCardPreview = props.magnifiedCards.length > 0;
    const playerBoardAspectRatio = getPlayerBoardAspectRatio(props.viewCharacterId);
    const playerBoardPreviewWidth = `min(90vw, calc(90vh * ${playerBoardAspectRatio}))`;
    const magnifiedCardWidth = 'min(54.9vh, 39.65vw, 396px, 60vw, 400px)';
    const magnifiedMultiCardWidth = 'min(28vw, 350px, calc(54.9vh - 2.44vw))';
    const shouldRenderMagnifiedAbilityOverlay = isPlayerBoardPreview && Boolean(props.viewCharacterId);
    const magnifyContainerClassName = `
        group/modal
        ${isPlayerBoardPreview ? 'h-auto w-auto max-h-[90vh] max-w-[90vw]' : ''}
        ${props.magnifiedCard ? 'w-auto max-h-[90vh] max-w-[60vw]' : ''}
        ${isMultiCardPreview ? 'max-h-[90vh] max-w-[90vw]' : ''}
        ${!isPlayerBoardPreview && !props.magnifiedCard && !isMultiCardPreview ? 'max-h-[90vh] max-w-[90vw]' : ''}
    `;
    const handleSelectMagnifiedAbility = React.useCallback((abilityId: string) => {
        props.onSelectAbility(abilityId);
        props.onCloseMagnify();
    }, [props.onCloseMagnify, props.onSelectAbility]);

    return (
        <>
            <AnimatePresence>
                {/* 放大预览 */}
                {props.isMagnifyOpen && (
                    <MagnifyOverlay
                        key="magnify"
                        isOpen={props.isMagnifyOpen}
                        onClose={props.onCloseMagnify}
                        containerClassName={magnifyContainerClassName}
                        closeLabel={t('actions.closePreview')}
                        overlayTestId="board-magnify-overlay"
                    >
                        {isMultiCardPreview ? (
                            <div
                                ref={multiCardScrollRef}
                                {...multiCardDragProps}
                                data-testid="dt-multi-card-magnify-strip"
                                className="flex flex-nowrap items-center justify-start gap-[2vw] p-[2vw] overflow-x-auto overflow-y-hidden"
                                style={multiCardDragProps.style}
                            >
                                {props.magnifiedCards.map((card) => (
                                    <CardPreview
                                        key={card.id}
                                        className="rounded-xl shadow-2xl border border-white/20 flex-shrink-0"
                                        style={{
                                            backgroundColor: '#0f172a',
                                            width: magnifiedMultiCardWidth,
                                            height: `calc(${magnifiedMultiCardWidth} / 0.61)`,
                                            aspectRatio: '0.61 / 1',
                                        }}
                                        previewRef={card.previewRef}
                                        locale={props.locale}
                                    />
                                ))}
                            </div>
                        ) : props.magnifiedCard ? (
                            <CardPreview
                                className="rounded-[1vw]"
                                style={{
                                    backgroundColor: '#0f172a',
                                    width: magnifiedCardWidth,
                                    height: `calc(${magnifiedCardWidth} / 0.61)`,
                                    aspectRatio: '0.61 / 1',
                                }}
                                previewRef={props.magnifiedCard.previewRef}
                                locale={props.locale}
                            />
                        ) : (
                            <div
                                className="relative"
                                style={isPlayerBoardPreview
                                    ? {
                                        width: playerBoardPreviewWidth,
                                        height: `calc(${playerBoardPreviewWidth} / ${playerBoardAspectRatio})`,
                                        aspectRatio: String(playerBoardAspectRatio),
                                    }
                                    : undefined}
                            >
                                <OptimizedImage
                                    src={props.magnifiedImage ?? ''}
                                    locale={props.locale}
                                    className={isPlayerBoardPreview
                                        ? 'block w-full h-full object-contain'
                                        : 'block max-h-[90vh] max-w-[90vw] w-auto h-auto object-contain'}
                                    alt={t('imageAlt.magnifiedView')}
                                />
                                {/* 玩家面板放大时复用原技能槽命中层，保证放大态仍可直接选技能 */}
                                {shouldRenderMagnifiedAbilityOverlay && props.viewCharacterId && (
                                    <AbilityOverlays
                                        isEditing={false}
                                        availableAbilityIds={props.availableAbilityIds}
                                        canSelect={props.canSelectAbility}
                                        canHighlight={props.canHighlightAbility}
                                        onSelectAbility={handleSelectMagnifiedAbility}
                                        onHighlightedAbilityClick={props.onHighlightedAbilityClick}
                                        selectedAbilityId={props.selectedAbilityId}
                                        activatingAbilityId={props.activatingAbilityId}
                                        abilityLevels={props.abilityLevels}
                                        characterId={props.viewCharacterId}
                                        playerBoardFace={props.viewPlayerBoardFace}
                                        locale={props.locale}
                                        slotScope="magnified-preview"
                                    />
                                )}
                            </div>
                        )}
                    </MagnifyOverlay>
                )}

                {/* 卡牌特写 */}
                {props.cardSpotlightQueue.length > 0 && (
                    <CardSpotlightOverlay
                        key="card-spotlight"
                        queue={props.cardSpotlightQueue}
                        locale={props.locale}
                        onClose={props.onCardSpotlightClose}
                        opponentHeaderRef={props.opponentHeaderRef}
                    />
                )}
            </AnimatePresence>

            {/* 游戏结束覆盖层 - 注入王权骰铸专属结算内容和重赛按钮样式 */}
            <EndgameOverlay
                isGameOver={props.isGameOver}
                result={props.gameoverResult}
                playerID={props.playerID}
                reset={props.reset}
                isMultiplayer={true}
                totalPlayers={Object.keys(props.players).length}
                rematchState={props.rematchState}
                onVote={props.onRematchVote}
                backdropClassName="bg-transparent"
                contentWrapperClassName="max-[1023px]:max-w-[30rem]"
                renderContent={(contentProps) => (
                    <DiceThroneEndgameContent
                        {...contentProps}
                        players={props.players}
                        myPlayerId={props.playerID ?? null}
                        locale={props.locale}
                    />
                )}
                renderActions={(actionsProps) => (
                    <RematchActions
                        {...actionsProps}
                        className="mt-4 flex-wrap justify-center max-[1023px]:mt-2 max-[1023px]:gap-2"
                        renderButton={renderDiceThroneButton}
                    />
                )}
            />
        </>
    );
};
