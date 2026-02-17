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
    const [selectedBaseIndex, setSelectedBaseIndex] = useState<number>(0);

    const player = core?.players?.[dealPlayer as '0' | '1'];
    const playerDeck = player?.deck ?? [];
    const playerHand = player?.hand ?? [];

    const selectedCard = playerDeck[deckIndex];

    const getCardName = (defId: string): string => {
        const def = getCardDef(defId);
        return def ? resolveCardDisplayName(def, t) : defId;
    };

    const getBaseName = (defId: string): string => {
        // 简化基地名称显示
        return defId.replace('base_', '').replace(/_/g, ' ');
    };

    return (
        <div className="space-y-4">
            {/* 刷新基地调试 */}
            <div className="bg-blue-50 p-3 rounded-lg border border-blue-200" data-testid="su-debug-refresh-base">
                <h4 className="text-[10px] font-black text-blue-600 uppercase tracking-widest mb-3">刷新基地</h4>
                <div className="space-y-2">
                    <div className="text-[9px] text-blue-600 mb-2">
                        场上基地: {core?.bases?.length ?? 0} 个 | 基地牌库: {core?.baseDeck?.length ?? 0} 张
                    </div>
                    <select 
                        value={selectedBaseIndex} 
                        onChange={(e) => setSelectedBaseIndex(Number(e.target.value))} 
                        className="w-full px-2 py-1.5 text-xs border border-blue-300 rounded bg-white text-gray-900"
                        data-testid="su-debug-base-select"
                    >
                        {(core?.bases ?? []).map((base, idx) => (
                            <option key={idx} value={idx}>
                                基地 {idx}: {getBaseName(base.defId)} ({base.minions.length} 随从, {base.ongoingActions.length} 行动)
                            </option>
                        ))}
                    </select>
                    <div className="text-[9px] text-blue-700 bg-blue-100 p-2 rounded">
                        {core?.baseDeck && core.baseDeck.length > 0 ? (
                            <>下一张基地: {getBaseName(core.baseDeck[0])}</>
                        ) : (
                            <span className="text-red-500">基地牌库为空</span>
                        )}
                    </div>
                    <button
                        onClick={() => {
                            console.log('[刷新基地] 点击刷新按钮:', {
                                baseIndex: selectedBaseIndex,
                                currentBase: core?.bases?.[selectedBaseIndex]?.defId,
                                nextBase: core?.baseDeck?.[0],
                                baseDeckLength: core?.baseDeck?.length,
                            });
                            dispatch('SYS_CHEAT_REFRESH_BASE', { baseIndex: selectedBaseIndex });
                        }}
                        disabled={!core?.baseDeck || core.baseDeck.length === 0}
                        className="w-full px-3 py-1.5 bg-blue-500 text-white rounded text-xs font-bold hover:bg-blue-600 disabled:bg-gray-300 disabled:cursor-not-allowed"
                        data-testid="su-debug-refresh-base-apply"
                    >
                        🔄 刷新基地 {selectedBaseIndex}
                    </button>
                    <button
                        onClick={() => {
                            console.log('[刷新所有基地] 点击刷新按钮:', {
                                basesCount: core?.bases?.length,
                                currentBases: core?.bases?.map(b => b.defId),
                                nextBases: core?.baseDeck?.slice(0, core?.bases?.length),
                                baseDeckLength: core?.baseDeck?.length,
                            });
                            dispatch('SYS_CHEAT_REFRESH_ALL_BASES');
                        }}
                        disabled={!core?.baseDeck || !core?.bases || core.baseDeck.length < core.bases.length}
                        className="w-full px-3 py-1.5 bg-purple-500 text-white rounded text-xs font-bold hover:bg-purple-600 disabled:bg-gray-300 disabled:cursor-not-allowed"
                        data-testid="su-debug-refresh-all-bases-apply"
                    >
                        🔄 刷新所有基地
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
                <h4 className="text-[10px] font-black text-slate-600 uppercase tracking-widest mb-3">手牌预览 (P{dealPlayer})</h4>
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
