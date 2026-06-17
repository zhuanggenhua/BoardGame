import { beforeEach, describe, expect, it, vi } from 'vitest';
import { setAssetsBaseUrl, setCommonAudioAssetBaseOverride } from '../../../core/AssetLoader';
import { AUDIO_RUNTIME_TOAST_EVENT } from '../audioRuntimeNotifications';

const { howlInstances, readInstalledGamePackageAssetBlobUrl } = vi.hoisted(() => ({
    howlInstances: [] as Array<{
        options: Record<string, any>;
        play: ReturnType<typeof vi.fn>;
        stop: ReturnType<typeof vi.fn>;
        unload: ReturnType<typeof vi.fn>;
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
        constructor(options: Record<string, unknown>) {
            this.options = options;
            howlInstances.push(this as unknown as {
                options: Record<string, any>;
                play: ReturnType<typeof vi.fn>;
                stop: ReturnType<typeof vi.fn>;
                unload: ReturnType<typeof vi.fn>;
            });
        }
        fade() {}
        volume() {}
        state() {
            return 'loaded';
        }
        playing() {
            return false;
        }
        once() {
            return this;
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
        expect(howlInstances[1].play).toHaveBeenCalledTimes(1);
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
