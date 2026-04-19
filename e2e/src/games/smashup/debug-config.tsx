/**
 * 大杀四方 调试工具配置
 * 定义游戏专属的作弊指令 UI（发牌功能，按牌库索引）
 */

import React, { useState } from 'react';
import type { SmashUpCore } from './domain/types';
import { getCardDef } from './data/cards';
import { useTranslation } from 'react-i18next';
import { resolveCardDisplayName } from '../../components/game/framework/debug/cardNameResolver';

interface SmashUpDebugConfigProps {
    G: { core: SmashUpCore };
    dispatch: (type: string, payload?: unknown) => void;
}

export const SmashUpDebugConfig: React.FC<SmashUpDebugConfigProps> = ({ G, dispatch }) => {
    const core = G?.core;
    const { t } = useTranslation('game-smashup');

    const [dealPlayer, setDealPlayer] = useState<string>('0');
    const [deckIndex, setDeckIndex] = useState<number>(0);
    const [vpDelta, setVpDelta] = useState<number>(1);
    const [vpPlayer, setVpPlayer] = useState<string>('0');

    const player = core?.players?.[dealPlayer as '0' | '1'];
    const playerDeck = player?.deck ?? [];
    const playerHand = player?.hand ?? [];

    const selectedCard = playerDeck[deckIndex];

    const getCardName = (defId: string): string => {
        const def = getCardDef(defId);
        return def ? resolveCardDisplayName(def, t) : defId;
    };

    return (
        <div className="space-y-4">
            {/* 分数调整 */}
            <div className="bg-rose-50 p-3 rounded-lg border border-rose-200" data-testid="su-debug-vp">
                <h4 className="text-[10px] font-black text-rose-600 uppercase tracking-widest mb-3">分数调整 (VP)</h4>
                <div className="space-y-2">
                    <div className="flex gap-2 items-center">
                        <select value={vpPlayer} onChange={(e) => setVpPlayer(e.target.value)} className="flex-1 px-2 py-1.5 text-xs border border-rose-300 rounded bg-white text-gray-900">
                            <option value="0">P0 (VP: {core?.players?.['0']?.vp ?? 0})</option>
                            <option value="1">P1 (VP: {core?.players?.['1']?.vp ?? 0})</option>
                        </select>
                        <input
                            type="number"
                            value={vpDelta}
                            onChange={(e) => setVpDelta(Number(e.target.value))}
                            className="w-16 px-2 py-1.5 text-xs border border-rose-300 rounded bg-white text-center text-gray-900"
                        />
                    </div>
                    <div className="flex gap-2">
                        <button
                            onClick={() => dispatch('SYS_CHEAT_ADD_RESOURCE', { playerId: vpPlayer, resourceId: 'vp', delta: vpDelta })}
                            className="flex-1 px-3 py-1.5 bg-rose-500 text-white rounded text-xs font-bold hover:bg-rose-600"
                            data-testid="su-debug-vp-add"
                        >
                            ➕ 增加 {vpDelta} VP
                        </button>
                        <button
                            onClick={() => dispatch('SYS_CHEAT_ADD_RESOURCE', { playerId: vpPlayer, resourceId: 'vp', delta: -vpDelta })}
                            className="flex-1 px-3 py-1.5 bg-gray-500 text-white rounded text-xs font-bold hover:bg-gray-600"
                            data-testid="su-debug-vp-sub"
                        >
                            ➖ 减少 {vpDelta} VP
                        </button>
                    </div>
                </div>
            </div>

            {/* 刷新基地调试 */}
            <div className="bg-blue-50 p-3 rounded-lg border border-blue-200" data-testid="su-debug-refresh-base">
                <h4 className="text-[10px] font-black text-blue-600 uppercase tracking-widest mb-3">刷新基地</h4>
                <div className="space-y-2">
                    <div className="text-[9px] text-blue-600 mb-2">
                        场上基地: {core?.bases?.length ?? 0} 个 | 基地牌库: {core?.baseDeck?.length ?? 0} 张
                    </div>
                    <div className="text-[9px] text-blue-700 bg-blue-100 p-2 rounded mb-2">
                        {core?.baseDeck && core.baseDeck.length > 0 ? (
                            <>💡 点击场上基地可刷新单个，或点击下方按钮刷新全部</>
                        ) : (
                            <span className="text-orange-500">基地牌库为空，刷新将清空所有基地</span>
                        )}
                    </div>
                    <button
                        onClick={() => {
                            console.log('[刷新所有基地] 点击刷新按钮:', {
                                basesCount: core?.bases?.length,
                                currentBases: core?.bases?.map(b => b.defId),
                                nextBases: core?.baseDeck?.slice(0, Math.min(core?.bases?.length ?? 0, core?.baseDeck?.length ?? 0)),
                                baseDeckLength: core?.baseDeck?.length,
                            });
                            dispatch('SYS_CHEAT_REFRESH_ALL_BASES');
                        }}
                        disabled={!core?.bases || core.bases.length === 0}
                        className="w-full px-3 py-1.5 bg-purple-500 text-white rounded text-xs font-bold hover:bg-purple-600 disabled:bg-gray-300 disabled:cursor-not-allowed"
                        data-testid="su-debug-refresh-all-bases-apply"
                    >
                        🔄 刷新所有基地 {core?.baseDeck?.length === 0 ? '(清空)' : ''}
                    </button>
                </div>
            </div>

            {/* 强制结算基地 */}
            <div className="bg-orange-50 p-3 rounded-lg border border-orange-200" data-testid="su-debug-force-score">
                <h4 className="text-[10px] font-black text-orange-600 uppercase tracking-widest mb-3">强制结算基地</h4>
                <div className="space-y-2">
                    <div className="text-[9px] text-orange-700 bg-orange-100 p-2 rounded mb-2">
                        💡 将所有有随从的基地临界点设为 0，触发立即结算
                    </div>
                    <button
                        onClick={() => {
                            const basesWithMinions = core?.bases?.filter(b => b.minions.length > 0) ?? [];
                            console.log('[强制结算基地] 点击按钮:', {
                                basesWithMinions: basesWithMinions.map((b, i) => ({
                                    index: i,
                                    defId: b.defId,
                                    minionCount: b.minions.length,
                                })),
                            });
                            dispatch('SYS_CHEAT_FORCE_SCORE_BASES_WITH_MINIONS');
                        }}
                        disabled={!core?.bases || core.bases.every(b => b.minions.length === 0)}
                        className="w-full px-3 py-1.5 bg-orange-500 text-white rounded text-xs font-bold hover:bg-orange-600 disabled:bg-gray-300 disabled:cursor-not-allowed"
                        data-testid="su-debug-force-score-apply"
                    >
                        ⚡ 强制结算有随从的基地
                    </button>
                </div>
            </div>

            {/* 发牌调试 */}
            <div className="bg-green-50 p-3 rounded-lg border border-green-200" data-testid="su-debug-deal">
                <h4 className="text-[10px] font-black text-green-600 uppercase tracking-widest mb-3">发牌调试 (牌库索引)</h4>
                <div className="space-y-2">
                    <div className="flex gap-2">
                        <select value={dealPlayer} onChange={(e) => setDealPlayer(e.target.value)} className="flex-1 px-2 py-1.5 text-xs border border-green-300 rounded bg-white text-gray-900">
                            <option value="0">P0 (牌库 {core?.players?.['0']?.deck?.length ?? 0} 张)</option>
                            <option value="1">P1 (牌库 {core?.players?.['1']?.deck?.length ?? 0} 张)</option>
                        </select>
                        <input
                            type="number"
                            min={0}
                            max={Math.max(0, playerDeck.length - 1)}
                            value={deckIndex}
                            onChange={(e) => setDeckIndex(Number(e.target.value))}
                            className="w-16 px-2 py-1.5 text-xs border border-green-300 rounded bg-white text-center text-gray-900"
                            placeholder="索引"
                        />
                    </div>
                    <div className="text-[9px] text-green-600 mb-1">
                        牌库剩余: {playerDeck.length} 张 | 手牌: {playerHand.length} 张
                        {selectedCard
                            ? <span className="ml-1 text-green-700">| 索引 {deckIndex}: {getCardName(selectedCard.defId)} ({selectedCard.type === 'minion' ? '随从' : '行动'})</span>
                            : <span className="ml-1 text-red-400">| 索引超出范围</span>
                        }
                    </div>
                    <button
                        onClick={() => {
                            const fullDeck = player?.deck ?? [];
                            const deckSnapshot = fullDeck.map((c, i) => ({ idx: i, defId: c.defId, uid: c.uid }));
                            console.log('[点击发牌] 点击发牌按钮:', {
                                playerId: dealPlayer,
                                deckIndex,
                                selectedCardDefId: selectedCard?.defId,
                                selectedCardUid: selectedCard?.uid,
                                deckLength: fullDeck.length,
                                deckSnapshot: deckSnapshot.map(({ idx, defId }) => ({ idx, defId })),
                            });
                            dispatch('SYS_CHEAT_DEAL_CARD_BY_INDEX', { playerId: dealPlayer, deckIndex });
                        }}
                        disabled={!selectedCard}
                        className="w-full px-3 py-1.5 bg-green-500 text-white rounded text-xs font-bold hover:bg-green-600 disabled:bg-gray-300 disabled:cursor-not-allowed"
                        data-testid="su-debug-deal-apply"
                    >
                        🎴 发指定牌 (索引 {deckIndex})
                    </button>
                </div>
            </div>

            {/* 牌库预览 */}
            <div className="bg-amber-50 p-3 rounded-lg border border-amber-200">
                <h4 className="text-[10px] font-black text-amber-600 uppercase tracking-widest mb-3">
                    牌库预览 (P{dealPlayer}) - 共 {playerDeck.length} 张
                </h4>
                <div className="max-h-48 overflow-y-auto">
                    {playerDeck.length === 0 ? (
                        <div className="text-[10px] text-amber-400 text-center py-2">牌库为空</div>
                    ) : (
                        <div className="space-y-1">
                            {playerDeck.map((card, idx) => {
                                // 验证：确保渲染的索引和数组索引一致
                                if (playerDeck[idx].uid !== card.uid) {
                                    console.error(`[DebugConfig] 索引不一致！idx=${idx}, card.uid=${card.uid}, playerDeck[idx].uid=${playerDeck[idx].uid}`);
                                }
                                return (
                                    <div
                                        key={card.uid}
                                        className={`flex items-center gap-2 text-[10px] px-1 py-0.5 rounded cursor-pointer transition-colors ${idx === deckIndex ? 'bg-amber-200 text-amber-900 font-bold' : 'text-amber-700 hover:bg-amber-100'}`}
                                        onClick={() => setDeckIndex(idx)}
                                    >
                                        <span className="w-5 text-amber-500 font-mono">{idx}</span>
                                        <span className={`px-1 rounded text-[8px] ${card.type === 'minion' ? 'bg-amber-200 text-amber-800' : 'bg-purple-200 text-purple-800'}`}>
                                            {card.type === 'minion' ? '随从' : '行动'}
                                        </span>
                                        <span className="flex-1 truncate">{getCardName(card.defId)}</span>
                                        <span className="text-amber-400 text-[8px] font-mono">{card.defId}</span>
                                    </div>
                                );
                            })}
                        </div>
                    )}
                </div>
            </div>

            {/* 手牌预览 */}
            <div className="bg-slate-50 p-3 rounded-lg border border-slate-200">
                <h4 className="text-[10px] font-black text-slate-600 uppercase tracking-widest mb-3">手牌预览 (P{dealPlayer}) - 共 {playerHand.length} 张</h4>
                <div className="max-h-24 overflow-y-auto">
                    {playerHand.length === 0 ? (
                        <div className="text-[10px] text-slate-400 text-center py-2">手牌为空</div>
                    ) : (
                        <div className="space-y-1">
                            {playerHand.map((card) => (
                                <div key={card.uid} className="flex items-center gap-2 text-[10px] text-slate-700 px-1 py-0.5 rounded">
                                    <span className={`px-1 rounded text-[8px] ${card.type === 'minion' ? 'bg-amber-200 text-amber-800' : 'bg-purple-200 text-purple-800'}`}>
                                        {card.type === 'minion' ? '随从' : '行动'}
                                    </span>
                                    <span className="flex-1 truncate">{getCardName(card.defId)}</span>
                                    <button
                                        onClick={() => dispatch('SYS_CHEAT_REMOVE_HAND_CARD', { playerId: dealPlayer, cardUid: card.uid })}
                                        className="px-1.5 py-0.5 bg-red-400 text-white rounded text-[8px] font-bold hover:bg-red-500 shrink-0"
                                        title="删除此手牌（移入弃牌堆）"
                                    >
                                        ✕
                                    </button>
                                    <span className="text-slate-400 text-[8px] font-mono">{card.defId}</span>
                                </div>
                            ))}
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
};
