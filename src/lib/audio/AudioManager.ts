/**
 * 音频管理器 - Howler.js 封装
 * 提供全局音效播放、静音、音量控制
 */
import { Howl, Howler } from 'howler';
import type { SoundDefinition, SoundKey, GameAudioConfig, BgmDefinition } from './types';
import type { AudioRegistryEntry } from './commonRegistry';
import { notifyAudioRuntimeToast } from './audioRuntimeNotifications';
import { assetsPath, getOptimizedAudioUrl, waitForCriticalImages, isCriticalImagesReady, resolveAssetsBaseUrlFromEnv } from '../../core/AssetLoader';

const isPassthroughSource = (src: string) => (
    src.startsWith('data:')
    || src.startsWith('blob:')
    || src.startsWith('http://')
    || src.startsWith('https://')
);

const ensureTrailingSlash = (value: string) => (value.endsWith('/') ? value : `${value}/`);

const normalizeBasePath = (basePath: string) => {
    if (!basePath) return '';
    if (isPassthroughSource(basePath)) {
        return ensureTrailingSlash(basePath);
    }
    return ensureTrailingSlash(assetsPath(basePath));
};

const buildAudioSrc = (basePath: string, src: string) => {
    if (isPassthroughSource(src)) {
        return src;
    }
    return getOptimizedAudioUrl(src, basePath);
};

const formatSrcForLog = (src: string | string[]) => (
    Array.isArray(src) ? src.join('|') : src
);

const OFFICIAL_REMOTE_ASSETS_BASE_URL = resolveAssetsBaseUrlFromEnv({
    DEV: false,
    VITE_ASSET_SOURCE: 'remote',
});

const MAX_CONCURRENT_LOADS = 4;
const INSTALLED_ASSET_PATH_MARKER = '/current/assets/';
const RAPID_BGM_END_THRESHOLD_MS = 1500;
const MAX_RAPID_BGM_ENDS = 3;

const splitUrlSuffix = (value: string) => {
    const hashIndex = value.indexOf('#');
    const withoutHash = hashIndex >= 0 ? value.slice(0, hashIndex) : value;
    const hash = hashIndex >= 0 ? value.slice(hashIndex) : '';
    const queryIndex = withoutHash.indexOf('?');
    return {
        path: queryIndex >= 0 ? withoutHash.slice(0, queryIndex) : withoutHash,
        suffix: queryIndex >= 0 ? `${withoutHash.slice(queryIndex)}${hash}` : hash,
    };
};

const stripVersionParam = (value: string) => {
    const { path, suffix } = splitUrlSuffix(value);
    if (!suffix.startsWith('?')) {
        return value;
    }

    const params = new URLSearchParams(suffix.slice(1));
    if (!params.has('v')) {
        return value;
    }
    params.delete('v');
    const nextQuery = params.toString();
    return nextQuery ? `${path}?${nextQuery}` : path;
};

const isCapacitorFileAssetUrl = (src: string) => {
    const { path } = splitUrlSuffix(src);
    return /^https?:\/\/[^/]+\/_capacitor_file_\//i.test(path)
        || path.startsWith('/_capacitor_file_/');
};

const extractCommonAudioRelativePath = (src: string) => {
    const { path } = splitUrlSuffix(src);
    const marker = '/common/audio/';
    const markerIndex = path.indexOf(marker);
    if (markerIndex < 0) {
        return null;
    }
    return path.slice(markerIndex + 1);
};

const resolveInstalledAssetLocationFromUrl = (src: string) => {
    const { path } = splitUrlSuffix(src);
    const markerIndex = path.indexOf(INSTALLED_ASSET_PATH_MARKER);
    if (markerIndex < 0) {
        return null;
    }

    const beforeMarker = path.slice(0, markerIndex);
    const gamePackagesMarker = '/game-packages/';
    const gamePackagesIndex = beforeMarker.lastIndexOf(gamePackagesMarker);
    if (gamePackagesIndex < 0) {
        return null;
    }

    const gameId = beforeMarker.slice(gamePackagesIndex + gamePackagesMarker.length).split('/')[0]?.trim();
    const relativePath = path
        .slice(markerIndex + INSTALLED_ASSET_PATH_MARKER.length)
        .split(/[?#]/, 1)[0]
        .trim();

    if (!gameId || !relativePath) {
        return null;
    }

    try {
        return {
            gameId,
            relativePath: decodeURIComponent(relativePath),
        };
    } catch {
        return {
            gameId,
            relativePath,
        };
    }
};

const toOfficialRemoteAssetUrl = (src: string) => {
    const { suffix } = splitUrlSuffix(src);
    const relativePath = src.startsWith('/assets/')
        ? splitUrlSuffix(src).path.replace(/^\/+assets\/+/, '')
        : extractCommonAudioRelativePath(src);
    if (!relativePath) return null;
    return `${OFFICIAL_REMOTE_ASSETS_BASE_URL}/${relativePath}${suffix}`;
};

type AudioFallbackCandidate =
    | { kind: 'url'; value: string }
    | { kind: 'native-blob'; value: string };

const buildAudioFallbackCandidates = (src: string | string[]) => {
    const sourceList = Array.isArray(src) ? src : [src];
    const candidates: AudioFallbackCandidate[] = [];
    const seen = new Set<string>();

    const pushCandidate = (candidate: AudioFallbackCandidate) => {
        const key = `${candidate.kind}:${candidate.value}`;
        if (!candidate.value || seen.has(key)) {
            return;
        }
        seen.add(key);
        candidates.push(candidate);
    };

    for (const item of sourceList) {
        if (!item) continue;
        pushCandidate({ kind: 'url', value: item });
        if (isCapacitorFileAssetUrl(item)) {
            pushCandidate({ kind: 'native-blob', value: item });
            pushCandidate({ kind: 'url', value: stripVersionParam(item) });
        }
        const remoteFallback = toOfficialRemoteAssetUrl(item);
        if (remoteFallback) {
            pushCandidate({ kind: 'url', value: remoteFallback });
        }
    }

    return candidates;
};

const extractNameFromSrc = (src: string): string => {
    const fileName = src.split('/').pop() ?? src;
    return fileName.replace(/\.[^.]+$/, '');
};

export type AudioLoadState = 'missing' | 'failed' | 'idle' | 'loading' | 'loaded' | 'playing';

const notifyAudioPlaybackFailure = (
    messageKey: string,
    key: string,
    dedupeKey: string,
    titleKey: string = 'audioRuntime.toast.playback_failed_title',
) => {
    notifyAudioRuntimeToast({
        tone: 'error',
        ns: 'lobby',
        titleKey,
        messageKey,
        params: { key },
        dedupeKey,
    });
};

const SFX_FRESH_PLAY_WINDOW_MS = 1000;

class AudioManagerClass {
    private sounds: Map<SoundKey, Howl> = new Map();
    private soundDefinitions: Map<SoundKey, SoundDefinition> = new Map();
    private bgms: Map<string, Howl> = new Map();
    private bgmDefinitions: Map<string, BgmDefinition> = new Map();
    private registryEntries: Map<string, AudioRegistryEntry> = new Map();
    private registryBasePath: string = '';
    private failedKeys: Set<SoundKey> = new Set();
    private nativeBlobUrlCache: Map<string, string> = new Map();
    private nativeBlobUrlPromises: Map<string, Promise<string | null>> = new Map();
    private bgmLoopRestartTimers: Map<string, ReturnType<typeof setTimeout>> = new Map();
    private bgmRapidEndCounts: Map<string, number> = new Map();
    private bgmLastPlayStartedAt: Map<string, number> = new Map();

    private bgmListeners: Set<(currentBgm: string | null) => void> = new Set();
    private bgmEndListeners: Set<(endedBgm: string) => boolean | void> = new Set();

    private _muted: boolean = false;
    private _masterVolume: number = 1.0;
    private _sfxVolume: number = 1.0;
    private _bgmVolume: number = 0.6;

    private _currentBgm: string | null = null;
    private _initialized: boolean = false;
    private _limiterSetup: boolean = false;
    private _userGestureObserved: boolean = false;
    private _unlockListenerAttached: boolean = false;
    private _pendingBgmKey: string | null = null;
    private _loadingCount: number = 0;

    private preloadSoundDefinition(
        key: SoundKey,
        definition: SoundDefinition,
        options?: {
            volumeMultiplier?: number;
            onLoaded?: () => void;
            onError?: (error: unknown) => void;
            onReplace?: (howl: Howl) => void;
        },
    ): Promise<void> {
        return new Promise((resolve, reject) => {
            const finalizeLoaded = () => {
                options?.onLoaded?.();
                resolve();
            };
            const finalizeError = (error: unknown) => {
                options?.onError?.(error);
                reject(error instanceof Error ? error : new Error(String(error)));
            };

            const howl = this.createHowlWithFallback(definition.src, {
                volume: (definition.volume ?? 1.0) * (options?.volumeMultiplier ?? this._sfxVolume),
                loop: definition.loop ?? false,
                sprite: definition.sprite,
                preload: true,
                onReplace: (nextHowl) => {
                    this.sounds.set(key, nextHowl);
                    options?.onReplace?.(nextHowl);
                },
                onload: finalizeLoaded,
                onloaderror: (_id, error) => {
                    finalizeError(error);
                },
            });

            if (!howl) {
                finalizeError(new Error(`failed to create preload howl for ${key}`));
                return;
            }
            this.sounds.set(key, howl);

            const state = howl.state();
            if (state === 'loaded') {
                finalizeLoaded();
            }
        });
    }

    private createHowlWithFallback(
        src: string | string[],
        options: Omit<ConstructorParameters<typeof Howl>[0], 'src' | 'onloaderror'> & {
            onloaderror?: (id: number, error: unknown) => void;
            onReplace?: (howl: Howl) => void;
            onFallbackReady?: (howl: Howl) => void;
        }
    ): Howl | null {
        const candidates = buildAudioFallbackCandidates(src);

        const createUrlHowlAt = (candidateSrc: string, index: number, isFallback: boolean): Howl => {
            const howl = new Howl({
                ...options,
                src: [candidateSrc],
                onloaderror: (id, error) => {
                    void tryFallback(index + 1, id, error, howl);
                },
            });
            if (isFallback) {
                options.onReplace?.(howl);
                options.onFallbackReady?.(howl);
            }
            return howl;
        };

        const tryFallback = (
            index: number,
            id: number,
            error: unknown,
            previousHowl: Howl,
        ): void => {
            if (index >= candidates.length) {
                options.onloaderror?.(id, error);
                return;
            }

            const candidate = candidates[index];
            if (candidate.kind === 'url') {
                const nextHowl = createUrlHowlAt(candidate.value, index, true);
                previousHowl.unload();
                void nextHowl;
                return;
            }

            void this.resolveNativeAudioBlobUrl(candidate.value)
                .then((blobUrl) => {
                    if (!blobUrl) {
                        tryFallback(index + 1, id, error, previousHowl);
                        return;
                    }

                    const nextHowl = createUrlHowlAt(blobUrl, index, true);
                    previousHowl.unload();
                    void nextHowl;
                })
                .catch(() => {
                    tryFallback(index + 1, id, error, previousHowl);
                });
        };

        const firstCandidate = candidates[0];
        if (!firstCandidate || firstCandidate.kind !== 'url') {
            options.onloaderror?.(0, new Error('Audio fallback candidates must start with a URL candidate.'));
            return null;
        }
        return createUrlHowlAt(firstCandidate.value, 0, false);
    }

    private async resolveNativeAudioBlobUrl(src: string): Promise<string | null> {
        const location = resolveInstalledAssetLocationFromUrl(src);
        if (!location) {
            return null;
        }

        const cacheKey = `${location.gameId}:${location.relativePath}`;
        const cached = this.nativeBlobUrlCache.get(cacheKey);
        if (cached) {
            return cached;
        }

        const pending = this.nativeBlobUrlPromises.get(cacheKey);
        if (pending) {
            return pending;
        }

        const promise = (async () => {
            const { readInstalledGamePackageAssetBlobUrl } = await import('../../features/mobile-packages/nativeGamePackagePlugin');
            const result = await readInstalledGamePackageAssetBlobUrl(location.gameId, location.relativePath);
            const blobUrl = result?.blobUrl?.trim();
            if (!blobUrl) {
                return null;
            }
            this.nativeBlobUrlCache.set(cacheKey, blobUrl);
            return blobUrl;
        })();

        this.nativeBlobUrlPromises.set(cacheKey, promise);
        try {
            return await promise;
        } finally {
            this.nativeBlobUrlPromises.delete(cacheKey);
        }
    }

    private isAudioDisabled(): boolean {
        if (typeof window === 'undefined') return false;
        const holder = window as Window & {
            __BG_DISABLE_AUDIO__?: boolean;
            __E2E_TEST_MODE__?: boolean;
        };
        if (holder.__BG_DISABLE_AUDIO__) return true;
        if (!holder.__E2E_TEST_MODE__) return false;
        try {
            return window.localStorage.getItem('audio_muted') === 'true';
        } catch {
            return false;
        }
    }

    private syncStoredSettings(): void {
        const savedMuted = localStorage.getItem('audio_muted');
        const savedMasterVolume = localStorage.getItem('audio_master_volume');
        const savedSfxVolume = localStorage.getItem('audio_sfx_volume');
        const savedBgmVolume = localStorage.getItem('audio_bgm_volume');

        if (savedMuted !== null) {
            this._muted = savedMuted === 'true';
            Howler.mute(this._muted);
        }
        if (savedMasterVolume !== null) {
            this._masterVolume = parseFloat(savedMasterVolume);
            Howler.volume(this._masterVolume);
        }
        if (savedSfxVolume !== null) {
            this._sfxVolume = parseFloat(savedSfxVolume);
        }
        if (savedBgmVolume !== null) {
            this._bgmVolume = parseFloat(savedBgmVolume);
        }
    }

    private getAudioContext(): AudioContext | null {
        return (Howler as unknown as { ctx?: AudioContext }).ctx ?? null;
    }

    private isContextSuspended(): boolean {
        const ctx = this.getAudioContext();
        return Boolean(ctx && ctx.state === 'suspended');
    }

    private resumeContextIfNeeded(): void {
        const ctx = this.getAudioContext();
        if (!ctx) return;
        if (ctx.state === 'running') {
            this._userGestureObserved = true;
            return;
        }
        if (ctx.state !== 'suspended') return;
        // 不再用 _userGestureObserved 守卫：始终尝试 resume，
        // 浏览器会在非用户手势上下文中自动拒绝（无害）
        ctx.resume()
            .then(() => {
                this._userGestureObserved = true;
            })
            .catch(() => {
                // 解锁依赖用户手势，失败时等待用户手势再重试
            });
    }

    private registerUnlockHandler(): void {
        if (this._unlockListenerAttached) return;
        if (typeof window === 'undefined') return;
        this._unlockListenerAttached = true;

        const cleanup = () => {
            window.removeEventListener('pointerdown', handler);
            window.removeEventListener('keydown', handler);
            window.removeEventListener('touchstart', handler);
        };

        const handler = () => {
            cleanup();
            this._unlockListenerAttached = false;
            this._userGestureObserved = true;

            const ctx = this.getAudioContext();
            const pendingKey = this._pendingBgmKey;
            this._pendingBgmKey = null;

            // 等待 ctx.resume() 真正完成后再播放 BGM，
            // 避免 playBgm 检查 isContextSuspended() 时 context 仍处于 suspended
            const afterResume = () => {
                if (pendingKey) {
                    this.playBgm(pendingKey);
                }
            };

            if (ctx && ctx.state === 'suspended') {
                ctx.resume()
                    .then(afterResume)
                    .catch(afterResume);
            } else {
                afterResume();
            }
        };

        window.addEventListener('pointerdown', handler, { once: true });
        window.addEventListener('keydown', handler, { once: true });
        window.addEventListener('touchstart', handler, { once: true });
    }

    private setupLimiterIfNeeded(): void {
        if (this._limiterSetup) return;
        const ctx = this.getAudioContext();
        const masterGain = (Howler as unknown as { masterGain?: GainNode }).masterGain;
        if (!ctx || !masterGain) return;

        const compressor = ctx.createDynamicsCompressor();
        compressor.threshold.setValueAtTime(-12, ctx.currentTime);
        compressor.knee.setValueAtTime(8, ctx.currentTime);
        compressor.ratio.setValueAtTime(12, ctx.currentTime);
        compressor.attack.setValueAtTime(0.003, ctx.currentTime);
        compressor.release.setValueAtTime(0.25, ctx.currentTime);

        const outputGain = ctx.createGain();
        outputGain.gain.setValueAtTime(1, ctx.currentTime);

        try {
            masterGain.disconnect();
        } catch {
            // 忽略已断开或不支持的情况
        }

        masterGain.connect(compressor);
        compressor.connect(outputGain);
        outputGain.connect(ctx.destination);

        this._limiterSetup = true;
    }

    private notifyBgmChange(): void {
        this.bgmListeners.forEach((listener) => listener(this._currentBgm));
    }

    private notifyBgmEnd(key: string): boolean {
        let handled = false;
        for (const listener of Array.from(this.bgmEndListeners)) {
            if (listener(key) === true) {
                handled = true;
            }
        }
        return handled;
    }

    private resolveRegistrySoundDefinition(key: SoundKey): SoundDefinition | null {
        const entry = this.registryEntries.get(key);
        if (!entry || entry.type !== 'sfx') return null;
        const src = buildAudioSrc(this.registryBasePath, entry.src);
        return {
            src,
            category: entry.category,
        };
    }

    private resolveRegistryBgmDefinition(key: string): BgmDefinition | null {
        const entry = this.registryEntries.get(key);
        if (!entry || entry.type !== 'bgm') return null;
        return {
            key: entry.key,
            name: extractNameFromSrc(entry.src),
            src: buildAudioSrc(this.registryBasePath, entry.src),
            category: entry.category,
        };
    }

    private resolveHowlLoadState(howl: Howl): AudioLoadState {
        if (howl.playing()) {
            return 'playing';
        }
        const state = howl.state();
        if (state === 'loading') {
            return 'loading';
        }
        if (state === 'loaded') {
            return 'loaded';
        }
        return 'idle';
    }

    private clearBgmLoopRestart(key: string): void {
        const timer = this.bgmLoopRestartTimers.get(key);
        if (timer !== undefined) {
            clearTimeout(timer);
            this.bgmLoopRestartTimers.delete(key);
        }
    }

    private clearBgmLoopState(key: string): void {
        this.clearBgmLoopRestart(key);
        this.bgmRapidEndCounts.delete(key);
        this.bgmLastPlayStartedAt.delete(key);
    }

    private markBgmPlayStarted(key: string): void {
        this.bgmLastPlayStartedAt.set(key, Date.now());
    }

    private stopBrokenBgmLoop(key: string, howl: Howl): void {
        const definition = this.bgmDefinitions.get(key);
        console.error(`[Audio] bgm_loop_aborted key=${key} reason=rapid_end src=${formatSrcForLog(definition?.src ?? [])}`);
        this.clearBgmLoopState(key);
        howl.stop();
        howl.unload();
        if (this.bgms.get(key) === howl) {
            this.bgms.delete(key);
        }
        if (this._currentBgm === key) {
            this._currentBgm = null;
            this.notifyBgmChange();
        }
    }

    private scheduleBgmLoopRestart(key: string, howl: Howl): void {
        if (this.bgmLoopRestartTimers.has(key)) {
            return;
        }
        const timer = setTimeout(() => {
            this.bgmLoopRestartTimers.delete(key);
            if (this._currentBgm !== key) return;
            if (this.bgms.get(key) !== howl) return;
            howl.volume(this._bgmVolume);
            this.markBgmPlayStarted(key);
            howl.play();
        }, 0);
        this.bgmLoopRestartTimers.set(key, timer);
    }

    private handleBgmEnded(key: string, howl: Howl): void {
        if (this._currentBgm !== key) return;
        if (this.bgms.get(key) !== howl) return;

        const lastStartedAt = this.bgmLastPlayStartedAt.get(key) ?? 0;
        const endedQuickly = lastStartedAt > 0 && (Date.now() - lastStartedAt) <= RAPID_BGM_END_THRESHOLD_MS;
        const rapidEndCount = endedQuickly ? (this.bgmRapidEndCounts.get(key) ?? 0) + 1 : 1;
        this.bgmRapidEndCounts.set(key, rapidEndCount);

        if (rapidEndCount >= MAX_RAPID_BGM_ENDS) {
            this.stopBrokenBgmLoop(key, howl);
            return;
        }

        if (this.notifyBgmEnd(key)) {
            return;
        }

        this.scheduleBgmLoopRestart(key, howl);
    }


    /**
     * 注册通用 registry 条目（仅缓存索引）
     */
    registerRegistryEntries(entries: AudioRegistryEntry[], basePath: string): void {
        this.registryEntries = new Map(entries.map(entry => [entry.key, entry]));
        this.registryBasePath = normalizeBasePath(basePath);
    }

    /**
     * 初始化音频管理器
     */
    initialize(): void {
        if (this._initialized) return;
        this.syncStoredSettings();
        this._initialized = true;
        if (this.isAudioDisabled()) {
            this._pendingBgmKey = null;
            return;
        }

        // 尽早注册用户手势监听，确保首次交互即可解锁 AudioContext
        this.registerUnlockHandler();
    }

    /**
     * 从 localStorage 重新读取设置并应用到内存状态。
     * 用于登出时还原游客本地偏好（因为远程同步 apply 只改内存，不写 localStorage）。
     */
    restoreLocalSettings(): void {
        this.syncStoredSettings();
        if (localStorage.getItem('audio_master_volume') === null) {
            this._masterVolume = 1.0;
            Howler.volume(this._masterVolume);
        }
        if (localStorage.getItem('audio_sfx_volume') === null) {
            this._sfxVolume = 1.0;
        }
        if (localStorage.getItem('audio_bgm_volume') === null) {
            this._bgmVolume = 0.6;
        }

        if (this._currentBgm) {
            this.bgms.get(this._currentBgm)?.volume(this._bgmVolume);
        }
    }

    /**
     * 注册单个音效
     */
    register(key: SoundKey, definition: SoundDefinition): void {
        this.soundDefinitions.set(key, definition);
        if (this.sounds.has(key)) {
            this.sounds.get(key)?.unload();
            this.sounds.delete(key);
        }
        this.failedKeys.delete(key);
    }

    /**
     * 批量注册音频（仅登记定义，按需加载）
     */
    registerAll(config: GameAudioConfig, basePath: string = ''): void {
        if (this.isAudioDisabled()) return;
        const normalizedBasePath = normalizeBasePath(basePath);

        // 登记音效定义
        if (config.sounds) {
            for (const [key, def] of Object.entries(config.sounds)) {
                const soundDef = def as SoundDefinition;
                const src = Array.isArray(soundDef.src)
                    ? soundDef.src.map(s => buildAudioSrc(normalizedBasePath, s))
                    : buildAudioSrc(normalizedBasePath, soundDef.src);
                this.register(key, { ...soundDef, src });
            }
        }

        // 登记 BGM 定义
        if (config.bgm) {
            for (const def of config.bgm) {
                const bgmDef = def as BgmDefinition;
                const src = Array.isArray(bgmDef.src)
                    ? bgmDef.src.map(s => buildAudioSrc(normalizedBasePath, s))
                    : buildAudioSrc(normalizedBasePath, bgmDef.src);

                this.bgmDefinitions.set(bgmDef.key, { ...bgmDef, src });
                if (this.bgms.has(bgmDef.key)) {
                    this.bgms.get(bgmDef.key)?.unload();
                    this.bgms.delete(bgmDef.key);
                }
            }
        }

        // 仅影响 WebAudio 音效链路，HTML5 BGM 不受影响
        this.setupLimiterIfNeeded();
    }

    /**
     * 播放音效
     */
    play(key: SoundKey, spriteKey?: string, onEnd?: () => void): number | null {
        if (this.isAudioDisabled()) return null;
        if (this.failedKeys.has(key)) {
            notifyAudioPlaybackFailure('audioRuntime.toast.known_failed', key, `audio.known-failed.${key}`);
            return null;
        }
        let howl = this.sounds.get(key);
        if (!howl) {
            // 限制同时进行的按需加载数，防止浏览器连接拥堵导致延迟
            if (this._loadingCount >= MAX_CONCURRENT_LOADS) {
                return null;
            }
            const definition = this.soundDefinitions.get(key) ?? this.resolveRegistrySoundDefinition(key);
            if (!definition) {
                console.warn(`[Audio] missing_sfx key=${key} registryCount=${this.registryEntries.size} definedCount=${this.soundDefinitions.size}`);
                notifyAudioPlaybackFailure('audioRuntime.toast.missing_key', key, `audio.missing-sfx.${key}`);
                return null;
            }
            this.soundDefinitions.set(key, definition);
            this._loadingCount++;
            const requestedAt = Date.now();
            const createdHowl = this.createHowlWithFallback(definition.src, {
                volume: (definition.volume ?? 1.0) * this._sfxVolume,
                loop: definition.loop ?? false,
                sprite: definition.sprite,
                preload: true,
                onReplace: (nextHowl) => {
                    this.sounds.set(key, nextHowl);
                },
                onFallbackReady: (nextHowl) => {
                    const retryPlay = () => {
                        if (Date.now() - requestedAt > SFX_FRESH_PLAY_WINDOW_MS) {
                            return;
                        }
                        const retriedSoundId = nextHowl.play(spriteKey);
                        if (onEnd && retriedSoundId != null) {
                            nextHowl.once('end', onEnd, retriedSoundId);
                        }
                    };
                    if (nextHowl.state() === 'loaded') {
                        retryPlay();
                        return;
                    }
                    nextHowl.once('load', retryPlay);
                },
                onload: () => {
                    this._loadingCount = Math.max(0, this._loadingCount - 1);
                },
                onloaderror: (_id, error) => {
                    this._loadingCount = Math.max(0, this._loadingCount - 1);
                    console.error(`[Audio] load_sfx_failed key=${key} src=${formatSrcForLog(definition.src)} error=${String(error)}`);
                    this.failedKeys.add(key);
                    notifyAudioPlaybackFailure(
                        String(error).includes('URL candidate')
                            ? 'audioRuntime.toast.invalid_source'
                            : 'audioRuntime.toast.load_failed',
                        key,
                        `audio.load-sfx-failed.${key}`,
                    );
                }
            });
            if (!createdHowl) {
                return null;
            }
            howl = createdHowl;
            this.sounds.set(key, createdHowl);
            if (createdHowl.state() === 'loading') {
                const playFreshlyLoadedSound = () => {
                    if (Date.now() - requestedAt > SFX_FRESH_PLAY_WINDOW_MS) {
                        return;
                    }
                    this.resumeContextIfNeeded();
                    const loadedSoundId = createdHowl.play(spriteKey);
                    if (onEnd && loadedSoundId != null) {
                        createdHowl.once('end', onEnd, loadedSoundId);
                    }
                };
                createdHowl.once('load', playFreshlyLoadedSound);
                return null;
            }
        } else if (howl.state() === 'loading') {
            // 音频仍在加载中，不再重复入队，避免加载完成后延迟播放过时的音效
            return null;
        }
        this.resumeContextIfNeeded();
        const soundId = howl.play(spriteKey);
        if (onEnd && soundId != null) {
            howl.once('end', onEnd, soundId);
        }
        if (this.isContextSuspended()) {
            howl.once('unlock', () => {
                this.resumeContextIfNeeded();
                if (soundId != null && !howl.playing(soundId)) {
                    howl.play(soundId);
                }
            });
        }
        return soundId;
    }

    private _bgmReadyResolve: (() => void) | null = null;
    private _bgmReadyPromise: Promise<void> | null = null;

    /**
     * 播放 BGM
     */
    playBgm(key: string): void {
        if (this.isAudioDisabled()) {
            this.stopBgm();
            return;
        }
        let howl = this.bgms.get(key);
        if (!howl) {
            const definition = this.bgmDefinitions.get(key);
            const registryDef = this.resolveRegistryBgmDefinition(key);
            const mergedDef = registryDef
                ? { ...registryDef, ...definition, src: registryDef.src }
                : definition;
            if (!mergedDef) {
                console.warn(`[Audio] missing_bgm key=${key} registryCount=${this.registryEntries.size} definedCount=${this.bgmDefinitions.size}`);
                notifyAudioPlaybackFailure('audioRuntime.toast.missing_key', key, `audio.missing-bgm.${key}`);
                return;
            }
            this.bgmDefinitions.set(key, mergedDef);
            // 创建 BGM 就绪 Promise，供 preloadKeys 等待
            this._bgmReadyPromise = new Promise<void>(resolve => {
                this._bgmReadyResolve = resolve;
            });
            const createdHowl = this.createHowlWithFallback(mergedDef.src, {
                volume: (mergedDef.volume ?? 1.0) * this._bgmVolume,
                // 对 html5 BGM 关闭 Howler 内建 loop，改为异步手动重播，
                // 避免异常媒体状态下出现 _ended -> play 的同步递归。
                loop: false,
                html5: true,
                preload: false,
                onReplace: (nextHowl) => {
                    this.bgms.set(key, nextHowl);
                },
                onFallbackReady: (nextHowl) => {
                    const retryPlay = () => {
                        nextHowl.volume(0);
                        this.markBgmPlayStarted(key);
                        const nextPlayId = nextHowl.play();
                        nextHowl.fade(0, this._bgmVolume, 1000, nextPlayId);
                    };
                    if (nextHowl.state() === 'loaded') {
                        retryPlay();
                        return;
                    }
                    nextHowl.once('load', retryPlay);
                },
                onload: () => {},
                onplay: () => {
                    // BGM 开始播放（流式，不需要完全下载），通知音效预加载可以开始
                    this._bgmReadyResolve?.();
                    this._bgmReadyResolve = null;
                },
                onloaderror: (_id, error) => {
                    console.error(`[Audio] load_bgm_failed key=${key} src=${formatSrcForLog(mergedDef.src)} error=${String(error)}`);
                    notifyAudioPlaybackFailure(
                        String(error).includes('URL candidate')
                            ? 'audioRuntime.toast.invalid_source'
                            : 'audioRuntime.toast.load_failed',
                        key,
                        `audio.load-bgm-failed.${key}`,
                    );
                    // 加载失败也要 resolve，不阻塞音效预加载
                    this._bgmReadyResolve?.();
                    this._bgmReadyResolve = null;
                },
                onplayerror: () => {
                    this._pendingBgmKey = key;
                    this.registerUnlockHandler();
                    // 播放失败（自动播放策略）也要 resolve
                    this._bgmReadyResolve?.();
                    this._bgmReadyResolve = null;
                },
                onend: () => {
                    const currentHowl = this.bgms.get(key);
                    if (currentHowl) {
                        this.handleBgmEnded(key, currentHowl);
                    }
                },
            });
            if (!createdHowl) {
                return;
            }
            howl = createdHowl;
            this.bgms.set(key, createdHowl);
        }

        // BGM 使用 html5: true，走浏览器原生 <audio>，不依赖 WebAudio context。
        // 不再用 isContextSuspended() 阻止播放；
        // 若浏览器自动播放策略阻止了 HTML5 Audio，由 onplayerror 捕获并重试。
        this.resumeContextIfNeeded();

        const isSameBgm = this._currentBgm === key;
        if (isSameBgm && howl.playing()) return;

        // 停止当前 BGM
        if (this._currentBgm && !isSameBgm) {
            this.clearBgmLoopState(this._currentBgm);
            this.bgms.get(this._currentBgm)?.fade(this._bgmVolume, 0, 1000);
            const prevBgm = this._currentBgm;
            setTimeout(() => {
                const prevHowl = this.bgms.get(prevBgm);
                prevHowl?.stop();
                prevHowl?.unload();
                this.bgms.delete(prevBgm);
            }, 1000);
        }

        this.clearBgmLoopRestart(key);
        howl.volume(0);
        this.markBgmPlayStarted(key);
        const playId = howl.play();
        howl.fade(0, this._bgmVolume, 1000, playId);
        if (!isSameBgm) {
            this._currentBgm = key;
            this.notifyBgmChange();
        }
    }

    /**
     * 停止 BGM
     */
    stopBgm(): void {
        if (this._currentBgm) {
            this.clearBgmLoopState(this._currentBgm);
            this.bgms.get(this._currentBgm)?.stop();
            this._currentBgm = null;
            this.notifyBgmChange();
        }
        this._pendingBgmKey = null;
    }

    /**
     * 设置主音量
     * @param persist 是否写入 localStorage（远程同步 apply 时传 false，避免污染游客本地偏好）
     */
    setMasterVolume(volume: number, persist = true): void {
        this._masterVolume = Math.max(0, Math.min(1, volume));
        Howler.volume(this._masterVolume);
        if (persist) {
            localStorage.setItem('audio_master_volume', String(this._masterVolume));
        }
    }

    /**
     * 设置音效音量
     * @param persist 是否写入 localStorage
     */
    setSfxVolume(volume: number, persist = true): void {
        this._sfxVolume = Math.max(0, Math.min(1, volume));
        for (const howl of this.sounds.values()) {
            howl.volume(this._sfxVolume);
        }
        if (persist) {
            localStorage.setItem('audio_sfx_volume', String(this._sfxVolume));
        }
    }

    /**
     * 设置 BGM 音量
     * @param persist 是否写入 localStorage
     */
    setBgmVolume(volume: number, persist = true): void {
        this._bgmVolume = Math.max(0, Math.min(1, volume));
        if (this._currentBgm) {
            this.bgms.get(this._currentBgm)?.volume(this._bgmVolume);
        }
        if (persist) {
            localStorage.setItem('audio_bgm_volume', String(this._bgmVolume));
        }
    }

    /**
     * 获取状态
     */
    get muted(): boolean { return this._muted; }
    get masterVolume(): number { return this._masterVolume; }
    get sfxVolume(): number { return this._sfxVolume; }
    get bgmVolume(): number { return this._bgmVolume; }
    get currentBgm(): string | null { return this._currentBgm; }

    isFailed(key: SoundKey): boolean {
        return this.failedKeys.has(key);
    }

    getSfxLoadState(key: SoundKey): AudioLoadState {
        if (this.failedKeys.has(key)) {
            return 'failed';
        }
        const howl = this.sounds.get(key);
        if (howl) {
            return this.resolveHowlLoadState(howl);
        }
        const definition = this.soundDefinitions.get(key) ?? this.resolveRegistrySoundDefinition(key);
        return definition ? 'idle' : 'missing';
    }

    getBgmLoadState(key: string): AudioLoadState {
        const howl = this.bgms.get(key);
        if (howl) {
            return this.resolveHowlLoadState(howl);
        }
        const definition = this.bgmDefinitions.get(key) ?? this.resolveRegistryBgmDefinition(key);
        return definition ? 'idle' : 'missing';
    }

    /**
     * @param persist 是否写入 localStorage（远程同步 apply 时传 false，避免污染游客本地偏好）
     */
    setMuted(muted: boolean, persist = true): void {
        this._muted = muted;
        Howler.mute(muted);
        if (persist) {
            localStorage.setItem('audio_muted', String(muted));
        }
    }

    onBgmChange(listener: (currentBgm: string | null) => void): () => void {
        this.bgmListeners.add(listener);
        return () => {
            this.bgmListeners.delete(listener);
        };
    }

    onBgmEnd(listener: (endedBgm: string) => boolean | void): () => void {
        this.bgmEndListeners.add(listener);
        return () => {
            this.bgmEndListeners.delete(listener);
        };
    }

    /**
     * 预加载音效（空闲时分批，不与图片/BGM 竞争连接）
     *
     * 优先级：关键图片 > BGM > 音效预加载
     * 1. 等待关键图片就绪
     * 2. 等待 BGM 开始播放（流式，只需缓冲一小段）或 3s 超时
     * 3. 每批最多 PRELOAD_BATCH_SIZE 个，通过 requestIdleCallback 空闲调度
     */
    preloadKeys(keys: SoundKey[]): void {
        if (this.isAudioDisabled()) return;
        // 过滤出需要加载的 key
        const pending = keys.filter(key =>
            !this.sounds.has(key) && !this.failedKeys.has(key)
        );
        if (pending.length === 0) return;

        const PRELOAD_BATCH_SIZE = 2;
        let index = 0;
        let bgmWaited = false;

        const loadBatch = () => {
            if (!isCriticalImagesReady()) {
                scheduleAfterImages(() => loadBatch());
                return;
            }
            const end = Math.min(index + PRELOAD_BATCH_SIZE, pending.length);
            for (; index < end; index++) {
                const key = pending[index];
                if (this.sounds.has(key) || this.failedKeys.has(key)) continue;
                const definition = this.soundDefinitions.get(key) ?? this.resolveRegistrySoundDefinition(key);
                if (!definition) continue;
                this.soundDefinitions.set(key, definition);
                void this.preloadSoundDefinition(key, definition, {
                    onError: (error) => {
                        console.error(`[Audio] preload_failed key=${key} src=${formatSrcForLog(definition.src)} error=${String(error)}`);
                        this.failedKeys.add(key);
                        notifyAudioPlaybackFailure(
                            String(error).includes('URL candidate')
                                ? 'audioRuntime.toast.invalid_source'
                                : 'audioRuntime.toast.load_failed',
                            key,
                            `audio.preload-failed.${key}`,
                            'audioRuntime.toast.preload_failed_title',
                        );
                    },
                }).catch(() => {
                    // 后台预加载失败已在 onError 中记录并降级，不能冒泡成 window.unhandledrejection。
                });
            }
            if (index < pending.length) {
                scheduleAfterImages(() => loadBatch());
            }
        };

        /** 等关键图片 + BGM 就绪后在空闲时执行回调 */
        const scheduleAfterImages = (fn: () => void) => {
            waitForCriticalImages().then(() => {
                // 首次：等 BGM 开始播放后再加载音效（最多等 3s）
                const afterBgm = bgmWaited
                    ? Promise.resolve()
                    : this.waitForBgmReady();
                bgmWaited = true;
                afterBgm.then(() => {
                    if (typeof requestIdleCallback === 'function') {
                        requestIdleCallback(() => fn(), { timeout: 3000 });
                    } else {
                        setTimeout(fn, 200);
                    }
                });
            });
        };

        scheduleAfterImages(() => loadBatch());
    }

    preloadBlockingKeys(
        keys: SoundKey[],
        onProgress?: (loaded: number, total: number) => void,
    ): Promise<void> {
        if (this.isAudioDisabled() || keys.length === 0) {
            return Promise.resolve();
        }

        const uniqueKeys = Array.from(new Set(keys.filter(Boolean)));
        if (uniqueKeys.length === 0) {
            return Promise.resolve();
        }

        let loaded = 0;
        const total = uniqueKeys.length;
        onProgress?.(loaded, total);

        const markLoaded = () => {
            loaded += 1;
            onProgress?.(loaded, total);
        };

        const tasks = uniqueKeys.map(async (key) => {
            const currentState = this.getSfxLoadState(key);
            if (currentState === 'loaded' || currentState === 'playing') {
                markLoaded();
                return;
            }
            if (currentState === 'failed' || currentState === 'missing') {
                markLoaded();
                return;
            }

            const existingHowl = this.sounds.get(key);
            if (existingHowl) {
                const state = existingHowl.state();
                if (state === 'loaded') {
                    markLoaded();
                    return;
                }
                await new Promise<void>((resolve) => {
                    existingHowl.once('load', () => resolve());
                    existingHowl.once('loaderror', () => resolve());
                });
                markLoaded();
                return;
            }

            const definition = this.soundDefinitions.get(key) ?? this.resolveRegistrySoundDefinition(key);
            if (!definition) {
                markLoaded();
                return;
            }
            this.soundDefinitions.set(key, definition);
            try {
                await this.preloadSoundDefinition(key, definition, {
                    onError: (error) => {
                        console.error(`[Audio] blocking_preload_failed key=${key} src=${formatSrcForLog(definition.src)} error=${String(error)}`);
                        this.failedKeys.add(key);
                    },
                });
            } catch {
                // 前台门禁允许失败后放行，避免单个音频源异常卡死进房。
            }
            markLoaded();
        });

        return Promise.all(tasks).then(() => undefined);
    }

    /** 等待 BGM 开始播放或超时（3s），不阻塞无 BGM 的场景 */
    private waitForBgmReady(): Promise<void> {
        if (!this._bgmReadyPromise) return Promise.resolve();
        return Promise.race([
            this._bgmReadyPromise,
            new Promise<void>(resolve => setTimeout(resolve, 3000)),
        ]);
    }


    /**
     * 停止指定音效（不影响 BGM）
     */
    stopSfx(key: SoundKey): void {
        this.sounds.get(key)?.stop();
    }

    stopAll(): void {
        Howler.stop();
        for (const key of this.bgms.keys()) {
            this.clearBgmLoopState(key);
        }
        if (this._currentBgm !== null) {
            this._currentBgm = null;
            this.notifyBgmChange();
        }
    }


    unloadAll(): void {
        for (const key of this.bgms.keys()) {
            this.clearBgmLoopState(key);
        }
        for (const howl of this.sounds.values()) howl.unload();
        for (const howl of this.bgms.values()) howl.unload();
        this.sounds.clear();
        this.bgms.clear();
        for (const blobUrl of this.nativeBlobUrlCache.values()) {
            try {
                URL.revokeObjectURL(blobUrl);
            } catch {
                // ignore blob revoke failures
            }
        }
        this.nativeBlobUrlCache.clear();
        this.nativeBlobUrlPromises.clear();
        this._loadingCount = 0;
        this._pendingBgmKey = null;
        if (this._currentBgm !== null) {
            this._currentBgm = null;
            this.notifyBgmChange();
        }
    }
}

// 导出单例
export const AudioManager = new AudioManagerClass();
