/**
 * DiceThrone 调试工具配置
 * 定义游戏专属的作弊指令 UI
 */

import React, { useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { resolveCardDisplayName } from '../../components/game/framework/debug/cardNameResolver';

/* eslint-disable @typescript-eslint/no-explicit-any */
interface DiceThroneDebugConfigProps {
    G: unknown;
    dispatch: (type: string, payload?: unknown) => void;
}

export const DiceThroneDebugConfig: React.FC<DiceThroneDebugConfigProps> = ({ G, dispatch }) => {
    const { t } = useTranslation('game-dicethrone');
    // ========== 资源作弊 ==========
    const [cheatPlayer, setCheatPlayer] = useState<string>('0');
    const [cheatResource, setCheatResource] = useState<string>('cp');
    const [cheatValue, setCheatValue] = useState<string>('1');

    // ========== 骰子作弊 ==========
    const [diceValues, setDiceValues] = useState<string[]>(
        G?.core?.dice?.map((die: any) => String(die.value)) ?? ['1', '1', '1', '1', '1']
    );

    // ========== Token 作弊 ==========
    const [tokenPlayer, setTokenPlayer] = useState<string>('0');
    const [tokenType, setTokenType] = useState<string>('lotus');
    const [tokenValue, setTokenValue] = useState<string>('1');

    // ========== 发牌作弊 ==========
    const [dealPlayer, setDealPlayer] = useState<string>('0');
    const [deckIndex, setDeckIndex] = useState<string>('0');

    // 获取当前玩家牌库和手牌
    const playerDeck: any[] = G?.core?.players?.[dealPlayer]?.deck ?? [];
    const playerHand: any[] = G?.core?.players?.[dealPlayer]?.hand ?? [];

    // 检查牌库中是否存在指定图集索引的卡牌
    const cardInDeck = useMemo(() => {
        const targetIndex = Number(deckIndex);
        return playerDeck.find(
            (c: any) => c.previewRef?.type === 'atlas' && c.previewRef.index === targetIndex
        );
    }, [playerDeck, deckIndex]);

    const sortedDeckCards = useMemo(() => {
        return [...playerDeck].sort((a: any, b: any) => {
            const ai = a.previewRef?.type === 'atlas' ? a.previewRef.index : 999;
            const bi = b.previewRef?.type === 'atlas' ? b.previewRef.index : 999;
            return ai - bi;
        });
    }, [playerDeck]);

    // 更新骰子值
    const handleDieChange = (index: number, value: string) => {
        const newValues = [...diceValues];
        newValues[index] = value;
        setDiceValues(newValues);
    };

    // 应用骰子值
    const handleApplyDice = () => {
        const values = diceValues.map((v) => {
            const num = parseInt(v, 10);
            return isNaN(num) ? 1 : Math.max(1, Math.min(6, num));
        });

        dispatch('SYS_CHEAT_SET_DICE', { diceValues: values });
    };

    return (
        <div className="space-y-4">
            {/* 资源作弊 */}
            <div className="bg-yellow-50 p-3 rounded-lg border border-yellow-200">
                    <h4 className="text-[10px] font-black text-yellow-600 uppercase tracking-widest mb-3">
                        资源修改
                    </h4>
                    <div className="space-y-2">
                        <div className="flex gap-2">
                            <select
                                value={cheatPlayer}
                                onChange={(e) => setCheatPlayer(e.target.value)}
                                className="flex-1 px-2 py-1.5 text-xs border border-yellow-300 rounded bg-white text-gray-900"
                            >
                                <option value="0">P0</option>
                                <option value="1">P1</option>
                            </select>
                            <select
                                value={cheatResource}
                                onChange={(e) => setCheatResource(e.target.value)}
                                className="flex-1 px-2 py-1.5 text-xs border border-yellow-300 rounded bg-white text-gray-900"
                            >
                                <option value="cp">CP</option>
                                <option value="health">HP</option>
                            </select>
                            <input
                                type="number"
                                value={cheatValue}
                                onChange={(e) => setCheatValue(e.target.value)}
                                className="w-16 px-2 py-1.5 text-xs border border-yellow-300 rounded bg-white text-center text-gray-900"
                            />
                        </div>
                        <div className="flex gap-2">
                            <button
                                onClick={() => {
                                    dispatch('SYS_CHEAT_SET_RESOURCE', {
                                        playerId: cheatPlayer,
                                        resourceId: cheatResource,
                                        value: Number(cheatValue),
                                    });
                                }}
                                className="flex-1 px-3 py-1.5 bg-yellow-500 text-white rounded text-xs font-bold hover:bg-yellow-600"
                            >
                                设置为
                            </button>
                            <button
                                onClick={() => {
                                    dispatch('SYS_CHEAT_ADD_RESOURCE', {
                                        playerId: cheatPlayer,
                                        resourceId: cheatResource,
                                        delta: Number(cheatValue),
                                    });
                                }}
                                className="flex-1 px-3 py-1.5 bg-green-500 text-white rounded text-xs font-bold hover:bg-green-600"
                            >
                                +增加
                            </button>
                            <button
                                onClick={() => {
                                    dispatch('SYS_CHEAT_ADD_RESOURCE', {
                                        playerId: cheatPlayer,
                                        resourceId: cheatResource,
                                        delta: -Number(cheatValue),
                                    });
                                }}
                                className="flex-1 px-3 py-1.5 bg-red-500 text-white rounded text-xs font-bold hover:bg-red-600"
                            >
                                -减少
                            </button>
                        </div>
                    </div>
                </div>

            {/* 骰子作弊 */}
            
                <div className="bg-blue-50 p-3 rounded-lg border border-blue-200" data-testid="dt-debug-dice">
                    <h4 className="text-[10px] font-black text-blue-600 uppercase tracking-widest mb-3">
                        骰子调整
                    </h4>
                    <div className="space-y-2">
                        <div className="grid grid-cols-5 gap-2">
                            {diceValues.map((value, index) => (
                                <div key={index} className="flex flex-col items-center gap-1">
                                    <span className="text-[9px] text-gray-500 font-bold">D{index + 1}</span>
                                    <input
                                        type="number"
                                        min="1"
                                        max="6"
                                        value={value}
                                        onChange={(e) => handleDieChange(index, e.target.value)}
                                        className="w-full px-2 py-1.5 text-xs border border-blue-300 rounded bg-white text-center font-bold text-gray-900"
                                    />
                                </div>
                            ))}
                        </div>
                        <button
                            onClick={handleApplyDice}
                            className="w-full px-3 py-2 bg-blue-500 text-white rounded text-xs font-bold hover:bg-blue-600"
                            data-testid="dt-debug-dice-apply"
                        >
                            ✓ 应用骰子值
                        </button>
                        <div className="flex gap-2">
                            <button
                                onClick={() => setDiceValues(['1', '1', '1', '1', '1'])}
                                className="flex-1 px-2 py-1 bg-gray-200 text-gray-700 rounded text-[10px] font-bold hover:bg-gray-300"
                            >
                                全1
                            </button>
                            <button
                                onClick={() => setDiceValues(['6', '6', '6', '6', '6'])}
                                className="flex-1 px-2 py-1 bg-gray-200 text-gray-700 rounded text-[10px] font-bold hover:bg-gray-300"
                            >
                                全6
                            </button>
                        </div>
                        <div className="flex gap-2">
                            <button
                                onClick={() => { setDiceValues(['1', '2', '3', '4', '5']); }}
                                className="flex-1 px-2 py-1 bg-indigo-200 text-indigo-700 rounded text-[10px] font-bold hover:bg-indigo-300"
                            >
                                大顺 1-5
                            </button>
                            <button
                                onClick={() => { setDiceValues(['2', '3', '4', '5', '6']); }}
                                className="flex-1 px-2 py-1 bg-indigo-200 text-indigo-700 rounded text-[10px] font-bold hover:bg-indigo-300"
                            >
                                大顺 2-6
                            </button>
                            <button
                                onClick={() => { setDiceValues(['1', '2', '3', '4', '4']); }}
                                className="flex-1 px-2 py-1 bg-teal-200 text-teal-700 rounded text-[10px] font-bold hover:bg-teal-300"
                            >
                                小顺 1-4
                            </button>
                        </div>
                    </div>
                </div>

            {/* Token 作弊 */}
            
                <div className="bg-purple-50 p-3 rounded-lg border border-purple-200">
                    <h4 className="text-[10px] font-black text-purple-600 uppercase tracking-widest mb-3">
                        Token 调整
                    </h4>
                    <div className="space-y-2">
                        <div className="flex gap-2">
                            <select
                                value={tokenPlayer}
                                onChange={(e) => setTokenPlayer(e.target.value)}
                                className="flex-1 px-2 py-1.5 text-xs border border-purple-300 rounded bg-white text-gray-900"
                            >
                                <option value="0">P0</option>
                                <option value="1">P1</option>
                            </select>
                            <select
                                value={tokenType}
                                onChange={(e) => setTokenType(e.target.value)}
                                className="flex-1 px-2 py-1.5 text-xs border border-purple-300 rounded bg-white text-gray-900"
                            >
                                <option value="lotus">莲花 🪷</option>
                            </select>
                            <input
                                type="number"
                                min="0"
                                value={tokenValue}
                                onChange={(e) => setTokenValue(e.target.value)}
                                className="w-16 px-2 py-1.5 text-xs border border-purple-300 rounded bg-white text-center text-gray-900"
                            />
                        </div>
                        <button
                            onClick={() => {
                                dispatch('SYS_CHEAT_SET_TOKEN', {
                                    playerId: tokenPlayer,
                                    tokenId: tokenType,
                                    amount: Number(tokenValue),
                                });
                            }}
                            className="w-full px-3 py-1.5 bg-purple-500 text-white rounded text-xs font-bold hover:bg-purple-600"
                        >
                            设置 Token 数量
                        </button>
                    </div>
                </div>

            {/* 发牌作弊 */}
            
                <div className="bg-green-50 p-3 rounded-lg border border-green-200">
                    <h4 className="text-[10px] font-black text-green-600 uppercase tracking-widest mb-3">
                        发牌调试 (图集索引)
                    </h4>
                    <div className="space-y-2">
                        <div className="flex gap-2">
                            <select
                                value={dealPlayer}
                                onChange={(e) => setDealPlayer(e.target.value)}
                                className="flex-1 px-2 py-1.5 text-xs border border-green-300 rounded bg-white text-gray-900"
                            >
                                <option value="0">P0</option>
                                <option value="1">P1</option>
                            </select>
                            <input
                                type="number"
                                min="0"
                                max={32}
                                value={deckIndex}
                                onChange={(e) => setDeckIndex(e.target.value)}
                                className="flex-1 px-2 py-1.5 text-xs border border-green-300 rounded bg-white text-center text-gray-900"
                                placeholder="图集索引"
                            />
                        </div>
                        <div className="text-[9px] text-green-600 mb-1">
                            牌库剩余: {playerDeck.length} 张
                            {cardInDeck ? (
                                <span className="ml-1 text-green-700">| 牌库中存在: {resolveCardDisplayName(cardInDeck, t)}</span>
                            ) : (
                                <span className="ml-1 text-red-400">| 牌库中不存在该索引</span>
                            )}
                        </div>
                        <button
                            onClick={() => {
                                dispatch('SYS_CHEAT_DEAL_CARD_BY_ATLAS_INDEX', {
                                    playerId: dealPlayer,
                                    atlasIndex: Number(deckIndex),
                                });
                            }}
                            disabled={!cardInDeck}
                            className="w-full px-3 py-1.5 bg-green-500 text-white rounded text-xs font-bold hover:bg-green-600 disabled:bg-gray-300 disabled:cursor-not-allowed"
                        >
                            🎴 发指定牌 (Atlas)
                        </button>
                    </div>
                </div>

            {/* 卡牌索引速查表 */}
            <div className="bg-amber-50 p-3 rounded-lg border border-amber-200">
                <h4 className="text-[10px] font-black text-amber-600 uppercase tracking-widest mb-3">
                    牌库索引速查 (P{dealPlayer})
                </h4>
                <div className="max-h-40 overflow-y-auto">
                    {sortedDeckCards.length === 0 ? (
                        <div className="text-[10px] text-amber-400 text-center py-2">牌库为空</div>
                    ) : (
                        <div className="space-y-1">
                            {sortedDeckCards.map((card, idx) => {
                                const atlasIdx = card.previewRef?.type === 'atlas' ? card.previewRef.index : null;
                                return (
                                    <div
                                        key={`${card.id}-${idx}`}
                                        className="flex items-center gap-2 text-[10px] px-1 py-0.5 rounded cursor-pointer text-amber-700 hover:bg-amber-100"
                                        onClick={() => {
                                            if (atlasIdx != null) {
                                                setDeckIndex(String(atlasIdx));
                                                dispatch('SYS_CHEAT_DEAL_CARD_BY_ATLAS_INDEX', {
                                                    playerId: dealPlayer,
                                                    atlasIndex: atlasIdx,
                                                });
                                            }
                                        }}
                                    >
                                        <span className="w-5 text-amber-500 font-mono">{atlasIdx ?? '-'}</span>
                                        <span className={`px-1 rounded text-[8px] ${
                                            card.type === 'upgrade' ? 'bg-amber-200 text-amber-800' : 'bg-purple-200 text-purple-800'
                                        }`}>
                                            {card.type === 'upgrade' ? '升级' : '行动'}
                                        </span>
                                        <span className="flex-1 truncate">{resolveCardDisplayName(card, t)}</span>
                                        <span className="text-purple-500 text-[9px]">💎{card.cpCost}</span>
                                        <span className="text-green-500 text-[8px]">✓ 可发</span>
                                    </div>
                                );
                            })}
                        </div>
                    )}
                </div>
            </div>

            {/* 手牌预览 */}
            <div className="bg-slate-50 p-3 rounded-lg border border-slate-200">
                <h4 className="text-[10px] font-black text-slate-600 uppercase tracking-widest mb-3">
                    手牌预览 (P{dealPlayer})
                </h4>
                <div className="max-h-24 overflow-y-auto">
                    {playerHand.length === 0 ? (
                        <div className="text-[10px] text-slate-400 text-center py-2">手牌为空</div>
                    ) : (
                        <div className="space-y-1">
                            {playerHand.map((card: any, idx: number) => (
                                <div
                                    key={`${card.id}-${idx}`}
                                    className="flex items-center gap-2 text-[10px] text-slate-700 px-1 py-0.5 rounded"
                                >
                                    <span className="w-5 text-slate-400 font-mono">
                                        {card.previewRef?.type === 'atlas' ? card.previewRef.index : '-'}
                                    </span>
                                    <span className={`px-1 rounded text-[8px] ${
                                        card.type === 'upgrade' ? 'bg-amber-200 text-amber-800' : 'bg-purple-200 text-purple-800'
                                    }`}>
                                        {card.type === 'upgrade' ? '升级' : '行动'}
                                    </span>
                                    <span className="flex-1 truncate">{resolveCardDisplayName(card, t)}</span>
                                    <span className="text-purple-500">💎{card.cpCost}</span>
                                </div>
                            ))}
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
};
