import { beforeEach, describe, expect, it, vi } from 'vitest';
import { setAssetsBaseUrl } from '../../../core/AssetLoader';

const howlInstances: Array<{ options: Record<string, any> }> = [];

vi.mock('howler', () => {
    const Howler = {
        mute: vi.fn(),
        volume: vi.fn(),
        stop: vi.fn(),
    };

    class Howl {
        options: Record<string, unknown>;
        constructor(options: Record<string, unknown>) {
            this.options = options;
            howlInstances.push(this as unknown as { options: Record<string, any> });
        }
        play() {
            return 1;
        }
        stop() {}
        fade() {}
        volume() {}
        unload() {}
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

import { AudioManager } from '../AudioManager';
import type { GameAudioConfig } from '../types';

describe('AudioManager', () => {
    beforeEach(() => {
        AudioManager.unloadAll();
        setAssetsBaseUrl('/assets');
        howlInstances.length = 0;
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
});
