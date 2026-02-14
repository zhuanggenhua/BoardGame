/**
 * 大杀四方 (Smash Up) - Me First! 响应窗口覆盖层
 */

import React, { useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import { motion } from 'framer-motion';
import { CheckCircle } from 'lucide-react';
import { GameButton } from './GameButton';
import type { MatchState } from '../../../engine/types';
import type { SmashUpCore, ActionCardDef } from '../domain/types';
import { SU_COMMANDS } from '../domain/types';
import { getCardDef, resolveCardName } from '../data/cards';
import { UI_Z_INDEX } from '../../../core';
import { PLAYER_CONFIG } from './playerConfig';

// ============================================================================
// Me First! Response Window Overlay
// ============================================================================

export interface MeFirstPendingCard {
    cardUid: string;
    defId: string;
}

export const MeFirstOverlay: React.FC<{
    G: MatchState<SmashUpCore>;
    moves: Record<string, (payload?: unknown) => void>;
    playerID: string | null;
    /** 当前待选基地的 Special 卡（需要基地目标时） */
    pendingCard: MeFirstPendingCard | null;
    onSelectCard: (card: MeFirstPendingCard | null) => void;
}> = ({ G, moves, playerID, pendingCard, onSelectCard }) => {
    const { t } = useTranslation('game-smashup');
    const responseWindow = G.sys.responseWindow?.current;

    const handlePass = useCallback(() => {
        onSelectCard(null);
        moves['RESPONSE_PASS']?.({});
    }, [moves, onSelectCard]);

    const handleCardClick = useCallback((cardUid: string, defId: string) => {
        const def = getCardDef(defId) as ActionCardDef | undefined;
        if (def?.specialNeedsBase) {
            // 需要选基地：进入基地选择模式
            onSelectCard({ cardUid, defId });
        } else {
            // 不需要选基地（如全速航行）：直接打出（不传 targetBaseIndex）
            onSelectCard(null);
            moves[SU_COMMANDS.PLAY_ACTION]?.({ cardUid });
        }
    }, [moves, onSelectCard]);

    if (!responseWindow || responseWindow.windowType !== 'meFirst') return null;

    const currentResponderId = responseWindow.responderQueue[responseWindow.currentResponderIndex];
    const isMyResponse = playerID === currentResponderId;
    const core = G.core;

    // 检查手牌中是否有特殊行动卡
    const myPlayer = playerID ? core.players[playerID] : undefined;
    const specialCards = myPlayer?.hand.filter(c => {
        if (c.type !== 'action') return false;
        const def = getCardDef(c.defId) as ActionCardDef | undefined;
        return def?.subtype === 'special';
    }) ?? [];

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
            >
                <div className="text-center mb-3">
                    <h3 className="text-xl font-black uppercase tracking-tight text-amber-800 transform rotate-1">
                        {t('ui.me_first_title')}
                    </h3>
                    <p className="text-sm font-bold text-slate-600 mt-1" data-testid="me-first-status">
                        {isMyResponse
                            ? pendingCard
                                ? t('ui.me_first_select_base')
                                : t('ui.me_first_your_turn')
                            : t('ui.me_first_waiting', { player: currentResponderId })
                        }
                    </p>
                </div>

                {isMyResponse && (
                    <div className="flex flex-col gap-2">
                        {/* 特殊牌列表 */}
                        {specialCards.length > 0 && !pendingCard && (
                            <div className="flex flex-wrap gap-2 justify-center mb-2" data-testid="me-first-special-cards">
                                {specialCards.map(card => {
                                    const def = getCardDef(card.defId);
                                    const resolvedName = resolveCardName(def, t) || card.defId;
                                    return (
                                        <GameButton
                                            key={card.uid}
                                            variant="danger"
                                            size="sm"
                                            onClick={() => handleCardClick(card.uid, card.defId)}
                                            data-testid={`me-first-card-${card.uid}`}
                                        >
                                            {resolvedName}
                                        </GameButton>
                                    );
                                })}
                            </div>
                        )}

                        {/* 选择基地提示 */}
                        {pendingCard && (
                            <div className="text-center mb-2">
                                <p className="text-sm text-amber-700 font-bold">
                                    {resolveCardName(getCardDef(pendingCard.defId), t)} — {t('ui.me_first_click_base')}
                                </p>
                                <GameButton
                                    variant="secondary"
                                    size="sm"
                                    onClick={() => onSelectCard(null)}
                                    className="mt-1"
                                    data-testid="me-first-cancel-select"
                                >
                                    {t('ui.cancel')}
                                </GameButton>
                            </div>
                        )}

                        {/* 让过按钮 */}
                        {!pendingCard && (
                            <div className="flex justify-center">
                                <GameButton
                                    variant="secondary"
                                    onClick={handlePass}
                                    data-testid="me-first-pass-button"
                                >
                                    {t('ui.me_first_pass')}
                                </GameButton>
                            </div>
                        )}
                    </div>
                )}

                {/* 响应进度 */}
                <div className="flex justify-center gap-2 mt-3">
                    {responseWindow.responderQueue.map((pid, idx) => {
                        const isPassed = responseWindow.passedPlayers.includes(pid);
                        const isCurrent = idx === responseWindow.currentResponderIndex;
                        const conf = PLAYER_CONFIG[parseInt(pid) % PLAYER_CONFIG.length];
                        return (
                            <div
                                key={pid}
                                className={`w-6 h-6 rounded-full flex items-center justify-center text-[10px] font-black text-white border-2 ${conf.bg} ${isCurrent ? 'ring-2 ring-amber-400 scale-125' : isPassed ? 'opacity-40' : ''
                                    }`}
                            >
                                {isPassed ? <CheckCircle size={12} strokeWidth={3} /> : pid === playerID ? t('ui.you_badge') : pid}
                            </div>
                        );
                    })}
                </div>
            </motion.div>
        </motion.div>
    );
};
