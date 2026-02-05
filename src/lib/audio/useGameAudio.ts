/**
 * 游戏音效 Hook
 * 监听游戏状态变化并自动播放对应音效
 * 支持通用注册表 + 游戏逻辑配置
 */
import { useEffect, useRef, useState } from 'react';
import { AudioManager } from './AudioManager';
import { playSynthSound, getSynthSoundKeys } from './SynthAudio';
import type { AudioRuntimeContext, GameAudioConfig, SoundKey } from './types';
import { resolveAudioEvent, resolveAudioKey, resolveBgmKey } from './audioRouting';
import { useAudio } from '../../contexts/AudioContext';
import { COMMON_AUDIO_BASE_PATH, loadCommonAudioRegistry } from './commonRegistry';

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
    const maybeEventStreamEntry = entry as { id?: number; event?: { type?: string; timestamp?: number } };
    if (typeof maybeEventStreamEntry.id === 'number') {
        return `eventId:${maybeEventStreamEntry.id}`;
    }

    const maybeEntry = entry as {
        timestamp?: number;
        type?: string;
        data?: { type?: string; timestamp?: number };
    };

    const dataTimestamp = typeof maybeEntry.data === 'object' && maybeEntry.data
        ? (maybeEntry.data as { timestamp?: number }).timestamp
        : undefined;
    const signatureTimestamp = typeof dataTimestamp === 'number'
        ? dataTimestamp
        : maybeEntry.timestamp;
    if (typeof signatureTimestamp !== 'number') return null;

    const dataType = typeof maybeEntry.data === 'object' && maybeEntry.data
        ? (maybeEntry.data as { type?: string }).type ?? ''
        : '';
    return `${signatureTimestamp}|${maybeEntry.type ?? ''}|${dataType}`;
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
    const synthKeys = getSynthSoundKeys();
    const isSynthKey = synthKeys.includes(key);
    if (failedSounds.has(key)) {
        if (isSynthKey) {
            playSynthSound(key);
        }
        return;
    }

    const result = AudioManager.play(key);
    // 如果播放失败（返回 null），标记并尝试合成音
    if (result === null && isSynthKey) {
        failedSounds.add(key);
        playSynthSound(key);
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
    const [registryLoaded, setRegistryLoaded] = useState(false);
    const eventEntriesVersion = (() => {
        if (!eventEntries || eventEntries.length === 0) return 0;
        const lastSignature = getLogEntrySignature(eventEntries[eventEntries.length - 1]);
        return lastSignature ?? eventEntries.length;
    })();

    const runtimeContext: AudioRuntimeContext<G, Ctx, Meta> = { G, ctx, meta };

    useEffect(() => {
        let active = true;
        loadCommonAudioRegistry()
            .then((registry) => {
                if (!active) return;
                AudioManager.registerRegistryEntries(registry.entries, COMMON_AUDIO_BASE_PATH);
                setRegistryLoaded(true);
            })
            .catch((error) => {
                console.error('[AudioRegistry] 通用音频注册表加载失败', error);
            });

        return () => {
            active = false;
        };
    }, []);

    useEffect(() => {
        if (!registryLoaded) return;
        if (!initializedRef.current) {
            AudioManager.initialize();

            // 仅登记游戏层配置（BGM/自定义音效）
            AudioManager.registerAll(config, config.basePath || '');

            // 刷新后跳过历史事件，避免重放所有历史音效
            if (eventEntries && eventEntries.length > 0) {
                const lastSignature = getLogEntrySignature(eventEntries[eventEntries.length - 1]);
                if (lastSignature) {
                    lastLogSignatureRef.current = lastSignature;
                }
            }

            if (config.bgm && config.bgm.length > 0) {
                const fallbackKey = config.bgm[0]?.key ?? null;
                const initialBgm = resolveBgmKey(runtimeContext, config.bgmRules, fallbackKey);
                setPlaylist(config.bgm);
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
    }, [registryLoaded, config, runtimeContext, setPlaylist, playBgm, stopBgm, eventEntriesVersion]);

    useEffect(() => {
        if (!initializedRef.current || !registryLoaded) return;
        if (!config.bgm || config.bgm.length === 0) return;

        const fallbackKey = config.bgm[0]?.key ?? null;
        const targetBgm = resolveBgmKey(runtimeContext, config.bgmRules, fallbackKey);

        if (!targetBgm) {
            stopBgm();
            currentBgmKeyRef.current = null;
            return;
        }

        if (currentBgmKeyRef.current !== targetBgm) {
            playBgm(targetBgm);
            currentBgmKeyRef.current = targetBgm;
        }
    }, [registryLoaded, config.bgm, config.bgmRules, runtimeContext, playBgm, stopBgm]);

    useEffect(() => {
        if (!registryLoaded) return;
        const safeEntries = eventEntries ?? [];
        const totalEntries = safeEntries.length;
        if (totalEntries === 0) {
            return;
        }

        let startIndex = 0;
        if (lastLogSignatureRef.current) {
            const lastIndex = findLastLogEntryIndex(safeEntries, lastLogSignatureRef.current);
            if (lastIndex >= 0) {
                startIndex = lastIndex + 1;
            }
        }

        const newEntries = safeEntries.slice(startIndex);
        if (safeEntries.length > 0) {
            lastLogSignatureRef.current = getLogEntrySignature(safeEntries[safeEntries.length - 1]);
        }

        for (const entry of newEntries) {
            const event = resolveAudioEvent(entry, config.eventSelector);
            if (!event) {
                continue;
            }
            const key = resolveAudioKey(
                event,
                runtimeContext,
                config,
                (category) => AudioManager.resolveCategoryKey(category)
            );
            if (key) {
                playSound(key);
            }
        }
    }, [registryLoaded, eventEntriesVersion, config, runtimeContext]);

    useEffect(() => {
        if (!registryLoaded) return;
        if (!prevRuntimeRef.current) {
            prevRuntimeRef.current = runtimeContext;
            return;
        }

        if (!config.stateTriggers || config.stateTriggers.length === 0) {
            prevRuntimeRef.current = runtimeContext;
            return;
        }

        for (const trigger of config.stateTriggers) {
            if (!trigger.condition(prevRuntimeRef.current, runtimeContext)) continue;
            const resolvedKey = trigger.resolveSound?.(prevRuntimeRef.current, runtimeContext);
            const key = resolvedKey ?? trigger.sound;
            if (key) {
                playSound(key);
            }
        }

        prevRuntimeRef.current = runtimeContext;
    }, [registryLoaded, config.stateTriggers, runtimeContext]);

    useEffect(() => (
        () => {
            setPlaylist([]);
            stopBgm();
            AudioManager.stopBgm();
            currentBgmKeyRef.current = null;
        }
    ), [setPlaylist, stopBgm]);
}
