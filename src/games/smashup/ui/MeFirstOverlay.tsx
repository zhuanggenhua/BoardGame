/**
 * 大杀四方 (Smash Up) - Me First! 响应窗口覆盖层
 */

import React, { useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import { motion } from 'framer-motion';
import { CheckCircle } from 'lucide-react';
import { GameButton } from './GameButton';
import type { MatchState } from '../../../engine/types';
import { SU_COMMANDS, type CardInstance, type SmashUpCommand, type SmashUpCore } from '../domain/types';
import {
    canCardBePlayedInResponseWindowForMatchState,
    getResponseWindowPlayableBaseIndicesForMatchState,
    isCardActionLike,
    isCardMinionLike,
} from '../domain/utils';
import { getSmashUpReactionWindowPresentation } from '../domain/reactionWindowState';
import { validate } from '../domain/commands';
import { UI_Z_INDEX } from '../../../core';
import { PLAYER_CONFIG } from './playerConfig';
import { getCompactPlayerBadgeLabel } from '../../../components/game/framework/playerDisplay';

// ============================================================================
// Me First! Response Window Overlay
// ============================================================================

export interface MeFirstPendingCard {
    cardUid: string;
    defId: string;
}

function hasValidatedResponseOption(
    G: MatchState<SmashUpCore>,
    playerId: string,
    card: CardInstance,
    windowType: 'meFirst' | 'afterScoring',
): boolean {
    if (!canCardBePlayedInResponseWindowForMatchState(G, card, windowType)) return false;

    const baseIndices = getResponseWindowPlayableBaseIndicesForMatchState(G, card.defId, windowType);
    if (isCardMinionLike(card)) {
        return baseIndices.some(baseIndex => {
            const command: SmashUpCommand = {
            type: SU_COMMANDS.PLAY_MINION,
            playerId,
            payload: { cardUid: card.uid, baseIndex },
            };
            return validate(G, command).valid;
        });
    }

    if (!isCardActionLike(card)) return false;
    if (baseIndices.length > 0) {
        return baseIndices.some(targetBaseIndex => {
            const command: SmashUpCommand = {
            type: SU_COMMANDS.PLAY_ACTION,
            playerId,
            payload: { cardUid: card.uid, targetBaseIndex },
            };
            return validate(G, command).valid;
        });
    }
    const command: SmashUpCommand = {
        type: SU_COMMANDS.PLAY_ACTION,
        playerId,
        payload: { cardUid: card.uid },
    };
    return validate(G, command).valid;
}

export const MeFirstOverlay: React.FC<{
    G: MatchState<SmashUpCore>;
    dispatch: (type: string, payload?: unknown) => void;
    playerID: string | null;
    playerNames?: Record<string, string>;
    /** 当前待选基地的 Special 卡（需要基地目标时） */
    pendingCard: MeFirstPendingCard | null;
    onSelectCard: (card: MeFirstPendingCard | null) => void;
}> = ({ G, dispatch, playerID, playerNames, pendingCard, onSelectCard }) => {
    const { t } = useTranslation('game-smashup');
    const reactionWindow = getSmashUpReactionWindowPresentation(G);

    const handlePass = useCallback(() => {
        onSelectCard(null);
        dispatch('RESPONSE_PASS');
    }, [dispatch, onSelectCard]);

    // `smashup_reaction_choose` 本身就是计分响应的中间承载语义，不应把这层提示弹窗隐藏掉。
    const currentInteraction = G.sys.interaction?.current;
    const interactionSourceId = (currentInteraction?.data as { sourceId?: unknown } | undefined)?.sourceId;
    const hasInteraction = !!currentInteraction && interactionSourceId !== 'smashup_reaction_choose';
    const hasLockedHiddenInteraction = !!G.sys.responseWindow?.current?.pendingInteractionId;

    // 支持 meFirst 和 afterScoring 两种窗口类型
    if (!reactionWindow) return null;
    if (hasInteraction || hasLockedHiddenInteraction || pendingCard) return null;

    const currentResponderId = reactionWindow.activePlayerId;
    const isMyResponse = playerID === currentResponderId;
    const core = G.core;
    const currentResponderName = playerNames?.[currentResponderId] ?? `P${Number(currentResponderId) + 1}`;

    // 检查手牌中是否有可在当前响应窗口打出的行动卡或 beforeScoringPlayable 随从
    const myPlayer = playerID ? core.players[playerID] : undefined;
    
    const hasRespondableCards = myPlayer?.hand.some(card =>
        playerID ? hasValidatedResponseOption(G, playerID, card, reactionWindow.windowType) : false,
    ) ?? false;
    
    // 窗口标题
    const windowTitle = reactionWindow.windowType === 'afterScoring'
        ? t('ui.after_scoring_title', { defaultValue: '计分后响应' })
        : t('ui.me_first_title');

    if (!isMyResponse) {
        return (
            <motion.div
                className="fixed inset-0 flex items-center justify-center pointer-events-none"
                style={{ zIndex: UI_Z_INDEX.overlayRaised }}
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                data-testid="me-first-overlay"
            >
                <motion.div
                    className="pointer-events-none rounded-2xl border border-amber-500/35 bg-[#fef3c7]/95 px-5 py-3 shadow-xl"
                    initial={{ scale: 0.9, y: 18 }}
                    animate={{ scale: 1, y: 0 }}
                    transition={{ type: 'spring', stiffness: 380, damping: 26 }}
                    data-testid="me-first-waiting-shell"
                >
                    <p className="text-sm font-bold text-slate-700 text-center" data-testid="me-first-status">
                        {t('ui.me_first_waiting', {
                            player: currentResponderName,
                            defaultValue: '正在等待 {{player}} 响应...',
                        })}
                    </p>
                </motion.div>
            </motion.div>
        );
    }

    return (
        <motion.div
            className="fixed inset-0 flex items-center justify-center pointer-events-none"
            style={{ zIndex: UI_Z_INDEX.overlayRaised }}
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            data-testid="me-first-overlay"
        >
            <motion.div
                className="bg-[#fef3c7] text-slate-900 p-5 shadow-2xl border-4 border-dashed border-amber-600/50 max-w-md pointer-events-auto -rotate-1"
                initial={{ scale: 0.7, y: 30 }}
                animate={{ scale: 1, y: 0 }}
                transition={{ type: 'spring', stiffness: 400, damping: 20 }}
                layout>
                <div className="text-center mb-3">
                    <h3 className="text-xl font-black uppercase tracking-tight text-amber-800 transform rotate-1">
                        {windowTitle}
                    </h3>
                    <p className="text-sm font-bold text-slate-600 mt-1" data-testid="me-first-status">
                        {t('ui.me_first_your_turn')}
                    </p>
                </div>

                <div className="flex flex-col gap-2">
                    {/* 提示：从手牌中选择可响应的卡牌或让过 */}
                    {hasRespondableCards ? (
                        <p className="text-xs text-center text-amber-700/80 font-medium">
                            {t('ui.me_first_select_from_hand', { defaultValue: '从手牌中选择可响应的卡牌打出' })}
                        </p>
                    ) : (
                        <p className="text-xs text-center text-slate-600 font-medium">
                            {t('ui.me_first_no_special', { defaultValue: '你没有可在当前窗口打出的卡牌' })}
                        </p>
                    )}

                    {/* 让过按钮 */}
                    <div className="flex justify-center">
                        <GameButton
                            variant="secondary"
                            onClick={handlePass}
                            data-testid="me-first-pass-button"
                        >
                            {t('ui.me_first_pass')}
                        </GameButton>
                    </div>
                </div>

                {/* 响应进度 */}
                <div className="flex justify-center gap-2 mt-3" data-testid="me-first-progress">
                    {reactionWindow.responderQueue.map((pid, idx) => {
                        const isPassed = reactionWindow.passedPlayers.includes(pid);
                        const isCurrent = idx === reactionWindow.currentResponderIndex;
                        const conf = PLAYER_CONFIG[parseInt(pid) % PLAYER_CONFIG.length];
                        return (
                            <div
                                key={pid}
                                className={`w-6 h-6 rounded-full flex items-center justify-center text-[10px] font-black text-white border-2 ${conf.bg} ${isCurrent ? 'ring-2 ring-amber-400 scale-125' : isPassed ? 'opacity-40' : ''
                                    }`}
                                title={playerNames?.[pid] ?? `P${Number(pid) + 1}`}
                            >
                                {isPassed
                                    ? <CheckCircle size={12} strokeWidth={3} />
                                    : pid === playerID
                                        ? t('ui.you_badge')
                                        : getCompactPlayerBadgeLabel(playerNames?.[pid] ?? `P${Number(pid) + 1}`, 2)}
                            </div>
                        );
                    })}
                </div>
            </motion.div>
        </motion.div>
    );
};
