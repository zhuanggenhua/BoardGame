import React, { useState, useCallback, useRef, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate, useParams, useSearchParams } from 'react-router-dom';
import { LobbyClient } from 'boardgame.io/client';
import { motion, useMotionValue } from 'framer-motion';
import { useDebug } from '../contexts/DebugContext';
import { useGameMode } from '../contexts/GameModeContext';
import { useAuth } from '../contexts/AuthContext';
import { GAME_SERVER_URL } from '../config/server';
import { matchSocket } from '../services/matchSocket';
import { destroyMatch, persistMatchCredentials } from '../hooks/match/useMatchStatus';
import { getOrCreateGuestId, getGuestName as resolveGuestName } from '../hooks/match/ownerIdentity';

const DEBUG_BUTTON_SIZE = 48;
const EDGE_PADDING = 16;
const STORAGE_KEY = 'debug_panel_position';

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

const lobbyClient = new LobbyClient({ server: GAME_SERVER_URL });

export const GameDebugPanel: React.FC<DebugPanelProps> = ({ G, ctx, moves, events, playerID, autoSwitch = true, children }) => {
    const { t } = useTranslation(['game', 'lobby']);
    const navigate = useNavigate();
    const { gameId, matchId: currentMatchId } = useParams<{ gameId: string; matchId: string }>();
    const [searchParams] = useSearchParams();
    const currentPlayerID = searchParams.get('playerID');
    const gameMode = useGameMode();
    const { user, token } = useAuth();
    const [isOpen, setIsOpen] = React.useState(false);
    const [activeTab, setActiveTab] = React.useState<'state' | 'actions' | 'controls'>('controls');
    const [isCreatingRoom, setIsCreatingRoom] = React.useState(false);
    const { setPlayerID } = useDebug();

    // 拖拽相关状态
    const [buttonPosition, setButtonPosition] = useState<{ left: number; top: number } | null>(null);
    const dragX = useMotionValue(0);
    const dragY = useMotionValue(0);
    const didDragRef = useRef(false);

    const getGuestId = () => getOrCreateGuestId();
    const getGuestName = () => resolveGuestName(t, getGuestId());

    // 位置约束函数
    const clampPosition = useCallback((target: { left: number; top: number }) => {
        const maxLeft = window.innerWidth - DEBUG_BUTTON_SIZE - EDGE_PADDING;
        const maxTop = window.innerHeight - DEBUG_BUTTON_SIZE - EDGE_PADDING;
        return {
            left: Math.min(Math.max(target.left, EDGE_PADDING), maxLeft),
            top: Math.min(Math.max(target.top, EDGE_PADDING), maxTop),
        };
    }, []);

    // 获取默认位置（右下角偏上）
    const getDefaultPosition = useCallback(() => {
        const maxLeft = window.innerWidth - DEBUG_BUTTON_SIZE - EDGE_PADDING;
        const defaultTop = window.innerHeight * 0.65; // 65% 高度位置
        return { left: maxLeft, top: defaultTop };
    }, []);

    // 加载保存的位置
    useEffect(() => {
        try {
            const saved = localStorage.getItem(STORAGE_KEY);
            if (saved) {
                const parsed = JSON.parse(saved);
                const next = clampPosition(parsed);
                setButtonPosition(next);
                return;
            }
            const next = clampPosition(getDefaultPosition());
            setButtonPosition(next);
        } catch (e) {
            console.error('[DebugPanel] 加载位置失败:', e);
            setButtonPosition(clampPosition(getDefaultPosition()));
        }
    }, [clampPosition, getDefaultPosition]);

    // 窗口大小变化时重新约束位置
    useEffect(() => {
        if (!buttonPosition) return;
        const handleResize = () => {
            const next = clampPosition(buttonPosition);
            setButtonPosition(next);
        };
        window.addEventListener('resize', handleResize);
        return () => window.removeEventListener('resize', handleResize);
    }, [clampPosition, buttonPosition]);

    // 拖拽结束处理
    const handleDragEnd = (_: unknown, info: { offset: { x: number; y: number } }) => {
        if (!buttonPosition) return;
        const next = clampPosition({
            left: buttonPosition.left + info.offset.x,
            top: buttonPosition.top + info.offset.y,
        });
        setButtonPosition(next);
        localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
        dragX.set(0);
        dragY.set(0);
    };

    const handleDragStart = () => {
        didDragRef.current = true;
    };

    const handlePointerDownCapture = () => {
        didDragRef.current = false;
    };

    const handleToggleClick = () => {
        if (didDragRef.current) {
            didDragRef.current = false;
            return;
        }
        setIsOpen(!isOpen);
    };

    // 动作参数状态
    const [moveArgs, setMoveArgs] = useState<Record<string, string>>({});
    
    
    // 状态复制/赋值
    const [copySuccess, setCopySuccess] = useState<boolean>(false);
    const [stateInput, setStateInput] = useState<string>('');
    const [showStateInput, setShowStateInput] = useState<boolean>(false);
    const [applyError, setApplyError] = useState<string | null>(null);
    
    const handleCopyState = useCallback(async () => {
        try {
            await navigator.clipboard.writeText(JSON.stringify(G, null, 2));
            setCopySuccess(true);
            setTimeout(() => setCopySuccess(false), 2000);
        } catch (err) {
            console.error('复制失败:', err);
        }
    }, [G]);
    
    const handleApplyState = useCallback(() => {
        if (!moves.SYS_CHEAT_SET_STATE) {
            setApplyError('此游戏不支持状态赋值');
            setTimeout(() => setApplyError(null), 3000);
            return;
        }
        try {
            const newState = JSON.parse(stateInput);
            moves.SYS_CHEAT_SET_STATE({ state: newState });
            setStateInput('');
            setShowStateInput(false);
            setApplyError(null);
        } catch (err) {
            setApplyError('JSON 格式错误');
            setTimeout(() => setApplyError(null), 3000);
        }
    }, [stateInput, moves]);

    // 监听当前玩家变化，实现自动切换视角
    // 优先使用领域内核的当前玩家字段（G.core.currentPlayer），回退到 ctx.currentPlayer
    const coreCurrentPlayer = G?.core?.currentPlayer as string | undefined;
    const activePlayer = coreCurrentPlayer ?? ctx.currentPlayer;
    useEffect(() => {
        if (!autoSwitch) return;
        if (activePlayer && activePlayer !== playerID) {
            // 延迟切换，让用户看到上一步的结果
            const timer = setTimeout(() => {
                setPlayerID(activePlayer);
            }, 500);
            return () => clearTimeout(timer);
        }
    }, [activePlayer, setPlayerID, playerID, autoSwitch]);

    // 早期返回必须在所有 hooks 之后
    if (!import.meta.env.DEV) return null;
    if (!buttonPosition) return null;

    const handleArgChange = (moveName: string, value: string) => {
        setMoveArgs(prev => ({ ...prev, [moveName]: value }));
    };

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
            {/* 浮动切换按钮 - 可拖拽 */}
            <motion.div
                drag
                dragMomentum={false}
                onDragStart={handleDragStart}
                onDragEnd={handleDragEnd}
                onPointerDownCapture={handlePointerDownCapture}
                style={{
                    position: 'fixed',
                    left: buttonPosition.left,
                    top: buttonPosition.top,
                    x: dragX,
                    y: dragY,
                    width: DEBUG_BUTTON_SIZE,
                    height: DEBUG_BUTTON_SIZE,
                }}
                className="z-[9999] cursor-grab active:cursor-grabbing"
                data-testid="debug-toggle-container"
            >
                <div
                    onClick={handleToggleClick}
                    className="w-full h-full bg-gray-900 text-white rounded-md shadow-lg flex items-center justify-center hover:bg-gray-800 border border-gray-700 text-xl select-none"
                    title={t('debug.toggleTitle')}
                    data-testid="debug-toggle"
                >
                    {isOpen ? '✕' : '🛠️'}
                </div>
            </motion.div>

            {/* 主面板 */}
            {isOpen && (
                <div
                    className="fixed top-20 right-4 bottom-24 w-96 bg-white shadow-2xl rounded-xl border border-gray-200 z-[9998] flex flex-col overflow-hidden font-mono text-sm ring-1 ring-black/5"
                    data-testid="debug-panel"
                >
                    {/* 页眉 */}
                    <div className="bg-gray-100 p-3 border-b border-gray-200 flex justify-between items-center">
                        <h3 className="font-bold text-gray-900 flex items-center gap-2">
                            <span>{t('debug.panelTitle')}</span>
                        </h3>
                        <div className="flex gap-1 bg-white p-1 rounded-lg border border-gray-200 shadow-sm">
                            <span className="text-xs px-2 py-1 text-gray-700 font-bold select-none">{t('debug.viewLabel')}</span>
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
                            data-testid="debug-tab-actions"
                            onClick={() => setActiveTab('actions')}
                            className={`flex-1 py-2.5 text-center text-xs font-bold transition-colors ${activeTab === 'actions' ? 'text-blue-600 border-b-2 border-blue-600 bg-blue-50/30' : 'text-gray-700 hover:bg-gray-50 hover:text-gray-900'}`}
                        >
                            {t('debug.tabs.actions')}
                        </button>
                        <button
                            data-testid="debug-tab-state"
                            onClick={() => setActiveTab('state')}
                            className={`flex-1 py-2.5 text-center text-xs font-bold transition-colors ${activeTab === 'state' ? 'text-blue-600 border-b-2 border-blue-600 bg-blue-50/30' : 'text-gray-700 hover:bg-gray-50 hover:text-gray-900'}`}
                        >
                            {t('debug.tabs.state')}
                        </button>
                        <button
                            data-testid="debug-tab-controls"
                            onClick={() => setActiveTab('controls')}
                            className={`flex-1 py-2.5 text-center text-xs font-bold transition-colors ${activeTab === 'controls' ? 'text-blue-600 border-b-2 border-blue-600 bg-blue-50/30' : 'text-gray-700 hover:bg-gray-50 hover:text-gray-900'}`}
                        >
                            {t('debug.tabs.controls')}
                        </button>
                    </div>

                    {/* 内容区域 */}
                    <div className="flex-1 overflow-y-auto p-4 custom-scrollbar bg-gray-50/30">
                        {/* 动作选项卡 */}
                        {activeTab === 'actions' && (
                            <div className="space-y-3">
                                <div className="space-y-3">
                                    <h4 className="text-[10px] font-black text-gray-700 uppercase tracking-widest flex items-center gap-2">
                                        <span className="w-full h-px bg-gray-200"></span>
                                        {t('debug.sections.moves')}
                                        <span className="w-full h-px bg-gray-200"></span>
                                    </h4>
                                    <div className="flex flex-col gap-3">
                                        {Object.keys(moves).filter(name => !name.startsWith('SYS_')).map((moveName) => (
                                            <div key={moveName} className="bg-white p-2 rounded-lg border border-gray-200 shadow-sm group hover:border-blue-300 transition-colors">
                                                <div className="flex justify-between items-center mb-2">
                                                    <span className="font-bold text-gray-900 text-xs">{t(`debug.moves.${moveName}`, moveName)}</span>
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
                                                    className="w-full px-2 py-1.5 text-xs border border-gray-200 rounded bg-gray-50 text-gray-900 focus:bg-white focus:border-blue-500 focus:ring-1 focus:ring-blue-500 outline-none transition-all placeholder:text-gray-400"
                                                />
                                            </div>
                                        ))}
                                        {Object.keys(moves).length === 0 && (
                                            <p className="text-gray-600 italic text-xs text-center py-2">{t('debug.actions.empty')}</p>
                                        )}
                                    </div>
                                </div>

                                <div className="space-y-3">
                                    <h4 className="text-[10px] font-black text-gray-700 uppercase tracking-widest flex items-center gap-2">
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
                                        <span className="text-gray-700 font-bold">{t('debug.state.phase')}</span>
                                        <span className="font-mono bg-purple-100 text-purple-700 px-1.5 rounded">{ctx.phase}</span>
                                    </div>
                                    <div className="flex justify-between text-xs border-b border-gray-100 pb-2">
                                        <span className="text-gray-700 font-bold">{t('debug.state.turn')}</span>
                                        <span className="font-mono bg-blue-100 text-blue-700 px-1.5 rounded">{ctx.turn}</span>
                                    </div>
                                    <div className="flex justify-between text-xs pt-1">
                                        <span className="text-gray-700 font-bold">{t('debug.state.activePlayer')}</span>
                                        <span className="font-mono bg-green-100 text-green-700 px-1.5 rounded">{ctx.currentPlayer}</span>
                                    </div>
                                </div>

                                <div className="space-y-2">
                                    <div className="flex items-center justify-between">
                                        <h4 className="text-[10px] font-bold text-gray-700 uppercase tracking-wider">{t('debug.state.gameState')}</h4>
                                        <div className="flex gap-1">
                                            <button
                                                data-testid="debug-state-copy"
                                                onClick={handleCopyState}
                                                className={`px-2 py-1 text-[10px] font-bold rounded transition-all ${
                                                    copySuccess
                                                        ? 'bg-green-500 text-white'
                                                        : 'bg-gray-200 text-gray-600 hover:bg-gray-300'
                                                }`}
                                            >
                                                {copySuccess ? '✓ 已复制' : '📋 复制'}
                                            </button>
                                            <button
                                                data-testid="debug-state-toggle-input"
                                                onClick={() => setShowStateInput(!showStateInput)}
                                                className={`px-2 py-1 text-[10px] font-bold rounded transition-all ${
                                                    showStateInput
                                                        ? 'bg-blue-500 text-white'
                                                        : 'bg-gray-200 text-gray-600 hover:bg-gray-300'
                                                }`}
                                            >
                                                {showStateInput ? '✕ 取消' : '📝 赋值'}
                                            </button>
                                        </div>
                                    </div>
                                    
                                    {/* 赋值输入区域 */}
                                    {showStateInput && (
                                        <div className="bg-blue-50 p-2 rounded-lg border border-blue-200 space-y-2">
                                            <textarea
                                                data-testid="debug-state-input"
                                                value={stateInput}
                                                onChange={(e) => setStateInput(e.target.value)}
                                                placeholder="粘贴游戏状态 JSON..."
                                                className="w-full h-32 px-2 py-1.5 text-[10px] font-mono border border-blue-300 rounded bg-white resize-none focus:outline-none focus:ring-1 focus:ring-blue-500"
                                            />
                                            <div className="flex gap-2">
                                                <button
                                                    data-testid="debug-state-paste"
                                                    onClick={async () => {
                                                        try {
                                                            const text = await navigator.clipboard.readText();
                                                            setStateInput(text);
                                                        } catch (err) {
                                                            console.error('粘贴失败:', err);
                                                        }
                                                    }}
                                                    className="flex-1 px-2 py-1.5 bg-gray-500 text-white rounded text-[10px] font-bold hover:bg-gray-600"
                                                >
                                                    📋 从剪贴板粘贴
                                                </button>
                                                <button
                                                    data-testid="debug-state-apply"
                                                    onClick={handleApplyState}
                                                    disabled={!stateInput.trim()}
                                                    className="flex-1 px-2 py-1.5 bg-blue-500 text-white rounded text-[10px] font-bold hover:bg-blue-600 disabled:opacity-50 disabled:cursor-not-allowed"
                                                >
                                                    ✓ 应用状态
                                                </button>
                                            </div>
                                            {applyError && (
                                                <p className="text-[10px] text-red-600 font-bold">{applyError}</p>
                                            )}
                                        </div>
                                    )}
                                    
                                    <pre
                                        data-testid="debug-state-json"
                                        className="text-[10px] leading-relaxed bg-gray-900 text-green-400 p-3 rounded-lg overflow-x-auto border border-gray-800 font-mono shadow-inner max-h-[300px]"
                                    >
                                        {JSON.stringify(G, null, 2)}
                                    </pre>
                                </div>
                            </div>
                        )}

                        {/* 系统选项卡 */}
                        {activeTab === 'controls' && (
                            <div className="space-y-4">
                                {/* 游戏专属调试工具 */}
                                {children && (
                                    <div className="space-y-3">
                                        {children}
                                    </div>
                                )}

                                <button
                                    disabled={isCreatingRoom}
                                    onClick={async () => {
                                        const isOnline = gameMode?.mode === 'online';
                                        
                                        if (isOnline && gameId) {
                                            // 联机模式：先广播新房间，然后创建并跳转
                                            setIsCreatingRoom(true);
                                            try {
                                                const playerName = user?.username || getGuestName();
                                                const guestId = user?.id ? undefined : getGuestId();
                                                
                                                // 1. 创建新房间
                                                const { matchID: newMatchID } = await lobbyClient.createMatch(
                                                    gameId,
                                                    { numPlayers: 2, setupData: guestId ? { guestId } : undefined },
                                                    token ? { headers: { Authorization: `Bearer ${token}` } } : undefined
                                                );
                                                const { playerCredentials: newCredentials } = await lobbyClient.joinMatch(gameId, newMatchID, {
                                                    playerID: '0',
                                                    playerName,
                                                });
                                                
                                                // 2. 广播新房间地址给其他玩家（在跳转前广播）
                                                const newRoomUrl = `/play/${gameId}/match/${newMatchID}`;
                                                matchSocket.broadcastNewRoom(newRoomUrl);
                                                
                                                // 3. 退出旧房间并准备延迟销毁（如果有凭据）
                                                let oldCredentials: string | null = null;
                                                if (currentMatchId && currentPlayerID) {
                                                    const storedCreds = localStorage.getItem(`match_creds_${currentMatchId}`);
                                                    if (storedCreds) {
                                                        try {
                                                            const parsed = JSON.parse(storedCreds) as { credentials?: string } | null;
                                                            oldCredentials = parsed?.credentials ?? null;
                                                            if (oldCredentials) {
                                                                await lobbyClient.leaveMatch(gameId, currentMatchId, {
                                                                    playerID: currentPlayerID,
                                                                    credentials: oldCredentials,
                                                                });
                                                            }
                                                        } catch {
                                                        }
                                                        localStorage.removeItem(`match_creds_${currentMatchId}`);
                                                    }
                                                }

                                                if (currentMatchId && currentPlayerID && oldCredentials) {
                                                    const delayMs = 8000;
                                                    window.setTimeout(() => {
                                                        void destroyMatch(gameId, currentMatchId, currentPlayerID, oldCredentials as string);
                                                    }, delayMs);
                                                }
                                                
                                                // 4. 保存新凭据
                                                persistMatchCredentials(newMatchID, {
                                                    playerID: '0',
                                                    credentials: newCredentials,
                                                    matchID: newMatchID,
                                                    gameName: gameId,
                                                    playerName,
                                                });
                                                
                                                // 5. 跳转到新房间
                                                navigate(`${newRoomUrl}?playerID=0`);
                                            } catch (error) {
                                                console.error('[Reset] 创建房间失败:', error);
                                            } finally {
                                                setIsCreatingRoom(false);
                                            }
                                        } else {
                                            // 本地模式：生成新种子并导航到新房间
                                            const newSeed = `${Date.now()}-${Math.random().toString(36).slice(2)}`;
                                            const currentPath = window.location.pathname;
                                            const newUrl = `${currentPath}?seed=${newSeed}`;
                                            window.location.href = newUrl;
                                        }
                                    }}
                                    className="w-full py-3 bg-red-600 hover:bg-red-700 disabled:bg-red-400 text-white rounded-lg shadow-md font-bold text-xs flex items-center justify-center gap-2 transition-all active:scale-95"
                                >
                                    {isCreatingRoom ? t('debug.reset.creating') : (gameMode?.mode === 'online' ? t('debug.reset.newRoom') : t('debug.reset.button'))}
                                </button>

                                <div className="bg-blue-50 p-4 rounded-lg text-xs text-blue-700 border border-blue-100">
                                    <p className="mb-2 font-bold">{t('debug.reset.hintTitle')}</p>
                                    <p>{t('debug.reset.hintDescription')}</p>
                                </div>
                            </div>
                        )}
                    </div>
                </div>
            )}
        </>
    );
};

export default GameDebugPanel;
