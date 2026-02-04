/**
 * 音频管理器 - Howler.js 封装
 * 提供全局音效播放、静音、音量控制
 */
import { Howl, Howler } from 'howler';
import type { SoundDefinition, SoundKey, GameAudioConfig, BgmDefinition } from './types';
import { assetsPath } from '../../core/AssetLoader';

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
    if (!basePath) {
        return assetsPath(src);
    }
    const trimmed = src.startsWith('/') ? src.slice(1) : src;
    return `${basePath}${trimmed}`;
};

class AudioManagerClass {
    private sounds: Map<SoundKey, Howl> = new Map();
    private bgms: Map<string, Howl> = new Map();
    private failedKeys: Set<SoundKey> = new Set();

    private bgmListeners: Set<(currentBgm: string | null) => void> = new Set();

    private _muted: boolean = false;
    private _masterVolume: number = 1.0;
    private _sfxVolume: number = 1.0;
    private _bgmVolume: number = 0.6;

    private _currentBgm: string | null = null;
    private _initialized: boolean = false;
    private _limiterSetup: boolean = false;

    private getAudioContext(): AudioContext | null {
        return (Howler as unknown as { ctx?: AudioContext }).ctx ?? null;
    }

    private isContextSuspended(): boolean {
        const ctx = this.getAudioContext();
        return Boolean(ctx && ctx.state === 'suspended');
    }

    private resumeContextIfNeeded(): void {
        const ctx = this.getAudioContext();
        if (ctx && ctx.state === 'suspended') {
            ctx.resume().catch(() => {
                // 解锁依赖用户手势，失败时等待 unlock 再重试
            });
        }
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
    }

    /**
     * 注册单个音效
     */
    register(key: SoundKey, definition: SoundDefinition): void {
        if (this.sounds.has(key)) {
            this.sounds.get(key)?.unload();
        }
        this.failedKeys.delete(key);

        const howl = new Howl({
            src: Array.isArray(definition.src) ? definition.src : [definition.src],
            volume: (definition.volume ?? 1.0) * this._sfxVolume,
            loop: definition.loop ?? false,
            sprite: definition.sprite,
            preload: true,
            onloaderror: (_id, error) => {
                console.error(`[AudioManager] 加载音效 "${key}" 失败:`, error);
                this.failedKeys.add(key);
            }
        });
        this.sounds.set(key, howl);
    }

    /**
     * 批量注册音频
     */
    registerAll(config: GameAudioConfig, basePath: string = ''): void {
        const normalizedBasePath = normalizeBasePath(basePath);

        // 注册音效
        if (config.sounds) {
            for (const [key, def] of Object.entries(config.sounds)) {
                const soundDef = def as SoundDefinition;
                const src = Array.isArray(soundDef.src)
                    ? soundDef.src.map(s => buildAudioSrc(normalizedBasePath, s))
                    : buildAudioSrc(normalizedBasePath, soundDef.src);
                this.register(key, { ...soundDef, src });
            }
        }

        // 注册 BGM
        if (config.bgm) {
            for (const def of config.bgm) {
                const bgmDef = def as BgmDefinition;
                const src = Array.isArray(bgmDef.src)
                    ? bgmDef.src.map(s => buildAudioSrc(normalizedBasePath, s))
                    : buildAudioSrc(normalizedBasePath, bgmDef.src);

                if (this.bgms.has(bgmDef.key)) {
                    this.bgms.get(bgmDef.key)?.unload();
                }

                const howl = new Howl({
                    src: Array.isArray(src) ? src : [src],
                    volume: (bgmDef.volume ?? 1.0) * this._bgmVolume,
                    loop: true,
                    html5: true, // BGM 通常比较大，使用 HTML5 Audio 以节省内存并支持流式播放
                    preload: false // BGM 按需加载
                });
                this.bgms.set(bgmDef.key, howl);
            }
        }

        // 仅影响 WebAudio 音效链路，HTML5 BGM 不受影响
        this.setupLimiterIfNeeded();
    }

    /**
     * 播放音效
     */
    play(key: SoundKey, spriteKey?: string): number | null {
        if (this.failedKeys.has(key)) return null;
        const howl = this.sounds.get(key);
        if (!howl) return null;
        this.resumeContextIfNeeded();
        if (this.isContextSuspended()) {
            howl.once('unlock', () => {
                this.resumeContextIfNeeded();
                howl.play(spriteKey);
            });
        }
        return howl.play(spriteKey);
    }

    /**
     * 播放 BGM
     */
    playBgm(key: string): void {
        const howl = this.bgms.get(key);
        if (!howl) {
            console.warn(`[AudioManager] BGM "${key}" 未注册`);
            return;
        }

        const isSameBgm = this._currentBgm === key;
        if (isSameBgm && howl.playing()) return;

        // 停止当前 BGM
        if (this._currentBgm && !isSameBgm) {
            this.bgms.get(this._currentBgm)?.fade(this._bgmVolume, 0, 1000);
            const prevBgm = this._currentBgm;
            setTimeout(() => {
                this.bgms.get(prevBgm)?.stop();
            }, 1000);
        }

        this.resumeContextIfNeeded();
        if (this.isContextSuspended()) {
            howl.once('unlock', () => {
                if (this._currentBgm !== key) return;
                this.resumeContextIfNeeded();
                howl.volume(0);
                const playId = howl.play();
                howl.fade(0, this._bgmVolume, 1000, playId);
            });
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
    }

    /**
     * 设置主音量
     */
    setMasterVolume(volume: number): void {
        this._masterVolume = Math.max(0, Math.min(1, volume));
        Howler.volume(this._masterVolume);
        localStorage.setItem('audio_master_volume', String(this._masterVolume));
    }

    /**
     * 设置音效音量
     */
    setSfxVolume(volume: number): void {
        this._sfxVolume = Math.max(0, Math.min(1, volume));
        for (const howl of this.sounds.values()) {
            howl.volume(this._sfxVolume);
        }
        localStorage.setItem('audio_sfx_volume', String(this._sfxVolume));
    }

    /**
     * 设置 BGM 音量
     */
    setBgmVolume(volume: number): void {
        this._bgmVolume = Math.max(0, Math.min(1, volume));
        if (this._currentBgm) {
            this.bgms.get(this._currentBgm)?.volume(this._bgmVolume);
        }
        localStorage.setItem('audio_bgm_volume', String(this._bgmVolume));
    }

    /**
     * 获取状态
     */
    get muted(): boolean { return this._muted; }
    get masterVolume(): number { return this._masterVolume; }
    get sfxVolume(): number { return this._sfxVolume; }
    get bgmVolume(): number { return this._bgmVolume; }
    get currentBgm(): string | null { return this._currentBgm; }

    setMuted(muted: boolean): void {
        this._muted = muted;
        Howler.mute(muted);
        localStorage.setItem('audio_muted', String(muted));
    }

    onBgmChange(listener: (currentBgm: string | null) => void): () => void {
        this.bgmListeners.add(listener);
        return () => {
            this.bgmListeners.delete(listener);
        };
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
        if (this._currentBgm !== null) {
            this._currentBgm = null;
            this.notifyBgmChange();
        }
    }
}

// 导出单例
export const AudioManager = new AudioManagerClass();
