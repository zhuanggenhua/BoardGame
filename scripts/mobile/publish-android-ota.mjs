import { config } from 'dotenv';
import { createHash } from 'node:crypto';
import { existsSync, readdirSync, readFileSync, statSync } from 'node:fs';
import path from 'node:path';
import { S3Client, PutObjectCommand } from '@aws-sdk/client-s3';
import { zipSync } from 'fflate';
import {
    resolveOtaForceUpdateOptions,
} from './ota-publish-config.mjs';

const rootDir = process.cwd();
const OTA_EXCLUDED_PREFIXES = [
    'assets/i18n/',
];
const OTA_ALLOWED_LOCALE_PREFIX = 'locales/zh-CN/';
const MAX_ANDROID_OTA_ZIP_BYTES = 20 * 1024 * 1024;

for (const file of ['.env', '.env.android', '.env.android.local', '.env.example']) {
    const fullPath = path.join(rootDir, file);
    if (!existsSync(fullPath)) continue;
    config({ path: fullPath, override: false, quiet: true });
}

const packageJson = JSON.parse(readFileSync(path.join(rootDir, 'package.json'), 'utf8'));
const args = process.argv.slice(2);
const allowedValueArgs = new Set([
    'channel',
    'version',
    'native-version',
    'target-native-version',
    'min-native-version',
    'max-native-version',
    'force-update-title',
    'force-update-message',
    'notes',
]);
const allowedBooleanArgs = new Set([
    'force-update',
    'no-force-update',
    'allow-legacy-shells',
    'dry-run',
    'skip-latest',
    'help',
]);
const helpText = `
Android OTA 发布脚本

默认策略：
- stable 默认收紧到当前原生版本：若未显式传兼容参数，会自动写入 minNativeVersion=<nativeVersion>
- stable 默认也会开启 forceUpdate，让旧壳直接进入原生 App 升级链路
- 如确需放行旧壳，必须显式传 --allow-legacy-shells
- 非 stable channel 仍保持显式传参才生成原生版本门禁

常见用法：
- node scripts/mobile/publish-android-ota.mjs --channel stable
- node scripts/mobile/publish-android-ota.mjs --channel edge --dry-run
- node scripts/mobile/publish-android-ota.mjs --channel stable --target-native-version 0.5.1
- node scripts/mobile/publish-android-ota.mjs --channel stable --min-native-version 0.5.0 --max-native-version 0.5.2
- node scripts/mobile/publish-android-ota.mjs --channel stable --allow-legacy-shells --no-force-update

参数：
- --channel <name>
- --version <bundleVersion>
- --native-version <version>
- --target-native-version <version[,version]>
- --min-native-version <version>
- --max-native-version <version>
- --force-update / --no-force-update
- --allow-legacy-shells
- --force-update-title <text>
- --force-update-message <text>
- --notes <text>
- --dry-run
- --skip-latest
- --help
`.trim();

const validateArgs = (sourceArgs) => {
    for (let index = 0; index < sourceArgs.length; index += 1) {
        const current = sourceArgs[index];
        if (current === '-h') {
            continue;
        }
        if (!current.startsWith('--')) {
            throw new Error(
                `检测到不受支持的位置参数: ${current}。`
                + ' Android OTA 发布脚本只接受 --channel 这类显式命名参数。'
                + ' 若你是通过 npm 传参，请不要使用 `npm run mobile:android:ota:publish -- --channel stable` 这种形式；'
                + ' 请改用 `node scripts/mobile/release-android.mjs ota --channel stable`'
                + ' 或 `node scripts/mobile/publish-android-ota.mjs --channel stable`。',
            );
        }

        const eqIndex = current.indexOf('=');
        const rawName = eqIndex >= 0 ? current.slice(2, eqIndex) : current.slice(2);
        if (allowedBooleanArgs.has(rawName)) {
            continue;
        }
        if (allowedValueArgs.has(rawName)) {
            if (eqIndex >= 0) {
                continue;
            }
            const next = sourceArgs[index + 1];
            if (!next || next.startsWith('--')) {
                throw new Error(`参数 --${rawName} 缺少值。`);
            }
            index += 1;
            continue;
        }

        throw new Error(`未知参数: ${current}`);
    }
};

validateArgs(args);

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
if (hasFlag('help') || args.includes('-h')) {
    console.log(helpText);
    process.exit(0);
}

const channel = readArgValue('channel', process.env.VITE_ANDROID_OTA_CHANNEL?.trim() || 'stable');
const nativeVersion = readArgValue('native-version', packageJson.version);
const explicitTargetNativeVersion = readArgValue('target-native-version', '');
const explicitMinNativeVersion = readArgValue('min-native-version', '');
const maxNativeVersion = readArgValue('max-native-version', '');
const explicitBundleVersion = readArgValue('version', '');
const notes = readArgValue('notes', 'Android embedded OTA bundle');
const allowLegacyShells = hasFlag('allow-legacy-shells');
const stableChannel = channel === 'stable';
const minNativeVersion = stableChannel && !allowLegacyShells && !explicitTargetNativeVersion && !explicitMinNativeVersion
    ? nativeVersion
    : explicitMinNativeVersion;
const {
    forceUpdate,
    forceUpdateTitle,
    forceUpdateMessage,
} = resolveOtaForceUpdateOptions({
    forceUpdateFlag: hasFlag('force-update'),
    noForceUpdateFlag: hasFlag('no-force-update'),
    forceUpdateTitle: readArgValue('force-update-title', ''),
    forceUpdateMessage: readArgValue('force-update-message', ''),
    defaultForceUpdate: stableChannel && !allowLegacyShells,
});
const dryRun = hasFlag('dry-run');
const skipLatest = hasFlag('skip-latest');
const distDir = path.join(rootDir, 'dist');
const androidBuildMetaPath = path.join(distDir, 'android-build-meta.json');
const builtAt = new Date().toISOString().replace(/[:.]/g, '-');
const bundleVersion = explicitBundleVersion || `${packageJson.version}-ota-${builtAt}`;
const manifestPrefix = `official/app-updates/android/${channel}`;
const bundleKey = `${manifestPrefix}/bundles/${bundleVersion}.zip`;
const versionManifestKey = `${manifestPrefix}/manifests/${bundleVersion}.json`;
const latestManifestKey = `${manifestPrefix}/latest.json`;
const assetsBaseUrl = (process.env.VITE_ASSETS_BASE_URL?.trim() || 'https://assets.easyboardgame.top/official').replace(/\/+$/, '');
const bundleUrl = `${assetsBaseUrl}/app-updates/android/${channel}/bundles/${encodeURIComponent(bundleVersion)}.zip`;
const validChannelPattern = /^[a-z0-9][a-z0-9._-]*$/i;
const releaseAndroidAppId = 'top.easyboardgame.app';
const debugAndroidAppIdSegments = new Set(['debug', 'dev', 'test', 'qa']);

const isNonReleaseAndroidAppId = (appId) => appId
    .split('.')
    .some((segment) => debugAndroidAppIdSegments.has(segment.trim().toLowerCase()));

if (!validChannelPattern.test(channel)) {
    throw new Error(`非法 channel: ${channel}。仅允许字母、数字、点、下划线、短横线。`);
}

if (!existsSync(distDir)) {
    throw new Error('dist 目录不存在。请先执行 Android Web 构建（例如 `npm run build:android:web` 或 `node scripts/mobile/android.mjs sync`）。');
}
if (!existsSync(androidBuildMetaPath)) {
    throw new Error('dist/android-build-meta.json 缺失。OTA 发布只接受 Android 链路产出的 dist，请先执行 `npm run mobile:android:sync`。');
}

const androidBuildMeta = JSON.parse(readFileSync(androidBuildMetaPath, 'utf8'));
if (androidBuildMeta.mode !== 'android') {
    throw new Error(`dist/android-build-meta.json 的 mode 非 android，当前值为: ${String(androidBuildMeta.mode || '')}`);
}
if (typeof androidBuildMeta.backendUrl !== 'string' || !/^https?:\/\//i.test(androidBuildMeta.backendUrl.trim())) {
    throw new Error('dist/android-build-meta.json 缺少合法 backendUrl。请先执行 `npm run mobile:android:sync`。');
}
if (typeof androidBuildMeta.appId !== 'string' || !androidBuildMeta.appId.trim()) {
    throw new Error('dist/android-build-meta.json 缺少 appId。已阻止 OTA 发布，请先使用最新 Android 发布链路重新构建。');
}
if (androidBuildMeta.appId.trim() !== releaseAndroidAppId) {
    throw new Error(`dist/android-build-meta.json 的 appId 非正式包：期望 ${releaseAndroidAppId}，实际 ${String(androidBuildMeta.appId || '')}`);
}
if (isNonReleaseAndroidAppId(androidBuildMeta.appId.trim())) {
    throw new Error(`dist/android-build-meta.json 检测到测试壳 appId=${androidBuildMeta.appId.trim()}，已阻止 OTA 发布。`);
}

if (!dryRun) {
    const requiredEnv = ['R2_ACCOUNT_ID', 'R2_ACCESS_KEY_ID', 'R2_SECRET_ACCESS_KEY', 'R2_BUCKET_NAME'];
    const missingEnv = requiredEnv.filter((key) => !process.env[key]);
    if (missingEnv.length > 0) {
        throw new Error(`缺少 R2 环境变量: ${missingEnv.join(', ')}`);
    }
}

const s3Client = new S3Client({
    region: 'auto',
    endpoint: `https://${process.env.R2_ACCOUNT_ID}.r2.cloudflarestorage.com`,
    credentials: {
        accessKeyId: process.env.R2_ACCESS_KEY_ID,
        secretAccessKey: process.env.R2_SECRET_ACCESS_KEY,
    },
});

const shouldIncludeOtaFile = (relativePath) => {
    if (OTA_EXCLUDED_PREFIXES.some((prefix) => relativePath.startsWith(prefix))) {
        return false;
    }

    if (relativePath.startsWith('locales/')) {
        return relativePath.startsWith(OTA_ALLOWED_LOCALE_PREFIX);
    }

    return true;
};

const collectFiles = (dirPath, baseDir, entries = {}, stats = {
    includedFiles: 0,
    includedBytes: 0,
    skippedFiles: 0,
    skippedBytes: 0,
}) => {
    for (const entry of readdirSync(dirPath, { withFileTypes: true })) {
        const fullPath = path.join(dirPath, entry.name);
        if (entry.isDirectory()) {
            collectFiles(fullPath, baseDir, entries, stats);
            continue;
        }

        const relativePath = path.relative(baseDir, fullPath).replace(/\\/g, '/');
        const fileBuffer = new Uint8Array(readFileSync(fullPath));
        if (!shouldIncludeOtaFile(relativePath)) {
            stats.skippedFiles += 1;
            stats.skippedBytes += fileBuffer.byteLength;
            continue;
        }
        entries[relativePath] = fileBuffer;
        stats.includedFiles += 1;
        stats.includedBytes += fileBuffer.byteLength;
    }

    return { entries, stats };
};

const {
    entries: otaEntries,
    stats: otaCollectionStats,
} = collectFiles(distDir, distDir);
if (otaCollectionStats.skippedFiles > 0) {
    throw new Error(
        `检测到当前 dist 含有不允许进入 OTA 的文件：skippedFiles=${otaCollectionStats.skippedFiles}, `
        + `skippedBytes=${otaCollectionStats.skippedBytes}。`
        + ' 这通常说明你没有走 `npm run mobile:android:sync` 这条 Android 专用裁剪链路，'
        + ' 或 dist 混入了 `assets/i18n/**` / 非 `locales/zh-CN/**` 资源。'
        + ' 为避免再次打出整包，发布已强制中止。',
    );
}
const zipBuffer = Buffer.from(zipSync(otaEntries, { level: 9 }));
if (zipBuffer.length > MAX_ANDROID_OTA_ZIP_BYTES) {
    throw new Error(
        `Android OTA 包体异常过大：${zipBuffer.length} bytes。`
        + ` 当前发布链路会自动排除 dist/assets/i18n/**，并只保留 dist/locales/zh-CN/**。`
        + ' 请检查 dist 是否混入了不应进入 OTA 的大资源，禁止继续发布。',
    );
}
const checksum = createHash('sha256').update(zipBuffer).digest('hex');
const normalizedTargetNativeVersion = explicitTargetNativeVersion
    ? explicitTargetNativeVersion
        .split(',')
        .map((value) => value.trim())
        .filter(Boolean)
    : [];
// stable 默认要求旧壳先升到当前原生版本，避免继续吃到新 OTA。
// 如确需放行旧壳，必须显式传 --allow-legacy-shells，或手动指定 target/min/max。
const resolvedTargetNativeVersion = normalizedTargetNativeVersion;
const manifest = {
    version: bundleVersion,
    url: bundleUrl,
    checksum,
    channel,
    ...(resolvedTargetNativeVersion.length > 0
        ? {
            targetNativeVersion: resolvedTargetNativeVersion.length === 1
                ? resolvedTargetNativeVersion[0]
                : resolvedTargetNativeVersion,
        }
        : {}),
    ...(minNativeVersion ? { minNativeVersion } : {}),
    ...(maxNativeVersion ? { maxNativeVersion } : {}),
    ...(forceUpdate ? { forceUpdate: true } : {}),
    ...(forceUpdateTitle ? { forceUpdateTitle } : {}),
    ...(forceUpdateMessage ? { forceUpdateMessage } : {}),
    publishedAt: new Date().toISOString(),
    size: zipBuffer.length,
    notes,
};

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
    await uploadObject(bundleKey, zipBuffer, 'application/zip', 'public, max-age=31536000, immutable');
    await uploadObject(versionManifestKey, `${JSON.stringify(manifest, null, 2)}\n`, 'application/json', 'public, max-age=60, must-revalidate');
    if (!skipLatest) {
        await uploadObject(latestManifestKey, `${JSON.stringify(manifest, null, 2)}\n`, 'application/json', 'public, max-age=60, must-revalidate');
    }
}

const distStats = statSync(path.join(distDir, 'index.html'));
console.log(dryRun ? 'OTA bundle 预演完成（未上传）' : 'OTA bundle 已发布');
console.log(`channel=${channel}`);
console.log(`bundleVersion=${bundleVersion}`);
console.log(`nativeVersion=${nativeVersion}`);
console.log(`mode=${dryRun ? 'dry-run' : 'publish'}`);
console.log(`forceUpdate=${forceUpdate ? 'true' : 'false'}`);
console.log(`allowLegacyShells=${allowLegacyShells ? 'true' : 'false'}`);
console.log(`effectiveMinNativeVersion=${minNativeVersion || '(none)'}`);
console.log(`skipLatest=${skipLatest ? 'true' : 'false'}`);
console.log(`zipBytes=${zipBuffer.length}`);
console.log(`otaIncludedFiles=${otaCollectionStats.includedFiles}`);
console.log(`otaIncludedBytes=${otaCollectionStats.includedBytes}`);
console.log(`otaSkippedFiles=${otaCollectionStats.skippedFiles}`);
console.log(`otaSkippedBytes=${otaCollectionStats.skippedBytes}`);
console.log(`indexMtime=${distStats.mtime.toISOString()}`);
console.log(`androidBuildBackendUrl=${androidBuildMeta.backendUrl}`);
console.log(`androidBuildBuiltAt=${androidBuildMeta.builtAt || '(unknown)'}`);
console.log(`bundleKey=${bundleKey}`);
console.log(`latestManifestKey=${latestManifestKey}`);
console.log(`bundleUrl=${bundleUrl}`);
console.log(`checksum=${checksum}`);
console.log(`manifest=${JSON.stringify(manifest)}`);
