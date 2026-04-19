/**
 * 临时测试页面：大杀四方响应式布局预览
 * 
 * 模拟实际游戏布局，支持切换 2/3/4 人局视角
 */

import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { getLayoutConfig } from '../games/smashup/ui/layoutConfig';

const SmashUp4PLayoutTest: React.FC = () => {
    const navigate = useNavigate();
    const [playerCount, setPlayerCount] = useState<2 | 3 | 4>(4);
    const layout = getLayoutConfig(playerCount);

    // 模拟基地数据
    // 2人局：4个基地，3人局：4个基地，4人局：5个基地
    const baseCount = playerCount === 4 ? 5 : 4;
    const bases = Array.from({ length: baseCount }, (_, i) => ({
        id: i + 1,
        // 每个基地有 2 个玩家的随从，每个玩家 4 个随从（最拥挤情况）
        minionGroups: [
            { playerId: 0, minions: [1, 2, 3, 4] },
            { playerId: 1, minions: [1, 2, 3, 4] },
        ],
        ongoingCards: i === 0 ? 2 : i === baseCount - 1 ? 3 : i % 2, // 第一个和最后一个基地有更多持续行动卡
    }));

    const playerColors = ['#3b82f6', '#ef4444', '#10b981', '#f59e0b']; // 蓝、红、绿、橙

    return (
        <div className="min-h-screen bg-gradient-to-br from-amber-50 to-orange-100">
            {/* 顶部控制栏 */}
            <div className="sticky top-0 z-50 bg-white/90 backdrop-blur-sm border-b border-gray-200 shadow-sm">
                <div className="max-w-7xl mx-auto px-4 py-3">
                    <div className="flex justify-between items-center mb-2">
                        <div className="flex items-center gap-4">
                            <h1 className="text-lg font-bold text-gray-800">大杀四方布局测试</h1>
                            <div className="flex gap-2">
                                {([2, 3, 4] as const).map((count) => (
                                    <button
                                        key={count}
                                        onClick={() => setPlayerCount(count)}
                                        className={`px-4 py-2 rounded-lg font-semibold transition-colors ${
                                            playerCount === count
                                                ? 'bg-blue-500 text-white'
                                                : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
                                        }`}
                                    >
                                        {count}人局
                                    </button>
                                ))}
                            </div>
                        </div>
                        <button
                            onClick={() => navigate('/')}
                            className="px-4 py-2 bg-gray-500 hover:bg-gray-600 text-white rounded-lg"
                        >
                            返回
                        </button>
                    </div>
                    {/* 配置详情 */}
                    <div className="grid grid-cols-5 gap-4 text-xs">
                        <div className="bg-green-50 px-3 py-2 rounded">
                            <div className="text-gray-600">基地间距</div>
                            <div className="text-lg font-bold text-green-600">{layout.baseGap}vw</div>
                        </div>
                        <div className="bg-blue-50 px-3 py-2 rounded">
                            <div className="text-gray-600">基地宽度</div>
                            <div className="text-lg font-bold text-blue-600">{layout.baseCardWidth}vw</div>
                        </div>
                        <div className="bg-purple-50 px-3 py-2 rounded">
                            <div className="text-gray-600">随从宽度</div>
                            <div className="text-lg font-bold text-purple-600">{layout.minionCardWidth}vw</div>
                        </div>
                        <div className="bg-orange-50 px-3 py-2 rounded">
                            <div className="text-gray-600">手牌高度</div>
                            <div className="text-lg font-bold text-orange-600">{layout.handAreaHeight}px</div>
                        </div>
                        <div className="bg-gray-50 px-3 py-2 rounded">
                            <div className="text-gray-600">基地数量</div>
                            <div className="text-lg font-bold text-gray-600">{baseCount}</div>
                        </div>
                    </div>
                </div>
            </div>

            {/* 游戏布局区域（模拟实际的滚动容器） */}
            <div className="absolute inset-0 flex items-center justify-center overflow-x-auto overflow-y-hidden pt-20 pb-60">
                <div 
                    className="flex items-start px-20 min-w-max"
                    style={{ gap: `${layout.baseGap}vw` }}
                >
                    {bases.map((base) => (
                        <div key={base.id} className="relative flex flex-col items-center mx-[1vw]">
                            {/* 持续行动卡（基地上方） */}
                            {base.ongoingCards > 0 && (
                                <div 
                                    className="absolute left-1/2 -translate-x-1/2 flex items-center gap-[0.4vw] z-30"
                                    style={{ top: `-${layout.ongoingTopOffset}vw` }}
                                >
                                    {Array.from({ length: base.ongoingCards }).map((_, idx) => (
                                        <div
                                            key={idx}
                                            className="bg-purple-600 rounded shadow-lg border-2 border-purple-700 flex items-center justify-center"
                                            style={{
                                                width: `${layout.ongoingCardWidth}vw`,
                                                aspectRatio: '0.714',
                                            }}
                                        >
                                            <div className="text-white text-[0.4vw] font-bold">持续</div>
                                        </div>
                                    ))}
                                </div>
                            )}

                            {/* 基地卡片 */}
                            <div
                                className="relative bg-amber-800 shadow-xl rounded-sm transition-all z-20 flex items-center justify-center"
                                style={{
                                    width: `${layout.baseCardWidth}vw`,
                                    aspectRatio: '1.43',
                                }}
                            >
                                <div className="text-white text-center">
                                    <div className="text-[1.2vw] font-bold">基地 {base.id}</div>
                                    <div className="text-[0.6vw] opacity-75 mt-1">{layout.baseCardWidth}vw</div>
                                </div>
                            </div>

                            {/* 随从区域（基地下方，按玩家分组） */}
                            <div 
                                className="mt-[1vw] flex items-start justify-center w-full"
                                style={{ gap: `${layout.playerColumnGap}vw` }}
                            >
                                {base.minionGroups.map((group) => (
                                    <div key={group.playerId} className="flex flex-col gap-[0.3vw]">
                                        {group.minions.map((minion) => (
                                            <div
                                                key={minion}
                                                className="rounded shadow-lg border-2 flex items-center justify-center"
                                                style={{
                                                    width: `${layout.minionCardWidth}vw`,
                                                    aspectRatio: '0.714',
                                                    backgroundColor: playerColors[group.playerId],
                                                    borderColor: playerColors[group.playerId],
                                                }}
                                            >
                                                <div className="text-white text-[0.5vw] font-bold text-center">
                                                    <div>P{group.playerId}</div>
                                                    <div className="text-[0.35vw] opacity-75">{layout.minionCardWidth}vw</div>
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                                ))}
                            </div>
                        </div>
                    ))}
                </div>
            </div>

            {/* 底部手牌区域占位 */}
            <div 
                className="fixed bottom-0 inset-x-0 bg-gradient-to-t from-amber-900/80 to-transparent pointer-events-none flex items-center justify-center"
                style={{ height: `${layout.handAreaHeight}px` }}
            >
                <div className="text-white text-sm opacity-75">
                    手牌区域占位 ({layout.handAreaHeight}px)
                </div>
            </div>
        </div>
    );
};

export default SmashUp4PLayoutTest;
