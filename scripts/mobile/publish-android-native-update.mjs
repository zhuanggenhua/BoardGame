import { config } from 'dotenv';
import { createHash } from 'node:crypto';
import { existsSync, readFileSync, statSync } from 'node:fs';
import path from 'node:path';
import { S3Client, PutObjectCommand } from '@aws-sdk/client-s3';

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

const channel = readArgValue('channel', process.env.VITE_ANDROID_NATIVE_UPDATE_CHANNEL?.trim() || 'stable');
const version = readArgValue('version', packageJson.version);
const parsedVersionCode = Number.parseInt(readArgValue('version-code', ''), 10);
const versionCode = Number.isFinite(parsedVersionCode) && parsedVersionCode > 0
    ? parsedVersionCode
    : parseAndroidVersionCode(version);
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
const assetsBaseUrl = (process.env.VITE_ASSETS_BASE_URL?.trim() || 'https://assets.easyboardgame.top/official').replace(/\/+$/, '');
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

if (!dryRun) {
    const requiredEnv = ['R2_ACCOUNT_ID', 'R2_ACCESS_KEY_ID', 'R2_SECRET_ACCESS_KEY', 'R2_BUCKET_NAME'];
    const missingEnv = requiredEnv.filter((key) => !process.env[key]);
    if (missingEnv.length > 0) {
        throw new Error(`缺少 R2 环境变量: ${missingEnv.join(', ')}`);
    }
}

const apkBuffer = readFileSync(apkPath);
const checksum = createHash('sha256').update(apkBuffer).digest('hex');
const manifest = {
    version,
    versionCode,
    url: apkUrl,
    checksum,
    channel,
    ...(forceUpdate ? { forceUpdate: true } : {}),
    ...(forceUpdateTitle ? { forceUpdateTitle } : {}),
    ...(forceUpdateMessage ? { forceUpdateMessage } : {}),
    publishedAt: new Date().toISOString(),
    size: apkBuffer.length,
    notes,
};

const s3Client = new S3Client({
    region: 'auto',
    endpoint: `https://${process.env.R2_ACCOUNT_ID}.r2.cloudflarestorage.com`,
    credentials: {
        accessKeyId: process.env.R2_ACCESS_KEY_ID,
        secretAccessKey: process.env.R2_SECRET_ACCESS_KEY,
    },
});

const uploadObject = async (key, body, contentType, cacheControl) => {
    await s3Client.send(new PutObjectCommand({
        Bucket: process.env.R2_BUCKET_NAME,
        Key: key,
        Body: body,
        ContentType: contentType,
        CacheControl: cacheControl,
    }));
};

if (!dryRun) {
    await uploadObject(apkKey, apkBuffer, 'application/vnd.android.package-archive', 'public, max-age=31536000, immutable');
    await uploadObject(versionManifestKey, `${JSON.stringify(manifest, null, 2)}\n`, 'application/json', 'public, max-age=60, must-revalidate');
    if (!skipLatest) {
        await uploadObject(latestManifestKey, `${JSON.stringify(manifest, null, 2)}\n`, 'application/json', 'public, max-age=60, must-revalidate');
    }
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
console.log(`latestManifestKey=${latestManifestKey}`);
console.log(`apkUrl=${apkUrl}`);
console.log(`checksum=${checksum}`);
console.log(`manifest=${JSON.stringify(manifest)}`);
