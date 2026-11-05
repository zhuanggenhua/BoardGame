import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { setAssetsBaseUrl, setCommonAudioAssetBaseOverride, signalCriticalImagesReady } from '../../../core/AssetLoader';
import { AUDIO_RUNTIME_TOAST_EVENT } from '../audioRuntimeNotifications';

const { howlInstances, readInstalledGamePackageAssetBlobUrl, nativeFallbackLoading } = vi.hoisted(() => ({
    nativeFallbackLoading: { enabled: false },
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
        isPlaying = false;
        play = vi.fn(() => { this.isPlaying = true; return 1; });
        stop = vi.fn(() => { this.isPlaying = false; });
        unload = vi.fn(() => { this.isPlaying = false; });
        stateValue: 'loaded' | 'loading' | 'unloaded';
        listeners = new Map<string, Array<(...args: unknown[]) => void>>();
        constructor(options: Record<string, unknown>) {
            this.options = options;
            this.stateValue = options.preload === true ? 'loading' : 'loaded';
            if (nativeFallbackLoading.enabled && String((options.src as string[])[0]).startsWith('blob:')) this.stateValue = 'loading';
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
        duration() { return 1; }
        volume() {}
        state() {
            return this.stateValue;
        }
        playing() {
            return this.isPlaying;
        }
        once(event: string, callback: (...args: unknown[]) => void) {
            const listeners = this.listeners.get(event) ?? [];
            listeners.push(callback);
            this.listeners.set(event, listeners);
            return this;
        }
        trigger(event: string, ...args: unknown[]) {
            if (event === 'end') this.isPlaying = false;
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

const waitForInstalledAssetRead = async () => {
    for (let attempt = 0; attempt < 20; attempt += 1) {
        if (readInstalledGamePackageAssetBlobUrl.mock.calls.length > 0) {
            return;
        }
        await new Promise((resolve) => setTimeout(resolve, 0));
    }
};

describe('AudioManager', () => {
    it('protects incoming SFX while the entire cache is playing and trims after end', async () => {
        for (let index = 0; index < 129; index++) {
            const key = `playing-${index}`;
            AudioManager.register(key, { src: `sfx/${key}.ogg` });
            AudioManager.play(key);
            const howl = howlInstances.at(-1)!;
            howl.trigger('load');
            howl.options.onload?.(1);
            await Promise.resolve();
        }
        expect(howlInstances).toHaveLength(129);
        expect(howlInstances.every(howl => howl.unload.mock.calls.length === 0)).toBe(true);
        howlInstances[0].trigger('end');
        howlInstances[0].options.onend?.(1);
        await Promise.resolve();
        expect(howlInstances[0].unload).toHaveBeenCalled();
        expect(howlInstances[128].unload).not.toHaveBeenCalled();
        AudioManager.unloadAll();
    });
    it('bounds idle decoded SFX across many games and unloads evicted native resources', async () => {
        for (let index = 0; index < 200; index++) {
            const key = `budget-sfx-${index}`;
            AudioManager.register(key, { src: `sfx/${key}.ogg` });
            AudioManager.play(key);
            const instance = howlInstances[howlInstances.length - 1];
            instance.trigger('load');
            instance.options.onload?.(1);
            instance.trigger('end');
            instance.options.onend?.(1);
            await Promise.resolve();
        }
        expect(howlInstances).toHaveLength(200);
        expect(howlInstances.filter(howl => howl.unload.mock.calls.length > 0)).toHaveLength(72);
        expect(AudioManager.getSfxLoadState('budget-sfx-0')).toBe('idle');
        expect(AudioManager.getSfxLoadState('budget-sfx-199')).toBe('loaded');
        AudioManager.unloadAll();
        expect(howlInstances.every(howl => howl.unload.mock.calls.length > 0)).toBe(true);
    });

    it('keeps the incoming BGM managed while three previous tracks are still playing', async () => {
        vi.useFakeTimers();
        AudioManager.registerAll({ bgm: ['a', 'b', 'c', 'd'].map(key => ({ key, name: key, src: `bgm/${key}.ogg` })) });
        for (const key of ['a', 'b', 'c', 'd']) AudioManager.playBgm(key);
        expect(howlInstances).toHaveLength(4);
        expect(howlInstances[3].unload).not.toHaveBeenCalled();
        await vi.advanceTimersByTimeAsync(1000);
        expect(howlInstances.slice(0, 3).every(howl => howl.unload.mock.calls.length > 0)).toBe(true);
        AudioManager.stopBgm();
        expect(howlInstances[3].stop).toHaveBeenCalled();
        AudioManager.unloadAll();
        expect(howlInstances[3].unload).toHaveBeenCalledTimes(1);
    });

    it('does not delete a BGM resumed before its previous fade-out timer expires', async () => {
        vi.useFakeTimers();
        AudioManager.registerAll({ bgm: [
            { key: 'fade-a', name: 'A', src: 'bgm/a.ogg' },
            { key: 'fade-b', name: 'B', src: 'bgm/b.ogg' },
        ] });
        AudioManager.playBgm('fade-a');
        AudioManager.playBgm('fade-b');
        AudioManager.playBgm('fade-a');
        await vi.advanceTimersByTimeAsync(1000);
        expect(howlInstances[0].unload).not.toHaveBeenCalled();
        expect(howlInstances[1].unload).toHaveBeenCalled();
        AudioManager.unloadAll();
    });

    it('revokes a late native blob after disposal without recreating audio', async () => {
        setCommonAudioAssetBaseOverride('http://localhost/_capacitor_file_/data/user/0/top.easyboardgame.app/files/game-packages/common-audio/current/assets');
        let complete!: (value: { blobUrl: string; mimeType: string; size: number }) => void;
        readInstalledGamePackageAssetBlobUrl.mockImplementation(() => new Promise(resolve => { complete = resolve; }));
        const revoke = vi.fn();
        const NativeURL = URL;
        vi.stubGlobal('URL', class extends NativeURL { static revokeObjectURL = revoke; });
        try {
            AudioManager.registerAll({ sounds: { 'native-late': { src: 'click.ogg' } } }, 'common/audio');
            AudioManager.play('native-late');
            howlInstances[0].options.onloaderror(1, 'decode failed');
            await waitForInstalledAssetRead();
            AudioManager.unloadAll();
            complete({ blobUrl: 'blob:late-disposed', mimeType: 'audio/ogg', size: 1 });
            await new Promise(resolve => setTimeout(resolve, 0));
            expect(revoke).toHaveBeenCalledWith('blob:late-disposed');
            expect(howlInstances).toHaveLength(1);
        } finally { vi.unstubAllGlobals(); }
    });
    it.each(['switch', 'stop'] as const)('does not revive a late BGM native fallback after %s', async action => {
        setCommonAudioAssetBaseOverride('http://localhost/_capacitor_file_/data/user/0/top.easyboardgame.app/files/game-packages/common-audio/current/assets');
        let complete!: (value: { blobUrl: string; mimeType: string; size: number }) => void;
        readInstalledGamePackageAssetBlobUrl.mockImplementation(() => new Promise(resolve => { complete = resolve; }));
        AudioManager.registerAll({ bgm: [
            { key: 'native-a', name: 'A', src: 'bgm/a.ogg' },
            { key: 'native-b', name: 'B', src: 'bgm/b.ogg' },
        ] }, 'common/audio');
        AudioManager.playBgm('native-a');
        howlInstances[0].options.onloaderror(1, 'decode failed');
        await waitForInstalledAssetRead();
        if (action === 'switch') AudioManager.playBgm('native-b');
        else AudioManager.stopBgm();
        const count = howlInstances.length;
        complete({ blobUrl: 'blob:obsolete-bgm', mimeType: 'audio/ogg', size: 1 });
        await new Promise(resolve => setTimeout(resolve, 0));
        expect(howlInstances).toHaveLength(count);
        expect(howlInstances[0].play).toHaveBeenCalledTimes(1);
        if (action === 'switch') expect(howlInstances[1].play).toHaveBeenCalledTimes(1);
        AudioManager.unloadAll();
    });
    it('does not play a fallback whose media load finishes after switching BGM', async () => {
        nativeFallbackLoading.enabled = true;
        setCommonAudioAssetBaseOverride('http://localhost/_capacitor_file_/data/user/0/top.easyboardgame.app/files/game-packages/common-audio/current/assets');
        readInstalledGamePackageAssetBlobUrl.mockResolvedValue({ blobUrl: 'blob:loading-bgm', mimeType: 'audio/ogg', size: 1 });
        AudioManager.registerAll({ bgm: [
            { key: 'loading-a', name: 'A', src: 'bgm/a.ogg' },
            { key: 'loading-b', name: 'B', src: 'bgm/b.ogg' },
        ] }, 'common/audio');
        AudioManager.playBgm('loading-a');
        const original = howlInstances[0];
        original.options.onloaderror(1, 'decode failed');
        // Native fallback shares the same request and its delayed load listener
        // must recheck ownership, even when replacement was valid initially.
        await waitForInstalledAssetRead();
        await new Promise(resolve => setTimeout(resolve, 0));
        const fallback = howlInstances[1];
        expect(fallback).toBeDefined();
        expect(fallback.play).not.toHaveBeenCalled();
        AudioManager.playBgm('loading-b');
        const calls = fallback.play.mock.calls.length;
        fallback.trigger('load');
        fallback.options.onload?.(1);
        expect(fallback.play).toHaveBeenCalledTimes(calls);
        AudioManager.unloadAll();
    });
    beforeEach(() => {
        nativeFallbackLoading.enabled = false;
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

        await waitForInstalledAssetRead();

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

    it('共享音频包本地 _capacitor_file_ 路径失败时，BGM 会优先走原生 blob 读取并继续播放', async () => {
        setCommonAudioAssetBaseOverride('http://localhost/_capacitor_file_/data/user/0/top.easyboardgame.app/files/game-packages/common-audio/current/assets');
        readInstalledGamePackageAssetBlobUrl.mockResolvedValue({
            blobUrl: 'blob:common-audio-bgm',
            mimeType: 'audio/ogg',
            size: 456,
        });
        const eventListener = vi.fn();
        window.addEventListener(AUDIO_RUNTIME_TOAST_EVENT, eventListener as EventListener);

        const config: GameAudioConfig = {
            bgm: [{
                key: 'bgm-local',
                name: 'Local BGM',
                src: 'bgm/fantasy/theme.ogg',
            }],
        };

        AudioManager.registerAll(config, 'common/audio');
        expect(() => AudioManager.playBgm('bgm-local')).not.toThrow();

        expect(howlInstances).toHaveLength(1);
        expect(howlInstances[0].options.src).toEqual([
            'http://localhost/_capacitor_file_/data/user/0/top.easyboardgame.app/files/game-packages/common-audio/current/assets/common/audio/bgm/fantasy/compressed/theme.ogg',
        ]);

        const firstLoadError = howlInstances[0].options.onloaderror as ((id: number, error: unknown) => void);
        firstLoadError(1, 'Decoding audio data failed.');

        await waitForInstalledAssetRead();

        expect(readInstalledGamePackageAssetBlobUrl).toHaveBeenCalledWith(
            'common-audio',
            'common/audio/bgm/fantasy/compressed/theme.ogg',
        );
        expect(howlInstances).toHaveLength(2);
        expect(howlInstances[1].options.src).toEqual(['blob:common-audio-bgm']);
        expect(howlInstances[1].play).toHaveBeenCalledTimes(1);
        expect(eventListener).not.toHaveBeenCalled();

        window.removeEventListener(AUDIO_RUNTIME_TOAST_EVENT, eventListener as EventListener);
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

        await waitForInstalledAssetRead();

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
