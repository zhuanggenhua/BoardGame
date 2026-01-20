/**
 * 音频管理器 - Howler.js 封装
 * 提供全局音效播放、静音、音量控制
 */
import { Howl, Howler } from 'howler';
import type { SoundDefinition, SoundKey } from './types';

class AudioManagerClass {
    private sounds: Map<SoundKey, Howl> = new Map();
    private failedKeys: Set<SoundKey> = new Set();
    private _muted: boolean = false;
    private _volume: number = 1.0;
    private _initialized: boolean = false;

    /**
     * 初始化音频管理器
     */
    initialize(): void {
        if (this._initialized) return;
        // 尝试恢复用户设置
        const savedMuted = localStorage.getItem('audio_muted');
        const savedVolume = localStorage.getItem('audio_volume');
        if (savedMuted !== null) {
            this._muted = savedMuted === 'true';
            Howler.mute(this._muted);
        }
        if (savedVolume !== null) {
            this._volume = parseFloat(savedVolume);
            Howler.volume(this._volume);
        }
        this._initialized = true;
    }

    /**
     * 注册单个音效
     */
    register(key: SoundKey, definition: SoundDefinition): void {
        if (this.sounds.has(key)) {
            console.warn(`[AudioManager] 音效 "${key}" 已存在，将被覆盖`);
            this.sounds.get(key)?.unload();
        }
        // 重置错误状态
        this.failedKeys.delete(key);

        const howl = new Howl({
            src: Array.isArray(definition.src) ? definition.src : [definition.src],
            volume: definition.volume ?? 1.0,
            loop: definition.loop ?? false,
            sprite: definition.sprite,
            preload: true,
            onloaderror: (_id, error) => {
                console.error(`[AudioManager] 加载音效 "${key}" 失败:`, error);
                this.failedKeys.add(key);
            },
            onplayerror: (_id, error) => {
                console.warn(`[AudioManager] 播放音效 "${key}" 失败:`, error);
                this.failedKeys.add(key);
            }
        });
        this.sounds.set(key, howl);
    }

    /**
     * 批量注册音效
     */
    registerAll(sounds: Record<SoundKey, SoundDefinition>, basePath: string = ''): void {
        for (const [key, def] of Object.entries(sounds)) {
            const src = Array.isArray(def.src)
                ? def.src.map(s => basePath + s)
                : basePath + def.src;
            this.register(key, { ...def, src });
        }
    }

    /**
     * 播放音效
     */
    play(key: SoundKey, spriteKey?: string): number | null {
        // 如果已知加载失败，返回 null 以便触发回退
        if (this.failedKeys.has(key)) {
            return null;
        }

        const howl = this.sounds.get(key);
        if (!howl) {
            console.warn(`[AudioManager] 音效 "${key}" 未注册`);
            return null;
        }

        // 尝试播放
        const id = howl.play(spriteKey);
        return id;
    }

    /**
     * 停止音效
     */
    stop(key: SoundKey): void {
        const howl = this.sounds.get(key);
        if (howl) {
            howl.stop();
        }
    }

    /**
     * 停止所有音效
     */
    stopAll(): void {
        Howler.stop();
    }

    /**
     * 设置静音
     */
    setMuted(muted: boolean): void {
        this._muted = muted;
        Howler.mute(muted);
        localStorage.setItem('audio_muted', String(muted));
    }

    /**
     * 获取静音状态
     */
    get muted(): boolean {
        return this._muted;
    }

    /**
     * 设置音量 (0.0 - 1.0)
     */
    setVolume(volume: number): void {
        this._volume = Math.max(0, Math.min(1, volume));
        Howler.volume(this._volume);
        localStorage.setItem('audio_volume', String(this._volume));
    }

    /**
     * 获取当前音量
     */
    get volume(): number {
        return this._volume;
    }

    /**
     * 卸载所有音效
     */
    unloadAll(): void {
        for (const howl of this.sounds.values()) {
            howl.unload();
        }
        this.sounds.clear();
    }
}

// 导出单例
export const AudioManager = new AudioManagerClass();
