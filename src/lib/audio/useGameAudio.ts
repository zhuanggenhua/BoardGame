/**
 * 游戏音效 Hook
 * 监听游戏状态变化并自动播放对应音效
 */
import { useEffect, useRef } from 'react';
import { AudioManager } from './AudioManager';
import { playSynthSound, getSynthSoundKeys } from './SynthAudio';
import type { GameAudioConfig, SoundKey } from './types';
import { useAudio } from '../../contexts/AudioContext';

interface UseGameAudioOptions<G> {
    config: GameAudioConfig;
    G: G;
    ctx: { gameover?: unknown; currentPlayer?: string; turn?: number };
}

// 追踪哪些音效加载失败，需要使用合成音
const failedSounds = new Set<string>();

/**
 * 播放指定音效（自动回退到合成音）
 * @param key 音效键名
 */
export function playSound(key: SoundKey): void {
    // 如果已知该音效加载失败，直接使用合成音
    if (failedSounds.has(key)) {
        if (getSynthSoundKeys().includes(key)) {
            playSynthSound(key);
        }
        return;
    }

    const result = AudioManager.play(key);
    // 如果播放失败（返回 null），标记并尝试合成音
    if (result === null) {
        failedSounds.add(key);
        if (getSynthSoundKeys().includes(key)) {
            playSynthSound(key);
        }
    }
}

/**
 * 游戏音效 Hook
 * 自动监听游戏状态变化并触发音效
 */
export function useGameAudio<G extends { cells?: unknown[] }>({
    config,
    G,
    ctx,
}: UseGameAudioOptions<G>): void {
    const prevGRef = useRef<G | null>(null);
    const prevCtxRef = useRef<typeof ctx | null>(null);
    const initializedRef = useRef(false);
    const { setPlaylist, playBgm, stopBgm } = useAudio();

    // 初始化音效
    useEffect(() => {
        if (!initializedRef.current) {
            AudioManager.initialize();
            AudioManager.registerAll(config, config.basePath || '');

            // 更新上下文状态
            if (config.bgm && config.bgm.length > 0) {
                setPlaylist(config.bgm);
                // 默认播放第一个 BGM
                playBgm(config.bgm[0].key);
            } else {
                // 如果没有 BGM 配置，确保停止当前播放并清空歌单
                setPlaylist([]);
                stopBgm();
            }

            initializedRef.current = true;
        }
    }, [config, setPlaylist, playBgm]);

    // 监听 cells 变化 (落子音效)
    useEffect(() => {
        if (!prevGRef.current) {
            prevGRef.current = G;
            return;
        }

        const prevCells = prevGRef.current.cells;
        const nextCells = G.cells;

        if (prevCells && nextCells && Array.isArray(prevCells) && Array.isArray(nextCells)) {
            // 找到新落子的位置
            for (let i = 0; i < nextCells.length; i++) {
                if (prevCells[i] === null && nextCells[i] !== null) {
                    // 根据落子玩家播放不同音效
                    const soundKey = nextCells[i] === '0' ? 'place_x' : 'place_o';
                    playSound(soundKey);
                    break;
                }
            }
        }

        prevGRef.current = G;
    }, [G]);

    // 组件卸载时停止 BGM
    useEffect(() => {
        return () => {
            // 使用 context 的 stopBgm 确保 React 状态同步
            stopBgm();
            AudioManager.stopBgm();
        };
    }, [stopBgm]);

    // 监听游戏结束
    useEffect(() => {
        if (!prevCtxRef.current) {
            prevCtxRef.current = ctx;
            return;
        }

        // 游戏刚结束
        if (!prevCtxRef.current.gameover && ctx.gameover) {
            const gameover = ctx.gameover as { winner?: string; draw?: boolean };
            if (gameover.draw) {
                playSound('draw');
            } else if (gameover.winner !== undefined) {
                playSound('victory');
            }
        }

        prevCtxRef.current = ctx;
    }, [ctx]);
}
