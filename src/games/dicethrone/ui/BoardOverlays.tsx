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
import { BonusDieOverlay } from './BonusDieOverlay';
import { CardSpotlightOverlay } from './CardSpotlightOverlay';
import { EndgameOverlay } from '../../../components/game/framework/widgets/EndgameOverlay';
import { RematchActions } from '../../../components/game/framework/widgets/RematchActions';
import { DiceThroneEndgameContent, renderDiceThroneButton } from './DiceThroneEndgame';
import type { StatusAtlases } from './statusEffects';
import type { AbilityCard, DieFace, HeroState, PendingBonusDiceSettlement, CharacterId, TurnPhase } from '../domain/types';
import type { PlayerId } from '../../../engine/types';
import type { CardSpotlightItem } from './CardSpotlightOverlay';
import {
    getAbilitySlotLayoutForCharacter,
    getPlayerBoardAspectRatio,
} from './abilitySlotLayout';
import { useHorizontalDragScroll } from '../../../hooks/ui/useHorizontalDragScroll';
import { getSlotAbilityId, getUpgradeCardPreviewRef } from './AbilityOverlays';
import { createScopedLogger } from '../../../lib/logger';

const boardOverlaysLogger = createScopedLogger('DT_BOARD_OVERLAYS');

export interface BoardOverlaysProps {
    // 放大预览
    isMagnifyOpen: boolean;
    magnifiedImage: string | null;
    magnifiedCard: AbilityCard | null;
    magnifiedCards: AbilityCard[];
    onCloseMagnify: () => void;
    /** 当前视角玩家的技能等级（用于放大预览叠加升级卡） */
    abilityLevels?: Record<string, number>;
    /** 当前视角玩家的角色 ID */
    viewCharacterId?: string;

    players: Record<PlayerId, HeroState>;
    currentPlayerId: PlayerId;
    playerNames: Record<PlayerId, string>;
    seatingOrder?: PlayerId[];
    teamIdByPlayerId?: Record<PlayerId, string>;

    // 卡牌特写
    cardSpotlightQueue: CardSpotlightItem[];
    onCardSpotlightClose: (id: string) => void;
    opponentHeaderRef: React.RefObject<HTMLDivElement | null>;


    // 额外骰子
    bonusDie: {
        value?: number;
        face?: DieFace;
        effectKey?: string;
        effectParams?: Record<string, string | number>;
        bonusDice?: import('../domain/types').BonusDieInfo[];
        summaryEffectKey?: string;
        summaryEffectParams?: Record<string, string | number>;
        showTotal?: boolean;
        displayOnly?: boolean;
        show: boolean;
        /** 骰子所属角色（用于图集选择） */
        characterId?: string;
    };
    onBonusDieClose: () => void;
    suppressBonusDieOverlay?: boolean;

    // 奖励骰重掷交互
    pendingBonusDiceSettlement?: PendingBonusDiceSettlement;
    canRerollBonusDie: boolean;
    onRerollBonusDie?: (dieIndex: number) => void;
    onSkipBonusDiceReroll?: () => void;


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
    /** 奖励骰特写手动关闭模式（仅游戏态启用） */
    bonusDieManualCloseOnly?: boolean;
}

/**
 * 放大预览时叠加升级卡图层
 * 复用 AbilityOverlays 的槽位布局和升级卡查找逻辑
 */
const MagnifyUpgradeOverlay: React.FC<{
    characterId: string;
    abilityLevels: Record<string, number>;
    locale: string;
}> = ({ characterId, abilityLevels, locale }) => {
    const slots = getAbilitySlotLayoutForCharacter(characterId);
    return (
        <div className="absolute inset-0 pointer-events-none">
            {slots.map((slot) => {
                if (slot.id === 'ultimate') return null;
                const baseAbilityId = getSlotAbilityId(characterId, slot.id);
                const level = baseAbilityId ? (abilityLevels[baseAbilityId] ?? 1) : 1;
                if (!baseAbilityId || level <= 1) return null;
                const previewRef = getUpgradeCardPreviewRef(characterId, baseAbilityId, level);
                if (!previewRef) return null;
                return (
                    <div
                        key={slot.id}
                        className="absolute"
                        style={{ left: `${slot.x}%`, top: `${slot.y}%`, width: `${slot.w}%`, height: `${slot.h}%` }}
                    >
                        <div className="absolute inset-0 flex items-center justify-center">
                            <CardPreview
                                previewRef={previewRef}
                                locale={locale}
                                className="h-full aspect-[0.61] rounded-lg"
                            />
                        </div>
                    </div>
                );
            })}
        </div>
    );
};

export const BoardOverlays: React.FC<BoardOverlaysProps> = (props) => {
    const { t } = useTranslation('game-dicethrone');
    const { ref: multiCardScrollRef, dragProps: multiCardDragProps } = useHorizontalDragScroll();
    const shouldShowBonusDieOverlay = !props.suppressBonusDieOverlay
        && (props.bonusDie.show || Boolean(props.pendingBonusDiceSettlement));

    // 调试日志：bonusDie prop
    React.useEffect(() => {
        boardOverlaysLogger.info('bonus-prop', {
            show: props.bonusDie.show,
            value: props.bonusDie.value,
            face: props.bonusDie.face,
            effectKey: props.bonusDie.effectKey,
            characterId: props.bonusDie.characterId,
        });
    }, [props.bonusDie]);

    const isPlayerBoardPreview = Boolean(props.magnifiedImage?.includes('player-board'));
    const isMultiCardPreview = props.magnifiedCards.length > 0;
    const playerBoardAspectRatio = getPlayerBoardAspectRatio(props.viewCharacterId);
    const magnifiedCardWidth = 'min(54.9vh, 39.65vw, 396px, 60vw, 400px)';
    const magnifyContainerClassName = `
        group/modal
        ${isPlayerBoardPreview ? 'h-auto w-auto max-h-[90vh] max-w-[90vw]' : ''}
        ${props.magnifiedCard ? 'aspect-[0.61] w-auto max-h-[90vh] max-w-[60vw]' : ''}
        ${isMultiCardPreview ? 'max-h-[90vh] max-w-[90vw]' : ''}
        ${!isPlayerBoardPreview && !props.magnifiedCard && !isMultiCardPreview ? 'max-h-[90vh] max-w-[90vw]' : ''}
    `;

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
                            <div ref={multiCardScrollRef} {...multiCardDragProps} className="flex flex-nowrap items-center justify-start gap-[2vw] p-[2vw] overflow-x-auto overflow-y-hidden" style={multiCardDragProps.style}>
                                {props.magnifiedCards.map((card) => (
                                    <CardPreview
                                        key={card.id}
                                        className="w-[28vw] aspect-[0.61] max-w-[350px] max-h-[574px] rounded-xl shadow-2xl border border-white/20 flex-shrink-0"
                                        style={{ backgroundColor: '#0f172a' }}
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
                                    aspectRatio: '0.61',
                                }}
                                previewRef={props.magnifiedCard.previewRef}
                                locale={props.locale}
                            />
                        ) : (
                            <div
                                className="relative"
                                style={isPlayerBoardPreview ? { aspectRatio: String(playerBoardAspectRatio) } : undefined}
                            >
                                <OptimizedImage
                                    src={props.magnifiedImage ?? ''}
                                    locale={props.locale}
                                    className="block max-h-[90vh] max-w-[90vw] w-auto h-auto object-contain"
                                    alt="预览图"
                                />
                                {/* 玩家面板放大时叠加升级卡预览 */}
                                {isPlayerBoardPreview && props.viewCharacterId && props.abilityLevels && (
                                    <MagnifyUpgradeOverlay
                                        characterId={props.viewCharacterId}
                                        abilityLevels={props.abilityLevels}
                                        locale={props.locale}
                                    />
                                )}
                            </div>
                        )}
                    </MagnifyOverlay>
                )}

                {/* 额外骰子特写 / 重掷交互 */}
                {shouldShowBonusDieOverlay && (
                    <BonusDieOverlay
                        key="bonus-die"
                        value={props.bonusDie.value}
                        face={props.bonusDie.face}
                        effectKey={props.bonusDie.effectKey}
                        effectParams={props.bonusDie.effectParams}
                        isVisible={shouldShowBonusDieOverlay}
                        onClose={props.onBonusDieClose}
                        locale={props.locale}
                        bonusDice={props.pendingBonusDiceSettlement?.dice ?? props.bonusDie.bonusDice}
                        canReroll={props.canRerollBonusDie}
                        rerollLimitReached={Boolean(
                            props.pendingBonusDiceSettlement &&
                            props.pendingBonusDiceSettlement.maxRerollCount !== undefined &&
                            props.pendingBonusDiceSettlement.rerollCount >= props.pendingBonusDiceSettlement.maxRerollCount
                        )}
                        onReroll={props.onRerollBonusDie}
                        onSkipReroll={props.onSkipBonusDiceReroll}
                        showTotal={props.pendingBonusDiceSettlement?.showTotal ?? props.bonusDie.showTotal ?? !props.pendingBonusDiceSettlement?.displayOnly}
                        rerollCostAmount={props.pendingBonusDiceSettlement?.rerollCostAmount}
                        rerollCostTokenId={props.pendingBonusDiceSettlement?.rerollCostTokenId}
                        displayOnly={props.pendingBonusDiceSettlement?.displayOnly ?? props.bonusDie.displayOnly}
                        lastRerolledDieIndex={props.pendingBonusDiceSettlement?.lastRerolledDieIndex}
                        rerollAnimationKey={props.pendingBonusDiceSettlement?.rerollAnimationKey}
                        summaryEffectKey={props.pendingBonusDiceSettlement?.summaryEffectKey ?? props.bonusDie.summaryEffectKey}
                        summaryEffectParams={props.pendingBonusDiceSettlement?.summaryEffectParams ?? props.bonusDie.summaryEffectParams}
                        characterId={
                            props.pendingBonusDiceSettlement
                                ? props.selectedCharacters[props.pendingBonusDiceSettlement.attackerId]
                                : props.bonusDie.characterId
                        }
                        forceAutoCloseDelay={props.tutorialSpotlightAutoCloseDelayMs}
                        manualCloseOnly={props.bonusDieManualCloseOnly}
                    />
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
                        className="mt-4"
                        renderButton={renderDiceThroneButton}
                    />
                )}
            />
        </>
    );
};
