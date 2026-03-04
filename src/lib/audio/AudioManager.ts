/**
 * 音频管理器 - Howler.js 封装
 * 提供全局音效播放、静音、音量控制
 */
import { Howl, Howler } from 'howler';
import type { SoundDefinition, SoundKey, GameAudioConfig, BgmDefinition } from './types';
import type { AudioRegistryEntry } from './commonRegistry';
import { assetsPath, getOptimizedAudioUrl, waitForCriticalImages, isCriticalImagesReady } from '../../core/AssetLoader';

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

const MAX_CONCURRENT_LOADS = 4;

const extractNameFromSrc = (src: string): string => {
    const fileName = src.split('/').pop() ?? src;
    return fileName.replace(/\.[^.]+$/, '');
};

class AudioManagerClass {
    private sounds: Map<SoundKey, Howl> = new Map();
    private soundDefinitions: Map<SoundKey, SoundDefinition> = new Map();
    private bgms: Map<string, Howl> = new Map();
    private bgmDefinitions: Map<string, BgmDefinition> = new Map();
    private registryEntries: Map<string, AudioRegistryEntry> = new Map();
    private registryBasePath: string = '';
    private failedKeys: Set<SoundKey> = new Set();

    private bgmListeners: Set<(currentBgm: string | null) => void> = new Set();

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
        // 尝试恢复用户设置
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
        this._initialized = true;

        // 尽早注册用户手势监听，确保首次交互即可解锁 AudioContext
        this.registerUnlockHandler();
    }

    /**
     * 从 localStorage 重新读取设置并应用到内存状态。
     * 用于登出时还原游客本地偏好（因为远程同步 apply 只改内存，不写 localStorage）。
     */
    restoreLocalSettings(): void {
        const savedMuted = localStorage.getItem('audio_muted');
        const savedMasterVolume = localStorage.getItem('audio_master_volume');
        const savedSfxVolume = localStorage.getItem('audio_sfx_volume');
        const savedBgmVolume = localStorage.getItem('audio_bgm_volume');

        this._muted = savedMuted === 'true';
        Howler.mute(this._muted);

        if (savedMasterVolume !== null) {
            this._masterVolume = parseFloat(savedMasterVolume);
        } else {
            this._masterVolume = 1.0;
        }
        Howler.volume(this._masterVolume);

        this._sfxVolume = savedSfxVolume !== null ? parseFloat(savedSfxVolume) : 1.0;
        this._bgmVolume = savedBgmVolume !== null ? parseFloat(savedBgmVolume) : 0.6;

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
        if (typeof window !== 'undefined') {
            const holder = window as Window & { __BG_DISABLE_AUDIO__?: boolean };
            if (holder.__BG_DISABLE_AUDIO__) return;
        }
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
        if (this.failedKeys.has(key)) return null;
        let howl = this.sounds.get(key);
        if (!howl) {
            // 限制同时进行的按需加载数，防止浏览器连接拥堵导致延迟
            if (this._loadingCount >= MAX_CONCURRENT_LOADS) {
                return null;
            }
            const definition = this.soundDefinitions.get(key) ?? this.resolveRegistrySoundDefinition(key);
            if (!definition) {
                console.warn(`[Audio] missing_sfx key=${key} registryCount=${this.registryEntries.size} definedCount=${this.soundDefinitions.size}`);
                return null;
            }
            this.soundDefinitions.set(key, definition);
            this._loadingCount++;
            howl = new Howl({
                src: Array.isArray(definition.src) ? definition.src : [definition.src],
                volume: (definition.volume ?? 1.0) * this._sfxVolume,
                loop: definition.loop ?? false,
                sprite: definition.sprite,
                preload: true,
                onload: () => {
                    this._loadingCount = Math.max(0, this._loadingCount - 1);
                },
                onloaderror: (_id, error) => {
                    this._loadingCount = Math.max(0, this._loadingCount - 1);
                    console.error(`[Audio] load_sfx_failed key=${key} src=${formatSrcForLog(definition.src)} error=${String(error)}`);
                    this.failedKeys.add(key);
                }
            });
            this.sounds.set(key, howl);
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
        let howl = this.bgms.get(key);
        if (!howl) {
            const definition = this.bgmDefinitions.get(key);
            const registryDef = this.resolveRegistryBgmDefinition(key);
            const mergedDef = registryDef
                ? { ...registryDef, ...definition, src: registryDef.src }
                : definition;
            if (!mergedDef) {
                console.warn(`[Audio] missing_bgm key=${key} registryCount=${this.registryEntries.size} definedCount=${this.bgmDefinitions.size}`);
                return;
            }
            this.bgmDefinitions.set(key, mergedDef);
            // 创建 BGM 就绪 Promise，供 preloadKeys 等待
            this._bgmReadyPromise = new Promise<void>(resolve => {
                this._bgmReadyResolve = resolve;
            });
            howl = new Howl({
                src: Array.isArray(mergedDef.src) ? mergedDef.src : [mergedDef.src],
                volume: (mergedDef.volume ?? 1.0) * this._bgmVolume,
                loop: true,
                html5: true,
                preload: false,
                onload: () => {},
                onplay: () => {
                    // BGM 开始播放（流式，不需要完全下载），通知音效预加载可以开始
                    this._bgmReadyResolve?.();
                    this._bgmReadyResolve = null;
                },
                onloaderror: (_id, error) => {
                    console.error(`[Audio] load_bgm_failed key=${key} src=${formatSrcForLog(mergedDef.src)} error=${String(error)}`);
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
            });
            this.bgms.set(key, howl);
        }

        // BGM 使用 html5: true，走浏览器原生 <audio>，不依赖 WebAudio context。
        // 不再用 isContextSuspended() 阻止播放；
        // 若浏览器自动播放策略阻止了 HTML5 Audio，由 onplayerror 捕获并重试。
        this.resumeContextIfNeeded();

        const isSameBgm = this._currentBgm === key;
        if (isSameBgm && howl.playing()) return;

        // 停止当前 BGM
        if (this._currentBgm && !isSameBgm) {
            this.bgms.get(this._currentBgm)?.fade(this._bgmVolume, 0, 1000);
            const prevBgm = this._currentBgm;
            setTimeout(() => {
                const prevHowl = this.bgms.get(prevBgm);
                prevHowl?.stop();
                prevHowl?.unload();
                this.bgms.delete(prevBgm);
            }, 1000);
        }

        howl.volume(0);
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

    /**
     * 预加载音效（空闲时分批，不与图片/BGM 竞争连接）
     *
     * 优先级：关键图片 > BGM > 音效预加载
     * 1. 等待关键图片就绪
     * 2. 等待 BGM 开始播放（流式，只需缓冲一小段）或 3s 超时
     * 3. 每批最多 PRELOAD_BATCH_SIZE 个，通过 requestIdleCallback 空闲调度
     */
    preloadKeys(keys: SoundKey[]): void {
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
                const howl = new Howl({
                    src: Array.isArray(definition.src) ? definition.src : [definition.src],
                    volume: (definition.volume ?? 1.0) * this._sfxVolume,
                    loop: definition.loop ?? false,
                    sprite: definition.sprite,
                    preload: true,
                    onloaderror: (_id, error) => {
                        console.error(`[Audio] preload_failed key=${key} src=${formatSrcForLog(definition.src)} error=${String(error)}`);
                        this.failedKeys.add(key);
                    },
                });
                this.sounds.set(key, howl);
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
        if (this._currentBgm !== null) {
            this._currentBgm = null;
            this.notifyBgmChange();
        }
    }


    unloadAll(): void {
        for (const howl of this.sounds.values()) howl.unload();
        for (const howl of this.bgms.values()) howl.unload();
        this.sounds.clear();
        this.bgms.clear();
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
