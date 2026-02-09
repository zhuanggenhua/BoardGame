import React, { useCallback, useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import type { BoardProps } from 'boardgame.io/react';
import type { MatchState } from '../../engine/types';
import type { TicTacToeCore } from './domain';
import { GameDebugPanel } from '../../components/GameDebugPanel';
import { EndgameOverlay } from '../../components/game/EndgameOverlay';
import { UndoProvider } from '../../contexts/UndoContext';
import { useDebug } from '../../contexts/DebugContext';
import { useTutorial, useTutorialBridge } from '../../contexts/TutorialContext';
import { useRematch } from '../../contexts/RematchContext';
import { useGameMode } from '../../contexts/GameModeContext';
import { motion } from 'framer-motion';
import { useGameAudio, playSound, playDeniedSound } from '../../lib/audio/useGameAudio';
import { TIC_TAC_TOE_AUDIO_CONFIG } from './audio.config';

type Props = BoardProps<MatchState<TicTacToeCore>>;

type LocalScoreboard = {
    xWins: number;
    oWins: number;
};

const LOCAL_SCOREBOARD_KEY = 'tictactoe_scoreboard_v1';

const clearLocalScoreboard = () => {
    try {
        localStorage.removeItem(LOCAL_SCOREBOARD_KEY);
    } catch {
        // ignore
    }
};

const readLocalScoreboard = (): LocalScoreboard => {
    try {
        const raw = localStorage.getItem(LOCAL_SCOREBOARD_KEY);
        if (!raw) return { xWins: 0, oWins: 0 };
        const parsed = JSON.parse(raw) as Partial<LocalScoreboard>;
        return {
            xWins: Number(parsed.xWins) || 0,
            oWins: Number(parsed.oWins) || 0,
        };
    } catch {
        return { xWins: 0, oWins: 0 };
    }
};

const writeLocalScoreboard = (next: LocalScoreboard) => {
    try {
        localStorage.setItem(LOCAL_SCOREBOARD_KEY, JSON.stringify(next));
    } catch {
        // ignore
    }
};



// SVG 图标组件 - X (Premium Neon) - Path Drawing Animation
const IconX = ({ className }: { className?: string }) => (
    <svg viewBox="0 0 24 24" fill="none" className={className} style={{ overflow: 'visible' }}>
        <defs>
            <filter id="glow-x" x="-50%" y="-50%" width="200%" height="200%">
                <feGaussianBlur stdDeviation="1.6" result="coloredBlur" />
                <feMerge>
                    <feMergeNode in="coloredBlur" />
                    <feMergeNode in="SourceGraphic" />
                </feMerge>
            </filter>
        </defs>
        <motion.path
            d="M6 6L18 18"
            stroke="currentColor"
            strokeWidth="1.4"
            strokeLinecap="round"
            initial={{ pathLength: 0 }}
            animate={{ pathLength: 1 }}
            transition={{ duration: 0.35, ease: "easeOut" }}
            style={{ filter: 'url(#glow-x)' }}
        />
        <motion.path
            d="M18 6L6 18"
            stroke="currentColor"
            strokeWidth="1.4"
            strokeLinecap="round"
            initial={{ pathLength: 0 }}
            animate={{ pathLength: 1 }}
            transition={{ duration: 0.35, ease: "easeOut", delay: 0.12 }}
            style={{ filter: 'url(#glow-x)' }}
        />
    </svg>
);

// SVG 图标组件 - O (Premium Neon) - Path Drawing Animation
const IconO = ({ className }: { className?: string }) => (
    <svg viewBox="0 0 24 24" fill="none" className={className} style={{ overflow: 'visible' }}>
        <defs>
            <filter id="glow-o" x="-50%" y="-50%" width="200%" height="200%">
                <feGaussianBlur stdDeviation="1.6" result="coloredBlur" />
                <feMerge>
                    <feMergeNode in="coloredBlur" />
                    <feMergeNode in="SourceGraphic" />
                </feMerge>
            </filter>
        </defs>
        <motion.circle
            cx="12" cy="12" r="7.5"
            stroke="currentColor"
            strokeWidth="1.4"
            strokeLinecap="round"
            initial={{ pathLength: 0 }}
            animate={{ pathLength: 1.01 }}
            transition={{ duration: 0.5, ease: "easeInOut" }}
            style={{ filter: 'url(#glow-o)' }}
            transform="rotate(-90 12 12)"
        />
    </svg>
);

export const TicTacToeBoard: React.FC<Props> = ({ ctx, G, moves, events, playerID, reset, matchData, isMultiplayer }) => {
    const isGameOver = ctx.gameover;
    const isWinner = isGameOver?.winner !== undefined;
    const coreCurrentPlayer = G.core.currentPlayer;
    const currentPlayer = coreCurrentPlayer ?? ctx.currentPlayer;
    const gameMode = useGameMode();
    const isLocalMatch = gameMode ? !gameMode.isMultiplayer : !isMultiplayer;
    const isSpectator = !!gameMode?.isSpectator;
    const isTutorialMode = gameMode?.mode === 'tutorial';
    const isPlayerTurn = isLocalMatch || (!isSpectator && currentPlayer === playerID);
    const { t } = useTranslation('game-tictactoe');

    // 本地同屏(hotseat)模式：开始一局时清空本机累计，避免上一轮对战/联机残留造成“离谱分数”。
    // 注意：多人联机的“再来一局”可能是新 match；我们只在本地同屏下清理。
    const isHotseatLocal = isLocalMatch;
    const didClearOnStartRef = useRef(false);

    const [scoreboard, setScoreboard] = useState<LocalScoreboard>(() => {
        if (isHotseatLocal && !didClearOnStartRef.current) {
            didClearOnStartRef.current = true;
            clearLocalScoreboard();
            return { xWins: 0, oWins: 0 };
        }
        return readLocalScoreboard();
    });

    // 获取玩家名称的辅助函数
    const getPlayerName = (pid: string) => {
        if (matchData) {
            const player = matchData.find(p => String(p.id) === pid);
            if (player?.name) return player.name;
        }
        return t('player.guest', { number: Number(pid) + 1 });
    };

    // 教学系统集成
    useTutorialBridge(G.sys.tutorial, moves as Record<string, unknown>);
    const { isActive, currentStep } = useTutorial();
    const { setPlayerID } = useDebug();

    // 重赛系统（多人模式使用 socket）
    const { state: rematchState, vote: handleRematchVote, registerReset } = useRematch();

    // 注册 reset 回调（当双方都投票后由 socket 触发）
    useEffect(() => {
        if (isMultiplayer && reset) {
            registerReset(reset);
        }
    }, [isMultiplayer, reset, registerReset]);

    // 音效系统
    useGameAudio({
        config: TIC_TAC_TOE_AUDIO_CONFIG,
        G: G.core,
        ctx,
        eventEntries: G.sys.eventStream.entries,
    });


    // 追踪先前的激活状态（必须在顶层）
    const previousActiveRef = useRef(isActive);
    const isGameOverRef = useRef(isGameOver);
    const cellsRef = useRef(G.core.cells);
    const didCountResultRef = useRef(false);

    const getWinningLine = (cells: (string | null)[]) => {
        if (!isWinner) return null;
        const positions = [
            [0, 1, 2], [3, 4, 5], [6, 7, 8],
            [0, 3, 6], [1, 4, 7], [2, 5, 8],
            [0, 4, 8], [2, 4, 6]
        ];
        for (const pos of positions) {
            const [a, b, c] = pos;
            if (cells[a] && cells[a] === cells[b] && cells[a] === cells[c]) {
                return pos;
            }
        }
        return null;
    };

    const winningLine = getWinningLine(G.core.cells);

    useEffect(() => {
        isGameOverRef.current = isGameOver;
    }, [isGameOver]);

    useEffect(() => {
        if (!isGameOver) {
            didCountResultRef.current = false;
            return;
        }
        if (didCountResultRef.current) return;

        const winner = isGameOver?.winner;
        const next: LocalScoreboard = { ...scoreboard };
        if (String(winner) === '0') {
            next.xWins += 1;
        } else if (String(winner) === '1') {
            next.oWins += 1;
        }

        didCountResultRef.current = true;
        setScoreboard(next);
        writeLocalScoreboard(next);
    }, [isGameOver, scoreboard]);

    useEffect(() => {
        cellsRef.current = G.core.cells;
    }, [G.core.cells]);

    useEffect(() => {
        if (!isActive) return;
        if (currentPlayer === null || currentPlayer === undefined) return;
        if (playerID !== currentPlayer) {
            setPlayerID(currentPlayer);
        }
    }, [isActive, currentPlayer, playerID, setPlayerID]);

    const resetGame = useCallback(() => {
        if (typeof reset === 'function') {
            reset();
        } else {
            window.location.reload();
        }
    }, [reset]);

    const onClick = (id: number) => {
        if (isGameOver) return;
        if (G.core.cells[id] !== null) return;
        if (isSpectator) {
            if (import.meta.env.DEV) {
                console.warn('[Spectate][TicTacToe] blocked click', { id, playerID, currentPlayer });
            }
            return;
        }

        if (!isPlayerTurn) {
            playDeniedSound();
            return;
        }

        playSound('ui.general.khron_studio_rpg_interface_essentials_inventory_dialog_ucs_system_192khz.dialog.dialog_choice.uiclick_dialog_choice_01_krst_none');

        if (isActive) {
            if (currentStep?.requireAction) {
                const targetId = `cell-${id}`;
                if (currentStep.highlightTarget && currentStep.highlightTarget !== targetId) return;

                moves.CLICK_CELL({ cellId: id });
            } else {
                return;
            }
        } else {
            moves.CLICK_CELL({ cellId: id });
        }
    };

    useEffect(() => {
        if (!previousActiveRef.current && isActive) {
            if (!isTutorialMode) {
                resetGame();
            }
        }

        if (previousActiveRef.current && !isActive && (ctx.turn > 0 || ctx.gameover != null)) {
            if (!isTutorialMode) {
                setTimeout(() => resetGame(), 300);
            }
        }
        previousActiveRef.current = isActive;
    }, [isActive, ctx.turn, ctx.gameover, isTutorialMode, resetGame]);

    return (
        <UndoProvider value={{ G, ctx, moves, playerID, isGameOver: !!isGameOver, isLocalMode: isLocalMatch }}>
            <div className="flex flex-col items-center h-[100dvh] w-full font-sans bg-black overflow-hidden relative pt-[env(safe-area-inset-top)] pb-[env(safe-area-inset-bottom)] select-none">

                {/* 增加一个径向渐变使光晕分布更自然 (放底层) */}
                <div className="absolute inset-0 bg-[radial-gradient(circle_at_center,_rgba(0,0,0,0)_0%,_rgba(0,0,0,0.8)_100%)] pointer-events-none z-0"></div>

                {/* 噪声纹理背景 - 提升不透明度并在渐变之上以确保可见 */}
                <div className="absolute inset-0 opacity-[0.20] pointer-events-none z-0 mix-blend-screen" style={{
                    backgroundImage: `url("data:image/svg+xml,%3Csvg viewBox='0 0 400 400' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='noiseFilter'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.75' numOctaves='3' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23noiseFilter)'/%3E%3C/svg%3E")`,
                    backgroundRepeat: 'repeat'
                }}></div>

                {/* 顶部标题 - 霞红青色交错的现代风格 */}
                <div className="flex-none flex flex-col items-center mt-8 mb-4 z-10">
                    <h1 className="text-4xl md:text-6xl font-black italic tracking-tight flex items-center gap-1">
                        <span className="text-neon-blue drop-shadow-[0_0_15px_rgba(0,243,255,0.7)]">
                            {t('title.primary')}
                        </span>
                        <span className="text-neon-pink drop-shadow-[0_0_15px_rgba(188,19,254,0.7)]">
                            {t('title.secondary')}
                        </span>
                    </h1>
                </div>

                {/* 棋盘主区域 - 移除边框，保留空间结构 */}
                <div className="flex-1 w-full flex items-center justify-center p-6 min-h-0 relative z-10">
                    <div className="relative aspect-square h-full max-h-[80vw] md:max-h-[60vh] max-w-full p-4">

                        {/* 核心网格线：SVG 路径实现，支持绘制动画且线条粗细与棋子完美平衡 */}
                        <div className="absolute inset-6 pointer-events-none z-10">
                            <svg viewBox="0 0 100 100" className="w-full h-full overflow-visible">
                                <style>{`
                                    .grid-line {
                                        stroke-dasharray: 100;
                                        stroke-dashoffset: 100;
                                        animation: grid-draw 0.8s cubic-bezier(0.16, 1, 0.3, 1) forwards;
                                    }
                                    @keyframes grid-draw {
                                        to { stroke-dashoffset: 0; }
                                    }
                                `}</style>
                                {/* 左竖线 - 粉色 */}
                                <line
                                    x1="33.33" y1="2" x2="33.33" y2="98"
                                    stroke="#BC13FE" strokeWidth="1.2" strokeLinecap="round"
                                    className="grid-line" style={{ animationDelay: '0.1s', filter: 'drop-shadow(0 0 5px rgba(188,19,254,0.8))' }}
                                />
                                {/* 右竖线 - 青色 */}
                                <line
                                    x1="66.66" y1="2" x2="66.66" y2="98"
                                    stroke="#00F3FF" strokeWidth="1.2" strokeLinecap="round"
                                    className="grid-line" style={{ animationDelay: '0.2s', filter: 'drop-shadow(0 0 5px rgba(0,243,255,0.8))' }}
                                />
                                {/* 上横线 - 粉色 */}
                                <line
                                    x1="2" y1="33.33" x2="98" y2="33.33"
                                    stroke="#BC13FE" strokeWidth="1.2" strokeLinecap="round"
                                    className="grid-line" style={{ animationDelay: '0.3s', filter: 'drop-shadow(0 0 5px rgba(188,19,254,0.8))' }}
                                />
                                {/* 下横线 - 青色 */}
                                <line
                                    x1="2" y1="66.66" x2="98" y2="66.66"
                                    stroke="#00F3FF" strokeWidth="1.2" strokeLinecap="round"
                                    className="grid-line" style={{ animationDelay: '0.4s', filter: 'drop-shadow(0 0 5px rgba(0,243,255,0.8))' }}
                                />
                            </svg>
                        </div>

                        {/* 棋子层 - 提升 z-index 确保可点击，并使用 inset-0 配合父级的 p-4 */}
                        <div className="grid grid-cols-3 grid-rows-3 h-full w-full absolute inset-0 p-4 z-20">
                            {G.core.cells.map((cell: string | null, id: number) => {
                                const isWinningCell = winningLine?.includes(id);
                                const isOccupied = cell !== null;
                                const isTutorialTarget = isActive && currentStep?.highlightTarget === `cell-${id}`;
                                const isClickable = !isOccupied && !isGameOver && isPlayerTurn && (!isActive || (currentStep?.requireAction && (!currentStep.highlightTarget || currentStep.highlightTarget === `cell-${id}`)));

                                // 动态光晕颜色 (匹配图片：X为粉，O为青)
                                const glowColor = cell === '0' ? 'rgba(188,19,254,' : 'rgba(0,243,255,';
                                const dynamicGlow = isWinningCell
                                    ? `drop-shadow-[0_0_20px_${glowColor}1)] drop-shadow-[0_0_40px_${glowColor}0.8)]`
                                    : `drop-shadow-[0_0_10px_${glowColor}0.6)]`;

                                return (
                                    <div
                                        key={id}
                                        data-tutorial-id={`cell-${id}`}
                                        onClick={() => onClick(id)}
                                        className={`
                                            flex items-center justify-center relative
                                            ${isClickable ? 'cursor-pointer transition-colors duration-200' : ''}
                                            ${isTutorialTarget ? 'z-[10000] ring-2 ring-white' : ''}
                                        `}
                                    >
                                        <div className={`
                                            w-3/5 h-3/5 flex items-center justify-center 
                                            ${isWinningCell ? 'scale-110 brightness-150 transition-all duration-300' : ''}
                                            ${cell === '0' ? 'text-neon-pink' : 'text-neon-blue'}
                                            ${isOccupied ? dynamicGlow : ''}
                                        `}>
                                            {cell === '0' && <IconX className="w-full h-full" />}
                                            {cell === '1' && <IconO className="w-full h-full" />}
                                        </div>
                                    </div>
                                );
                            })}
                        </div>
                    </div>
                </div>

                {/* 底部 HUD 仪表盘 */}
                <div className="flex-none w-full max-w-2xl px-8 pb-12 z-10">
                    <div className="relative flex justify-between items-end">

                        {/* 左侧玩家 P0 (X - Pink) */}
                        <div className={`flex flex-col items-center gap-2 transition-opacity duration-300 ${String(currentPlayer) === '0' || isGameOver ? 'opacity-100' : 'opacity-40'}`}>
                            <div className="text-neon-pink font-bold tracking-widest text-xs md:text-sm uppercase mb-1">
                                {getPlayerName('0')}
                            </div>
                            <IconX className="w-8 h-8 md:w-10 md:h-10 text-neon-pink drop-shadow-[0_0_8px_rgba(188,19,254,0.5)]" />
                            <div className="text-3xl md:text-4xl font-black text-neon-pink mt-2 leading-none">
                                {scoreboard.xWins}
                            </div>
                        </div>

                        {/* 中间状态栏 */}
                        <div className="flex-1 flex flex-col items-center justify-end pb-2">
                            {isGameOver ? (
                                <div className="text-xl md:text-2xl font-black italic text-white tracking-widest animate-pulse whitespace-nowrap drop-shadow-lg">
                                    {isWinner ?
                                        (String(ctx.gameover.winner) === '0'
                                            ? <span className="text-neon-pink">{t('status.win', { player: getPlayerName('0') })}</span>
                                            : <span className="text-neon-blue">{t('status.win', { player: getPlayerName('1') })}</span>)
                                        : t('status.draw')
                                    }
                                </div>
                            ) : (
                                <div className="flex flex-col items-center">
                                    <div className="flex items-baseline gap-2 mb-2">
                                        <span className={`text-2xl md:text-3xl font-black italic tracking-wider ${String(currentPlayer) === '0' ? 'text-neon-pink drop-shadow-[0_0_15px_rgba(188,19,254,0.6)]' : 'text-neon-blue drop-shadow-[0_0_15px_rgba(0,243,255,0.6)]'}`}>
                                            {getPlayerName(currentPlayer)}
                                        </span>
                                        <span className="text-sm md:text-base font-bold text-white/80 italic">
                                            {t('status.turnSuffix')}
                                        </span>
                                    </div>
                                    <div className="h-[2px] w-24 bg-gray-900 rounded-full overflow-hidden">
                                        <div className={`h-full w-full rounded-full animate-[loading_1.5s_ease-in-out_infinite] ${String(currentPlayer) === '0' ? 'bg-neon-pink' : 'bg-neon-blue'}`} />
                                    </div>
                                </div>
                            )}
                        </div>

                        {/* 右侧玩家 P1 (O - Blue) */}
                        <div className={`flex flex-col items-center gap-2 transition-opacity duration-300 ${String(currentPlayer) === '1' || isGameOver ? 'opacity-100' : 'opacity-40'}`}>
                            <div className="text-neon-blue font-bold tracking-widest text-xs md:text-sm uppercase mb-1">
                                {getPlayerName('1')}
                            </div>
                            <IconO className="w-8 h-8 md:w-10 md:h-10 text-neon-blue drop-shadow-[0_0_8px_rgba(0,243,255,0.5)]" />
                            <div className="text-3xl md:text-4xl font-black text-neon-blue mt-2 leading-none">
                                {scoreboard.oWins}
                            </div>
                        </div>

                    </div>
                </div>

                {/* 统一结束页面遮罩 */}
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
                {!isSpectator && (
                    <GameDebugPanel G={G} ctx={ctx} moves={moves} events={events} playerID={playerID} autoSwitch={!isMultiplayer} />
                )}
            </div>
        </UndoProvider>
    );
};

export default TicTacToeBoard;
