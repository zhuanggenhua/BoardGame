/**
 * 召唤师战争 - 游戏界面
 */

import React from 'react';
import { useTranslation } from 'react-i18next';
import type { BoardProps } from 'boardgame.io/react';
import type { MatchState } from '../../engine/types';
import type { SummonerWarsCore } from './domain';
import { GameDebugPanel } from '../../components/GameDebugPanel';
import { EndgameOverlay } from '../../components/game/EndgameOverlay';
import { UndoProvider } from '../../contexts/UndoContext';
import { useDebug } from '../../contexts/DebugContext';
import { useTutorial, useTutorialBridge } from '../../contexts/TutorialContext';
import { useRematch } from '../../contexts/RematchContext';
import { useGameMode } from '../../contexts/GameModeContext';

type Props = BoardProps<MatchState<SummonerWarsCore>>;

export const SummonerWarsBoard: React.FC<Props> = ({
    ctx,
    G,
    moves,
    events,
    playerID,
    reset,
    matchData,
    isMultiplayer,
}) => {
    const { t } = useTranslation('game-summonerwars');
    const isGameOver = ctx.gameover;
    const gameMode = useGameMode();
    const isLocalMatch = gameMode ? !gameMode.isMultiplayer : !isMultiplayer;
    const isSpectator = !!gameMode?.isSpectator;

    // 教学系统集成
    useTutorialBridge(G.sys.tutorial, moves as Record<string, unknown>);
    const { isActive } = useTutorial();

    // 重赛系统
    const { state: rematchState, vote: handleRematchVote } = useRematch();

    // TODO: 实现游戏界面
    return (
        <UndoProvider
            value={{
                G,
                ctx,
                moves,
                playerID,
                isGameOver: !!isGameOver,
                isLocalMode: isLocalMatch,
            }}
        >
            <div className="flex flex-col items-center h-[100dvh] w-full bg-gradient-to-br from-slate-900 via-purple-900 to-slate-900 overflow-hidden relative">
                {/* 顶部标题 */}
                <div className="flex-none flex flex-col items-center mt-8 mb-4 z-10">
                    <h1 className="text-4xl md:text-6xl font-black tracking-tight text-white drop-shadow-lg">
                        {t('title')}
                    </h1>
                    <p className="text-sm text-white/60 mt-2">{t('subtitle')}</p>
                </div>

                {/* 游戏主区域 */}
                <div className="flex-1 w-full flex items-center justify-center p-6 min-h-0 relative z-10">
                    <div className="relative w-full h-full max-w-6xl">
                        {/* TODO: 实现游戏棋盘/战场 */}
                        <div className="w-full h-full flex items-center justify-center">
                            <div className="text-white/40 text-2xl">
                                游戏界面开发中...
                            </div>
                        </div>
                    </div>
                </div>

                {/* 底部 HUD */}
                <div className="flex-none w-full max-w-4xl px-8 pb-8 z-10">
                    <div className="flex justify-between items-center">
                        <div className="text-white/80">
                            当前玩家: {ctx.currentPlayer}
                        </div>
                        <div className="text-white/80">回合: {ctx.turn}</div>
                    </div>
                </div>

                {/* 结束页面遮罩 */}
                <EndgameOverlay
                    isGameOver={!!isGameOver}
                    result={isGameOver}
                    playerID={playerID}
                    reset={isSpectator ? undefined : reset}
                    isMultiplayer={isSpectator ? false : isMultiplayer}
                    totalPlayers={matchData?.length}
                    rematchState={rematchState}
                    onVote={isSpectator ? undefined : handleRematchVote}
                />

                {/* 调试面板 */}
                {!isSpectator && (
                    <div className="fixed bottom-0 right-0 p-2 z-50 opacity-0 hover:opacity-100 transition-opacity">
                        <GameDebugPanel
                            G={G}
                            ctx={ctx}
                            moves={moves}
                            events={events}
                            playerID={playerID}
                            autoSwitch={!isMultiplayer}
                        />
                    </div>
                )}
            </div>
        </UndoProvider>
    );
};

export default SummonerWarsBoard;
