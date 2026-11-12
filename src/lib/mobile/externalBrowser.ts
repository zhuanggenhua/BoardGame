import { Capacitor, registerPlugin } from '@capacitor/core';

const browser = registerPlugin<{ open(options: { url: string }): Promise<void> }>('ExternalBrowser');

export function canOpenExternalBrowser(url: string): boolean {
    try {
        const parsed = new URL(url);
        return Capacitor.getPlatform() === 'android' && Capacitor.isPluginAvailable('ExternalBrowser')
            && (parsed.protocol === 'https:' || parsed.protocol === 'http:') && !parsed.username && !parsed.password;
    } catch { return false; }
}

export function openExternalBrowser(url: string): Promise<void> {
    return browser.open({ url });
}
