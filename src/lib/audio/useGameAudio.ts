/**
 * 游戏音效 Hook
 * 监听游戏状态变化并自动播放对应音效
 * 支持通用注册表 + 游戏逻辑配置
 */
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { AudioManager } from './AudioManager';
import { playSynthSound, getSynthSoundKeys } from './SynthAudio';
import type { AudioRuntimeContext, BgmDefinition, BgmGroupId, GameAudioConfig, SoundKey } from './types';
import { resolveAudioEvent, resolveFeedback, resolveBgmGroup, resolveBgmKey } from './audioRouting';
import { useAudio } from '../../contexts/AudioContext';
import { COMMON_AUDIO_BASE_PATH, loadCommonAudioRegistry } from './commonRegistry';

interface UseGameAudioOptions<G, Ctx = unknown, Meta extends Record<string, unknown> = Record<string, unknown>> {
    config: GameAudioConfig;
    gameId?: string;
    G: G;
    ctx: Ctx;
    eventEntries?: unknown[];
    meta?: Meta;
}

// 追踪哪些音效加载失败，需要使用合成音
const failedSounds = new Set<string>();

// 全局节流：记录每个音效上次播放时间
const lastPlayedTime = new Map<string, number>();
const SFX_THROTTLE_MS = 80;

const DT_TRACE_SOUND_KEYS = new Set<string>([
    'ui.general.khron_studio_rpg_interface_essentials_inventory_dialog_ucs_system_192khz.dialog.dialog_choice.uiclick_dialog_choice_01_krst_none',
    'ui.general.ui_menu_sound_fx_pack_vol.signals.positive.signal_positive_bells_a',
    'ui.fantasy_ui_sound_fx_pack_vol.signals.signal_update_b_003',
    'fantasy.gothic_fantasy_sound_fx_pack_vol.musical.drums_of_fate_002',
]);

const DT_TRACE_EVENT_TYPES = new Set<string>([
    'CHARACTER_SELECTED',
    'PLAYER_READY',
    'HOST_STARTED',
    'SYS_PHASE_CHANGED',
]);

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
    // 节流：同一音效在 SFX_THROTTLE_MS 内只播放一次
    const now = Date.now();
    const lastPlayed = lastPlayedTime.get(key);
    if (lastPlayed !== undefined && now - lastPlayed < SFX_THROTTLE_MS) {
        return;
    }
    lastPlayedTime.set(key, now);

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
    
    // 仅在音效确实加载失败时标记为永久失败并回退到合成音
    // （因并发加载限制被跳过的不算失败）
    if (result === null && isSynthKey && AudioManager.isFailed(key)) {
        failedSounds.add(key);
        playSynthSound(key);
    }
}

/** 操作被拒绝/失败时的反馈音效 key */
const DENIED_SOUND_KEY = 'puzzle.18.negative_pop_01';

/**
 * 播放操作被拒绝的反馈音效
 * 用于用户尝试执行不合法操作时（如不是自己的回合、条件不满足等）
 */
export function playDeniedSound(): void {
    playSound(DENIED_SOUND_KEY);
}

/**
 * 游戏音效 Hook
 * 自动监听游戏状态变化并触发音效
 */
export function useGameAudio<G, Ctx = unknown, Meta extends Record<string, unknown> = Record<string, unknown>>({
    config,
    gameId,
    G,
    ctx,
    eventEntries,
    meta,
}: UseGameAudioOptions<G, Ctx, Meta>): void {
    const initializedRef = useRef(false);
    const prevRuntimeRef = useRef<AudioRuntimeContext<G, Ctx, Meta> | null>(null);
    const lastLogSignatureRef = useRef<string | null>(null);
    const currentBgmKeyRef = useRef<string | null>(null);
    const currentBgmGroupRef = useRef<BgmGroupId | null>(null);
    const contextualPreloadRef = useRef<Set<SoundKey>>(new Set());
    const { setPlaylist, playBgm, stopBgm, bgmSelections, setActiveBgmContext } = useAudio();
    const [registryLoaded, setRegistryLoaded] = useState(false);
    const eventEntriesVersion = (() => {
        if (!eventEntries || eventEntries.length === 0) return 0;
        const lastSignature = getLogEntrySignature(eventEntries[eventEntries.length - 1]);
        return lastSignature ?? eventEntries.length;
    })();

    const runtimeContext: AudioRuntimeContext<G, Ctx, Meta> = { G, ctx, meta };
    // 用 ref 持有 runtimeContext，避免 useCallback 依赖不稳定的对象引用
    const runtimeContextRef = useRef(runtimeContext);
    useEffect(() => {
        runtimeContextRef.current = runtimeContext;
    });

    const contextualPreloadKeys = useMemo(() => {
        if (!config.contextualPreloadKeys) return [] as SoundKey[];
        const keys = config.contextualPreloadKeys(runtimeContext);
        if (!keys || keys.length === 0) return [] as SoundKey[];
        return keys.filter((key): key is SoundKey => !!key);
    }, [config.contextualPreloadKeys, G, ctx, meta]);

    const contextualPreloadSignature = useMemo(() => {
        if (contextualPreloadKeys.length === 0) return '';
        return Array.from(new Set(contextualPreloadKeys)).sort().join('|');
    }, [contextualPreloadKeys]);

    const bgmDefinitionMap = useMemo(() => {
        return new Map((config.bgm ?? []).map((def) => [def.key, def]));
    }, [config.bgm]);

    const resolveFallbackGroup = useCallback((): BgmGroupId => {
        if (config.bgmGroups) {
            if (config.bgmGroups.normal) return 'normal';
            const firstGroup = Object.keys(config.bgmGroups)[0];
            if (firstGroup) return firstGroup as BgmGroupId;
        }
        return 'normal';
    }, [config.bgmGroups]);

    const resolveBgmPlan = useCallback(() => {
        const allBgm = config.bgm ?? [];
        if (allBgm.length === 0) {
            return {
                activeGroup: null as BgmGroupId | null,
                playlist: [] as BgmDefinition[],
                targetKey: null as string | null,
            };
        }

        const currentRuntimeContext = runtimeContextRef.current;
        const allKeys = allBgm.map((def) => def.key);
        const fallbackGroup = resolveFallbackGroup();
        const activeGroup = resolveBgmGroup(currentRuntimeContext, config.bgmRules, fallbackGroup);
        const groupKeys = config.bgmGroups?.[activeGroup] ?? allKeys;
        const effectiveKeys = groupKeys.length > 0 ? groupKeys : allKeys;
        const playlist = effectiveKeys
            .map((key) => bgmDefinitionMap.get(key))
            .filter((entry): entry is BgmDefinition => !!entry);
        const fallbackKeyFromGroup = effectiveKeys.find((key) => allKeys.includes(key)) ?? allKeys[0] ?? null;
        const resolvedKey = resolveBgmKey(currentRuntimeContext, config.bgmRules, null);
        const safeFallbackKey = resolvedKey && effectiveKeys.includes(resolvedKey)
            ? resolvedKey
            : fallbackKeyFromGroup;
        const selection = gameId ? bgmSelections?.[gameId]?.[activeGroup] : undefined;
        const candidateKey = selection && effectiveKeys.includes(selection) ? selection : safeFallbackKey;
        const targetKey = candidateKey && allKeys.includes(candidateKey)
            ? candidateKey
            : fallbackKeyFromGroup;

        return { activeGroup, playlist, targetKey };
    }, [bgmDefinitionMap, bgmSelections, config.bgm, config.bgmGroups, config.bgmRules, gameId, resolveFallbackGroup]);

    useEffect(() => {
        let active = true;
        loadCommonAudioRegistry()
            .then((registry) => {
                if (!active) return;
                AudioManager.registerRegistryEntries(registry.entries, COMMON_AUDIO_BASE_PATH);
                setRegistryLoaded(true);

                // 关键音效预加载（preloadKeys 内部已走 requestIdleCallback 空闲调度，不会与图片竞争连接）
                if (config.criticalSounds && config.criticalSounds.length > 0) {
                    AudioManager.preloadKeys(config.criticalSounds);
                }
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

            const { activeGroup, playlist, targetKey } = resolveBgmPlan();
            setPlaylist(playlist);
            if (gameId && activeGroup) {
                setActiveBgmContext(gameId, activeGroup);
                currentBgmGroupRef.current = activeGroup;
            }
            if (targetKey) {
                playBgm(targetKey);
                currentBgmKeyRef.current = targetKey;
            } else {
                stopBgm();
            }

            initializedRef.current = true;
        }
    }, [
        registryLoaded,
        config,
        setPlaylist,
        playBgm,
        stopBgm,
        eventEntriesVersion,
        resolveBgmPlan,
        gameId,
        setActiveBgmContext,
    ]);

    useEffect(() => {
        if (!registryLoaded || !initializedRef.current) return;
        if (contextualPreloadKeys.length === 0) return;

        const uniqueKeys = Array.from(new Set(contextualPreloadKeys));
        const pending = uniqueKeys.filter((key) => !contextualPreloadRef.current.has(key));
        if (pending.length === 0) return;

        pending.forEach((key) => contextualPreloadRef.current.add(key));
        // preloadKeys 内部已走 requestIdleCallback 空闲调度，不会与图片竞争连接
        AudioManager.preloadKeys(pending);
    }, [registryLoaded, contextualPreloadSignature, contextualPreloadKeys.length]);

    useEffect(() => {
        if (!initializedRef.current || !registryLoaded) return;
        if (!config.bgm || config.bgm.length === 0) return;

        const { activeGroup, playlist, targetKey } = resolveBgmPlan();
        if (gameId && activeGroup && currentBgmGroupRef.current !== activeGroup) {
            setActiveBgmContext(gameId, activeGroup);
            currentBgmGroupRef.current = activeGroup;
        }
        if (playlist.length > 0) {
            setPlaylist(playlist);
        }

        if (!targetKey) {
            stopBgm();
            currentBgmKeyRef.current = null;
            return;
        }

        if (currentBgmKeyRef.current !== targetKey) {
            playBgm(targetKey);
            currentBgmKeyRef.current = targetKey;
        }
    }, [
        registryLoaded,
        config.bgm,
        config.bgmRules,
        playBgm,
        stopBgm,
        resolveBgmPlan,
        gameId,
        setActiveBgmContext,
        setPlaylist,
    ]);

    useEffect(() => {
        if (!registryLoaded) return;
        const safeEntries = eventEntries ?? [];
        const totalEntries = safeEntries.length;
        if (totalEntries === 0) {
            // 撤回恢复快照时 eventStream.entries 被清空，
            // 必须重置签名指针，否则后续新事件 ID 与旧签名碰撞会被误判为"已播放"
            lastLogSignatureRef.current = null;
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

        // 批量事件过多时只对最近的几条播放音效，避免同时触发大量音频加载
        const MAX_BATCH_SOUNDS = 5;
        const audioEntries = newEntries.length > MAX_BATCH_SOUNDS
            ? newEntries.slice(-MAX_BATCH_SOUNDS)
            : newEntries;

        const playedKeys = new Set<SoundKey>();
        for (const entry of audioEntries) {
            const event = resolveAudioEvent(entry, config.eventSelector);
            if (!event) {
                continue;
            }
            
            // 框架层自动过滤 UI 本地交互事件（音效已由 UI 组件本地播放）
            // 音频追踪日志已移除
            
            if (event.audioMetadata?.isLocalUIEvent) {
                continue;
            }
            
            const key = resolveFeedback(
                event,
                runtimeContextRef.current,
                config,
            );
            if (!key) continue;
            if (gameId === 'dicethrone' && DT_TRACE_EVENT_TYPES.has(event.type)) {
                const eventId = (entry as { id?: number }).id;
            }
            // 立即播放（去重）
            if (!playedKeys.has(key)) {
                playedKeys.add(key);
                playSound(key);
            }
        }
    }, [registryLoaded, eventEntriesVersion, config]);

    useEffect(() => {
        if (!registryLoaded) return;
        const currentRuntime = runtimeContextRef.current;
        if (!prevRuntimeRef.current) {
            prevRuntimeRef.current = currentRuntime;
            return;
        }

        if (!config.stateTriggers || config.stateTriggers.length === 0) {
            prevRuntimeRef.current = currentRuntime;
            return;
        }

        for (const trigger of config.stateTriggers) {
            if (!trigger.condition(prevRuntimeRef.current, currentRuntime)) continue;
            const resolvedKey = trigger.resolveSound?.(prevRuntimeRef.current, currentRuntime);
            const key = resolvedKey ?? trigger.sound;
            if (key) {
                playSound(key);
            }
        }

        prevRuntimeRef.current = currentRuntime;
    }, [registryLoaded, config.stateTriggers, G, ctx]);

    useEffect(() => (
        () => {
            setPlaylist([]);
            stopBgm();
            AudioManager.stopBgm();
            currentBgmKeyRef.current = null;
            currentBgmGroupRef.current = null;
            setActiveBgmContext(null, null);
        }
    ), [setPlaylist, stopBgm, setActiveBgmContext]);
}
