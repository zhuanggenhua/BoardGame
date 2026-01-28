/**
 * BoardOverlays 组件
 * 
 * 统一管理所有弹窗和覆盖层，简化主组件结构
 */

import React from 'react';
import { useTranslation } from 'react-i18next';
import { AnimatePresence } from 'framer-motion';
import { buildLocalizedImageSet, getLocalizedAssetPath } from '../../../core';
import { OptimizedImage } from '../../../components/common/media/OptimizedImage';
import { MagnifyOverlay } from '../../../components/common/overlays/MagnifyOverlay';
import { ConfirmSkipModal } from './ConfirmSkipModal';
import { ConfirmRemoveStunModal } from './ConfirmRemoveStunModal';
import { ChoiceModal } from './ChoiceModal';
import { BonusDieOverlay } from './BonusDieOverlay';
import { CardSpotlightOverlay } from './CardSpotlightOverlay';
import { TokenResponseModal } from './TokenResponseModal';
import { PurifyModal } from './PurifyModal';
import { InteractionOverlay } from './InteractionOverlay';
import { EndgameOverlay } from '../../../components/game/EndgameOverlay';
import { ASSETS } from './assets';
import { getCardAtlasStyle, type CardAtlasConfig } from './cardAtlas';
import type { StatusIconAtlasConfig } from './statusEffects';
import type { AbilityCard, DieFace, HeroState, PendingInteraction, TokenResponsePhase } from '../domain/types';
import type { PlayerId } from '../../../engine/types';
import type { CardSpotlightItem } from './CardSpotlightOverlay';
import type { PendingDamage } from '../domain/types';
import type { TokenDef } from '../../../systems/TokenSystem';
import { PROMPT_COMMANDS } from '../../../engine/systems/PromptSystem';

export interface BoardOverlaysProps {
    // 放大预览
    isMagnifyOpen: boolean;
    magnifiedImage: string | null;
    magnifiedCard: AbilityCard | null;
    magnifiedCards: AbilityCard[];
    onCloseMagnify: () => void;

    // 弹窗状态
    isConfirmingSkip: boolean;
    onConfirmSkip: () => void;
    onCancelSkip: () => void;

    isPurifyModalOpen: boolean;
    onConfirmPurify: (statusId: string) => void;
    onCancelPurify: () => void;

    isConfirmRemoveStunOpen: boolean;
    onConfirmRemoveStun: () => void;
    onCancelRemoveStun: () => void;

    // 选择弹窗
    choice: {
        hasChoice: boolean;
        title?: string;
        options: Array<{ id: string; label: string; statusId?: string; tokenId?: string; customId?: string }>;
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
    };
    onBonusDieClose: () => void;


    // Token 响应
    pendingDamage?: PendingDamage;
    tokenResponsePhase: TokenResponsePhase | null;
    isTokenResponder: boolean;
    tokenDefinitions: TokenDef[];
    onUseToken: (tokenId: string, amount: number) => void;
    onSkipTokenResponse: () => void;

    // 交互覆盖层
    isStatusInteraction: boolean;
    pendingInteraction?: PendingInteraction;
    players: Record<PlayerId, HeroState>;
    currentPlayerId: PlayerId;
    onSelectStatus: (playerId: string, statusId: string) => void;
    onSelectPlayer: (playerId: string) => void;
    onConfirmStatusInteraction: () => void;
    onCancelInteraction: () => void;

    // 净化相关
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
    cardAtlas: CardAtlasConfig | null;
    statusIconAtlas?: StatusIconAtlasConfig | null;
    locale: string;
    moves: Record<string, unknown>;
}

export const BoardOverlays: React.FC<BoardOverlaysProps> = (props) => {
    const { t } = useTranslation('game-dicethrone');
    const cardAtlas = props.cardAtlas;

    const isPlayerBoardPreview = Boolean(props.magnifiedImage?.includes('monk-player-board'));
    const isMultiCardPreview = props.magnifiedCards.length > 0;
    const magnifyContainerClassName = `
        group/modal
        ${isPlayerBoardPreview ? 'aspect-[2048/1673] h-auto w-auto max-h-[90vh] max-w-[90vw]' : ''}
        ${props.magnifiedCard ? 'aspect-[0.61] h-auto w-auto max-h-[90vh] max-w-[60vw]' : ''}
        ${isMultiCardPreview ? 'max-h-[90vh] max-w-[90vw] overflow-x-auto overflow-y-hidden' : ''}
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
                        {isMultiCardPreview && cardAtlas ? (
                            <div className="flex flex-nowrap items-center justify-start gap-[2vw] p-[2vw] w-fit">
                                {props.magnifiedCards.map((card, idx) => (
                                    <div
                                        key={card.id}
                                        className="w-[28vw] aspect-[0.61] max-w-[350px] max-h-[574px] rounded-xl shadow-2xl border border-white/20 flex-shrink-0"
                                        style={{
                                            backgroundImage: buildLocalizedImageSet(ASSETS.CARDS_ATLAS, props.locale),
                                            backgroundRepeat: 'no-repeat',
                                            backgroundColor: '#0f172a',
                                            ...getCardAtlasStyle(card.atlasIndex ?? 0, cardAtlas),
                                        }}
                                        title={`#${idx + 1}`}
                                    />
                                ))}
                            </div>
                        ) : props.magnifiedCard && cardAtlas ? (
                            <div
                                className="w-[40vw] h-[65vw] max-w-[400px] max-h-[650px]"
                                style={{
                                    backgroundImage: buildLocalizedImageSet(ASSETS.CARDS_ATLAS, props.locale),
                                    backgroundRepeat: 'no-repeat',
                                    backgroundColor: '#0f172a',
                                    ...getCardAtlasStyle(props.magnifiedCard.atlasIndex ?? 0, cardAtlas),
                                }}
                            />
                        ) : (
                            <OptimizedImage
                                src={getLocalizedAssetPath(props.magnifiedImage ?? '', props.locale)}
                                fallbackSrc={props.magnifiedImage ?? ''}
                                className="max-h-[90vh] max-w-[90vw] w-auto h-auto object-contain"
                                alt="Preview"
                            />
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
                {props.isConfirmRemoveStunOpen && (
                    <ConfirmRemoveStunModal
                        key="confirm-remove-stun"
                        isOpen={props.isConfirmRemoveStunOpen}
                        onCancel={props.onCancelRemoveStun}
                        onConfirm={props.onConfirmRemoveStun}
                    />
                )}

                {/* Token 响应窗口 */}
                {props.pendingDamage && props.tokenResponsePhase && props.isTokenResponder && (
                    <TokenResponseModal
                        key="token-response"
                        pendingDamage={props.pendingDamage}
                        responsePhase={props.tokenResponsePhase}
                        responderState={props.players[props.pendingDamage.responderId]}
                        tokenDefinitions={props.tokenDefinitions}
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
                        choice={props.choice.hasChoice ? { title: props.choice.title ?? '', options: props.choice.options } : null}
                        canResolve={props.canResolveChoice}
                        onResolve={(optionId) => {
                            const promptMove = props.moves[PROMPT_COMMANDS.RESPOND];
                            if (typeof promptMove === 'function') {
                                (promptMove as (payload: { optionId: string }) => void)({ optionId });
                            }
                        }}
                        locale={props.locale}
                        statusIconAtlas={props.statusIconAtlas}
                    />
                )}

                {/* 状态交互覆盖层 */}
                {props.isStatusInteraction && props.pendingInteraction && props.pendingInteraction.playerId === props.currentPlayerId && (
                    <InteractionOverlay
                        key="interaction"
                        interaction={{
                            ...props.pendingInteraction,
                            selected: props.pendingInteraction.selected || [],
                        }}
                        players={props.players}
                        currentPlayerId={props.currentPlayerId}
                        onSelectStatus={props.onSelectStatus}
                        onSelectPlayer={props.onSelectPlayer}
                        onConfirm={props.onConfirmStatusInteraction}
                        onCancel={props.onCancelInteraction}
                        statusIconAtlas={props.statusIconAtlas}
                        locale={props.locale}
                    />
                )}

                {/* 额外骰子特写 */}
                {props.bonusDie.show && (
                    <BonusDieOverlay
                        key="bonus-die"
                        value={props.bonusDie.value}
                        face={props.bonusDie.face}
                        effectKey={props.bonusDie.effectKey}
                        effectParams={props.bonusDie.effectParams}
                        isVisible={props.bonusDie.show}
                        onClose={props.onBonusDieClose}
                        locale={props.locale}
                    />
                )}



                {/* 卡牌特写 */}
                {props.cardSpotlightQueue.length > 0 && (
                    <CardSpotlightOverlay
                        key="card-spotlight"
                        queue={props.cardSpotlightQueue}
                        atlas={cardAtlas}
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
