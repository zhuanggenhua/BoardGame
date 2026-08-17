import { spawn } from 'node:child_process';
import { existsSync } from 'node:fs';
import path from 'node:path';
import {
    bumpSemver,
    packageJsonPath,
    readJsonFile,
    updateProjectVersion,
} from './version-utils.mjs';
import {
    resolveAndroidAssetsBaseUrl,
    resolveAndroidControlAssetsBaseUrl,
} from './android-assets-base-url.mjs';
import { resolveAndroidBackendUrl } from './android-backend-url.mjs';
import { resolveAndroidOtaClientBuildEnv } from './ota-publish-config.mjs';

const rootDir = process.cwd();
const rawArgs = process.argv.slice(2);
const command = rawArgs[0] || '';
const args = rawArgs.slice(1);
const releaseAndroidAppId = 'top.easyboardgame.app';
const releaseAndroidAppName = '易桌游';
const debugAndroidAppIdSegments = new Set(['debug', 'dev', 'test', 'qa']);

const helpText = `
Android 统一发布入口

用法:
  node scripts/mobile/release-android.mjs ota [选项]
  node scripts/mobile/release-android.mjs native [选项]
  node scripts/mobile/release-android.mjs packages [选项]
  node scripts/mobile/release-android.mjs full [选项]

子命令:
  ota       先 doctor + typecheck + sync, 再发布 OTA
  native    可选 bump 版本, 再 typecheck + build release + 发布原生 APK 更新
  packages  发布 Android 游戏包
  full      依次执行 OTA -> 可选 packages -> native

常用选项:
  --channel <stable|gray|edge>
  --dry-run
  --skip-latest 仅允许 Android OTA dry-run 诊断；正式 Android OTA 禁止跳过 latest.json

ota / native / full 额外选项:
  --bump <patch|minor|major>   自动更新 package.json / package-lock.json 版本

ota 额外选项:
  --version <bundleVersion>     显式指定 OTA 内部游标
  --display-version <number>    显式指定用户可见更新号；不传则从线上 latest.json 自动递增，最低 600

ota / full 额外选项:
  --ota-version-base <semver>   未显式 --version 时的 OTA 游标基线，可与产品版本解耦

native / full 额外选项:
  --skip-build                 跳过 native build:release, 直接发布现有 APK

full 额外选项:
  --with-packages              full 时顺带发布游戏包
  --game <gameId>              指定游戏包; 传了该参数会自动启用 packages 阶段

说明:
  - OTA 发布已禁止隐式版本；发布时会强制传 --expected-base-version=<package.json.version>
  - 所有 OTA 都强制更新；--no-force-update 已禁用
  - 正式 Android OTA 必须写入 latest.json，禁止跳过更新发现入口
  - OTA 客户端按 bundle version 这个内部游标判断新旧；publishedAt 只用于审计和展示
  - OTA / native / full 可使用 --bump 自动递增版本后再发布
  - full 的顺序固定为: OTA -> packages(可选) -> native
  - native / full 不接受 --version 覆盖原生版本, 原生版本以 package.json 为单一真实来源
`.trim();

const readArgValue = (name, fallback = '', sourceArgs = args) => {
    const prefix = `--${name}=`;
    const direct = sourceArgs.find((arg) => arg.startsWith(prefix));
    if (direct) {
        return direct.slice(prefix.length);
    }
    const index = sourceArgs.findIndex((arg) => arg === `--${name}`);
    if (index >= 0 && sourceArgs[index + 1]) {
        return sourceArgs[index + 1];
    }
    return fallback;
};

const hasFlag = (name, sourceArgs = args) => sourceArgs.includes(`--${name}`);

const collectPassthroughArgs = (allowedNames, allowedFlags, sourceArgs = args) => {
    const nextArgs = [];
    for (let index = 0; index < sourceArgs.length; index += 1) {
        const current = sourceArgs[index];
        if (!current.startsWith('--')) {
            continue;
        }
        const eqIndex = current.indexOf('=');
        const rawName = eqIndex >= 0 ? current.slice(2, eqIndex) : current.slice(2);
        if (allowedNames.has(rawName)) {
            nextArgs.push(current);
            if (eqIndex < 0 && index + 1 < sourceArgs.length && !sourceArgs[index + 1].startsWith('--')) {
                nextArgs.push(sourceArgs[index + 1]);
                index += 1;
            }
            continue;
        }
        if (allowedFlags.has(rawName)) {
            nextArgs.push(current);
        }
    }
    return nextArgs;
};

const runCommand = (cmd, cmdArgs, options = {}) => new Promise((resolve, reject) => {
    const child = spawn(cmd, cmdArgs, {
        cwd: rootDir,
        env: process.env,
        stdio: 'inherit',
        windowsHide: true,
        shell: false,
        ...options,
    });

    child.on('exit', (code) => {
        if (code === 0) {
            resolve();
            return;
        }
        reject(new Error(`command failed: ${cmd} ${cmdArgs.join(' ')} (exit ${code ?? 'unknown'})`));
    });
    child.on('error', reject);
});

const runNodeScript = async (relativePath, scriptArgs = []) => {
    const scriptPath = path.join(rootDir, relativePath);
    if (!existsSync(scriptPath)) {
        throw new Error(`未找到脚本: ${relativePath}`);
    }
    await runCommand(process.execPath, [scriptPath, ...scriptArgs]);
};

const logStep = (message) => {
    console.log(`\n[android-release] ${message}`);
};

let didTypecheck = false;
const runTypecheck = async () => {
    if (didTypecheck) {
        return;
    }
    didTypecheck = true;

    logStep('执行 TypeScript typecheck');
    const tscPath = path.join(rootDir, 'node_modules', 'typescript', 'bin', 'tsc');
    if (!existsSync(tscPath)) {
        throw new Error('未找到 TypeScript 编译器（node_modules/typescript/bin/tsc）。请先安装依赖后再发布。');
    }
    await runCommand(process.execPath, [tscPath, '--noEmit']);
};

const ensureNoNativeVersionOverride = () => {
    if (readArgValue('version', '', args)) {
        throw new Error('native / full 不支持 --version。若要改原生版本，请使用 --bump，并让 package.json 作为单一真实来源。');
    }
};

const ensureSupportedCommand = () => {
    if (!command || hasFlag('help', rawArgs) || rawArgs.includes('-h')) {
        console.log(helpText);
        process.exit(0);
    }

    if (!new Set(['ota', 'native', 'packages', 'full']).has(command)) {
        throw new Error(`未知子命令: ${command}`);
    }
};

const isNonReleaseAndroidAppId = (appId) => appId
    .split('.')
    .some((segment) => debugAndroidAppIdSegments.has(segment.trim().toLowerCase()));

const assertReleaseShellConfig = () => {
    const appId = process.env.CAPACITOR_APP_ID?.trim() || '';
    const viteAppId = process.env.VITE_CAPACITOR_APP_ID?.trim() || '';
    const appName = process.env.CAPACITOR_APP_NAME?.trim() || '';

    if (!appId) {
        throw new Error('release 流程缺少 CAPACITOR_APP_ID。');
    }
    if (!viteAppId) {
        throw new Error('release 流程缺少 VITE_CAPACITOR_APP_ID。');
    }
    if (appId !== viteAppId) {
        throw new Error(`release 壳配置不一致：CAPACITOR_APP_ID=${appId}，VITE_CAPACITOR_APP_ID=${viteAppId}`);
    }
    if (appId !== releaseAndroidAppId) {
        throw new Error(`release 壳 appId 非正式包：期望 ${releaseAndroidAppId}，实际 ${appId}`);
    }
    if (isNonReleaseAndroidAppId(appId)) {
        throw new Error(`release 流程检测到测试壳 appId=${appId}，已阻止发布。`);
    }
    if (appName !== releaseAndroidAppName) {
        throw new Error(`release 壳 appName 非正式包：期望 ${releaseAndroidAppName}，实际 ${appName || '(空)'}`);
    }
};

const applyReleaseShellDefaults = () => {
    process.env.CAPACITOR_APP_ID = process.env.CAPACITOR_APP_ID?.trim() || releaseAndroidAppId;
    process.env.VITE_CAPACITOR_APP_ID = process.env.VITE_CAPACITOR_APP_ID?.trim() || process.env.CAPACITOR_APP_ID;
    process.env.CAPACITOR_APP_NAME = process.env.CAPACITOR_APP_NAME?.trim() || releaseAndroidAppName;

    assertReleaseShellConfig();
    logStep(`release 壳配置: appId=${process.env.CAPACITOR_APP_ID}, appName=${process.env.CAPACITOR_APP_NAME}`);
};

const forbiddenOtaCompatibilityArgs = [
    'target-native-version',
    'min-native-version',
    'max-native-version',
    'allow-legacy-shells',
];

const ensureNoForbiddenOtaCompatibilityArgs = (sourceArgs = args) => {
    const matched = forbiddenOtaCompatibilityArgs.filter(
        (name) => hasFlag(name, sourceArgs) || readArgValue(name, '', sourceArgs) !== '',
    );
    if (matched.length === 0) {
        return;
    }
    throw new Error(
        `已禁止按原生版本做 OTA 门禁：${matched.map((name) => `--${name}`).join(', ')}。`
        + ' 当前项目规则是“所有版本都必须更新”，OTA manifest 不得再写 targetNativeVersion/minNativeVersion/maxNativeVersion。',
    );
};

const applyOtaClientBuildDefaults = () => {
    const channel = readArgValue('channel', process.env.VITE_ANDROID_OTA_CHANNEL?.trim() || 'stable');
    const downloadAssetsBaseUrl = resolveAndroidAssetsBaseUrl(process.env);
    const controlAssetsBaseUrl = resolveAndroidControlAssetsBaseUrl(process.env);
    const otaEnv = resolveAndroidOtaClientBuildEnv({
        channel,
        controlAssetsBaseUrl,
        downloadAssetsBaseUrl,
    });
    Object.assign(process.env, otaEnv, {
        VITE_ASSETS_BASE_URL: downloadAssetsBaseUrl,
        VITE_MOBILE_PACKAGE_MANIFEST_URL: `${downloadAssetsBaseUrl}/mobile-packages/android`,
    });
    logStep(
        `OTA 客户端配置: channel=${channel}, manifest=${otaEnv.VITE_ANDROID_OTA_MANIFEST_URL}`
        + `, fallback=${otaEnv.VITE_ANDROID_OTA_MANIFEST_FALLBACK_URLS || '(none)'}`,
    );
};

const applyAndroidBackendDefaults = () => {
    const backendUrl = resolveAndroidBackendUrl(process.env);
    process.env.VITE_BACKEND_URL = backendUrl;
    logStep(`Android 后端地址: ${backendUrl}`);
};

const ensureForcedOta = (sourceArgs = args) => {
    if (hasFlag('no-force-update', sourceArgs)) {
        throw new Error('所有 OTA 已强制更新，禁止使用 --no-force-update。');
    }
};

const buildOtaArgs = (sourceArgs = args) => collectPassthroughArgs(
    new Set([
        'channel',
        'version',
        'display-version',
        'ota-version-base',
        'native-version',
        'expected-base-version',
        'force-update-title',
        'force-update-message',
        'notes',
    ]),
    new Set(['dry-run', 'skip-latest', 'force-update']),
    sourceArgs,
);

const buildNativeArgs = (sourceArgs = args) => collectPassthroughArgs(
    new Set([
        'channel',
        'version-code',
        'force-update-title',
        'force-update-message',
        'notes',
        'apk',
    ]),
    new Set(['dry-run', 'skip-latest', 'no-force-update']),
    sourceArgs,
);

const buildPackagesArgs = (sourceArgs = args) => collectPassthroughArgs(
    new Set(['channel', 'game', 'version']),
    new Set(['dry-run', 'manifest-only']),
    sourceArgs,
);

const runDoctor = async () => {
    logStep('执行 Android doctor');
    await runNodeScript('scripts/mobile/android.mjs', ['doctor']);
};

const runSync = async () => {
    logStep('执行 Android sync');
    await runNodeScript('scripts/mobile/android.mjs', ['sync']);
};

const runBuildRelease = async () => {
    logStep('构建 Android release APK');
    await runNodeScript('scripts/mobile/android.mjs', ['build-release']);
};

const prepareReleaseVersion = () => {
    const bumpType = readArgValue('bump', '', args);
    const currentVersion = readJsonFile(packageJsonPath).version;
    if (!bumpType) {
        return {
            version: currentVersion,
            bumped: false,
        };
    }
    if (!new Set(['patch', 'minor', 'major']).has(bumpType)) {
        throw new Error(`--bump 只支持 patch | minor | major，当前值为: ${bumpType}`);
    }
    if (hasFlag('dry-run', args)) {
        throw new Error('--dry-run 不能与 --bump 同时使用；预演不会改版本文件。');
    }
    const nextVersion = bumpSemver(currentVersion, bumpType);
    updateProjectVersion(nextVersion);
    logStep(`已更新项目版本: ${currentVersion} -> ${nextVersion}`);
    return {
        version: nextVersion,
        bumped: true,
    };
};

const buildOtaArgsWithExpectedVersion = (releaseVersion, sourceArgs = args) => [
    ...buildOtaArgs(sourceArgs).filter((arg, index, list) => {
        if (arg === '--expected-base-version') return false;
        const prev = list[index - 1];
        if (prev === '--expected-base-version') return false;
        return true;
    }),
    `--expected-base-version=${releaseVersion}`,
];

const runOtaRelease = async () => {
    const releaseInfo = prepareReleaseVersion();
    ensureNoForbiddenOtaCompatibilityArgs();
    ensureForcedOta();
    applyAndroidBackendDefaults();
    applyOtaClientBuildDefaults();
    await runDoctor();
    await runTypecheck();
    await runSync();
    logStep(`发布 Android OTA (expectedBaseVersion=${releaseInfo.version})`);
    await runNodeScript('scripts/mobile/publish-android-ota.mjs', buildOtaArgsWithExpectedVersion(releaseInfo.version));
};

const runPackagesRelease = async (sourceArgs = args) => {
    logStep('发布 Android 游戏包');
    await runNodeScript('scripts/mobile/publish-android-game-packages.mjs', buildPackagesArgs(sourceArgs));
};

const prepareNativeVersion = () => {
    ensureNoNativeVersionOverride();
    if (hasFlag('skip-build', args) && readArgValue('bump', '', args)) {
        throw new Error('--skip-build 不能与 --bump 同时使用；否则 APK 版本与 package.json 会失配。');
    }
    return prepareReleaseVersion();
};

const runNativeRelease = async () => {
    const nativeInfo = prepareNativeVersion();
    applyAndroidBackendDefaults();
    await runDoctor();
    await runTypecheck();
    if (!hasFlag('skip-build', args)) {
        await runBuildRelease();
    } else {
        logStep('跳过 native build，直接发布现有 APK');
    }
    logStep(`发布 Android 原生更新包 (version=${nativeInfo.version})`);
    await runNodeScript('scripts/mobile/publish-android-native-update.mjs', buildNativeArgs());
};

const shouldRunPackagesInFull = () => hasFlag('with-packages', args) || Boolean(readArgValue('game', '', args));

const runFullRelease = async () => {
    const nativeInfo = prepareNativeVersion();
    ensureNoForbiddenOtaCompatibilityArgs();
    ensureForcedOta();
    applyAndroidBackendDefaults();
    applyOtaClientBuildDefaults();
    await runDoctor();
    await runSync();
    logStep(`发布 Android OTA (expectedBaseVersion=${nativeInfo.version})`);
    await runNodeScript('scripts/mobile/publish-android-ota.mjs', buildOtaArgsWithExpectedVersion(nativeInfo.version));
    if (shouldRunPackagesInFull()) {
        await runPackagesRelease(args);
    }
    if (!hasFlag('skip-build', args)) {
        await runBuildRelease();
    } else {
        logStep('跳过 native build，直接发布现有 APK');
    }
    logStep(`发布 Android 原生更新包 (version=${nativeInfo.version})`);
    await runNodeScript('scripts/mobile/publish-android-native-update.mjs', buildNativeArgs());
};

const run = async () => {
    ensureSupportedCommand();
    applyReleaseShellDefaults();

    switch (command) {
        case 'ota':
            await runOtaRelease();
            return;
        case 'native':
            await runNativeRelease();
            return;
        case 'packages':
            await runPackagesRelease();
            return;
        case 'full':
            await runFullRelease();
            return;
        default:
            throw new Error(`未知子命令: ${command}`);
    }
};

run().catch((error) => {
    console.error(`[android-release] ${error instanceof Error ? error.message : String(error)}`);
    process.exit(1);
});
