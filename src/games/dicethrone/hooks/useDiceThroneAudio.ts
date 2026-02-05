/**
 * useDiceThroneAudio Hook
 * 
 * 管理 DiceThrone 游戏的音效播放。
 * 监听游戏状态变化并自动触发相应音效。
 */

import { useGameAudio } from '../../../lib/audio/useGameAudio';
import { DICETHRONE_AUDIO_CONFIG } from '../audio.config';
import type { DiceThroneCore, TurnPhase } from '../domain/types';
import type { MatchState, PlayerId } from '../../../engine/types';

export interface DiceThroneAudioConfig {
    /** 核心游戏状态 */
    G: DiceThroneCore;
    /** 原始 MatchState（用于读取 sys.eventStream） */
    rawState: MatchState<DiceThroneCore>;
    /** 当前玩家 ID */
    currentPlayerId: PlayerId;
    /** 当前阶段 */
    currentPhase: TurnPhase;
    /** 游戏是否结束 */
    isGameOver: boolean;
    /** 当前玩家是否是赢家 */
    isWinner?: boolean;
}

/**
 * DiceThrone 音频 Hook（适配通用音频系统）
 */
export function useDiceThroneAudio(config: DiceThroneAudioConfig) {
    const { G, rawState, currentPlayerId, currentPhase, isGameOver, isWinner } = config;

    useGameAudio({
        config: DICETHRONE_AUDIO_CONFIG,
        G,
        ctx: {
            currentPhase,
            isGameOver,
            isWinner,
        },
        meta: {
            currentPlayerId,
        },
        eventEntries: rawState.sys.eventStream.entries,
    });
}
