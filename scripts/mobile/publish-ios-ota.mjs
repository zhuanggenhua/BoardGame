import { config } from 'dotenv';
import { createHash } from 'node:crypto';
import { existsSync, readdirSync, readFileSync, statSync } from 'node:fs';
import path from 'node:path';
import { zipSync } from 'fflate';
import { publishPrimaryAssetBatch } from '../assets/publish-primary-assets.mjs';
import {
    resolveOtaForceUpdateOptions,
} from './ota-publish-config.mjs';
import { classifyOtaBundleFile } from './ota-bundle-files.mjs';
import { waitForServerAssets } from './wait-for-server-assets.mjs';

const rootDir = process.cwd();
const MAX_IOS_OTA_ZIP_BYTES = 20 * 1024 * 1024;

for (const file of ['.env', '.env.ios', '.env.ios.local', '.env.example']) {
    const fullPath = path.join(rootDir, file);
    if (!existsSync(fullPath)) continue;
    config({ path: fullPath, override: false, quiet: true });
}

const packageJson = JSON.parse(readFileSync(path.join(rootDir, 'package.json'), 'utf8'));
const args = process.argv.slice(2);
const allowedValueArgs = new Set([
    'channel',
    'version',
    'product-version',
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
iOS OTA 发布脚本

默认策略：
- iOS 原生壳通过 TestFlight 分发；本脚本只发布 H5 OTA bundle
- OTA 路径与 Android 平行隔离：official/app-updates/ios/<channel>/**
- OTA 包版本在发布时决定；--expected-base-version 只作为可选 package.json 断言
- 所有 OTA 都强制更新，客户端必须阻塞下载并立即切换 bundle
- --no-force-update 已禁用，任何发布入口都不得关闭强制更新
- OTA 只携带 H5 代码、中文语言包、字体和资源清单；游戏资源继续走服务器资源链
- 兼容策略与 Android OTA 保持一致：面向所有已安装 TestFlight 壳版本，不写 target/min/max 原生版本门禁

常见用法：
- node scripts/mobile/publish-ios-ota.mjs --channel stable
- node scripts/mobile/publish-ios-ota.mjs --channel edge --dry-run
- node scripts/mobile/publish-ios-ota.mjs --channel stable --product-version 0.5.8 --force-update

参数：
- --channel <name>
- --version <bundleVersion>
- --product-version <version> 商业产品版本；不传则使用 package.json.version 作为兼容展示值
- --native-version <version>
- --expected-base-version <package.json.version> 可选 package.json 断言；用于确认发布 ref，没有传则不阻塞 OTA
- --force-update 兼容旧命令，可省略
- --force-update-title <text>
- --force-update-message <text>
- --notes <text>
- --dry-run
- --skip-latest 仅允许 dry-run 诊断；正式 iOS OTA 禁止跳过 latest.json
- --help
`.trim();

const validateArgs = (sourceArgs) => {
    for (let index = 0; index < sourceArgs.length; index += 1) {
        const current = sourceArgs[index];
        if (current === '-h') {
            continue;
        }
        if (!current.startsWith('--')) {
            throw new Error(`检测到不受支持的位置参数: ${current}。iOS OTA 发布脚本只接受 --channel 这类显式命名参数。`);
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

const channel = readArgValue(
    'channel',
    process.env.VITE_IOS_OTA_CHANNEL?.trim()
        || process.env.VITE_MOBILE_OTA_CHANNEL?.trim()
        || 'stable',
);
const nativeVersion = readArgValue('native-version', packageJson.version);
const expectedBaseVersion = readArgValue('expected-base-version', '').trim();
const explicitBundleVersion = readArgValue('version', '');
const productVersion = readArgValue('product-version', packageJson.version).trim() || packageJson.version;
const notes = readArgValue('notes', 'iOS TestFlight embedded OTA bundle');
const forbiddenCompatibilityArgs = [
    'target-native-version',
    'min-native-version',
    'max-native-version',
    'allow-legacy-shells',
].filter((name) => hasFlag(name) || readArgValue(name, '') !== '');
if (forbiddenCompatibilityArgs.length > 0) {
    throw new Error(
        `已禁止按原生版本做 OTA 门禁：${forbiddenCompatibilityArgs.map((name) => `--${name}`).join(', ')}。`
        + ' 当前项目规则是“所有版本都必须更新”，iOS OTA manifest 不得写 targetNativeVersion/minNativeVersion/maxNativeVersion。',
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
    throw new Error('正式 iOS OTA 发布禁止使用 --skip-latest。手机端依赖 latest.json 发现更新，跳过会导致无法更新。');
}
const distDir = path.join(rootDir, 'dist');
const iosBuildMetaPath = path.join(distDir, 'ios-build-meta.json');
const buildInstant = new Date();
const builtAt = buildInstant.toISOString().replace(/[:.]/g, '-');
const bundleVersion = explicitBundleVersion || `${productVersion}-ota-${builtAt}`;
const manifestPrefix = `official/app-updates/ios/${channel}`;
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
const bundleUrl = `${assetsBaseUrl}/app-updates/ios/${channel}/bundles/${encodeURIComponent(bundleVersion)}.zip`;
const validChannelPattern = /^[a-z0-9][a-z0-9._-]*$/i;
const releaseIosAppId = 'top.easyboardgame.app';

if (!validChannelPattern.test(channel)) {
    throw new Error(`非法 channel: ${channel}。仅允许字母、数字、点、下划线、短横线。`);
}

if (expectedBaseVersion && expectedBaseVersion !== packageJson.version) {
    throw new Error(
        `iOS OTA 基线版本不匹配：期望 ${expectedBaseVersion}，实际 package.json.version=${packageJson.version}。`
        + ' 请改用正确 ref，或移除该断言后通过 --product-version 指定商业产品版本。',
    );
}

if (!existsSync(distDir)) {
    throw new Error('dist 目录不存在。请先执行 iOS Web 构建（例如 `npm run build:ios:web` 或 `npm run mobile:ios:sync`）。');
}
if (!existsSync(path.join(distDir, 'index.html'))) {
    throw new Error('dist/index.html 缺失。请先执行 `npm run build:ios:web`。');
}
if (!existsSync(iosBuildMetaPath)) {
    throw new Error('dist/ios-build-meta.json 缺失。iOS OTA 发布只接受 iOS 链路产出的 dist，请先执行 `npm run build:ios:web`。');
}

const iosBuildMeta = JSON.parse(readFileSync(iosBuildMetaPath, 'utf8'));
if (iosBuildMeta.mode !== 'ios') {
    throw new Error(`dist/ios-build-meta.json 的 mode 非 ios，当前值为: ${String(iosBuildMeta.mode || '')}`);
}
if (typeof iosBuildMeta.backendUrl !== 'string' || !/^https?:\/\//i.test(iosBuildMeta.backendUrl.trim())) {
    throw new Error('dist/ios-build-meta.json 缺少合法 backendUrl。请先执行 `npm run build:ios:web`。');
}
if (typeof iosBuildMeta.appId !== 'string' || !iosBuildMeta.appId.trim()) {
    throw new Error('dist/ios-build-meta.json 缺少 appId。已阻止 OTA 发布，请先使用最新 iOS 发布链路重新构建。');
}
if (iosBuildMeta.appId.trim() !== releaseIosAppId) {
    throw new Error(`dist/ios-build-meta.json 的 appId 非正式包：期望 ${releaseIosAppId}，实际 ${String(iosBuildMeta.appId || '')}`);
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
if (zipBuffer.length > MAX_IOS_OTA_ZIP_BYTES) {
    throw new Error(
        `iOS OTA 包体异常过大：${zipBuffer.length} bytes。`
        + ' 当前发布链路会自动排除远程素材目录，并只保留本地必需文件。'
        + ' 请检查 dist 是否混入了不应进入 OTA 的大资源，禁止继续发布。',
    );
}
const checksum = createHash('sha256').update(zipBuffer).digest('hex');
const publishedAt = new Date();
const manifest = {
    version: bundleVersion,
    productVersion,
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
    await waitForServerAssets([bundleUrl]);
}

const distStats = statSync(path.join(distDir, 'index.html'));
console.log(dryRun ? 'iOS OTA bundle 预演完成（未上传）' : 'iOS OTA bundle 已发布');
console.log(`channel=${channel}`);
console.log(`bundleVersion=${bundleVersion}`);
console.log(`productVersion=${productVersion}`);
console.log(`packageVersion=${packageJson.version}`);
console.log(`bundleVersionHumanTime=${bundleVersionHumanTime}`);
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
console.log(`iosBuildBackendUrl=${iosBuildMeta.backendUrl}`);
console.log(`iosBuildBuiltAt=${iosBuildMeta.builtAt || '(unknown)'}`);
console.log(`bundleKey=${bundleKey}`);
console.log(`latestManifestKey=${latestManifestKey}`);
console.log(`bundleUrl=${bundleUrl}`);
console.log(`checksum=${checksum}`);
console.log(`publishedAtHumanTime=${publishedAtHumanTime}`);
console.log(`manifest=${JSON.stringify(manifest)}`);
