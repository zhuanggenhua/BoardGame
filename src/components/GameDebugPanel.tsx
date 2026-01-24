import React, { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useDebug } from '../contexts/DebugContext';

/* eslint-disable @typescript-eslint/no-explicit-any */
interface DebugPanelProps {
    G: any;
    ctx: any;
    moves: any;
    events?: any;
    playerID?: string | null;
    autoSwitch?: boolean;
    children?: React.ReactNode; // 支持自定义调试项
}

export const GameDebugPanel: React.FC<DebugPanelProps> = ({ G, ctx, moves, events, playerID, autoSwitch = true, children }) => {
    const { t } = useTranslation('game');
    const [isOpen, setIsOpen] = React.useState(false);
    const [activeTab, setActiveTab] = React.useState<'state' | 'actions' | 'controls'>('actions');
    const { setPlayerID } = useDebug();

    // 动作参数的状态
    const [moveArgs, setMoveArgs] = useState<Record<string, string>>({});

    if (!import.meta.env.DEV) return null;

    const handleArgChange = (moveName: string, value: string) => {
        setMoveArgs(prev => ({ ...prev, [moveName]: value }));
    };

    // 监听当前玩家变化，实现自动切换视角
    // 优先使用领域内核的 currentPlayer（G.core.currentPlayer），回退到 ctx.currentPlayer
    const coreCurrentPlayer = G?.core?.currentPlayer as string | undefined;
    const activePlayer = coreCurrentPlayer ?? ctx.currentPlayer;
    React.useEffect(() => {
        if (!autoSwitch) return;
        if (activePlayer && activePlayer !== playerID) {
            // 延迟一点切换，让用户看到上一步的结果
            const timer = setTimeout(() => {
                setPlayerID(activePlayer);
            }, 500);
            return () => clearTimeout(timer);
        }
    }, [activePlayer, setPlayerID, playerID, autoSwitch]);

    const executeMove = (moveName: string) => {
        const rawArg = moveArgs[moveName];
        if (!rawArg) {
            moves[moveName]();
            return;
        }

        // 尝试将参数解析为 JSON（用于数字、对象、数组），否则按字符串传递
        try {
            // 解析参数：如果输入是 JSON 格式则解析，否则作为字符串
            const arg = JSON.parse(rawArg);
            moves[moveName](arg);
        } catch (_) {
            // 如果不是有效的 JSON，则回退到字符串
            moves[moveName](rawArg);
        }
    };

    return (
        <>
            {/* 浮动切换按钮 */}
            <button
                onClick={() => setIsOpen(!isOpen)}
                className="fixed bottom-24 right-4 z-[9999] w-12 h-12 bg-gray-900 text-white rounded-md shadow-lg flex items-center justify-center hover:bg-gray-800 transition-all border border-gray-700 hover:scale-105 active:scale-95 text-xl"
                title={t('debug.toggleTitle')}
            >
                {isOpen ? '✕' : '🛠️'}
            </button>

            {/* 主面板 */}
            {isOpen && (
                <div className="fixed top-20 right-4 bottom-24 w-96 bg-white shadow-2xl rounded-xl border border-gray-200 z-[9998] flex flex-col overflow-hidden font-mono text-sm ring-1 ring-black/5">
                    {/* 页眉 */}
                    <div className="bg-gray-100 p-3 border-b border-gray-200 flex justify-between items-center">
                        <h3 className="font-bold text-gray-700 flex items-center gap-2">
                            <span>{t('debug.panelTitle')}</span>
                        </h3>
                        <div className="flex gap-1 bg-white p-1 rounded-lg border border-gray-200 shadow-sm">
                            <span className="text-xs px-2 py-1 text-gray-500 font-bold select-none">{t('debug.viewLabel')}</span>
                            {['0', '1', null].map((pid) => (
                                <button
                                    key={String(pid)}
                                    onClick={() => setPlayerID(pid as string | null)}
                                    className={`px-2 py-0.5 text-xs rounded transition-colors font-medium ${String(playerID) === String(pid)
                                        ? 'bg-blue-600 text-white shadow-sm'
                                        : 'hover:bg-gray-100 text-gray-600'
                                        }`}
                                >
                                    {pid === null ? t('debug.spectator') : `P${pid}`}
                                </button>
                            ))}
                        </div>
                    </div>

                    {/* 导航栏 */}
                    <div className="flex border-b border-gray-200 bg-white">
                        <button
                            onClick={() => setActiveTab('actions')}
                            className={`flex-1 py-2.5 text-center text-xs font-bold transition-colors ${activeTab === 'actions' ? 'text-blue-600 border-b-2 border-blue-600 bg-blue-50/30' : 'text-gray-500 hover:bg-gray-50 hover:text-gray-700'}`}
                        >
                            {t('debug.tabs.actions')}
                        </button>
                        <button
                            onClick={() => setActiveTab('state')}
                            className={`flex-1 py-2.5 text-center text-xs font-bold transition-colors ${activeTab === 'state' ? 'text-blue-600 border-b-2 border-blue-600 bg-blue-50/30' : 'text-gray-500 hover:bg-gray-50 hover:text-gray-700'}`}
                        >
                            {t('debug.tabs.state')}
                        </button>
                        <button
                            onClick={() => setActiveTab('controls')}
                            className={`flex-1 py-2.5 text-center text-xs font-bold transition-colors ${activeTab === 'controls' ? 'text-blue-600 border-b-2 border-blue-600 bg-blue-50/30' : 'text-gray-500 hover:bg-gray-50 hover:text-gray-700'}`}
                        >
                            {t('debug.tabs.controls')}
                        </button>
                    </div>

                    {/* 内容区域 */}
                    <div className="flex-1 overflow-y-auto p-4 custom-scrollbar bg-gray-50/30">
                        {/* 动作选项卡 */}
                        {activeTab === 'actions' && (
                            <div className="space-y-6">
                                <div className="space-y-3">
                                    <h4 className="text-[10px] font-black text-gray-400 uppercase tracking-widest flex items-center gap-2">
                                        <span className="w-full h-px bg-gray-200"></span>
                                        {t('debug.sections.moves')}
                                        <span className="w-full h-px bg-gray-200"></span>
                                    </h4>
                                    <div className="flex flex-col gap-3">
                                        {Object.keys(moves).map((moveName) => (
                                            <div key={moveName} className="bg-white p-2 rounded-lg border border-gray-200 shadow-sm group hover:border-blue-300 transition-colors">
                                                <div className="flex justify-between items-center mb-2">
                                                    <span className="font-bold text-gray-700 text-xs">{moveName}</span>
                                                    <button
                                                        onClick={() => executeMove(moveName)}
                                                        className="px-3 py-1 bg-blue-600 text-white rounded text-xs font-bold hover:bg-blue-700 active:translate-y-0.5 transition-all shadow-sm shadow-blue-200"
                                                    >
                                                        {t('debug.actions.execute')}
                                                    </button>
                                                </div>
                                                <input
                                                    type="text"
                                                    placeholder={t('debug.placeholders.moveArgs')}
                                                    value={moveArgs[moveName] || ''}
                                                    onChange={(e) => handleArgChange(moveName, e.target.value)}
                                                    className="w-full px-2 py-1.5 text-xs border border-gray-200 rounded bg-gray-50 focus:bg-white focus:border-blue-500 focus:ring-1 focus:ring-blue-500 outline-none transition-all placeholder:text-gray-300"
                                                />
                                            </div>
                                        ))}
                                        {Object.keys(moves).length === 0 && (
                                            <p className="text-gray-400 italic text-xs text-center py-2">{t('debug.actions.empty')}</p>
                                        )}
                                    </div>
                                </div>

                                <div className="space-y-3">
                                    <h4 className="text-[10px] font-black text-gray-400 uppercase tracking-widest flex items-center gap-2">
                                        <span className="w-full h-px bg-gray-200"></span>
                                        {t('debug.sections.events')}
                                        <span className="w-full h-px bg-gray-200"></span>
                                    </h4>
                                    <div className="grid grid-cols-2 gap-2">
                                        {events?.endTurn && (
                                            <button onClick={() => events.endTurn()} className="px-3 py-2 bg-red-50 text-red-600 border border-red-200 rounded hover:bg-red-100 text-xs font-bold transition-all text-left flex items-center gap-2">
                                                {t('debug.events.endTurn')}
                                            </button>
                                        )}
                                        {events?.endPhase && (
                                            <button onClick={() => events.endPhase()} className="px-3 py-2 bg-orange-50 text-orange-600 border border-orange-200 rounded hover:bg-orange-100 text-xs font-bold transition-all text-left flex items-center gap-2">
                                                {t('debug.events.endPhase')}
                                            </button>
                                        )}
                                    </div>
                                </div>
                            </div>
                        )}

                        {/* 数据选项卡 */}
                        {activeTab === 'state' && (
                            <div className="space-y-4">
                                <div className="bg-white p-3 rounded-lg border border-gray-200 shadow-sm space-y-2">
                                    <div className="flex justify-between text-xs border-b border-gray-100 pb-2">
                                        <span className="text-gray-500 font-bold">{t('debug.state.phase')}</span>
                                        <span className="font-mono bg-purple-100 text-purple-700 px-1.5 rounded">{ctx.phase}</span>
                                    </div>
                                    <div className="flex justify-between text-xs border-b border-gray-100 pb-2">
                                        <span className="text-gray-500 font-bold">{t('debug.state.turn')}</span>
                                        <span className="font-mono bg-blue-100 text-blue-700 px-1.5 rounded">{ctx.turn}</span>
                                    </div>
                                    <div className="flex justify-between text-xs pt-1">
                                        <span className="text-gray-500 font-bold">{t('debug.state.activePlayer')}</span>
                                        <span className="font-mono bg-green-100 text-green-700 px-1.5 rounded">{ctx.currentPlayer}</span>
                                    </div>
                                </div>

                                <div className="space-y-1">
                                    <h4 className="text-[10px] font-bold text-gray-400 uppercase tracking-wider mb-2">{t('debug.state.gameState')}</h4>
                                    <pre className="text-[10px] leading-relaxed bg-gray-900 text-green-400 p-3 rounded-lg overflow-x-auto border border-gray-800 font-mono shadow-inner">
                                        {JSON.stringify(G, null, 2)}
                                    </pre>
                                </div>
                            </div>
                        )}

                        {/* 系统选项卡 */}
                        {activeTab === 'controls' && (
                            <div className="space-y-4">
                                <button
                                    onClick={() => { localStorage.removeItem('bgio_state'); window.location.reload(); }}
                                    className="w-full py-3 bg-red-600 hover:bg-red-700 text-white rounded-lg shadow-md font-bold text-xs flex items-center justify-center gap-2 transition-all active:scale-95"
                                >
                                    {t('debug.reset.button')}
                                </button>

                                <div className="bg-blue-50 p-4 rounded-lg text-xs text-blue-700 border border-blue-100">
                                    <p className="mb-2 font-bold">{t('debug.reset.hintTitle')}</p>
                                    <p>{t('debug.reset.hintDescription')}</p>
                                </div>

                                {children && (
                                    <div className="pt-4 border-t border-gray-200 mt-4 space-y-3">
                                        <h4 className="text-[10px] font-black text-gray-400 uppercase tracking-widest">{t('debug.tools.gameSpecific')}</h4>
                                        {children}
                                    </div>
                                )}
                            </div>
                        )}
                    </div>
                </div>
            )}
        </>
    );
};

export default GameDebugPanel;
