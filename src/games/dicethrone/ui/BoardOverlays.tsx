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
import { ConfirmSkipModal } from './ConfirmSkipModal';
import { ConfirmRemoveKnockdownModal } from './ConfirmRemoveKnockdownModal';
import { ChoiceModal } from './ChoiceModal';
import { BonusDieOverlay } from './BonusDieOverlay';
import { CardSpotlightOverlay } from './CardSpotlightOverlay';
import { TokenResponseModal } from './TokenResponseModal';
import { PurifyModal } from './PurifyModal';
import { EndgameOverlay } from '../../../components/game/framework/widgets/EndgameOverlay';
import type { StatusAtlases } from './statusEffects';
import type { AbilityCard, DieFace, HeroState, PendingInteraction, TokenResponsePhase, PendingBonusDiceSettlement, CharacterId, TurnPhase } from '../domain/types';
import type { PlayerId } from '../../../engine/types';
import type { CardSpotlightItem } from './CardSpotlightOverlay';
import type { PendingDamage } from '../domain/types';
import type { TokenDef } from '../domain/tokenTypes';
import { INTERACTION_COMMANDS } from '../../../engine/systems/InteractionSystem';
import { DEFAULT_ABILITY_SLOT_LAYOUT } from './abilitySlotLayout';
import { useHorizontalDragScroll } from '../../../hooks/ui/useHorizontalDragScroll';
import { getSlotAbilityId, getUpgradeCardPreviewRef } from './AbilityOverlays';

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

    // 弹窗状态
    isConfirmingSkip: boolean;
    onConfirmSkip: () => void;
    onCancelSkip: () => void;

    isPurifyModalOpen: boolean;
    onConfirmPurify: (statusId: string) => void;
    onCancelPurify: () => void;

    isConfirmRemoveKnockdownOpen: boolean;
    onConfirmRemoveKnockdown: () => void;
    onCancelRemoveKnockdown: () => void;

    // 选择弹窗
    choice: {
        hasChoice: boolean;
        title?: string;
        options: Array<{ id: string; label: string; statusId?: string; tokenId?: string; customId?: string; value?: number }>;
        /** slider 模式配置（存在时渲染滑动条） */
        slider?: { confirmLabelKey: string; hintKey?: string; skipLabelKey?: string };
    };
    canResolveChoice: boolean;
    onResolveChoice: (optionId: string) => void;

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
        show: boolean;
        /** 骰子所属角色（用于图集选择） */
        characterId?: string;
    };
    onBonusDieClose: () => void;

    // 奖励骰重掷交互
    pendingBonusDiceSettlement?: PendingBonusDiceSettlement;
    canRerollBonusDie: boolean;
    onRerollBonusDie?: (dieIndex: number) => void;
    onSkipBonusDiceReroll?: () => void;


    // Token 响应
    pendingDamage?: PendingDamage;
    tokenResponsePhase: TokenResponsePhase | null;
    isTokenResponder: boolean;
    /** 当前阶段可用的 Token 列表（由领域层过滤） */
    usableTokens: TokenDef[];
    onUseToken: (tokenId: string, amount: number) => void;
    onSkipTokenResponse: () => void;// 净化相关
    viewPlayer: HeroState;
    purifiableStatusIds: string[];

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
    dispatch: (type: string, payload?: unknown) => void;
    currentPhase: TurnPhase;

    // 选角相关
    selectedCharacters: Record<PlayerId, CharacterId>;
    playerNames: Record<PlayerId, string>;
    hostPlayerId: PlayerId;
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
    return (
        <div className="absolute inset-0 pointer-events-none">
            {DEFAULT_ABILITY_SLOT_LAYOUT.map((slot) => {
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

    const isPlayerBoardPreview = Boolean(props.magnifiedImage?.includes('player-board'));
    const isMultiCardPreview = props.magnifiedCards.length > 0;
    const magnifyContainerClassName = `
        group/modal
        ${isPlayerBoardPreview ? 'aspect-[2048/1673] h-auto w-auto max-h-[90vh] max-w-[90vw]' : ''}
        ${props.magnifiedCard ? 'aspect-[0.61] h-auto w-auto max-h-[90vh] max-w-[60vw]' : ''}
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
                                className="w-[40vw] h-[65vw] max-w-[400px] max-h-[650px]"
                                style={{ backgroundColor: '#0f172a' }}
                                previewRef={props.magnifiedCard.previewRef}
                                locale={props.locale}
                            />
                        ) : (
                            <div className="relative">
                                <OptimizedImage
                                    src={props.magnifiedImage ?? ''}
                                    locale={props.locale}
                                    className="max-h-[90vh] max-w-[90vw] w-auto h-auto object-contain"
                                    alt="Preview"
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

                {/* 确认跳过弹窗 */}
                {props.isConfirmingSkip && (
                    <ConfirmSkipModal
                        key="confirm-skip"
                        isOpen={props.isConfirmingSkip}
                        onCancel={props.onCancelSkip}
                        onConfirm={props.onConfirmSkip}
                    />
                )}

                {/* 击倒移除确认弹窗 */}
                {props.isConfirmRemoveKnockdownOpen && (
                    <ConfirmRemoveKnockdownModal
                        key="confirm-remove-knockdown"
                        isOpen={props.isConfirmRemoveKnockdownOpen}
                        onCancel={props.onCancelRemoveKnockdown}
                        onConfirm={props.onConfirmRemoveKnockdown}
                    />
                )}

                {/* Token 响应窗口 */}
                {props.pendingDamage && props.tokenResponsePhase && props.isTokenResponder && (
                    <TokenResponseModal
                        key="token-response"
                        pendingDamage={props.pendingDamage}
                        responsePhase={props.tokenResponsePhase}
                        responderState={props.players[props.pendingDamage.responderId]}
                        usableTokens={props.usableTokens}
                        onUseToken={props.onUseToken}
                        onSkip={props.onSkipTokenResponse}
                        locale={props.locale}
                        lastEvasionRoll={props.pendingDamage.lastEvasionRoll}
                        statusIconAtlas={props.statusIconAtlas}
                    />
                )}

                {/* 净化弹窗 */}
                {props.isPurifyModalOpen && (
                    <PurifyModal
                        key="purify"
                        playerState={props.viewPlayer}
                        purifiableStatusIds={props.purifiableStatusIds}
                        onConfirm={props.onConfirmPurify}
                        onCancel={props.onCancelPurify}
                        locale={props.locale}
                        statusIconAtlas={props.statusIconAtlas}
                    />
                )}

                {/* 选择弹窗 */}
                {props.choice.hasChoice && (
                    <ChoiceModal
                        key="choice"
                        choice={props.choice.hasChoice ? { title: props.choice.title ?? '', options: props.choice.options, slider: props.choice.slider } : null}
                        canResolve={props.canResolveChoice}
                    onResolve={(optionId) => {
                            props.dispatch(INTERACTION_COMMANDS.RESPOND, { optionId });
                        }}
                        onResolveWithValue={(optionId, mergedValue) => {
                            props.dispatch(INTERACTION_COMMANDS.RESPOND, { optionId, mergedValue });
                        }}
                        locale={props.locale}
                        statusIconAtlas={props.statusIconAtlas}
                    />
                )}{/* 额外骰子特写 / 重掷交互 */}
                {(props.bonusDie.show || props.pendingBonusDiceSettlement) && (
                    <BonusDieOverlay
                        key="bonus-die"
                        value={props.bonusDie.value}
                        face={props.bonusDie.face}
                        effectKey={props.bonusDie.effectKey}
                        effectParams={props.bonusDie.effectParams}
                        isVisible={props.bonusDie.show || Boolean(props.pendingBonusDiceSettlement)}
                        onClose={props.onBonusDieClose}
                        locale={props.locale}
                        bonusDice={props.pendingBonusDiceSettlement?.dice}
                        canReroll={props.canRerollBonusDie}
                        onReroll={props.onRerollBonusDie}
                        onSkipReroll={props.onSkipBonusDiceReroll}
                        showTotal={props.pendingBonusDiceSettlement?.showTotal ?? !props.pendingBonusDiceSettlement?.displayOnly}
                        rerollCostAmount={props.pendingBonusDiceSettlement?.rerollCostAmount}
                        rerollCostTokenId={props.pendingBonusDiceSettlement?.rerollCostTokenId}
                        displayOnly={props.pendingBonusDiceSettlement?.displayOnly}
                        characterId={
                            props.pendingBonusDiceSettlement
                                ? props.selectedCharacters[props.pendingBonusDiceSettlement.attackerId]
                                : props.bonusDie.characterId
                        }
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

            {/* 游戏结束覆盖层 - 独立管理其 Portal */}
            <EndgameOverlay
                isGameOver={props.isGameOver}
                result={props.gameoverResult}
                playerID={props.playerID}
                reset={props.reset}
                isMultiplayer={true}
                totalPlayers={Object.keys(props.players).length}
                rematchState={props.rematchState}
                onVote={props.onRematchVote}
            />
        </>
    );
};
