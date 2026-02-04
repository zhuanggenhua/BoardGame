/**
 * 游戏音效 Hook
 * 监听游戏状态变化并自动播放对应音效
 * 支持 common + game 分层配置
 */
import { useEffect, useMemo, useRef } from 'react';
import { AudioManager } from './AudioManager';
import { playSynthSound, getSynthSoundKeys } from './SynthAudio';
import type { AudioRuntimeContext, GameAudioConfig, SoundKey } from './types';
import { resolveAudioEvent, resolveBgmKey, resolveEventSoundKey } from './audioRouting';
import { useAudio } from '../../contexts/AudioContext';
import { COMMON_AUDIO_CONFIG } from './common.config';
import { mergeAudioConfigs } from './mergeAudioConfigs';

interface UseGameAudioOptions<G, Ctx = unknown, Meta extends Record<string, unknown> = Record<string, unknown>> {
    config: GameAudioConfig;
    G: G;
    ctx: Ctx;
    eventEntries?: unknown[];
    meta?: Meta;
}

// 追踪哪些音效加载失败，需要使用合成音
const failedSounds = new Set<string>();

function getLogEntrySignature(entry: unknown): string | null {
    if (!entry || typeof entry !== 'object') return null;
    const maybeEntry = entry as { timestamp?: number; type?: string; data?: { type?: string } };
    if (typeof maybeEntry.timestamp !== 'number') return null;
    const dataType = typeof maybeEntry.data === 'object' && maybeEntry.data
        ? (maybeEntry.data as { type?: string }).type ?? ''
        : '';
    return `${maybeEntry.timestamp}|${maybeEntry.type ?? ''}|${dataType}`;
}

function findLastLogEntryIndex(entries: unknown[], signature: string): number {
    for (let i = entries.length - 1; i >= 0; i -= 1) {
        if (getLogEntrySignature(entries[i]) === signature) return i;
    }
    return -1;
}

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
export function useGameAudio<G, Ctx = unknown, Meta extends Record<string, unknown> = Record<string, unknown>>({
    config,
    G,
    ctx,
    eventEntries,
    meta,
}: UseGameAudioOptions<G, Ctx, Meta>): void {
    const initializedRef = useRef(false);
    const prevRuntimeRef = useRef<AudioRuntimeContext<G, Ctx, Meta> | null>(null);
    const lastLogSignatureRef = useRef<string | null>(null);
    const currentBgmKeyRef = useRef<string | null>(null);
    const { setPlaylist, playBgm, stopBgm } = useAudio();

    const runtimeContext: AudioRuntimeContext<G, Ctx, Meta> = { G, ctx, meta };

    // 合并 common + game 配置（游戏层覆盖通用层）
    const mergedConfig = useMemo(
        () => mergeAudioConfigs(COMMON_AUDIO_CONFIG, config),
        [config]
    );

    useEffect(() => {
        if (!initializedRef.current) {
            AudioManager.initialize();

            // 分层注册：先 common，再 game（游戏层可覆盖通用音效）
            AudioManager.registerAll(COMMON_AUDIO_CONFIG, COMMON_AUDIO_CONFIG.basePath || '');
            AudioManager.registerAll(config, config.basePath || '');

            // 刷新后跳过历史事件，避免重放所有历史音效
            if (eventEntries && eventEntries.length > 0) {
                const lastSignature = getLogEntrySignature(eventEntries[eventEntries.length - 1]);
                if (lastSignature) {
                    lastLogSignatureRef.current = lastSignature;
                }
            }

            if (mergedConfig.bgm && mergedConfig.bgm.length > 0) {
                const fallbackKey = mergedConfig.bgm[0]?.key ?? null;
                const initialBgm = resolveBgmKey(runtimeContext, mergedConfig.bgmRules, fallbackKey);
                setPlaylist(mergedConfig.bgm);
                if (initialBgm) {
                    playBgm(initialBgm);
                    currentBgmKeyRef.current = initialBgm;
                } else {
                    stopBgm();
                }
            } else {
                setPlaylist([]);
                stopBgm();
            }

            initializedRef.current = true;
        }
    }, [config, mergedConfig, runtimeContext, setPlaylist, playBgm, stopBgm]);

    useEffect(() => {
        if (!initializedRef.current) return;
        if (!mergedConfig.bgm || mergedConfig.bgm.length === 0) return;

        const fallbackKey = mergedConfig.bgm[0]?.key ?? null;
        const targetBgm = resolveBgmKey(runtimeContext, mergedConfig.bgmRules, fallbackKey);

        if (!targetBgm) {
            stopBgm();
            currentBgmKeyRef.current = null;
            return;
        }

        if (currentBgmKeyRef.current !== targetBgm) {
            playBgm(targetBgm);
            currentBgmKeyRef.current = targetBgm;
        }
    }, [mergedConfig.bgm, mergedConfig.bgmRules, runtimeContext, playBgm, stopBgm]);

    useEffect(() => {
        if (!eventEntries || eventEntries.length === 0) return;

        let startIndex = 0;
        if (lastLogSignatureRef.current) {
            const lastIndex = findLastLogEntryIndex(eventEntries, lastLogSignatureRef.current);
            if (lastIndex >= 0) {
                startIndex = lastIndex + 1;
            }
        }

        const newEntries = eventEntries.slice(startIndex);
        if (eventEntries.length > 0) {
            lastLogSignatureRef.current = getLogEntrySignature(eventEntries[eventEntries.length - 1]);
        }

        for (const entry of newEntries) {
            const event = resolveAudioEvent(entry, mergedConfig.eventSelector);
            if (!event) continue;
            const key = resolveEventSoundKey(event, runtimeContext, mergedConfig);
            if (key) {
                playSound(key);
            }
        }
    }, [eventEntries, mergedConfig, runtimeContext]);

    useEffect(() => {
        if (!prevRuntimeRef.current) {
            prevRuntimeRef.current = runtimeContext;
            return;
        }

        if (!mergedConfig.stateTriggers || mergedConfig.stateTriggers.length === 0) {
            prevRuntimeRef.current = runtimeContext;
            return;
        }

        for (const trigger of mergedConfig.stateTriggers) {
            if (!trigger.condition(prevRuntimeRef.current, runtimeContext)) continue;
            const resolvedKey = trigger.resolveSound?.(prevRuntimeRef.current, runtimeContext);
            const key = resolvedKey ?? trigger.sound;
            if (key) {
                playSound(key);
            }
        }

        prevRuntimeRef.current = runtimeContext;
    }, [mergedConfig.stateTriggers, runtimeContext]);

    useEffect(() => (
        () => {
            setPlaylist([]);
            stopBgm();
            AudioManager.stopBgm();
            currentBgmKeyRef.current = null;
        }
    ), [setPlaylist, stopBgm]);
}
