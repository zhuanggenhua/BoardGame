import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { setAssetsBaseUrl, setCommonAudioAssetBaseOverride, signalCriticalImagesReady } from '../../../core/AssetLoader';
import { AUDIO_RUNTIME_TOAST_EVENT } from '../audioRuntimeNotifications';

const { howlInstances, readInstalledGamePackageAssetBlobUrl } = vi.hoisted(() => ({
    howlInstances: [] as Array<{
        options: Record<string, any>;
        play: ReturnType<typeof vi.fn>;
        stop: ReturnType<typeof vi.fn>;
        unload: ReturnType<typeof vi.fn>;
        stateValue: 'loaded' | 'loading' | 'unloaded';
        trigger: (event: string, ...args: unknown[]) => void;
    }>,
    readInstalledGamePackageAssetBlobUrl: vi.fn(),
}));

vi.mock('howler', () => {
    const Howler = {
        mute: vi.fn(),
        volume: vi.fn(),
        stop: vi.fn(),
    };

    class Howl {
        options: Record<string, unknown>;
        play = vi.fn(() => 1);
        stop = vi.fn();
        unload = vi.fn();
        stateValue: 'loaded' | 'loading' | 'unloaded';
        listeners = new Map<string, Array<(...args: unknown[]) => void>>();
        constructor(options: Record<string, unknown>) {
            this.options = options;
            this.stateValue = options.preload === true ? 'loading' : 'loaded';
            howlInstances.push(this as unknown as {
                options: Record<string, any>;
                play: ReturnType<typeof vi.fn>;
                stop: ReturnType<typeof vi.fn>;
                unload: ReturnType<typeof vi.fn>;
                stateValue: 'loaded' | 'loading' | 'unloaded';
                trigger: (event: string, ...args: unknown[]) => void;
            });
        }
        fade() {}
        volume() {}
        state() {
            return this.stateValue;
        }
        playing() {
            return false;
        }
        once(event: string, callback: (...args: unknown[]) => void) {
            const listeners = this.listeners.get(event) ?? [];
            listeners.push(callback);
            this.listeners.set(event, listeners);
            return this;
        }
        trigger(event: string, ...args: unknown[]) {
            if (event === 'load') {
                this.stateValue = 'loaded';
            }
            const listeners = this.listeners.get(event) ?? [];
            this.listeners.delete(event);
            for (const listener of listeners) {
                listener(...args);
            }
        }
    }

    return { Howl, Howler };
});

vi.mock('../../../features/mobile-packages/nativeGamePackagePlugin', () => ({
    readInstalledGamePackageAssetBlobUrl,
}));

import { AudioManager } from '../AudioManager';
import type { GameAudioConfig } from '../types';

describe('AudioManager', () => {
    beforeEach(() => {
        vi.useRealTimers();
        AudioManager.unloadAll();
        setAssetsBaseUrl('/assets');
        setCommonAudioAssetBaseOverride(undefined);
        howlInstances.length = 0;
        readInstalledGamePackageAssetBlobUrl.mockReset();
    });

    afterEach(() => {
        vi.restoreAllMocks();
    });

    it('onBgmChange 在播放/停止时触发，并支持取消订阅', () => {
        const config: GameAudioConfig = {
            bgm: [{ key: 'bgm-1', name: 'BGM 1', src: 'bgm-1.mp3' }],
        };

        AudioManager.registerAll(config);

        const listener = vi.fn();
        const unsubscribe = AudioManager.onBgmChange(listener);

        AudioManager.playBgm('bgm-1');
        expect(listener).toHaveBeenCalledWith('bgm-1');

        AudioManager.stopBgm();
        expect(listener).toHaveBeenLastCalledWith(null);

        unsubscribe();
        AudioManager.playBgm('bgm-1');
        expect(listener).toHaveBeenCalledTimes(2);
    });

    it('本地音效缺失时会自动回退到官方资源域名', () => {
        const config: GameAudioConfig = {
            sounds: {
                click: { src: 'sfx/ui/click.ogg' },
            },
        };

        AudioManager.registerAll(config, 'common/audio');
        AudioManager.play('click');

        expect(howlInstances).toHaveLength(1);
        expect(howlInstances[0].options.src).toEqual(['/assets/common/audio/sfx/ui/compressed/click.ogg']);

        const firstLoadError = howlInstances[0].options.onloaderror as ((id: number, error: unknown) => void);
        firstLoadError(1, 'Decoding audio data failed.');

        expect(howlInstances).toHaveLength(2);
        expect(howlInstances[1].options.src).toEqual(['https://assets.easyboardgame.top/official/common/audio/sfx/ui/compressed/click.ogg']);
    });

    it('共享音频包本地 _capacitor_file_ 路径失败时，会优先走原生 blob 读取并续播当前音效', async () => {
        vi.spyOn(Date, 'now').mockReturnValue(1000);
        setCommonAudioAssetBaseOverride('http://localhost/_capacitor_file_/data/user/0/top.easyboardgame.app/files/game-packages/common-audio/current/assets');
        readInstalledGamePackageAssetBlobUrl.mockResolvedValue({
            blobUrl: 'blob:common-audio-click',
            mimeType: 'audio/ogg',
            size: 123,
        });

        const config: GameAudioConfig = {
            sounds: {
                click: { src: 'sfx/ui/click.ogg' },
            },
        };

        AudioManager.registerAll(config, 'common/audio');
        AudioManager.play('click');

        expect(howlInstances).toHaveLength(1);
        expect(howlInstances[0].options.src).toEqual([
            'http://localhost/_capacitor_file_/data/user/0/top.easyboardgame.app/files/game-packages/common-audio/current/assets/common/audio/sfx/ui/compressed/click.ogg',
        ]);

        const firstLoadError = howlInstances[0].options.onloaderror as ((id: number, error: unknown) => void);
        firstLoadError(1, 'Decoding audio data failed.');

        await new Promise((resolve) => setTimeout(resolve, 0));

        expect(readInstalledGamePackageAssetBlobUrl).toHaveBeenCalledWith(
            'common-audio',
            'common/audio/sfx/ui/compressed/click.ogg',
        );
        expect(howlInstances).toHaveLength(2);
        expect(howlInstances[1].options.src).toEqual([
            'blob:common-audio-click',
        ]);
        howlInstances[1].trigger('load');
        expect(howlInstances[1].play).toHaveBeenCalledTimes(1);
    });

    it('首播音效 1 秒内加载完成才播放，避免事件过期后补播', async () => {
        vi.spyOn(Date, 'now').mockReturnValue(1000);
        const config: GameAudioConfig = {
            sounds: {
                click: { src: 'sfx/ui/click.ogg' },
            },
        };

        AudioManager.registerAll(config, 'common/audio');
        const result = AudioManager.play('click');

        expect(result).toBeNull();
        expect(howlInstances).toHaveLength(1);
        expect(howlInstances[0].play).not.toHaveBeenCalled();

        vi.mocked(Date.now).mockReturnValue(1800);
        howlInstances[0].trigger('load');

        expect(howlInstances[0].play).toHaveBeenCalledTimes(1);
    });

    it('首播音效超过 1 秒才加载完成时只缓存，不再补播过期事件', async () => {
        vi.spyOn(Date, 'now').mockReturnValue(1000);
        const config: GameAudioConfig = {
            sounds: {
                click: { src: 'sfx/ui/click.ogg' },
            },
        };

        AudioManager.registerAll(config, 'common/audio');
        const result = AudioManager.play('click');

        expect(result).toBeNull();
        expect(howlInstances).toHaveLength(1);
        expect(howlInstances[0].play).not.toHaveBeenCalled();

        vi.mocked(Date.now).mockReturnValue(2101);
        howlInstances[0].trigger('load');

        expect(howlInstances[0].play).not.toHaveBeenCalled();

        const nextResult = AudioManager.play('click');
        expect(nextResult).toBe(1);
        expect(howlInstances[0].play).toHaveBeenCalledTimes(1);
    });

    it('共享音频包本地 _capacitor_file_ 路径原生读取失败时，才回退到官方资源域名', async () => {
        setCommonAudioAssetBaseOverride('http://localhost/_capacitor_file_/data/user/0/top.easyboardgame.app/files/game-packages/common-audio/current/assets');
        readInstalledGamePackageAssetBlobUrl.mockResolvedValue(null);

        const config: GameAudioConfig = {
            sounds: {
                click: { src: 'sfx/ui/click.ogg' },
            },
        };

        AudioManager.registerAll(config, 'common/audio');
        AudioManager.play('click');

        const firstLoadError = howlInstances[0].options.onloaderror as ((id: number, error: unknown) => void);
        firstLoadError(1, 'Decoding audio data failed.');

        await new Promise((resolve) => setTimeout(resolve, 0));

        expect(readInstalledGamePackageAssetBlobUrl).toHaveBeenCalledWith(
            'common-audio',
            'common/audio/sfx/ui/compressed/click.ogg',
        );
        expect(howlInstances).toHaveLength(2);
        expect(howlInstances[1].options.src).toEqual([
            'https://assets.easyboardgame.top/official/common/audio/sfx/ui/compressed/click.ogg',
        ]);
    });

    it('后台预加载音频失败时只标记失败，不产生未处理 Promise', async () => {
        vi.useFakeTimers();
        signalCriticalImagesReady();
        const consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
        const unhandledSpy = vi.fn();
        window.addEventListener('unhandledrejection', unhandledSpy);

        const config: GameAudioConfig = {
            sounds: {
                click: { src: 'sfx/ui/click.ogg' },
            },
        };

        AudioManager.registerAll(config, 'common/audio');
        AudioManager.preloadKeys(['click']);

        await vi.runAllTimersAsync();
        expect(howlInstances).toHaveLength(1);

        const firstLoadError = howlInstances[0].options.onloaderror as ((id: number, error: unknown) => void);
        firstLoadError(1, new Error('Failed loading audio file with status: 502.'));
        await vi.runAllTimersAsync();

        expect(howlInstances).toHaveLength(2);
        const fallbackLoadError = howlInstances[1].options.onloaderror as ((id: number, error: unknown) => void);
        fallbackLoadError(1, new Error('Failed loading audio file with status: 502.'));
        await vi.runAllTimersAsync();

        expect(AudioManager.isFailed('click')).toBe(true);
        expect(unhandledSpy).not.toHaveBeenCalled();

        window.removeEventListener('unhandledrejection', unhandledSpy);
        consoleErrorSpy.mockRestore();
    });

    it('BGM 使用手动循环而不是 Howler 内建 loop，避免 vendor 递归重播', () => {
        const config: GameAudioConfig = {
            bgm: [{ key: 'bgm-loop', name: 'Loop BGM', src: 'bgm-loop.mp3' }],
        };

        AudioManager.registerAll(config);
        AudioManager.playBgm('bgm-loop');

        expect(howlInstances).toHaveLength(1);
        expect(howlInstances[0].options.loop).toBe(false);
        expect(typeof howlInstances[0].options.onend).toBe('function');
    });

    it('BGM 结束事件可由播放列表接管，接管后不执行默认单曲重播', async () => {
        vi.useFakeTimers();
        const config: GameAudioConfig = {
            bgm: [{ key: 'bgm-auto', name: 'Auto BGM', src: 'bgm-auto.mp3' }],
        };

        AudioManager.registerAll(config);
        AudioManager.playBgm('bgm-auto');

        const listener = vi.fn(() => true);
        const unsubscribe = AudioManager.onBgmEnd(listener);
        const instance = howlInstances[0];
        const onEnd = instance.options.onend as (() => void);

        onEnd();
        await vi.runAllTimersAsync();

        expect(listener).toHaveBeenCalledWith('bgm-auto');
        expect(instance.play).toHaveBeenCalledTimes(1);
        unsubscribe();
    });

    it('BGM 源地址为空时不会抛异常打挂页面', () => {
        const consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
        const config: GameAudioConfig = {
            bgm: [{ key: 'bgm-empty', name: 'Empty BGM', src: '' }],
        };
        const eventListener = vi.fn();
        window.addEventListener(AUDIO_RUNTIME_TOAST_EVENT, eventListener as EventListener);

        AudioManager.registerAll(config);

        expect(() => AudioManager.playBgm('bgm-empty')).not.toThrow();
        expect(howlInstances).toHaveLength(0);
        expect(eventListener).toHaveBeenCalledTimes(1);

        window.removeEventListener(AUDIO_RUNTIME_TOAST_EVENT, eventListener as EventListener);
        consoleErrorSpy.mockRestore();
    });

    it('BGM 异常快速结束时会熔断手动循环，避免无限重播', async () => {
        vi.useFakeTimers();
        const consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

        const config: GameAudioConfig = {
            bgm: [{ key: 'bgm-broken', name: 'Broken BGM', src: 'bgm-broken.mp3' }],
        };

        AudioManager.registerAll(config);
        AudioManager.playBgm('bgm-broken');

        expect(howlInstances).toHaveLength(1);
        const instance = howlInstances[0];
        const onEnd = instance.options.onend as (() => void);

        onEnd();
        await vi.runAllTimersAsync();
        expect(instance.play).toHaveBeenCalledTimes(2);
        expect(instance.stop).not.toHaveBeenCalled();

        onEnd();
        await vi.runAllTimersAsync();
        expect(instance.play).toHaveBeenCalledTimes(3);
        expect(instance.stop).not.toHaveBeenCalled();

        onEnd();
        await vi.runAllTimersAsync();
        expect(instance.stop).toHaveBeenCalledTimes(1);
        expect(instance.unload).toHaveBeenCalledTimes(1);
        expect(AudioManager.currentBgm).toBe(null);
        consoleErrorSpy.mockRestore();
    });
});
