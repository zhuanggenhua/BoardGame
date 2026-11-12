import { describe, expect, it, vi } from 'vitest';

const native = vi.hoisted(() => ({ platform: 'android', available: true, open: vi.fn() }));
vi.mock('@capacitor/core', () => ({
    Capacitor: { getPlatform: () => native.platform, isPluginAvailable: () => native.available },
    registerPlugin: () => ({ open: native.open }),
}));
import { canOpenExternalBrowser, openExternalBrowser } from '../externalBrowser';

describe('外站原生浏览器', () => {
    it('只在原生插件可用时接受不含凭据的 HTTP(S) 地址', () => {
        expect(canOpenExternalBrowser('https://yuanyigames.top/')).toBe(true);
        expect(canOpenExternalBrowser('http://e7-auto.7skyun.com:41956/')).toBe(true);
        expect(canOpenExternalBrowser('javascript:alert(1)')).toBe(false);
        expect(canOpenExternalBrowser('https://user:pass@example.com')).toBe(false);
        native.available = false;
        expect(canOpenExternalBrowser('https://yuanyigames.top/')).toBe(false);
        native.available = true;
        native.platform = 'web';
        expect(canOpenExternalBrowser('https://yuanyigames.top/')).toBe(false);
        native.platform = 'android';
    });
    it('将所选游戏网址交给原生插件', async () => {
        native.open.mockResolvedValue(undefined);
        await openExternalBrowser('https://queen-alice.onwardtool.com/');
        expect(native.open).toHaveBeenCalledWith({ url: 'https://queen-alice.onwardtool.com/' });
    });
});
