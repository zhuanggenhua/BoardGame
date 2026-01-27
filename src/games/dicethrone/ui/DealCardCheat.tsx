/**
 * 发牌作弊组件（仅开发模式）
 * 用于调试面板，可以根据牌库索引直接发牌到手牌
 */

import React, { useState } from 'react';
import type { HeroState } from '../types';

interface DealCardCheatProps {
    players: Record<string, HeroState>;
    onDealCard: (playerId: string, deckIndex: number) => void;
}

export const DealCardCheat: React.FC<DealCardCheatProps> = ({ players, onDealCard }) => {
    const [dealPlayer, setDealPlayer] = useState('0');
    const [deckIndex, setDeckIndex] = useState('0');
    
    const targetPlayer = players[dealPlayer];
    const deckLength = targetPlayer?.deck?.length ?? 0;
    const cardAtIndex = targetPlayer?.deck?.[Number(deckIndex)];

    if (!import.meta.env.DEV) return null;

    return (
        <div className="space-y-2 p-3 bg-green-50 rounded-lg border border-green-200">
            <h4 className="text-[10px] font-black text-green-600 uppercase tracking-widest">
                🎴 发牌调试
            </h4>
            <div className="flex gap-2">
                <select
                    value={dealPlayer}
                    onChange={(e) => setDealPlayer(e.target.value)}
                    className="flex-1 px-2 py-1.5 text-xs border border-green-300 rounded bg-white text-gray-700"
                >
                    {Object.keys(players).map(pid => (
                        <option key={pid} value={pid}>P{pid}</option>
                    ))}
                </select>
                <input
                    type="number"
                    min="0"
                    max={Math.max(0, deckLength - 1)}
                    value={deckIndex}
                    onChange={(e) => setDeckIndex(e.target.value)}
                    className="flex-1 px-2 py-1.5 text-xs border border-green-300 rounded bg-white text-center text-gray-700"
                    placeholder="牌库索引"
                />
            </div>
            <div className="text-[9px] text-green-600">
                牌库: {deckLength} 张 {cardAtIndex && ` | 选中: ${cardAtIndex.id}`}
            </div>
            <button
                onClick={() => {
                    const index = Number(deckIndex);
                    if (index >= 0 && index < deckLength) {
                        onDealCard(dealPlayer, index);
                    }
                }}
                disabled={deckLength === 0}
                className="w-full px-3 py-1.5 bg-green-500 text-white rounded text-xs font-bold hover:bg-green-600 disabled:opacity-50 disabled:cursor-not-allowed"
            >
                发指定牌
            </button>
        </div>
    );
};
