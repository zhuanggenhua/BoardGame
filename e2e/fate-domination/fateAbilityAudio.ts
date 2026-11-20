import { expect, type BrowserContext, type Page } from '@playwright/test';
import { initContext } from '../helpers/common';

export async function initFateAudioContext(context: BrowserContext) {
    await initContext(context, { enableAudio: true });
    await context.addInitScript(() => {
        localStorage.setItem('audio_muted', 'false');
        localStorage.setItem('audio_master_volume', '1');
        localStorage.setItem('audio_sfx_volume', '1');
        localStorage.setItem('audio_bgm_volume', '1');
    });
}

// Howler 在原生播放开始后发出 play。短音效可能在监听回调执行时已经播完。
export async function trackFateAbilitySounds(page: Page, files: readonly string[]) {
    await expect.poll(() => page.evaluate(names => {
        type Sound = { _src: string; state: () => string; on: (name: 'play', handler: () => void) => void };
        const browser = window as unknown as { Howler?: { _howls: Sound[] }; fateAbilitySounds?: string[] };
        if (browser.fateAbilitySounds) return true;
        const howls = names.map(file => browser.Howler?._howls.find(sound => decodeURIComponent(sound._src).endsWith(file) && sound.state() === 'loaded'));
        if (howls.some(sound => !sound)) return false;
        const played: string[] = [];
        browser.fateAbilitySounds = played;
        howls.forEach((sound, index) => sound!.on('play', () => played.push(names[index])));
        return true;
    }, files), { timeout: 25_000, message: '发动音实际解码完成' }).toBe(true);
    return () => page.evaluate(() => (window as unknown as { fateAbilitySounds: string[] }).fateAbilitySounds);
}
