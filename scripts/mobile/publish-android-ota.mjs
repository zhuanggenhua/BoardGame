import { config } from 'dotenv';
import { createHash } from 'node:crypto';
import { existsSync, readdirSync, readFileSync, statSync } from 'node:fs';
import path from 'node:path';
import { zipSync } from 'fflate';
import { publishPrimaryAssetBatch } from '../assets/publish-primary-assets.mjs';
import {
    resolveAndroidOtaVersionBase,
    resolveOtaForceUpdateOptions,
} from './ota-publish-config.mjs';
import { resolveAndroidAssetsBaseUrl } from './android-assets-base-url.mjs';
import { classifyOtaBundleFile } from './ota-bundle-files.mjs';
import { waitForServerAssets } from './wait-for-server-assets.mjs';

const rootDir = process.cwd();
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
    'display-version',
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
- 所有 OTA 都强制更新，客户端必须阻塞下载并立即切换 bundle
- --no-force-update 已禁用，任何发布入口都不得关闭强制更新
- OTA 只携带 H5 代码、中文语言包、字体和资源清单；游戏资源继续走服务器资源链
- 若误传任何 target/min/max 原生版本兼容参数，脚本会直接失败，防止再次发出“只给某个原生版本”的错误 OTA

常见用法：
- node scripts/mobile/publish-android-ota.mjs --channel stable
- node scripts/mobile/publish-android-ota.mjs --channel edge --dry-run
- node scripts/mobile/publish-android-ota.mjs --channel stable --force-update

参数：
- --channel <name>
- --version <bundleVersion>
- --display-version <number> 用户可见发布号；不传则从线上 latest.json 自动递增，最低 600
- --ota-version-base <semver> 仅用于未显式 --version 时生成 OTA 内部游标；默认取 package.json.version
- --native-version <version>
- --expected-base-version <package.json.version>
- --force-update 兼容旧命令，可省略
- --force-update-title <text>
- --force-update-message <text>
- --notes <text>
- --dry-run
- --skip-latest 仅允许 dry-run 诊断；正式发布禁止跳过 latest.json
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
const explicitDisplayVersion = readArgValue('display-version', '').trim();
const requestedOtaVersionBase = readArgValue(
    'ota-version-base',
    process.env.ANDROID_OTA_VERSION_BASE?.trim() || '',
).trim();
const otaVersionBase = resolveAndroidOtaVersionBase({
    packageVersion: packageJson.version,
    requestedVersionBase: requestedOtaVersionBase,
});
if (explicitBundleVersion) {
    resolveAndroidOtaVersionBase({
        packageVersion: packageJson.version,
        requestedVersionBase: explicitBundleVersion,
    });
}
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
    noForceUpdateFlag: hasFlag('no-force-update'),
    forceUpdateTitle: readArgValue('force-update-title', ''),
    forceUpdateMessage: readArgValue('force-update-message', ''),
});
const dryRun = hasFlag('dry-run');
const skipLatest = hasFlag('skip-latest');
if (skipLatest && !dryRun) {
    throw new Error('正式 Android OTA 发布禁止使用 --skip-latest。手机端依赖 latest.json 发现更新，跳过会导致无法更新。');
}
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
const assetsBaseUrl = resolveAndroidAssetsBaseUrl(process.env);
const bundleUrl = `${assetsBaseUrl}/app-updates/android/${channel}/bundles/${encodeURIComponent(bundleVersion)}.zip`;
const latestManifestUrl = `${assetsBaseUrl}/app-updates/android/${channel}/latest.json`;
const validChannelPattern = /^[a-z0-9][a-z0-9._-]*$/i;
const validOtaVersionBasePattern = /^\d+\.\d+\.\d+(?:[-+][0-9A-Za-z.-]+)?$/;
const MIN_ANDROID_OTA_DISPLAY_VERSION = 600;
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

const parseDisplayVersion = (value) => {
    if (value === null || value === undefined || value === '') {
        return null;
    }
    const text = String(value).trim();
    if (!/^\d+$/.test(text)) {
        return null;
    }
    const parsed = Number.parseInt(text, 10);
    return Number.isSafeInteger(parsed) && parsed >= 0 ? parsed : null;
};

const readLatestDisplayVersion = async () => {
    try {
        const response = await fetch(`${latestManifestUrl}?probe=${Date.now()}`, {
            headers: { 'Cache-Control': 'no-cache' },
            signal: AbortSignal.timeout(30_000),
        });
        if (!response.ok) {
            return null;
        }
        const latestManifest = await response.json();
        return parseDisplayVersion(latestManifest.displayVersion);
    } catch {
        return null;
    }
};

const explicitDisplayVersionNumber = parseDisplayVersion(explicitDisplayVersion);
if (explicitDisplayVersion && explicitDisplayVersionNumber === null) {
    throw new Error(`Android OTA 显示发布号非法：${explicitDisplayVersion}。请使用 600、601 这类非负整数。`);
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
if (androidBuildMeta.otaEnabled !== true) {
    throw new Error('dist/android-build-meta.json 显示 OTA 未启用。已阻止发布，避免正式 App 更新后误报“测试壳已禁用 OTA”。');
}
if (typeof androidBuildMeta.otaManifestUrl !== 'string' || !/^https?:\/\//i.test(androidBuildMeta.otaManifestUrl.trim())) {
    throw new Error('dist/android-build-meta.json 缺少合法 otaManifestUrl。已阻止发布，请通过统一 Android OTA 入口重新构建。');
}
if (androidBuildMeta.otaChannel !== channel) {
    throw new Error(`Android OTA 构建 channel 与发布目标不一致：构建=${String(androidBuildMeta.otaChannel || '')}，发布=${channel}`);
}

const collectFiles = (dirPath, baseDir, entries = {}, stats = {
    includedFiles: 0,
    includedBytes: 0,
    remoteSkippedFiles: 0,
    remoteSkippedBytes: 0,
}) => {
    for (const entry of readdirSync(dirPath, { withFileTypes: true })) {
        const fullPath = path.join(dirPath, entry.name);
        if (entry.isDirectory()) {
            collectFiles(fullPath, baseDir, entries, stats);
            continue;
        }

        const relativePath = path.relative(baseDir, fullPath).replace(/\\/g, '/');
        const fileBuffer = new Uint8Array(readFileSync(fullPath));
        const classification = classifyOtaBundleFile(relativePath);
        if (classification === 'remote-skip') {
            stats.remoteSkippedFiles += 1;
            stats.remoteSkippedBytes += fileBuffer.byteLength;
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
const zipBuffer = Buffer.from(zipSync(otaEntries, { level: 9 }));
if (zipBuffer.length > MAX_ANDROID_OTA_ZIP_BYTES) {
    throw new Error(
        `Android OTA 包体异常过大：${zipBuffer.length} bytes。`
        + ' 当前发布链路会自动排除远程素材目录，并只保留本地必需文件。'
        + ' 请检查 dist 是否混入了不应进入 OTA 的大资源，禁止继续发布。',
    );
}
const checksum = createHash('sha256').update(zipBuffer).digest('hex');
const publishedAt = new Date();
const latestDisplayVersion = await readLatestDisplayVersion();
const displayVersion = String(
    explicitDisplayVersionNumber ?? Math.max(
        MIN_ANDROID_OTA_DISPLAY_VERSION,
        (latestDisplayVersion ?? (MIN_ANDROID_OTA_DISPLAY_VERSION - 1)) + 1,
    ),
);
const manifest = {
    version: bundleVersion,
    displayVersion,
    productVersion: packageJson.version,
    url: bundleUrl,
    checksum,
    channel,
    forceUpdate,
    forceUpdateTitle,
    forceUpdateMessage,
    publishedAt: publishedAt.toISOString(),
    size: zipBuffer.length,
    notes,
};
const publishedAtHumanTime = formatHumanTime(publishedAt);

const versionManifestBody = `${JSON.stringify(manifest, null, 2)}\n`;
const latestManifestBody = versionManifestBody;

if (!dryRun) {
    await publishPrimaryAssetBatch([
        {
            key: bundleKey,
            body: zipBuffer,
            size: zipBuffer.length,
            contentType: 'application/zip',
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
    await waitForServerAssets([
        {
            url: bundleUrl,
            expectedSize: zipBuffer.length,
        },
        {
            url: latestManifestUrl,
            expectedSize: Buffer.byteLength(latestManifestBody),
            expectedSha256: createHash('sha256').update(latestManifestBody).digest('hex'),
        },
    ], { requireCorsPreflight: true });
}

const distStats = statSync(path.join(distDir, 'index.html'));
console.log(dryRun ? 'OTA bundle 预演完成（未上传）' : 'OTA bundle 已发布');
console.log(`channel=${channel}`);
console.log(`bundleVersion=${bundleVersion}`);
console.log(`displayVersion=${displayVersion}`);
console.log(`productVersion=${packageJson.version}`);
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
console.log(`otaRemoteSkippedFiles=${otaCollectionStats.remoteSkippedFiles}`);
console.log(`otaRemoteSkippedBytes=${otaCollectionStats.remoteSkippedBytes}`);
console.log(`indexMtime=${distStats.mtime.toISOString()}`);
console.log(`androidBuildBackendUrl=${androidBuildMeta.backendUrl}`);
console.log(`androidBuildBuiltAt=${androidBuildMeta.builtAt || '(unknown)'}`);
console.log(`bundleKey=${bundleKey}`);
console.log(`latestManifestKey=${latestManifestKey}`);
console.log(`bundleUrl=${bundleUrl}`);
console.log(`checksum=${checksum}`);
console.log(`publishedAtHumanTime=${publishedAtHumanTime}`);
console.log(`manifest=${JSON.stringify(manifest)}`);
