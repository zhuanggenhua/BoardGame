import { existsSync } from 'node:fs';
import path from 'node:path';
import dotenv from 'dotenv';
import type { CapacitorConfig } from '@capacitor/cli';

const rootDir = process.cwd();

for (const file of ['.env', '.env.android', '.env.android.local']) {
    const fullPath = path.join(rootDir, file);
    if (!existsSync(fullPath)) continue;
    dotenv.config({ path: fullPath, override: true, quiet: true });
}

const appId = process.env.CAPACITOR_APP_ID?.trim() || 'top.easyboardgame.app';
const appName = process.env.CAPACITOR_APP_NAME?.trim() || '易桌游';
const mode = (process.env.ANDROID_WEBVIEW_MODE?.trim().toLowerCase() || 'embedded');
const remoteUrl = process.env.ANDROID_REMOTE_WEB_URL?.trim() || '';

if (mode !== 'embedded' && mode !== 'remote') {
    throw new Error(`ANDROID_WEBVIEW_MODE 只支持 embedded 或 remote，当前值为: ${mode}`);
}

if (mode === 'remote' && !/^https:\/\//i.test(remoteUrl)) {
    throw new Error('ANDROID_REMOTE_WEB_URL 必须是绝对 HTTPS 地址，且仅在 remote 模式下使用。');
}

const server: NonNullable<CapacitorConfig['server']> = {
    androidScheme: 'https',
};

if (mode === 'remote') {
    server.url = remoteUrl;
}

const config: CapacitorConfig = {
    appId,
    appName,
    webDir: 'dist',
    server,
};

export default config;
