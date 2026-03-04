/**
 * 测试模式对局页面
 * 
 * 专门用于 E2E 测试的对局页面，提供：
 * 1. 跳过派系选择 - 通过 URL 参数直接指定派系
 * 2. 确定性随机 - 通过 URL 参数设置随机种子
 * 3. 快速场景构建 - 通过 TestHarness 注入状态
 * 
 * URL 格式：
 * /play/:gameId/test?p0=faction1,faction2&p1=faction3,faction4&seed=12345
 * 
 * 示例：
 * /play/smashup/test?p0=wizards,aliens&p1=zombies,pirates&seed=12345
 */

import React, { useEffect, useState, useMemo } from 'react';
import { useParams, useSearchParams } from 'react-router-dom';
import { loadGameImplementation, getGameImplementation } from '../games/registry';
import { GameModeProvider } from '../contexts/GameModeContext';
import { getGameById } from '../config/games.config';
import { GameHUD } from '../components/game/framework/widgets/GameHUD';
import { GameCursorProvider } from '../core/cursor/GameCursorProvider';
import { LocalGameProvider, BoardBridge } from '../engine/transport/react';
import { LoadingScreen } from '../components/system/LoadingScreen';
import { SEO } from '../components/common/SEO';
import { enableTestMode } from '../engine/testing/environment';

// 启用测试模式（必须在组件外部调用，确保在任何 Provider 渲染前生效）
if (typeof window !== 'undefined') {
    enableTestMode();
}

export const TestMatchRoom: React.FC = () => {
    const { gameId } = useParams<{ gameId: string }>();
    const [searchParams] = useSearchParams();
    const [engineConfig, setEngineConfig] = useState<any>(null);
    const [WrappedBoard, setWrappedBoard] = useState<React.ComponentType<any> | null>(null);
    const [loading, setLoading] = useState(true);

    const gameConfig = gameId ? getGameById(gameId) : null;

    // 解析 URL 参数
    const testConfig = useMemo(() => {
        const p0Factions = searchParams.get('p0')?.split(',') || [];
        const p1Factions = searchParams.get('p1')?.split(',') || [];
        const seed = searchParams.get('seed') || '12345';
        const numPlayers = parseInt(searchParams.get('numPlayers') || '2', 10);
        const skipFactionSelect = searchParams.get('skipFactionSelect') === 'true';
        const skipInitialization = searchParams.get('skipInitialization') === 'true';
        
        return {
            player0Factions: p0Factions,
            player1Factions: p1Factions,
            randomSeed: seed,
            numPlayers,
            skipFactionSelect,
            skipInitialization,
        };
    }, [searchParams]);

    useEffect(() => {
        if (!gameId) return;

        const loadGame = async () => {
            console.log('[TestMatchRoom] 开始加载游戏:', gameId);
            try {
                setLoading(true);
                console.log('[TestMatchRoom] 调用 loadGameImplementation');
                await loadGameImplementation(gameId);
                console.log('[TestMatchRoom] loadGameImplementation 完成');
                
                console.log('[TestMatchRoom] 调用 getGameImplementation');
                const impl = getGameImplementation(gameId);
                console.log('[TestMatchRoom] getGameImplementation 结果:', {
                    hasImpl: !!impl,
                    hasEngineConfig: !!impl?.engineConfig,
                    hasBoard: !!impl?.board,
                });

                if (!impl) {
                    console.error(`[TestMatchRoom] 游戏实现未找到: ${gameId}`);
                    return;
                }

                console.log('[TestMatchRoom] 设置 engineConfig 和 board');
                setEngineConfig(impl.engineConfig);
                setWrappedBoard(() => impl.board);
                
                console.log('[TestMatchRoom] 游戏实现已加载');
            } catch (error) {
                console.error(`[TestMatchRoom] 加载游戏失败:`, error);
                console.error(`[TestMatchRoom] 错误堆栈:`, (error as Error).stack);
            } finally {
                console.log('[TestMatchRoom] 加载完成，设置 loading=false');
                setLoading(false);
            }
        };

        loadGame();
    }, [gameId, testConfig]);

    // 注入测试配置到 window（供 TestHarness 使用）
    useEffect(() => {
        if (typeof window === 'undefined') return;
        
        const holder = window as Window & { __BG_TEST_CONFIG__?: typeof testConfig };
        holder.__BG_TEST_CONFIG__ = testConfig;
        
        console.log('[TestMatchRoom] 测试配置已注入:', testConfig);
        
        return () => {
            holder.__BG_TEST_CONFIG__ = undefined;
        };
    }, [testConfig]);

    // 自动完成派系选择（如果 URL 参数中指定了派系且未启用 skipFactionSelect）
    // 注意：如果 skipFactionSelect=true，LocalGameProvider 会直接创建游戏开始状态，无需此逻辑
    useEffect(() => {
        if (typeof window === 'undefined') return;
        if (!testConfig.player0Factions.length && !testConfig.player1Factions.length) return;
        // 如果启用了 skipFactionSelect，跳过自动派系选择（LocalGameProvider 已处理）
        if (testConfig.skipFactionSelect) {
            console.log('[TestMatchRoom] skipFactionSelect=true，跳过自动派系选择逻辑');
            return;
        }
        // 等待游戏加载完成
        if (loading || !engineConfig || !WrappedBoard) return;
        
        // 等待 TestHarness 就绪
        const checkAndAutoSelect = async () => {
            const harness = (window as any).__BG_TEST_HARNESS__;
            if (!harness || !harness.command.isRegistered()) {
                console.log('[TestMatchRoom] TestHarness 未就绪，等待...');
                return;
            }
            
            // 检查当前状态
            const state = harness.state.get();
            if (!state || !state.core) {
                console.log('[TestMatchRoom] 状态未就绪');
                return;
            }
            
            // 原有的自动派系选择逻辑（逐个等待）
            if (!state.core.factionSelection) {
                console.log('[TestMatchRoom] 状态未就绪或已完成派系选择');
                return;
            }
            
            // 检查是否已经完成派系选择
            if (state.sys.phase !== 'factionSelect') {
                console.log('[TestMatchRoom] 已不在派系选择阶段，跳过自动选择');
                return;
            }
            
            console.log('[TestMatchRoom] 开始自动派系选择');
            
            // 蛇形选秀顺序（SmashUp 规则）：P0 → P1 → P1 → P0
            const selectionOrder: Array<{ playerId: string; factionIndex: number }> = [];
            selectionOrder.push({ playerId: '0', factionIndex: 0 });
            selectionOrder.push({ playerId: '1', factionIndex: 0 });
            selectionOrder.push({ playerId: '1', factionIndex: 1 });
            selectionOrder.push({ playerId: '0', factionIndex: 1 });
            
            // 按顺序执行选择
            for (const { playerId, factionIndex } of selectionOrder) {
                const factions = playerId === '0' ? testConfig.player0Factions : testConfig.player1Factions;
                const factionId = factions[factionIndex];
                
                if (!factionId) {
                    console.warn(`[TestMatchRoom] 玩家 ${playerId} 的第 ${factionIndex + 1} 个派系未指定，跳过`);
                    continue;
                }
                
                console.log(`[TestMatchRoom] 玩家 ${playerId} 选择派系 ${factionIndex + 1}: ${factionId}`);
                await harness.command.dispatch({
                    type: 'su:select_faction',
                    payload: { factionId }
                });
                
                // 等待状态更新
                await new Promise(resolve => setTimeout(resolve, 100));
            }
            
            console.log('[TestMatchRoom] 派系选择完成');
        };
        
        // 延迟执行，确保 LocalGameProvider 已经注册 TestHarness
        const timer = setTimeout(checkAndAutoSelect, 1000);
        
        return () => clearTimeout(timer);
    }, [testConfig, loading, engineConfig, WrappedBoard]);

    if (!gameId || !gameConfig) {
        return (
            <div className="w-full h-full flex items-center justify-center text-white/50">
                游戏未找到
            </div>
        );
    }

    if (loading) {
        return <LoadingScreen title={gameConfig ? `加载 ${gameConfig.title}...` : '加载中...'} />;
    }

    if (!engineConfig || !WrappedBoard) {
        console.log('[TestMatchRoom] 游戏加载失败:', { engineConfig: !!engineConfig, WrappedBoard: !!WrappedBoard });
        return (
            <div className="w-full h-full flex items-center justify-center text-white/50">
                游戏加载失败
            </div>
        );
    }
    
    console.log('[TestMatchRoom] 准备渲染:', {
        engineConfig: !!engineConfig,
        WrappedBoard: !!WrappedBoard,
    });

    return (
        <>
            <SEO
                title={`${gameConfig.title} - 测试模式`}
                description={`${gameConfig.title} E2E 测试模式`}
            />
            <div
                className="w-full h-full relative overflow-hidden"
                style={{
                    background: gameConfig.theme?.background || 'linear-gradient(135deg, #1a1a2e 0%, #16213e 100%)',
                } as React.CSSProperties}
            >
                <GameModeProvider mode="test">
                    <GameCursorProvider themeId={gameConfig?.cursorTheme} gameId={gameId}>
                    {engineConfig && WrappedBoard ? (
                        <LocalGameProvider 
                            config={engineConfig}
                            numPlayers={testConfig.numPlayers}
                            seed={testConfig.randomSeed}
                            playerId="0"
                        >
                            <GameHUD gameId={gameId} mode="test" />
                            <BoardBridge 
                                board={WrappedBoard}
                                loading={<LoadingScreen title={gameConfig ? `加载 ${gameConfig.title}...` : '加载中...'} />}
                            />
                        </LocalGameProvider>
                    ) : (
                        <LoadingScreen title={gameConfig ? `加载 ${gameConfig.title}...` : '加载中...'} />
                    )}
                    </GameCursorProvider>
                </GameModeProvider>
            </div>
        </>
    );
};
