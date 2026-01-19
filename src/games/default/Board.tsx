import React from 'react';
import type { BoardProps } from 'boardgame.io/react';
import type { TicTacToeState } from './game';
import { GameDebugPanel } from '../../components/GameDebugPanel';

interface Props extends BoardProps<TicTacToeState> { }

// SVG 图标组件 - X
const IconX = ({ className }: { className?: string }) => (
    <svg viewBox="0 0 24 24" fill="none" className={className} stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
        <path className="animate-[draw_0.4s_ease-out_forwards]" d="M18 6L6 18" style={{ strokeDasharray: 20, strokeDashoffset: 20, animationName: 'draw' }} />
        <path className="animate-[draw_0.4s_ease-out_0.2s_forwards]" d="M6 6l12 12" style={{ strokeDasharray: 20, strokeDashoffset: 20, animationName: 'draw' }} />
        <style>{`
            @keyframes draw {
                to { stroke-dashoffset: 0; }
            }
        `}</style>
    </svg>
);

// SVG 图标组件 - O
const IconO = ({ className }: { className?: string }) => (
    <svg viewBox="0 0 24 24" fill="none" className={className} stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
        <circle className="animate-[draw-circle_0.5s_ease-out_forwards]" cx="12" cy="12" r="9" style={{ strokeDasharray: 60, strokeDashoffset: 60 }} />
        <style>{`
            @keyframes draw-circle {
                to { stroke-dashoffset: 0; }
            }
        `}</style>
    </svg>
);

export const TicTacToeBoard: React.FC<Props> = ({ ctx, G, moves, events, playerID }) => {
    const isGameOver = ctx.gameover;
    const isWinner = isGameOver?.winner !== undefined;
    const isDraw = isGameOver && !isWinner;
    const currentPlayer = ctx.currentPlayer;

    // 简单的胜利线路检测（用于高亮）
    const getWinningLine = (cells: (string | null)[]) => {
        if (!isWinner) return null;
        const positions = [
            [0, 1, 2], [3, 4, 5], [6, 7, 8],
            [0, 3, 6], [1, 4, 7], [2, 5, 8],
            [0, 4, 8], [2, 4, 6]
        ];
        for (let pos of positions) {
            const [a, b, c] = pos;
            if (cells[a] && cells[a] === cells[b] && cells[a] === cells[c]) {
                return pos;
            }
        }
        return null;
    };

    const winningLine = getWinningLine(G.cells);

    const onClick = (id: number) => {
        if (!isGameOver && G.cells[id] === null) {
            moves.clickCell(id);
        }
    };

    return (
        <div className="flex flex-col items-center justify-center min-h-screen bg-gradient-to-br from-indigo-500 via-purple-500 to-pink-500 font-sans p-4">
            {/* Header */}
            <div className="mb-8 text-center animate-fade-in-down">
                <h1 className="text-4xl md:text-5xl font-extrabold text-white drop-shadow-md tracking-tight mb-2">
                    井字棋对决
                </h1>
                <p className="text-indigo-100 text-lg opacity-90">
                    经典策略 • 极速对战
                </p>
            </div>

            {/* Game Container */}
            <div className="relative bg-white/10 backdrop-blur-xl rounded-3xl p-8 shadow-2xl border border-white/20 animate-fade-in-up">

                {/* Status Bar */}
                <div className="flex justify-between items-center mb-8 px-2">
                    <div className={`flex items-center gap-2 px-4 py-2 rounded-full transition-all duration-300 ${currentPlayer === '0' && !isGameOver ? 'bg-white/20 shadow-lg scale-105 border border-white/30' : 'opacity-60'}`}>
                        <div className="w-8 h-8 text-cyan-300"><IconX /></div>
                        <span className="text-white font-bold">玩家 X</span>
                    </div>

                    <div className="text-white/80 font-mono text-sm">VS</div>

                    <div className={`flex items-center gap-2 px-4 py-2 rounded-full transition-all duration-300 ${currentPlayer === '1' && !isGameOver ? 'bg-white/20 shadow-lg scale-105 border border-white/30' : 'opacity-60'}`}>
                        <div className="w-8 h-8 text-rose-300"><IconO /></div>
                        <span className="text-white font-bold">玩家 O</span>
                    </div>
                </div>

                {/* Grid */}
                <div className="grid grid-cols-3 gap-3">
                    {G.cells.map((cell, id) => {
                        const isWinningCell = winningLine?.includes(id);
                        const isOccupied = cell !== null;

                        return (
                            <div
                                key={id}
                                onClick={() => onClick(id)}
                                className={`
                                    w-20 h-20 md:w-24 md:h-24 rounded-xl flex items-center justify-center text-5xl
                                    transition-all duration-300 cursor-pointer relative overflow-hidden
                                    ${!isOccupied && !isGameOver ? 'hover:bg-white/10 active:scale-95' : ''}
                                    ${isOccupied ? 'bg-white/5' : 'bg-black/20'}
                                    ${isWinningCell ? 'ring-4 ring-yellow-400 bg-yellow-400/20 shadow-[0_0_20px_rgba(250,204,21,0.5)] z-10 scale-105' : ''}
                                    ${!isWinningCell && isGameOver && isOccupied ? 'opacity-50 grayscale' : ''}
                                `}
                            >
                                {cell === '0' && <div className="w-12 h-12 md:w-16 md:h-16 text-cyan-300 drop-shadow-[0_0_8px_rgba(103,232,249,0.8)]"><IconX /></div>}
                                {cell === '1' && <div className="w-12 h-12 md:w-16 md:h-16 text-rose-300 drop-shadow-[0_0_8px_rgba(253,164,175,0.8)]"><IconO /></div>}
                            </div>
                        );
                    })}
                </div>

                {/* Game Over Overlay / Result */}
                {isGameOver && (
                    <div className="mt-8 text-center animate-bounce-in">
                        {isWinner ? (
                            <div className="inline-block px-8 py-3 bg-gradient-to-r from-yellow-400 to-orange-500 rounded-full shadow-lg transform hover:scale-105 transition-transform cursor-pointer" onClick={() => events.endGame?.()}>
                                <span className="text-2xl font-black text-white uppercase tracking-wider">
                                    {ctx.gameover.winner === '0' ? '玩家 X' : '玩家 O'} 获胜! 🎉
                                </span>
                            </div>
                        ) : (
                            <div className="inline-block px-8 py-3 bg-gray-600 rounded-full shadow-lg transform hover:scale-105 transition-transform cursor-pointer" onClick={() => events.endGame?.()}>
                                <span className="text-2xl font-bold text-white">
                                    平局! 🤝
                                </span>
                            </div>
                        )}
                        <p className="text-white/60 text-sm mt-3 animate-pulse">
                            点击胜利横幅或刷新页面重新开始
                        </p>
                    </div>
                )}
            </div>

            {/* Debug Panel Toggle (Hidden by default or stylized) */}
            <div className="mt-8 opacity-50 hover:opacity-100 transition-opacity">
                <GameDebugPanel G={G} ctx={ctx} moves={moves} events={events} playerID={playerID} />
            </div>
        </div>
    );
};
