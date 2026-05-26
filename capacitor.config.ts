import { existsSync } from 'node:fs';
import path from 'node:path';
import dotenv from 'dotenv';
import type { CapacitorConfig } from '@capacitor/cli';

const rootDir = process.cwd();
const debugAndroidAppIdSegments = new Set(['debug', 'dev', 'test', 'qa']);
const preservedProcessEnv = { ...process.env };
const requestedPlatform = process.argv.includes('ios')
    ? 'ios'
    : process.argv.includes('android')
        ? 'android'
        : undefined;
const envFiles = requestedPlatform
    ? ['.env', `.env.${requestedPlatform}`, `.env.${requestedPlatform}.local`]
    : ['.env', '.env.android', '.env.android.local'];

for (const file of envFiles) {
    const fullPath = path.join(rootDir, file);
    if (!existsSync(fullPath)) continue;
    dotenv.config({ path: fullPath, override: true, quiet: true });
}

// Keep explicit shell env higher priority than local dotenv files while still
// allowing .env.android.local to override earlier dotenv files.
for (const [key, value] of Object.entries(preservedProcessEnv)) {
    if (typeof value === 'string') {
        process.env[key] = value;
    }
}

const parseBooleanEnv = (value: string | undefined) => /^(1|true|yes|on)$/i.test(value?.trim() || '');
const readPlatformEnv = (platformKey: string, genericKey: string) =>
    process.env[platformKey]?.trim() || process.env[genericKey]?.trim() || '';
const appId = process.env.CAPACITOR_APP_ID?.trim() || 'top.easyboardgame.app';
const appName = process.env.CAPACITOR_APP_NAME?.trim() || '易桌游';
const mode = (process.env.ANDROID_WEBVIEW_MODE?.trim().toLowerCase() || 'embedded');
const remoteUrl = process.env.ANDROID_REMOTE_WEB_URL?.trim() || '';
const isHttpRemoteUrl = /^http:\/\//i.test(remoteUrl);
const isNonReleaseAndroidAppId = (value: string) => value
    .split('.')
    .some((segment) => debugAndroidAppIdSegments.has(segment.trim().toLowerCase()));
const platformOtaPrefix = requestedPlatform === 'ios' ? 'VITE_IOS_OTA' : 'VITE_ANDROID_OTA';
const otaEnabledValue = readPlatformEnv(`${platformOtaPrefix}_ENABLED`, 'VITE_MOBILE_OTA_ENABLED');
const otaAllowDebugValue = readPlatformEnv(`${platformOtaPrefix}_ALLOW_DEBUG_APP`, 'VITE_MOBILE_OTA_ALLOW_DEBUG_APP');
const otaChannelValue = readPlatformEnv(`${platformOtaPrefix}_CHANNEL`, 'VITE_MOBILE_OTA_CHANNEL');
const otaAppReadyTimeout = Number.parseInt(
    readPlatformEnv(`${platformOtaPrefix}_APP_READY_TIMEOUT_MS`, 'VITE_MOBILE_OTA_APP_READY_TIMEOUT_MS'),
    10,
);
const otaEnabled = parseBooleanEnv(otaEnabledValue)
    && (!isNonReleaseAndroidAppId(appId) || parseBooleanEnv(otaAllowDebugValue));

if (mode !== 'embedded' && mode !== 'remote') {
    throw new Error(`ANDROID_WEBVIEW_MODE 只支持 embedded 或 remote，当前值为: ${mode}`);
}

if (mode === 'remote' && !/^https?:\/\//i.test(remoteUrl)) {
    throw new Error('ANDROID_REMOTE_WEB_URL 必须是绝对 HTTP/HTTPS 地址，且仅在 remote 模式下使用。');
}

const server: NonNullable<CapacitorConfig['server']> = {
    // Android embedded WebView must keep the local bridge on http://localhost
    // so Capacitor.convertFileSrc() can resolve /_capacitor_file_/... correctly.
    androidScheme: mode === 'embedded' ? 'http' : 'https',
};

if (mode === 'remote') {
    server.url = remoteUrl;
    server.cleartext = isHttpRemoteUrl;
}

const config: CapacitorConfig = {
    appId,
    appName,
    webDir: 'dist',
    server,
    plugins: otaEnabled
        ? {
            CapacitorUpdater: {
                autoUpdate: false,
                appReadyTimeout: Number.isFinite(otaAppReadyTimeout) && otaAppReadyTimeout >= 1000
                    ? otaAppReadyTimeout
                    : 10000,
                autoDeleteFailed: true,
                autoDeletePrevious: true,
                resetWhenUpdate: true,
                keepUrlPathAfterReload: true,
                allowManualBundleError: true,
                defaultChannel: otaChannelValue || undefined,
            },
        }
        : undefined,
};

export default config;
