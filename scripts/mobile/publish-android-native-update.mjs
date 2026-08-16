import { config } from 'dotenv';
import { createHash } from 'node:crypto';
import { existsSync, readFileSync, statSync } from 'node:fs';
import path from 'node:path';
import { publishPrimaryAssetBatch } from '../assets/publish-primary-assets.mjs';
import { waitForServerAssets } from './wait-for-server-assets.mjs';
import { resolveAndroidAssetsBaseUrl } from './android-assets-base-url.mjs';

const rootDir = process.cwd();

for (const file of ['.env', '.env.android', '.env.android.local', '.env.example']) {
    const fullPath = path.join(rootDir, file);
    if (!existsSync(fullPath)) continue;
    config({ path: fullPath, override: false, quiet: true });
}

const packageJson = JSON.parse(readFileSync(path.join(rootDir, 'package.json'), 'utf8'));
const args = process.argv.slice(2);
const readArgValue = (name, fallback = '') => {
    const prefix = `--${name}=`;
    const direct = args.find((arg) => arg.startsWith(prefix));
    if (direct) {
        return direct.slice(prefix.length);
    }
    const index = args.findIndex((arg) => arg === `--${name}`);
    if (index >= 0 && args[index + 1]) {
        return args[index + 1];
    }
    return fallback;
};
const hasFlag = (name) => args.includes(`--${name}`);

const parseAndroidVersionCode = (versionName) => {
    const segments = String(versionName || '')
        .split('.')
        .map((segment) => {
            const match = segment.match(/\d+/);
            return match ? Number.parseInt(match[0], 10) : 0;
        });

    while (segments.length < 3) {
        segments.push(0);
    }

    return (segments[0] * 10000) + (segments[1] * 100) + segments[2];
};

const resolveAndroidVersionCode = (packageJsonValue, versionName) => {
    if (typeof packageJsonValue === 'number' && Number.isFinite(packageJsonValue) && packageJsonValue > 0) {
        return Math.trunc(packageJsonValue);
    }
    return parseAndroidVersionCode(versionName);
};

const channel = readArgValue('channel', process.env.VITE_ANDROID_NATIVE_UPDATE_CHANNEL?.trim() || 'stable');
const version = readArgValue('version', packageJson.version);
const parsedVersionCode = Number.parseInt(readArgValue('version-code', ''), 10);
const versionCode = Number.isFinite(parsedVersionCode) && parsedVersionCode > 0
    ? parsedVersionCode
    : resolveAndroidVersionCode(packageJson.androidVersionCode, version);
const notes = readArgValue('notes', 'Android native APK update');
const forceUpdate = hasFlag('no-force-update') ? false : true;
const forceUpdateTitle = forceUpdate
    ? (readArgValue('force-update-title', '需要安装新版 App').trim() || '需要安装新版 App')
    : '';
const forceUpdateMessage = forceUpdate
    ? (readArgValue('force-update-message', '正在准备新的安装包，请按系统提示完成更新。').trim() || '正在准备新的安装包，请按系统提示完成更新。')
    : '';
const dryRun = hasFlag('dry-run');
const skipLatest = hasFlag('skip-latest');
if (skipLatest && !dryRun) {
    throw new Error('正式 Android 原生更新发布禁止使用 --skip-latest。手机端依赖 latest.json 发现新版 APK，跳过会导致无法更新。');
}
const apkPath = path.resolve(
    rootDir,
    readArgValue('apk', path.join('android', 'app', 'build', 'outputs', 'apk', 'release', 'easyboardgame-release.apk')),
);
const releasePrefix = `official/native-app-updates/android/${channel}`;
const releaseAndroidAppId = 'top.easyboardgame.app';
const debugAndroidAppIdSegments = new Set(['debug', 'dev', 'test', 'qa']);

const isNonReleaseAndroidAppId = (appId) => appId
    .split('.')
    .some((segment) => debugAndroidAppIdSegments.has(segment.trim().toLowerCase()));
const versionManifestKey = `${releasePrefix}/manifests/${encodeURIComponent(version)}.json`;
const latestManifestKey = `${releasePrefix}/latest.json`;
const apkKey = `${releasePrefix}/packages/${encodeURIComponent(version)}.apk`;
const assetsBaseUrl = resolveAndroidAssetsBaseUrl(process.env);
const apkUrl = `${assetsBaseUrl}/native-app-updates/android/${channel}/packages/${encodeURIComponent(version)}.apk`;

if (!existsSync(apkPath)) {
    throw new Error(`未找到 APK：${path.relative(rootDir, apkPath)}。请先执行 npm run mobile:android:build:release，或用 --apk 指定。`);
}

const releaseAppId = process.env.CAPACITOR_APP_ID?.trim() || process.env.VITE_CAPACITOR_APP_ID?.trim() || '';
if (!releaseAppId) {
    throw new Error('native 发布缺少 CAPACITOR_APP_ID / VITE_CAPACITOR_APP_ID，已阻止上传。');
}
if (releaseAppId !== releaseAndroidAppId) {
    throw new Error(`native 发布 appId 非正式包：期望 ${releaseAndroidAppId}，实际 ${releaseAppId}`);
}
if (isNonReleaseAndroidAppId(releaseAppId)) {
    throw new Error(`native 发布检测到测试壳 appId=${releaseAppId}，已阻止上传。`);
}

const apkBuffer = readFileSync(apkPath);
const checksum = createHash('sha256').update(apkBuffer).digest('hex');
const apkFingerprint = checksum.slice(0, 12);
const fingerprintedApkKey = `${releasePrefix}/packages/${encodeURIComponent(version)}-${apkFingerprint}.apk`;
const fingerprintedApkUrl = `${assetsBaseUrl}/native-app-updates/android/${channel}/packages/${encodeURIComponent(version)}-${apkFingerprint}.apk`;
const manifest = {
    version,
    versionCode,
    url: fingerprintedApkUrl,
    checksum,
    channel,
    ...(forceUpdate ? { forceUpdate: true } : {}),
    ...(forceUpdateTitle ? { forceUpdateTitle } : {}),
    ...(forceUpdateMessage ? { forceUpdateMessage } : {}),
    publishedAt: new Date().toISOString(),
    size: apkBuffer.length,
    notes,
};

const versionManifestBody = `${JSON.stringify(manifest, null, 2)}\n`;
const latestManifestBody = versionManifestBody;

if (!dryRun) {
    await publishPrimaryAssetBatch([
        {
            key: apkKey,
            body: apkBuffer,
            size: apkBuffer.length,
            contentType: 'application/vnd.android.package-archive',
            cacheControl: 'public, max-age=31536000, immutable',
        },
        {
            key: fingerprintedApkKey,
            body: apkBuffer,
            size: apkBuffer.length,
            contentType: 'application/vnd.android.package-archive',
            cacheControl: 'public, max-age=31536000, immutable',
        },
        {
            key: versionManifestKey,
            body: versionManifestBody,
            size: Buffer.byteLength(versionManifestBody),
            contentType: 'application/json',
            cacheControl: 'public, max-age=60, must-revalidate',
        },
        ...(!skipLatest
            ? [{
                key: latestManifestKey,
                body: latestManifestBody,
                size: Buffer.byteLength(latestManifestBody),
                contentType: 'application/json',
                cacheControl: 'public, max-age=60, must-revalidate',
            }]
            : []),
    ]);
}

if (!dryRun && !skipLatest) {
    await waitForServerAssets([{
        url: fingerprintedApkUrl,
        expectedSize: apkBuffer.length,
    }]);
}

const apkStats = statSync(apkPath);
console.log(dryRun ? 'Android 原生更新包预演完成（未上传）' : 'Android 原生更新包已发布');
console.log(`channel=${channel}`);
console.log(`version=${version}`);
console.log(`versionCode=${versionCode}`);
console.log(`mode=${dryRun ? 'dry-run' : 'publish'}`);
console.log(`forceUpdate=${forceUpdate ? 'true' : 'false'}`);
console.log(`skipLatest=${skipLatest ? 'true' : 'false'}`);
console.log(`apkBytes=${apkBuffer.length}`);
console.log(`apkMtime=${apkStats.mtime.toISOString()}`);
console.log(`apkPath=${apkPath}`);
console.log(`apkKey=${apkKey}`);
console.log(`fingerprintedApkKey=${fingerprintedApkKey}`);
console.log(`latestManifestKey=${latestManifestKey}`);
console.log(`apkUrl=${fingerprintedApkUrl}`);
console.log(`checksum=${checksum}`);
console.log(`manifest=${JSON.stringify(manifest)}`);
