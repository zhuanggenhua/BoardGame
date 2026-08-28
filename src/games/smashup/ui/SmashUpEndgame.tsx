/**
 * 大杀四方 - 自定义结束页面（计分轨 + 自定义风格按钮）
 *
 * 设计：
 * - 计分轨（0→15 VP）上的玩家标记动画推进
 * - "Paper Chaos" 便签纸美学，与 Board 风格一致
 * - 派系图标 + 最终分数 + 疯狂卡惩罚明细
 * - 按钮复用引擎重赛逻辑，UI 用 SmashUp GameButton 风格
 */

import { useMemo } from 'react';
import { motion } from 'framer-motion';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';
import { Trophy } from 'lucide-react';
import type { ContentSlotProps, ActionsSlotProps } from '../../../components/game/framework/widgets/EndgameOverlay';
import type { SmashUpCore } from '../domain/types';
import { PLAYER_CONFIG } from './playerConfig';
import { getFactionMeta } from './factionMeta';
import { getScores } from '../domain/index';
import { countMadnessCardsForPlayer } from '../domain/abilityHelpers';
import { SMASHUP_TEAM_IDS, getSmashUpTeamMembers, getSmashUpTeamScores, getSmashUpVictoryTarget, isSmashUpTwoVsTwoMode } from '../domain/teamMode';
import { GameButton } from './GameButton';

/** 计算计分轨最大刻度（跟随最高分与胜利线） */
function getTrackMax(
    finalScores: Record<string, number>,
    victoryTarget: number,
    teamScores?: Record<string, number> | null,
): number {
    const teamValues = teamScores ? Object.values(teamScores) : [];
    const maxScore = Math.max(victoryTarget, ...Object.values(finalScores), ...teamValues);
    return maxScore;
}

// ============================================================================
// 计分轨内容区域
// ============================================================================

interface SmashUpEndgameContentProps extends ContentSlotProps {
    core: SmashUpCore;
    myPlayerId: string | null;
    playerNames: Record<string, string>;
}

export function SmashUpEndgameContent({ core, myPlayerId, playerNames, result }: SmashUpEndgameContentProps) {
    const { t: tSmashUp } = useTranslation('game-smashup');
    const finalScores = useMemo(() => getScores(core), [core]);
    const isTeamMode = useMemo(() => isSmashUpTwoVsTwoMode(core), [core]);
    const winners = useMemo(
        () => new Set(result?.winners?.map(String) ?? (result?.winner !== undefined ? [String(result.winner)] : [])),
        [result],
    );
    const victoryTarget = useMemo(() => getSmashUpVictoryTarget(core), [core]);
    const teamScores = useMemo(
        () => (isTeamMode ? getSmashUpTeamScores(core, finalScores) : null),
        [core, finalScores, isTeamMode],
    );
    const trackMax = useMemo(
        () => getTrackMax(finalScores, victoryTarget, teamScores),
        [finalScores, teamScores, victoryTarget],
    );

    // 按最终分数排序（高→低）
    const rankedPlayers = useMemo(() => {
        return [...core.turnOrder].sort((a, b) => (finalScores[b] ?? 0) - (finalScores[a] ?? 0));
    }, [core.turnOrder, finalScores]);

    return (
        <div className="flex flex-col items-center gap-4 w-full max-w-lg">
            {/* 计分轨 — 记分纸风格，跟随 Smash Up 主题色板。 */}
            <motion.div
                initial={{ y: 30, opacity: 0 }}
                animate={{ y: 0, opacity: 1 }}
                transition={{ delay: 0.2, type: 'spring', stiffness: 200, damping: 20 }}
                className="smashup-paper-panel p-5 shadow-[3px_4px_10px_rgba(0,0,0,0.3)] rotate-[0.5deg] w-full rounded-sm relative"
            >
                {isTeamMode && teamScores && (
                    <div className="mb-4 flex flex-wrap items-center justify-center gap-2">
                        {SMASHUP_TEAM_IDS.map((teamId) => {
                            const labelKey = teamId === 'team_13' ? 'ui.team_13' : 'ui.team_24';
                            const teamMembers = getSmashUpTeamMembers(core, teamId);
                            const isWinningTeam = teamMembers.some((pid) => winners.has(pid));
                            return (
                                <div
                                    key={teamId}
                                    className={`rounded-full border px-3 py-1 text-xs font-black uppercase tracking-wide ${
                                        isWinningTeam
                                            ? 'smashup-winner-chip'
                                            : 'smashup-chip'
                                    }`}
                                >
                                    {tSmashUp(labelKey)}
                                    {' · '}
                                    {tSmashUp('ui.team_total', {
                                        score: teamScores[teamId],
                                        target: victoryTarget,
                                        defaultValue: '{{score}} / {{target}}',
                                    })}
                                </div>
                            );
                        })}
                    </div>
                )}
                {/* 轨道 */}
                <div className="relative mb-6">
                    {/* 刻度线 */}
                    <div className="flex justify-between items-end px-1 mb-1">
                        {Array.from({ length: trackMax + 1 }, (_, i) => (
                            <div key={i} className="flex flex-col items-center" style={{ width: `${100 / (trackMax + 1)}%` }}>
                                <span className={`text-[9px] font-mono ${i === victoryTarget ? 'text-amber-600 font-black text-[11px]' : i % 5 === 0 ? 'smashup-text-muted font-bold' : 'smashup-text-faint'}`}>
                                    {i}
                                </span>
                            </div>
                        ))}
                    </div>

                    {/* 轨道条 */}
                    <div className="smashup-score-track relative h-8 border rounded-sm overflow-visible">
                        {/* 格子分隔线 */}
                        {Array.from({ length: trackMax }, (_, i) => (
                            <div
                                key={i}
                                className="smashup-score-grid-line absolute top-0 bottom-0 border-l"
                                style={{ left: `${((i + 1) / (trackMax + 1)) * 100}%` }}
                            />
                        ))}

                        {/* 胜利分数线 */}
                        <div
                            className="absolute top-0 bottom-0 w-[1px] border-l-2 border-dashed border-amber-400"
                            style={{ left: `${(victoryTarget / (trackMax + 1)) * 100}%` }}
                        />

                        {/* 玩家标记 */}
                        {rankedPlayers.map((pid, rankIdx) => {
                            const score = Math.min(finalScores[pid] ?? 0, trackMax);
                            const conf = PLAYER_CONFIG[parseInt(pid) % PLAYER_CONFIG.length];
                            const leftPct = (score / (trackMax + 1)) * 100;
                            // 同分玩家垂直偏移避免重叠
                            const yOffset = rankIdx * 3 - 2;

                            return (
                                <motion.div
                                    key={pid}
                                    className="absolute"
                                    style={{ top: `calc(50% + ${yOffset}px)`, transform: 'translateY(-50%)' }}
                                    initial={{ left: '0%' }}
                                    animate={{ left: `calc(${leftPct}% + 2px)` }}
                                    transition={{ delay: 0.4 + rankIdx * 0.2, duration: 1.2, type: 'spring', stiffness: 80, damping: 15 }}
                                >
                                    <div
                                        className={`w-5 h-5 rounded-full ${conf.bg} border-2 border-white shadow-md flex items-center justify-center text-[9px] font-black text-white`}
                                        title={`${playerNames[pid] ?? `P${Number(pid) + 1}`}: ${score} VP`}
                                    >
                                        {score}
                                    </div>
                                </motion.div>
                            );
                        })}
                    </div>
                </div>

                {/* 玩家详情 */}
                <div className="space-y-3">
                    {rankedPlayers.map((pid, rankIdx) => {
                        const player = core.players[pid];
                        if (!player) return null;
                        const conf = PLAYER_CONFIG[parseInt(pid) % PLAYER_CONFIG.length];
                        const rawVp = player.vp;
                        const finalVp = finalScores[pid] ?? 0;
                        const madnessCount = countMadnessCardsForPlayer(core, pid);
                        const penalty = rawVp - finalVp;
                        const isMe = pid === myPlayerId;
                        const isThisWinner = winners.has(pid);
                        const displayName = playerNames[pid] ?? `P${Number(pid) + 1}`;
                        const factionIcons = (player.factions ?? []).map(fid => getFactionMeta(fid)).filter(Boolean);

                        return (
                            <motion.div
                                key={pid}
                                initial={{ x: -20, opacity: 0 }}
                                animate={{ x: 0, opacity: 1 }}
                                transition={{ delay: 0.5 + rankIdx * 0.15 }}
                                className={`flex items-center gap-3 p-2 rounded border ${
                                    isThisWinner ? 'smashup-winner-chip' : 'smashup-paper-subtle-panel'
                                }`}
                            >
                                {/* 排名 */}
                                <div className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-black ${
                                    rankIdx === 0 ? 'bg-amber-400 text-white' : 'smashup-chip'
                                }`}>
                                    {rankIdx + 1}
                                </div>

                                {/* 玩家标记 */}
                                <div className={`w-8 h-8 rounded-full ${conf.bg} border-2 border-white shadow flex items-center justify-center text-sm font-black text-white`}>
                                    {finalVp}
                                </div>

                                {/* 信息 */}
                                <div className="flex-1 min-w-0">
                                    <div className="flex items-center gap-1.5">
                                        <span className="smashup-text-main max-w-[13rem] truncate text-sm font-black">
                                            {displayName}
                                        </span>
                                        {isMe && <span className="smashup-chip rounded-full px-1.5 py-0.5 text-[10px] font-bold">{tSmashUp('ui.you_short')}</span>}
                                        {isThisWinner && <Trophy className="w-4 h-4 text-amber-500" />}
                                    </div>
                                    {/* 派系图标 */}
                                    <div className="flex gap-1 mt-0.5">
                                        {factionIcons.map(meta => {
                                            if (!meta) return null;
                                            const Icon = meta.icon;
                                            return (
                                                <span key={meta.id} title={tSmashUp(meta.nameKey)}>
                                                    <Icon className="w-3.5 h-3.5" style={{ color: meta.color }} />
                                                </span>
                                            );
                                        })}
                                    </div>
                                </div>

                                {/* 分数明细 */}
                                <div className="smashup-text-muted text-right text-xs font-mono shrink-0">
                                    <div className="smashup-text-main text-lg font-black">{finalVp} <span className="smashup-text-faint text-[10px]">VP</span></div>
                                    {penalty > 0 && (
                                        <div className="text-red-500 text-[10px]">
                                            {tSmashUp('endgame.madnessPenalty', { count: madnessCount, penalty })}
                                        </div>
                                    )}
                                </div>
                            </motion.div>
                        );
                    })}
                </div>
            </motion.div>
        </div>
    );
}

// ============================================================================
// 自定义按钮区域（复用引擎重赛逻辑，SmashUp 风格 UI）
// ============================================================================

export function SmashUpEndgameActions({
    playerID,
    reset,
    isMultiplayer = false,
    rematchState,
    onVote,
    onBackToLobby,
}: ActionsSlotProps) {
    const { t: tCommon } = useTranslation('common');
    const navigate = useNavigate();

    const ready = rematchState?.ready ?? false;
    const myVote = playerID ? (rematchState?.votes[playerID] ?? false) : false;
    console.log('[SmashUpEndgame] 渲染按钮', { isMultiplayer, playerID, ready, myVote, hasOnVote: !!onVote, rematchState });

    const handleBackToLobby = () => {
        if (onBackToLobby) {
            void onBackToLobby();
            return;
        }
        navigate('/');
    };

    // 单人模式
    if (!isMultiplayer) {
        return (
            <motion.div
                initial={{ y: 20, opacity: 0 }}
                animate={{ y: 0, opacity: 1 }}
                transition={{ delay: 0.8 }}
                className="flex items-center gap-3 mt-2"
            >
                <GameButton variant="primary" size="md" onClick={() => reset?.()}>
                    {tCommon('rematch.playAgain')}
                </GameButton>
                <GameButton variant="secondary" size="md" onClick={handleBackToLobby}>
                    {tCommon('rematch.backToLobby')}
                </GameButton>
            </motion.div>
        );
    }

    // 多人模式
    return (
        <motion.div
            initial={{ y: 20, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            transition={{ delay: 0.8 }}
            className="flex items-center gap-3 mt-2"
        >
            {ready ? (
                <GameButton variant="primary" size="md" disabled>
                    {tCommon('rematch.restarting')}
                </GameButton>
            ) : myVote ? (
                <>
                    <GameButton variant="secondary" size="md" onClick={() => onVote?.()}>
                        {tCommon('rematch.cancelVote')}
                    </GameButton>
                    <span className="text-white/50 text-sm animate-pulse font-bold">
                        {tCommon('rematch.waitingForOpponent')}
                    </span>
                </>
            ) : (
                <GameButton variant="primary" size="md" onClick={() => onVote?.()}>
                    {tCommon('rematch.votePlayAgain')}
                </GameButton>
            )}
            <GameButton variant="secondary" size="md" onClick={handleBackToLobby}>
                {tCommon('rematch.backToLobby')}
            </GameButton>
        </motion.div>
    );
}
