import { spawn } from 'node:child_process';
import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';

const rootDir = process.cwd();
const rawArgs = process.argv.slice(2);
const command = rawArgs[0] || '';
const args = rawArgs.slice(1);
const packageJsonPath = path.join(rootDir, 'package.json');
const packageLockPath = path.join(rootDir, 'package-lock.json');
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
  ota       先 doctor + sync, 再发布 OTA
  native    可选 bump 版本, 再 build release + 发布原生 APK 更新
  packages  发布 Android 游戏包
  full      依次执行 OTA -> 可选 packages -> native

常用选项:
  --channel <stable|gray|edge>
  --dry-run
  --skip-latest

native / full 额外选项:
  --bump <patch|minor|major>   自动更新 package.json / package-lock.json 版本
  --skip-build                 跳过 native build:release, 直接发布现有 APK

full 额外选项:
  --with-packages              full 时顺带发布游戏包
  --game <gameId>              指定游戏包; 传了该参数会自动启用 packages 阶段

说明:
  - OTA 默认不改 package.json.version
  - full 的顺序固定为: OTA -> packages(可选) -> native
  - 若 native 阶段使用 --bump, 版本会在 native 阶段开始前写回仓库文件
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

const readJsonFile = (filePath) => JSON.parse(readFileSync(filePath, 'utf8'));

const writeJsonFile = (filePath, value) => {
    writeFileSync(filePath, `${JSON.stringify(value, null, 2)}\n`, 'utf8');
};

const parseSemver = (value) => {
    const match = String(value || '').trim().match(/^(\d+)\.(\d+)\.(\d+)$/);
    if (!match) {
        throw new Error(`当前版本不是可 bump 的 x.y.z 形式: ${String(value || '')}`);
    }
    return match.slice(1).map((segment) => Number.parseInt(segment, 10));
};

const bumpSemver = (value, bumpType) => {
    const [major, minor, patch] = parseSemver(value);
    switch (bumpType) {
        case 'major':
            return `${major + 1}.0.0`;
        case 'minor':
            return `${major}.${minor + 1}.0`;
        case 'patch':
            return `${major}.${minor}.${patch + 1}`;
        default:
            throw new Error(`不支持的 bump 类型: ${bumpType}`);
    }
};

const updateProjectVersion = (nextVersion) => {
    const packageJson = readJsonFile(packageJsonPath);
    packageJson.version = nextVersion;
    writeJsonFile(packageJsonPath, packageJson);

    if (!existsSync(packageLockPath)) {
        return;
    }

    const packageLock = readJsonFile(packageLockPath);
    packageLock.version = nextVersion;
    if (packageLock.packages && typeof packageLock.packages === 'object' && packageLock.packages['']) {
        packageLock.packages[''].version = nextVersion;
    }
    writeJsonFile(packageLockPath, packageLock);
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

const buildOtaArgs = (sourceArgs = args) => collectPassthroughArgs(
    new Set([
        'channel',
        'version',
        'native-version',
        'target-native-version',
        'min-native-version',
        'max-native-version',
        'force-update-title',
        'force-update-message',
        'notes',
    ]),
    new Set(['dry-run', 'skip-latest', 'force-update', 'no-force-update']),
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

const runOtaRelease = async () => {
    await runDoctor();
    await runSync();
    logStep('发布 Android OTA');
    await runNodeScript('scripts/mobile/publish-android-ota.mjs', buildOtaArgs());
};

const runPackagesRelease = async (sourceArgs = args) => {
    logStep('发布 Android 游戏包');
    await runNodeScript('scripts/mobile/publish-android-game-packages.mjs', buildPackagesArgs(sourceArgs));
};

const prepareNativeVersion = () => {
    ensureNoNativeVersionOverride();

    const bumpType = readArgValue('bump', '', args);
    if (!bumpType) {
        const currentVersion = readJsonFile(packageJsonPath).version;
        return {
            version: currentVersion,
            bumped: false,
        };
    }

    if (!new Set(['patch', 'minor', 'major']).has(bumpType)) {
        throw new Error(`--bump 只支持 patch | minor | major，当前值为: ${bumpType}`);
    }
    if (hasFlag('dry-run', args)) {
        throw new Error('--dry-run 不能与 --bump 同时使用；预演不会改仓库版本文件。');
    }
    if (hasFlag('skip-build', args)) {
        throw new Error('--skip-build 不能与 --bump 同时使用；否则 APK 版本与 package.json 会失配。');
    }

    const currentVersion = readJsonFile(packageJsonPath).version;
    const nextVersion = bumpSemver(currentVersion, bumpType);
    updateProjectVersion(nextVersion);
    logStep(`已更新项目版本: ${currentVersion} -> ${nextVersion}`);
    return {
        version: nextVersion,
        bumped: true,
    };
};

const runNativeRelease = async () => {
    const nativeInfo = prepareNativeVersion();
    await runDoctor();
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
    await runDoctor();
    await runSync();
    logStep('发布 Android OTA');
    await runNodeScript('scripts/mobile/publish-android-ota.mjs', buildOtaArgs());
    if (shouldRunPackagesInFull()) {
        await runPackagesRelease(args);
    }
    const nativeInfo = prepareNativeVersion();
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
