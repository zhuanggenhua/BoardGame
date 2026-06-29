import { config } from 'dotenv';
import { createHash } from 'node:crypto';
import { existsSync, readdirSync, readFileSync, statSync } from 'node:fs';
import path from 'node:path';
import { S3Client, PutObjectCommand } from '@aws-sdk/client-s3';
import { zipSync } from 'fflate';
import {
    resolveOtaForceUpdateOptions,
} from './ota-publish-config.mjs';
import {
    DIST_COMMON_JSON_RETAIN_RELATIVE_PATHS,
    DIST_I18N_JSON_RETAIN_RELATIVE_PATHS,
    DIST_LOGOS_RETAIN_RELATIVE_PATHS,
} from '../deploy/prune-web-dist-assets.mjs';

const rootDir = process.cwd();
const OTA_REMOTE_EXCLUDED_PREFIXES = [
    'assets/common/audio/',
];
const OTA_ALLOWED_LOCALE_PREFIX = 'locales/zh-CN/';
const MAX_ANDROID_OTA_ZIP_BYTES = 20 * 1024 * 1024;
const OTA_ALLOWED_EMBEDDED_ASSET_FILES = new Set([
    ...DIST_COMMON_JSON_RETAIN_RELATIVE_PATHS.map((relativePath) => `assets/common/${relativePath}`),
    ...DIST_I18N_JSON_RETAIN_RELATIVE_PATHS.map((relativePath) => `assets/i18n/${relativePath}`),
    ...DIST_LOGOS_RETAIN_RELATIVE_PATHS.map((relativePath) => `logos/${relativePath}`),
]);
const OTA_ALLOWED_EMBEDDED_ASSET_PREFIXES = [
    'assets/region-mask-',
];

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
    'ota-version-base',
    'native-version',
    'expected-base-version',
    'force-update-title',
    'force-update-message',
    'notes',
]);
const allowedBooleanArgs = new Set([
    'force-update',
    'no-force-update',
    'dry-run',
    'skip-latest',
    'help',
]);
const helpText = `
Android OTA 发布脚本

默认策略：
- OTA 默认面向所有已安装版本，不按原生版本做 target/min/max 门禁
- 如需让客户端拿到更新后立即切换 bundle，可显式传 --force-update
- 若误传任何 target/min/max 原生版本兼容参数，脚本会直接失败，防止再次发出“只给某个原生版本”的错误 OTA

常见用法：
- node scripts/mobile/publish-android-ota.mjs --channel stable
- node scripts/mobile/publish-android-ota.mjs --channel edge --dry-run
- node scripts/mobile/publish-android-ota.mjs --channel stable --force-update

参数：
- --channel <name>
- --version <bundleVersion>
- --ota-version-base <semver> 仅用于未显式 --version 时生成 OTA 内部游标；默认取 package.json.version
- --native-version <version>
- --expected-base-version <package.json.version>
- --force-update / --no-force-update
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
const expectedBaseVersion = readArgValue('expected-base-version', '').trim();
const explicitBundleVersion = readArgValue('version', '');
const otaVersionBase = readArgValue(
    'ota-version-base',
    process.env.ANDROID_OTA_VERSION_BASE?.trim() || packageJson.version,
).trim();
const notes = readArgValue('notes', 'Android embedded OTA bundle');
const forbiddenCompatibilityArgs = [
    'target-native-version',
    'min-native-version',
    'max-native-version',
    'allow-legacy-shells',
].filter((name) => hasFlag(name) || readArgValue(name, '') !== '');
if (forbiddenCompatibilityArgs.length > 0) {
    throw new Error(
        `已禁止按原生版本做 OTA 门禁：${forbiddenCompatibilityArgs.map((name) => `--${name}`).join(', ')}。`
        + ' 当前项目规则是“所有版本都必须更新”，OTA manifest 不得再写 targetNativeVersion/minNativeVersion/maxNativeVersion。',
    );
}
const {
    forceUpdate,
    forceUpdateTitle,
    forceUpdateMessage,
} = resolveOtaForceUpdateOptions({
    forceUpdateFlag: hasFlag('force-update'),
    noForceUpdateFlag: hasFlag('no-force-update'),
    forceUpdateTitle: readArgValue('force-update-title', ''),
    forceUpdateMessage: readArgValue('force-update-message', ''),
    defaultForceUpdate: false,
});
const dryRun = hasFlag('dry-run');
const skipLatest = hasFlag('skip-latest');
const distDir = path.join(rootDir, 'dist');
const androidBuildMetaPath = path.join(distDir, 'android-build-meta.json');
const buildInstant = new Date();
const builtAt = buildInstant.toISOString().replace(/[:.]/g, '-');
const bundleVersion = explicitBundleVersion || `${otaVersionBase}-ota-${builtAt}`;
const manifestPrefix = `official/app-updates/android/${channel}`;
const humanDateTimeFormatter = new Intl.DateTimeFormat('zh-CN', {
    timeZone: 'Asia/Shanghai',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: false,
});
const formatHumanTime = (value) => {
    if (!value) return '(unknown)';
    const date = value instanceof Date ? value : new Date(value);
    if (Number.isNaN(date.getTime())) return String(value);
    return `${humanDateTimeFormatter.format(date)}（北京时间）`;
};
const bundleVersionHumanTime = formatHumanTime(buildInstant);
const bundleKey = `${manifestPrefix}/bundles/${bundleVersion}.zip`;
const versionManifestKey = `${manifestPrefix}/manifests/${bundleVersion}.json`;
const latestManifestKey = `${manifestPrefix}/latest.json`;
const assetsBaseUrl = (process.env.VITE_ASSETS_BASE_URL?.trim() || 'https://assets.easyboardgame.top/official').replace(/\/+$/, '');
const bundleUrl = `${assetsBaseUrl}/app-updates/android/${channel}/bundles/${encodeURIComponent(bundleVersion)}.zip`;
const validChannelPattern = /^[a-z0-9][a-z0-9._-]*$/i;
const validOtaVersionBasePattern = /^\d+\.\d+\.\d+(?:[-+][0-9A-Za-z.-]+)?$/;
const releaseAndroidAppId = 'top.easyboardgame.app';
const debugAndroidAppIdSegments = new Set(['debug', 'dev', 'test', 'qa']);

const isNonReleaseAndroidAppId = (appId) => appId
    .split('.')
    .some((segment) => debugAndroidAppIdSegments.has(segment.trim().toLowerCase()));

if (!validChannelPattern.test(channel)) {
    throw new Error(`非法 channel: ${channel}。仅允许字母、数字、点、下划线、短横线。`);
}

if (!explicitBundleVersion && !validOtaVersionBasePattern.test(otaVersionBase)) {
    throw new Error(
        `非法 OTA 游标基线: ${otaVersionBase || '(空)'}。`
        + ' 未显式传 --version 时，--ota-version-base 必须是类似 0.6.0 或 6.0.0 的版本号。',
    );
}

if (!expectedBaseVersion) {
    throw new Error('Android OTA 发布已禁止隐式版本：必须显式传 --expected-base-version，并与 package.json.version 完全一致。');
}

if (expectedBaseVersion !== packageJson.version) {
    throw new Error(
        `Android OTA 基线版本不匹配：期望 ${expectedBaseVersion}，实际 package.json.version=${packageJson.version}。`
        + ' 请先 bump 到正确版本，或改用正确 ref / 正确显式版本后再发布。',
    );
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

const classifyOtaFile = (relativePath) => {
    if (OTA_REMOTE_EXCLUDED_PREFIXES.some((prefix) => relativePath.startsWith(prefix))) {
        return 'optional-skip';
    }

    if (relativePath.startsWith('locales/')) {
        return relativePath.startsWith(OTA_ALLOWED_LOCALE_PREFIX) ? 'include' : 'blocked-skip';
    }

    if (relativePath.startsWith('assets/common/') || relativePath.startsWith('assets/i18n/') || relativePath.startsWith('logos/')) {
        if (OTA_ALLOWED_EMBEDDED_ASSET_FILES.has(relativePath)) {
            return 'include';
        }
        if (OTA_ALLOWED_EMBEDDED_ASSET_PREFIXES.some((prefix) => relativePath.startsWith(prefix))) {
            return 'include';
        }
        return 'blocked-skip';
    }

    return 'include';
};

const collectFiles = (dirPath, baseDir, entries = {}, stats = {
    includedFiles: 0,
    includedBytes: 0,
    blockedSkippedFiles: 0,
    blockedSkippedBytes: 0,
    optionalSkippedFiles: 0,
    optionalSkippedBytes: 0,
}) => {
    for (const entry of readdirSync(dirPath, { withFileTypes: true })) {
        const fullPath = path.join(dirPath, entry.name);
        if (entry.isDirectory()) {
            collectFiles(fullPath, baseDir, entries, stats);
            continue;
        }

        const relativePath = path.relative(baseDir, fullPath).replace(/\\/g, '/');
        const fileBuffer = new Uint8Array(readFileSync(fullPath));
        const classification = classifyOtaFile(relativePath);
        if (classification === 'blocked-skip') {
            stats.blockedSkippedFiles += 1;
            stats.blockedSkippedBytes += fileBuffer.byteLength;
            continue;
        }
        if (classification === 'optional-skip') {
            stats.optionalSkippedFiles += 1;
            stats.optionalSkippedBytes += fileBuffer.byteLength;
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
if (otaCollectionStats.blockedSkippedFiles > 0) {
    throw new Error(
        `检测到当前 dist 含有不允许进入 OTA 的文件：skippedFiles=${otaCollectionStats.blockedSkippedFiles}, `
        + `skippedBytes=${otaCollectionStats.blockedSkippedBytes}。`
        + ' 这通常说明你没有走最新的 Android 专用构建裁剪链路，'
        + ' 或 dist 混入了本该继续走本地的非法资源。'
        + ' 为避免再次打出整包，发布已强制中止。',
    );
}
const zipBuffer = Buffer.from(zipSync(otaEntries, { level: 9 }));
if (zipBuffer.length > MAX_ANDROID_OTA_ZIP_BYTES) {
    throw new Error(
        `Android OTA 包体异常过大：${zipBuffer.length} bytes。`
        + ' 当前发布链路会自动排除默认走 R2 的图片/音频资源，并只保留本地必需文件。'
        + ' 请检查 dist 是否混入了不应进入 OTA 的大资源，禁止继续发布。',
    );
}
const checksum = createHash('sha256').update(zipBuffer).digest('hex');
const publishedAt = new Date();
const manifest = {
    version: bundleVersion,
    url: bundleUrl,
    checksum,
    channel,
    ...(forceUpdate ? { forceUpdate: true } : {}),
    ...(forceUpdateTitle ? { forceUpdateTitle } : {}),
    ...(forceUpdateMessage ? { forceUpdateMessage } : {}),
    publishedAt: publishedAt.toISOString(),
    size: zipBuffer.length,
    notes,
};
const publishedAtHumanTime = formatHumanTime(publishedAt);

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
console.log(`bundleVersionHumanTime=${bundleVersionHumanTime}`);
console.log(`otaVersionBase=${explicitBundleVersion ? '(explicit-version)' : otaVersionBase}`);
console.log(`nativeVersion=${nativeVersion}`);
console.log(`mode=${dryRun ? 'dry-run' : 'publish'}`);
console.log(`forceUpdate=${forceUpdate ? 'true' : 'false'}`);
console.log('nativeCompatibilityMode=disabled');
console.log(`skipLatest=${skipLatest ? 'true' : 'false'}`);
console.log(`zipBytes=${zipBuffer.length}`);
console.log(`otaIncludedFiles=${otaCollectionStats.includedFiles}`);
console.log(`otaIncludedBytes=${otaCollectionStats.includedBytes}`);
console.log(`otaBlockedSkippedFiles=${otaCollectionStats.blockedSkippedFiles}`);
console.log(`otaBlockedSkippedBytes=${otaCollectionStats.blockedSkippedBytes}`);
console.log(`otaOptionalSkippedFiles=${otaCollectionStats.optionalSkippedFiles}`);
console.log(`otaOptionalSkippedBytes=${otaCollectionStats.optionalSkippedBytes}`);
console.log(`indexMtime=${distStats.mtime.toISOString()}`);
console.log(`androidBuildBackendUrl=${androidBuildMeta.backendUrl}`);
console.log(`androidBuildBuiltAt=${androidBuildMeta.builtAt || '(unknown)'}`);
console.log(`bundleKey=${bundleKey}`);
console.log(`latestManifestKey=${latestManifestKey}`);
console.log(`bundleUrl=${bundleUrl}`);
console.log(`checksum=${checksum}`);
console.log(`publishedAtHumanTime=${publishedAtHumanTime}`);
console.log(`manifest=${JSON.stringify(manifest)}`);
