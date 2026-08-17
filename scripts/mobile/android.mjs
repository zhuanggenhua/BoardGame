import {
    existsSync,
    mkdirSync,
    readFileSync,
    readdirSync,
    rmSync,
    writeFileSync,
} from 'node:fs';
import path from 'node:path';
import { spawn } from 'node:child_process';
import dotenv from 'dotenv';
import { checkChildProcessSupport } from '../infra/assert-child-process-support.mjs';
import { generateAndroidBrandAssets, getAndroidBrandAssetConfig } from './android-assets.mjs';
import { detectAndroidReleaseSigning, prepareAndroidReleaseSigning } from './android-signing.mjs';
import { resolveAndroidBackendUrl } from './android-backend-url.mjs';
import {
    DIST_COMMON_JSON_RETAIN_RELATIVE_PATHS,
    DIST_I18N_JSON_RETAIN_RELATIVE_PATHS,
    DIST_LOGOS_RETAIN_RELATIVE_PATHS,
    getEmbeddedPublicAssetMirrorDirNamesToRemove,
} from '../deploy/prune-web-dist-assets.mjs';

const rootDir = process.cwd();
const androidDir = path.join(rootDir, 'android');
const capacitorCliPath = path.join(rootDir, 'node_modules', '@capacitor', 'cli', 'bin', 'capacitor');
const capacitorAndroidBuildGradlePath = path.join(rootDir, 'node_modules', '@capacitor', 'android', 'capacitor', 'build.gradle');
const viteCliPath = path.join(rootDir, 'node_modules', 'vite', 'bin', 'vite.js');
const viteSafeCliPath = path.join(rootDir, 'scripts', 'infra', 'vite-cli-safe.mjs');
const gradleWrapper = process.platform === 'win32'
    ? path.join(androidDir, 'gradlew.bat')
    : path.join(androidDir, 'gradlew');
const defaultAppId = 'top.easyboardgame.app.debug';
const defaultAppName = '易桌游测试';
const stableAndroidSourcePackage = 'top.easyboardgame.app';
const releaseAppId = stableAndroidSourcePackage;
const releaseAppName = '易桌游';
const defaultAndroidWebviewMode = 'embedded';
const supportedAndroidWebviewModes = new Set(['embedded', 'remote']);
const command = process.argv[2];
const distDir = path.join(rootDir, 'dist');
const distLocalesDir = path.join(distDir, 'locales');
const distLocalizedAssetsDir = path.join(distDir, 'assets', 'i18n');
const androidPublicDir = path.join(androidDir, 'app', 'src', 'main', 'assets', 'public');
const androidBuildMetaFileName = 'android-build-meta.json';
const gameManifestGeneratorPath = path.join(rootDir, 'scripts', 'game', 'generate_game_manifests.js');
const debugAndroidAppIdSegments = new Set(['debug', 'dev', 'test', 'qa']);
const webDistPruneScriptPath = path.join(rootDir, 'scripts', 'deploy', 'prune-web-dist-assets.mjs');
const allowedEmbeddedRuntimeAssetFiles = new Set(
    [
        ...DIST_COMMON_JSON_RETAIN_RELATIVE_PATHS.map((relativePath) => `assets/common/${relativePath}`),
        ...DIST_I18N_JSON_RETAIN_RELATIVE_PATHS.map((relativePath) => `assets/i18n/${relativePath}`),
        ...DIST_LOGOS_RETAIN_RELATIVE_PATHS.map((relativePath) => `logos/${relativePath}`),
    ],
);

const envFiles = ['.env', '.env.android', '.env.android.local'];
for (const file of envFiles) {
    const fullPath = path.join(rootDir, file);
    if (!existsSync(fullPath)) continue;
    dotenv.config({ path: fullPath, override: false, quiet: true });
}
process.env.VITE_BACKEND_URL = resolveAndroidBackendUrl(process.env);
process.env.VITE_CAPACITOR_APP_ID = process.env.VITE_CAPACITOR_APP_ID?.trim()
    || process.env.CAPACITOR_APP_ID?.trim()
    || '';

const runCommand = (cmd, args, options = {}) => new Promise((resolve, reject) => {
    const child = spawn(cmd, args, {
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
        reject(new Error(`command failed: ${cmd} ${args.join(' ')} (exit ${code ?? 'unknown'})`));
    });
    child.on('error', reject);
});

const runNodeScript = async (scriptPath, args, options = {}) => {
    if (!existsSync(scriptPath)) {
        throw new Error(`未找到脚本: ${path.relative(rootDir, scriptPath)}`);
    }
    await runCommand(process.execPath, [scriptPath, ...args], options);
};

const quoteCmdArg = (value) => {
    if (value.length === 0) return '""';
    if (!/[\s"]/u.test(value)) return value;
    return `"${value.replace(/"/g, '""')}"`;
};

const parseBooleanEnv = (value) => /^(1|true|yes|on)$/i.test((value || '').trim());

const runWindowsBatch = async (scriptPath, args, options = {}) => {
    const comSpec = process.env.ComSpec || 'cmd.exe';
    const cmdLine = [scriptPath, ...args].map(quoteCmdArg).join(' ');
    await runCommand(comSpec, ['/d', '/s', '/c', cmdLine], options);
};

const runCapacitor = async (args) => {
    await runNodeScript(capacitorCliPath, args);
};

const runAndroidWebBuild = async () => {
    await runNodeScript(viteSafeCliPath, ['build', '--mode', 'android', '--configLoader', 'bundle', '--config', 'vite.config.ts']);
    await runNodeScript(webDistPruneScriptPath, ['--target', 'android-embedded']);
};

const runGradle = async (args) => {
    if (!existsSync(gradleWrapper)) {
        throw new Error('未找到 Android Gradle Wrapper，请先执行 npm run mobile:android:init');
    }

    if (process.platform === 'win32') {
        await runWindowsBatch(gradleWrapper, args, { cwd: androidDir });
        return;
    }

    await runCommand(gradleWrapper, args, { cwd: androidDir });
};

const readText = (filePath) => readFileSync(filePath, 'utf8');
const tryReadText = (filePath) => (existsSync(filePath) ? readText(filePath) : null);

const getAndroidBuildMetaPaths = () => ({
    distIndexPath: path.join(distDir, 'index.html'),
    distMetaPath: path.join(distDir, androidBuildMetaFileName),
    syncedIndexPath: path.join(androidPublicDir, 'index.html'),
    syncedMetaPath: path.join(androidPublicDir, androidBuildMetaFileName),
});

const normalizeCapacitorPluginProjectName = (pkg) => pkg
    .trim()
    .replace(/^@/, '')
    .replace(/\//g, '-');

const getCapacitorPluginWiringStatus = () => {
    const pluginsFile = path.join(androidDir, 'app', 'src', 'main', 'assets', 'capacitor.plugins.json');
    const settingsFile = path.join(androidDir, 'capacitor.settings.gradle');
    const buildFile = path.join(androidDir, 'app', 'capacitor.build.gradle');

    if (!existsSync(pluginsFile)) {
        return {
            ok: false,
            code: 'missing-plugins-json',
            message: 'android/app/src/main/assets/capacitor.plugins.json 缺失。请先执行 npm run mobile:android:sync。',
        };
    }

    if (!existsSync(settingsFile) || !existsSync(buildFile)) {
        return {
            ok: false,
            code: 'missing-generated-gradle',
            message: 'Capacitor 生成的 Gradle 文件缺失。请先执行 npm run mobile:android:sync。',
        };
    }

    let plugins;
    try {
        plugins = JSON.parse(readText(pluginsFile));
    } catch {
        return {
            ok: false,
            code: 'invalid-plugins-json',
            message: 'android/app/src/main/assets/capacitor.plugins.json 不是合法 JSON。',
        };
    }

    if (!Array.isArray(plugins)) {
        return {
            ok: false,
            code: 'invalid-plugins-shape',
            message: 'android/app/src/main/assets/capacitor.plugins.json 结构异常。',
        };
    }

    const settingsText = readText(settingsFile);
    const buildText = readText(buildFile);
    const missingProjects = [];

    for (const plugin of plugins) {
        const pkg = typeof plugin?.pkg === 'string' ? plugin.pkg.trim() : '';
        if (!pkg) continue;

        const projectName = normalizeCapacitorPluginProjectName(pkg);
        const includeLine = `include ':${projectName}'`;
        const implementationLine = `implementation project(':${projectName}')`;

        if (!settingsText.includes(includeLine) || !buildText.includes(implementationLine)) {
            missingProjects.push(pkg);
        }
    }

    if (missingProjects.length > 0) {
        return {
            ok: false,
            code: 'stale-plugin-wiring',
            message: `Android 原生工程未接入这些 Capacitor 插件: ${missingProjects.join(', ')}。请先执行 npm run mobile:android:sync。`,
        };
    }

    return {
        ok: true,
        code: 'ready',
        message: `ready(${plugins.length} plugins)`,
    };
};

const parseAndroidBuildMeta = (filePath, rawText) => {
    try {
        return JSON.parse(rawText);
    } catch {
        throw new Error(`Android build metadata is invalid: ${path.relative(rootDir, filePath)}`);
    }
};

const getAndroidWebAssetsStatus = () => {
    const shellStatus = getAndroidShellStatus();
    if (!shellStatus.ok) {
        return shellStatus;
    }

    if (getAndroidWebviewMode() === 'remote') {
        return {
            ok: true,
            code: 'remote-mode',
            message: `skipped(${shellStatus.message})`,
        };
    }

    const paths = getAndroidBuildMetaPaths();
    const currentBackendUrl = process.env.VITE_BACKEND_URL?.trim() || '';

    if (!existsSync(paths.distIndexPath)) {
        return {
            ok: false,
            code: 'dist-missing-index',
            message: 'dist/index.html 缺失。请先重新执行 Android Web 构建。',
        };
    }

    const distMetaRaw = tryReadText(paths.distMetaPath);
    if (!distMetaRaw) {
        return {
            ok: false,
            code: 'dist-missing-meta',
            message: 'dist/android-build-meta.json 缺失。请先执行 npm run mobile:android:sync。',
        };
    }

    const distMeta = parseAndroidBuildMeta(paths.distMetaPath, distMetaRaw);
    if (!distMeta.backendUrl) {
        return {
            ok: false,
            code: 'dist-missing-backend',
            message: '当前 Android Web 构建没有写入 VITE_BACKEND_URL。请重新执行 npm run mobile:android:sync。',
        };
    }

    if (currentBackendUrl && distMeta.backendUrl !== currentBackendUrl) {
        return {
            ok: false,
            code: 'dist-backend-mismatch',
            message: `dist/android-build-meta.json 中的后端地址仍是 ${distMeta.backendUrl}，与当前 VITE_BACKEND_URL=${currentBackendUrl} 不一致。请重新执行 npm run mobile:android:sync。`,
        };
    }

    if (!existsSync(paths.syncedIndexPath)) {
        return {
            ok: false,
            code: 'synced-missing-index',
            message: 'android/app/src/main/assets/public/index.html 缺失。请先执行 npm run mobile:android:sync。',
        };
    }

    const syncedMetaRaw = tryReadText(paths.syncedMetaPath);
    if (!syncedMetaRaw) {
        return {
            ok: false,
            code: 'synced-missing-meta',
            message: 'android/app/src/main/assets/public/android-build-meta.json 缺失。请先执行 npm run mobile:android:sync。',
        };
    }

    if (distMetaRaw.trim() !== syncedMetaRaw.trim()) {
        return {
            ok: false,
            code: 'stale-sync',
            message: 'Android 工程中的 Web 资源不是 dist 的最新同步结果。请先执行 npm run mobile:android:sync，或直接使用 npm run mobile:android:build:release。',
        };
    }

    return {
        ok: true,
        code: 'ready',
        message: `ready(${distMeta.backendUrl} @ ${distMeta.builtAt})`,
    };
};

const ensureAndroidDistBuildReady = () => {
    const status = getAndroidWebAssetsStatus();
    if (
        status.code === 'dist-missing-index'
        || status.code === 'dist-missing-meta'
        || status.code === 'dist-missing-backend'
        || status.code === 'dist-backend-mismatch'
    ) {
        throw new Error(status.message);
    }
};

const ensureAndroidWebAssetsSynced = () => {
    const status = getAndroidWebAssetsStatus();
    if (!status.ok) {
        throw new Error(status.message);
    }
};

const clearBundledWebAssetsForRemote = () => {
    if (!existsSync(androidPublicDir)) {
        return;
    }
    rmSync(androidPublicDir, { recursive: true, force: true });
};

const clearDirectoryChildren = (dirPath, { preserve = [] } = {}) => {
    if (!existsSync(dirPath)) return;

    const preservedPaths = preserve.map((value) => path.resolve(value));
    for (const entry of readdirSync(dirPath, { withFileTypes: true })) {
        const fullPath = path.join(dirPath, entry.name);
        const resolvedPath = path.resolve(fullPath);
        const shouldPreserve = preservedPaths.some((preservedPath) => (
            resolvedPath === preservedPath || resolvedPath.startsWith(`${preservedPath}${path.sep}`)
        ));
        if (shouldPreserve) continue;
        rmSync(fullPath, { recursive: true, force: true });
    }
};

const collectBlockedRelativePaths = (baseDir, blockedPrefixes) => {
    if (!existsSync(baseDir)) return [];

    const matches = [];
    const visit = (currentDir) => {
        for (const entry of readdirSync(currentDir, { withFileTypes: true })) {
            const fullPath = path.join(currentDir, entry.name);
            if (entry.isDirectory()) {
                visit(fullPath);
                continue;
            }

            if (!entry.isFile()) {
                continue;
            }

            const relativePath = toUnixPath(path.relative(baseDir, fullPath));
            if (blockedPrefixes.some((prefix) => relativePath.startsWith(prefix))) {
                matches.push(relativePath);
            }
        }
    };

    visit(baseDir);
    return matches.sort((left, right) => left.localeCompare(right));
};

const ensureNoBlockedEmbeddedAssets = (baseDir, label) => {
    const blockedPrefixes = [
        'assets/common/',
        'assets/i18n/',
        'logos/',
        ...getEmbeddedPublicAssetMirrorDirNamesToRemove()
            .map((dirName) => `assets/${dirName}/`),
    ];
    const blockedPaths = collectBlockedRelativePaths(baseDir, blockedPrefixes)
        .filter((relativePath) => !allowedEmbeddedRuntimeAssetFiles.has(relativePath));
    if (blockedPaths.length === 0) {
        return;
    }

    const sample = blockedPaths.slice(0, 5).join(', ');
    const suffix = blockedPaths.length > 5 ? ` 等 ${blockedPaths.length} 项` : '';
    throw new Error(
        `${label} 仍包含禁止内置到 Android embedded 包的运行时资源: ${sample}${suffix}。`
        + ' 这些资源必须继续走远程素材 / 游戏包链路，不能被打进 APK。',
    );
};

const pruneAndroidEmbeddedDist = () => {
    ensureNoBlockedEmbeddedAssets(distDir, 'dist');
};

const writeText = (filePath, content) => {
    mkdirSync(path.dirname(filePath), { recursive: true });
    if (existsSync(filePath) && readText(filePath) === content) {
        return;
    }
    writeFileSync(filePath, content, 'utf8');
};


const replaceInFile = (filePath, replacer) => {
    const current = readText(filePath);
    const next = replacer(current);
    if (next !== current) {
        writeFileSync(filePath, next, 'utf8');
    }
};

const toUnixPath = (value) => value.replace(/\\/g, '/');

const removeEmptyParents = (dirPath, stopDir) => {
    let current = dirPath;
    const resolvedStopDir = path.resolve(stopDir);

    while (path.resolve(current).startsWith(resolvedStopDir) && path.resolve(current) !== resolvedStopDir) {
        if (readdirSync(current).length > 0) {
            return;
        }
        rmSync(current, { recursive: true, force: true });
        current = path.dirname(current);
    }
};

const findFirstFile = (dirPath, fileName) => {
    if (!existsSync(dirPath)) return null;

    for (const entry of readdirSync(dirPath, { withFileTypes: true })) {
        const fullPath = path.join(dirPath, entry.name);
        if (entry.isDirectory()) {
            const nested = findFirstFile(fullPath, fileName);
            if (nested) return nested;
            continue;
        }

        if (entry.isFile() && entry.name === fileName) {
            return fullPath;
        }
    }

    return null;
};

const getAppConfig = () => ({
    appId: process.env.CAPACITOR_APP_ID?.trim()
        || process.env.VITE_CAPACITOR_APP_ID?.trim()
        || defaultAppId,
    appName: process.env.CAPACITOR_APP_NAME?.trim() || defaultAppName,
});

const isNonReleaseAndroidAppId = (appId) => appId
    .split('.')
    .some((segment) => debugAndroidAppIdSegments.has(segment.trim().toLowerCase()));

const shouldAppendDebugApplicationIdSuffix = (appId) => !appId
    .split('.')
    .some((segment) => debugAndroidAppIdSegments.has(segment.trim().toLowerCase()));

const applyReleaseShellDefaults = () => {
    process.env.CAPACITOR_APP_ID = releaseAppId;
    process.env.VITE_CAPACITOR_APP_ID = releaseAppId;
    process.env.CAPACITOR_APP_NAME = releaseAppName;

    const { appId, appName } = getAppConfig();
    if (appId !== releaseAppId || appName !== releaseAppName || isNonReleaseAndroidAppId(appId)) {
        throw new Error(`release 构建检测到非正式壳配置: appId=${appId}, appName=${appName}`);
    }
};

const isAndroidOtaAllowedForApp = () => {
    const { appId } = getAppConfig();
    if (!appId || !isNonReleaseAndroidAppId(appId)) {
        return true;
    }
    return parseBooleanEnv(process.env.VITE_ANDROID_OTA_ALLOW_DEBUG_APP);
};

const isHttpUrl = (value) => /^http:\/\//i.test(value);
const isHttpsUrl = (value) => /^https:\/\//i.test(value);
const writeCapacitorShellConfig = () => {
    const { appId, appName } = getAppConfig();
    const mode = getAndroidWebviewMode();
    const server = {
        // Android embedded WebView must keep the local bridge on http://localhost
        // so Capacitor.convertFileSrc() can resolve /_capacitor_file_/... correctly.
        androidScheme: mode === 'embedded' ? 'http' : 'https',
    };
    const otaEnabled = getAndroidOtaEnabled();
    const otaAppReadyTimeout = Number.parseInt(process.env.VITE_ANDROID_OTA_APP_READY_TIMEOUT_MS?.trim() || '', 10);

    if (mode === 'remote') {
        server.url = ensureRemoteWebUrl();
        server.cleartext = isHttpUrl(server.url);
    }

    const plugins = otaEnabled
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
                defaultChannel: getAndroidOtaChannel() || undefined,
            },
        }
        : undefined;

    writeText(
        path.join(androidDir, 'app', 'src', 'main', 'assets', 'capacitor.config.json'),
        `${JSON.stringify(
            {
                appId,
                appName,
                webDir: 'dist',
                server,
                ...(plugins ? { plugins } : {}),
            },
            null,
            2,
        )}\n`,
    );
};

const ensureRemoteShellAssetsReady = () => {
    const pluginsFile = path.join(androidDir, 'app', 'src', 'main', 'assets', 'capacitor.plugins.json');
    if (!existsSync(pluginsFile)) {
        throw new Error('remote 纯壳构建缺少 android/app/src/main/assets/capacitor.plugins.json。首次初始化或插件变更后请先执行 npm run mobile:android:sync。');
    }
};

const getAndroidWebviewMode = () => {
    const mode = (process.env.ANDROID_WEBVIEW_MODE?.trim().toLowerCase() || defaultAndroidWebviewMode);
    if (!supportedAndroidWebviewModes.has(mode)) {
        throw new Error(`ANDROID_WEBVIEW_MODE 只支持 embedded 或 remote，当前值为: ${mode}`);
    }
    return mode;
};

const getAndroidRemoteWebUrl = () => process.env.ANDROID_REMOTE_WEB_URL?.trim() || '';
const getAndroidOtaEnabled = () => (
    parseBooleanEnv(process.env.VITE_ANDROID_OTA_ENABLED)
    && isAndroidOtaAllowedForApp()
);
const getAndroidOtaManifestUrl = () => process.env.VITE_ANDROID_OTA_MANIFEST_URL?.trim() || '';
const getAndroidOtaChannel = () => process.env.VITE_ANDROID_OTA_CHANNEL?.trim() || '';

const ensureRemoteWebUrl = () => {
    const remoteUrl = getAndroidRemoteWebUrl();
    if (!remoteUrl) {
        throw new Error('remote 模式必须配置 ANDROID_REMOTE_WEB_URL，且必须是绝对 HTTP/HTTPS 地址。');
    }
    if (!/^https?:\/\//i.test(remoteUrl)) {
        throw new Error(`ANDROID_REMOTE_WEB_URL 必须是绝对 HTTP/HTTPS 地址，当前值为: ${remoteUrl}`);
    }
    return remoteUrl;
};

const getAndroidShellStatus = () => {
    const mode = getAndroidWebviewMode();
    if (mode === 'remote') {
        const remoteUrl = getAndroidRemoteWebUrl();
        if (!remoteUrl) {
            return {
                ok: false,
                code: 'remote-missing-url',
                message: 'remote 模式缺少 ANDROID_REMOTE_WEB_URL。',
            };
        }
        if (!/^https?:\/\//i.test(remoteUrl)) {
            return {
                ok: false,
                code: 'remote-invalid-url',
                message: `ANDROID_REMOTE_WEB_URL 必须是绝对 HTTP/HTTPS 地址，当前值为: ${remoteUrl}`,
            };
        }
        return {
            ok: true,
            code: 'remote-ready',
            message: `remote(${remoteUrl})`,
        };
    }

    return {
        ok: true,
        code: 'embedded-ready',
        message: 'embedded(dist -> android assets)',
    };
};

const ensureEmbeddedBackendUrl = () => {
    const backendUrl = process.env.VITE_BACKEND_URL?.trim();
    if (!backendUrl) {
        throw new Error(
            '移动端壳构建必须显式配置 VITE_BACKEND_URL。请在 .env.android 或 .env.android.local 中设置绝对 HTTP/HTTPS 地址。',
        );
    }
    if (!isHttpUrl(backendUrl) && !isHttpsUrl(backendUrl)) {
        throw new Error(`VITE_BACKEND_URL 必须是绝对地址，当前值为: ${backendUrl}`);
    }
};

const hasAndroidProject = () => existsSync(path.join(androidDir, 'app', 'build.gradle'));

const ensureGeneratedAndroidFiles = () => {
    const capacitorAndroidDir = path.join(rootDir, 'node_modules', '@capacitor', 'android', 'capacitor');
    const capacitorAndroidRelativePath = existsSync(capacitorAndroidDir)
        ? toUnixPath(path.relative(androidDir, capacitorAndroidDir))
        : '../node_modules/@capacitor/android/capacitor';

    const capacitorSettingsPath = path.join(androidDir, 'capacitor.settings.gradle');
    if (!existsSync(capacitorSettingsPath)) {
        writeText(
            capacitorSettingsPath,
            `// DO NOT EDIT THIS FILE! IT IS GENERATED EACH TIME "capacitor update" IS RUN
include ':capacitor-android'
project(':capacitor-android').projectDir = new File('${capacitorAndroidRelativePath}')
`,
        );
    }

    const capacitorBuildGradlePath = path.join(androidDir, 'app', 'capacitor.build.gradle');
    if (!existsSync(capacitorBuildGradlePath)) {
        writeText(
            capacitorBuildGradlePath,
            `// DO NOT EDIT THIS FILE! IT IS GENERATED EACH TIME "capacitor update" IS RUN

android {
  compileOptions {
      sourceCompatibility JavaVersion.VERSION_17
      targetCompatibility JavaVersion.VERSION_17
  }
}

apply from: "../capacitor-cordova-android-plugins/cordova.variables.gradle"
dependencies {
}

if (hasProperty('postBuildExtras')) {
  postBuildExtras()
}
`,
        );
    }

    writeText(
        path.join(androidDir, 'capacitor-cordova-android-plugins', 'cordova.variables.gradle'),
        `// DO NOT EDIT THIS FILE! IT IS GENERATED EACH TIME "capacitor update" IS RUN
ext {
  cdvMinSdkVersion = project.hasProperty('minSdkVersion') ? rootProject.ext.minSdkVersion : 24
  cdvPluginPostBuildExtras = []
  cordovaConfig = [:]
}
`,
    );
};

const prepareCapacitorAndroidModule = () => {
    if (!existsSync(capacitorAndroidBuildGradlePath)) {
        return;
    }

    replaceInFile(capacitorAndroidBuildGradlePath, (content) => (
        content
            .replace(/classpath 'com\.android\.tools\.build:gradle:[^']+'/g, "classpath 'com.android.tools.build:gradle:8.6.1'")
            .replace(/sourceCompatibility JavaVersion\.VERSION_\d+/g, 'sourceCompatibility JavaVersion.VERSION_17')
            .replace(/targetCompatibility JavaVersion\.VERSION_\d+/g, 'targetCompatibility JavaVersion.VERSION_17')
    ));
};

const moveJavaFileToPackage = (javaRootDir, fileName, packageName, transformContent = (content) => content) => {
    const currentFile = findFirstFile(javaRootDir, fileName);
    if (!currentFile) return;

    const targetDir = path.join(javaRootDir, ...packageName.split('.'));
    const targetFile = path.join(targetDir, fileName);
    const nextContent = transformContent(
        readText(currentFile).replace(/^package\s+[\w.]+;/m, `package ${packageName};`),
    );

    writeText(targetFile, nextContent);

    if (path.resolve(currentFile) !== path.resolve(targetFile)) {
        rmSync(currentFile);
        removeEmptyParents(path.dirname(currentFile), javaRootDir);
    }
};

const updateAppBuildGradle = (appId) => {
    replaceInFile(path.join(androidDir, 'app', 'build.gradle'), (content) => {
        let next = content;
        const debugApplicationIdSuffixLine = shouldAppendDebugApplicationIdSuffix(appId)
            ? '            applicationIdSuffix ".debug"\n'
            : '';

        if (!next.includes('import java.util.Properties')) {
            next = `import java.util.Properties\n\n${next}`;
        }

        if (!next.includes('import groovy.json.JsonSlurper')) {
            next = `import groovy.json.JsonSlurper\n${next}`;
        }

        next = next
            .replace(/namespace\s*=\s*"[^"]+"/, `namespace = "${stableAndroidSourcePackage}"`)
            .replace(/applicationId\s+"[^"]+"/, `applicationId "${appId}"`)
            .replace(
                /debug\s*\{\s*(?:applicationIdSuffix\s+"[^"]+"\s*)?\}/,
                `debug {\n${debugApplicationIdSuffixLine}        }`,
            )
            .replace(/minifyEnabled\s+false/g, 'minifyEnabled true');

        if (!/shrinkResources\s+true/.test(next)) {
            next = next.replace(
                /(minifyEnabled\s+true\s*\n)/,
                '$1            shrinkResources true\n',
            );
        }

        if (!next.includes('keystorePropertiesFile')) {
            next = next.replace(
                "apply plugin: 'com.android.application'\n\n",
                `apply plugin: 'com.android.application'\n\n` +
                `def keystorePropertiesFile = rootProject.file('keystore.properties')\n` +
                `def keystoreProperties = new Properties()\n` +
                `def hasReleaseSigning = false\n` +
                `def requiresReleaseSigning = gradle.startParameter.taskNames.any { taskName -> taskName.toLowerCase().contains('release') }\n` +
                `if (keystorePropertiesFile.exists()) {\n` +
                `    keystoreProperties.load(new FileInputStream(keystorePropertiesFile))\n` +
                `    hasReleaseSigning = ['storeFile', 'storePassword', 'keyAlias', 'keyPassword'].every { key ->\n` +
                `        keystoreProperties[key]\n` +
                `    }\n` +
                `}\n\n`,
            );
        }

        if (!next.includes('signingConfigs {')) {
            next = next.replace(
                '    defaultConfig {\n',
                `    signingConfigs {\n` +
                `        release {\n` +
                `            if (hasReleaseSigning) {\n` +
                `                storeFile file(keystoreProperties['storeFile'])\n` +
                `                storePassword keystoreProperties['storePassword']\n` +
                `                keyAlias keystoreProperties['keyAlias']\n` +
                `                keyPassword keystoreProperties['keyPassword']\n` +
                `            }\n` +
                `        }\n` +
                `    }\n` +
                `    defaultConfig {\n`,
            );
        }

        if (!next.includes('signingConfig signingConfigs.release')) {
            next = next.replace(
                '        release {\n',
                `        release {\n` +
                `            if (hasReleaseSigning) {\n` +
                `                signingConfig signingConfigs.release\n` +
                `            }\n`,
            );
        }

        if (!next.includes('requiresReleaseSigning && !hasReleaseSigning')) {
            next = `${next}\nif (requiresReleaseSigning && !hasReleaseSigning) {\n` +
                `    throw new GradleException('Missing Android release signing. Run npm run mobile:android:prepare-release or set ANDROID_KEYSTORE_PATH / ANDROID_KEYSTORE_BASE64.')\n` +
                `}\n`;
        }

        const androidShellValidationBlock =
            `def capacitorConfigFile = file('src/main/assets/capacitor.config.json')\n` +
            `def capacitorConfig = capacitorConfigFile.exists() ? new JsonSlurper().parse(capacitorConfigFile) : [:]\n` +
            `def androidServerConfig = capacitorConfig.server instanceof Map ? capacitorConfig.server : [:]\n` +
            `def androidWebviewMode = androidServerConfig.url ? 'remote' : 'embedded'\n` +
            `def distAndroidBuildMetaFile = rootProject.file('../dist/android-build-meta.json')\n` +
            `def syncedAndroidBuildMetaFile = file('src/main/assets/public/android-build-meta.json')\n` +
            `def capacitorPluginsJsonFile = file('src/main/assets/capacitor.plugins.json')\n` +
            `def capacitorSettingsGradleFile = rootProject.file('capacitor.settings.gradle')\n` +
            `def capacitorBuildGradleFile = file('capacitor.build.gradle')\n` +
            `def requiresSyncedWebAssets = androidWebviewMode == 'embedded' && gradle.startParameter.taskNames.any { taskName ->\n` +
            `    def lowerTaskName = taskName.toLowerCase()\n` +
            `    lowerTaskName.contains('assemble') || lowerTaskName.contains('bundle') || lowerTaskName.contains('install')\n` +
            `}\n` +
            `if (requiresSyncedWebAssets) {\n` +
            `    if (!distAndroidBuildMetaFile.exists()) {\n` +
            `        throw new GradleException('Missing dist/android-build-meta.json. Run npm run mobile:android:sync before building Android.')\n` +
            `    }\n` +
            `    if (!syncedAndroidBuildMetaFile.exists()) {\n` +
            `        throw new GradleException('Missing synced Android web assets. Run npm run mobile:android:sync before building Android.')\n` +
            `    }\n` +
            `    if (distAndroidBuildMetaFile.getText('UTF-8') != syncedAndroidBuildMetaFile.getText('UTF-8')) {\n` +
            `        throw new GradleException('Android web assets are out of sync with dist. Run npm run mobile:android:sync or npm run mobile:android:build:release.')\n` +
            `    }\n` +
            `}\n` +
            `if (!capacitorPluginsJsonFile.exists()) {\n` +
            `    throw new GradleException('Missing android/app/src/main/assets/capacitor.plugins.json. Run npm run mobile:android:sync before building Android.')\n` +
            `}\n` +
            `if (!capacitorSettingsGradleFile.exists() || !capacitorBuildGradleFile.exists()) {\n` +
            `    throw new GradleException('Missing generated Capacitor Gradle files. Run npm run mobile:android:sync before building Android.')\n` +
            `}\n` +
            `def capacitorPlugins = new JsonSlurper().parse(capacitorPluginsJsonFile)\n` +
            `if (!(capacitorPlugins instanceof List)) {\n` +
            `    throw new GradleException('android/app/src/main/assets/capacitor.plugins.json has invalid shape. Run npm run mobile:android:sync before building Android.')\n` +
            `}\n` +
            `def capacitorSettingsText = capacitorSettingsGradleFile.getText('UTF-8')\n` +
            `def capacitorBuildText = capacitorBuildGradleFile.getText('UTF-8')\n` +
            `def missingCapacitorPluginWiring = []\n` +
            `capacitorPlugins.each { plugin ->\n` +
            `    def pkg = plugin instanceof Map ? (plugin.pkg ?: '').toString().trim() : ''\n` +
            `    if (!pkg) {\n` +
            `        return\n` +
            `    }\n` +
            `    def projectName = pkg.replaceFirst('^@', '').replace('/', '-')\n` +
            `    def includeLine = "include ':\${projectName}'"\n` +
            `    def implementationLine = "implementation project(':\${projectName}')"\n` +
            `    if (!capacitorSettingsText.contains(includeLine) || !capacitorBuildText.contains(implementationLine)) {\n` +
            `        missingCapacitorPluginWiring << pkg\n` +
            `    }\n` +
            `}\n` +
            `if (!missingCapacitorPluginWiring.isEmpty()) {\n` +
            `    throw new GradleException("Capacitor plugin wiring is stale for: \${missingCapacitorPluginWiring.join(', ')}. Run npm run mobile:android:sync before building Android.")\n` +
            `}\n`;

        next = next.replace(
            /\n*(?:def capacitorConfigFile = file\('src\/main\/assets\/capacitor\.config\.json'\)[\s\S]*?)?if \(!capacitorPluginsJsonFile\.exists\(\)\) \{[\s\S]*?if \(!missingCapacitorPluginWiring\.isEmpty\(\)\) \{\n    throw new GradleException\("Capacitor plugin wiring is stale for: \$\{missingCapacitorPluginWiring\.join\(', '\)\}\. Run npm run mobile:android:sync before building Android\."\)\n\}\n*/g,
            '\n',
        ).trimEnd();
        next = `${next}\n\n${androidShellValidationBlock}`;

        return next;
    });
};

const prepareAndroidProject = async () => {
    if (!hasAndroidProject()) return;

    const { appId, appName } = getAppConfig();
    const mainJavaRoot = path.join(androidDir, 'app', 'src', 'main', 'java');
    const testJavaRoot = path.join(androidDir, 'app', 'src', 'test', 'java');
    const androidTestJavaRoot = path.join(androidDir, 'app', 'src', 'androidTest', 'java');

    updateAppBuildGradle(appId);

    writeText(
        path.join(androidDir, 'app', 'src', 'main', 'res', 'values', 'strings.xml'),
        `<?xml version='1.0' encoding='utf-8'?>
<resources>
    <string name="app_name">${appName}</string>
    <string name="title_activity_main">${appName}</string>
    <string name="package_name">${appId}</string>
    <string name="custom_url_scheme">${appId}</string>
</resources>
`,
    );

    moveJavaFileToPackage(mainJavaRoot, 'MainActivity.java', stableAndroidSourcePackage);
    moveJavaFileToPackage(testJavaRoot, 'ExampleUnitTest.java', stableAndroidSourcePackage);
    moveJavaFileToPackage(androidTestJavaRoot, 'ExampleInstrumentedTest.java', stableAndroidSourcePackage, (content) => (
        content.replace(/assertEquals\(".*?", appContext\.getPackageName\(\)\);/, `assertEquals("${appId}", appContext.getPackageName());`)
    ));

    ensureGeneratedAndroidFiles();
    prepareCapacitorAndroidModule();
    writeCapacitorShellConfig();
    await generateAndroidBrandAssets({
        rootDir,
        androidDir,
        env: process.env,
    });
};

const ensureAndroidProject = async () => {
    if (!hasAndroidProject()) {
        await runCapacitor(['add', 'android']);
    }

    await prepareAndroidProject();
};

const ensureBuildSupport = async () => {
    const probe = await checkChildProcessSupport({
        probeEsbuild: true,
    });

    if (probe.ok) {
        return;
    }

    const code = probe.error && typeof probe.error === 'object' && 'code' in probe.error
        ? String(probe.error.code)
        : 'UNKNOWN';

    throw new Error(
        [
            `当前环境无法完成 Android 自动化构建，阻塞阶段: ${probe.stage}`,
            `底层错误: ${code} ${probe.error instanceof Error ? probe.error.message : String(probe.error)}`,
            '请改在本地终端、CI Runner 或允许 child_process / esbuild 的环境执行。',
        ].join('\n'),
    );
};

const syncAndroid = async () => {
    const mode = getAndroidWebviewMode();
    if (mode === 'embedded') {
        ensureEmbeddedBackendUrl();
    } else {
        ensureRemoteWebUrl();
    }
    await ensureBuildSupport();
    if (mode === 'embedded') {
        await runAndroidWebBuild();
        pruneAndroidEmbeddedDist();
        ensureAndroidDistBuildReady();
    }
    await ensureAndroidProject();
    if (mode === 'embedded') {
        await runCapacitor(['sync', 'android']);
        ensureNoBlockedEmbeddedAssets(androidPublicDir, 'android/app/src/main/assets/public');
    } else {
        await runCapacitor(['update', 'android']);
        clearBundledWebAssetsForRemote();
    }
    await prepareAndroidProject();
    const pluginWiringStatus = getCapacitorPluginWiringStatus();
    if (!pluginWiringStatus.ok) {
        throw new Error(pluginWiringStatus.message);
    }
    if (mode === 'embedded') {
        ensureAndroidWebAssetsSynced();
    } else {
        clearBundledWebAssetsForRemote();
    }
};

const prepareRemoteShellBuild = async () => {
    ensureRemoteWebUrl();
    await ensureBuildSupport();
    await runNodeScript(gameManifestGeneratorPath, []);
    await ensureAndroidProject();
    ensureRemoteShellAssetsReady();
    clearBundledWebAssetsForRemote();
};

const prepareRelease = async ({ required }) => {
    await ensureAndroidProject();
    const result = prepareAndroidReleaseSigning({
        rootDir,
        androidDir,
        env: process.env,
        required,
    });

    if (result.configured) {
        console.log(`Release 签名材料已就绪: ${path.relative(rootDir, result.propertiesPath)}`);
        return;
    }

    console.log('未配置 Release 签名，已跳过签名材料准备。');
};

const printDoctor = async () => {
    const { appId, appName } = getAppConfig();
    const probe = await checkChildProcessSupport({
        probeEsbuild: true,
    });
    const assetConfig = getAndroidBrandAssetConfig({
        rootDir,
        env: process.env,
    });
    const signingState = detectAndroidReleaseSigning({
        rootDir,
        androidDir,
        env: process.env,
    });
    const androidShellStatus = getAndroidShellStatus();
    const androidWebAssetsStatus = getAndroidWebAssetsStatus();
    const capacitorPluginWiringStatus = getCapacitorPluginWiringStatus();

    const lines = [
        `JAVA_HOME=${process.env.JAVA_HOME || '(未设置)'}`,
        `ANDROID_HOME=${process.env.ANDROID_HOME || '(未设置)'}`,
        `ANDROID_SDK_ROOT=${process.env.ANDROID_SDK_ROOT || '(未设置)'}`,
        `VITE_BACKEND_URL=${process.env.VITE_BACKEND_URL || '(未设置)'}`,
        `ANDROID_WEBVIEW_MODE=${getAndroidWebviewMode()}`,
        `ANDROID_REMOTE_WEB_URL=${getAndroidRemoteWebUrl() || '(未设置)'}`,
        `ANDROID_OTA_CONFIGURED=${parseBooleanEnv(process.env.VITE_ANDROID_OTA_ENABLED) ? 'true' : 'false'}`,
        `ANDROID_OTA_ALLOW_DEBUG_APP=${parseBooleanEnv(process.env.VITE_ANDROID_OTA_ALLOW_DEBUG_APP) ? 'true' : 'false'}`,
        `ANDROID_OTA_ENABLED=${getAndroidOtaEnabled() ? 'true' : 'false'}`,
        `ANDROID_OTA_MANIFEST_URL=${getAndroidOtaManifestUrl() || '(未设置)'}`,
        `ANDROID_OTA_CHANNEL=${getAndroidOtaChannel() || '(未设置)'}`,
        `CAPACITOR_APP_ID=${appId}`,
        `CAPACITOR_APP_NAME=${appName}`,
        `ANDROID_PROJECT=${hasAndroidProject() ? 'ready' : 'missing'}`,
        `CAPACITOR_CLI=${existsSync(capacitorCliPath) ? 'ready' : 'missing'}`,
        `VITE_CLI=${existsSync(viteCliPath) ? 'ready' : 'missing'}`,
        `ANDROID_ICON_SOURCE=${path.relative(rootDir, assetConfig.iconSourcePath)}`,
        `ANDROID_SPLASH_SOURCE=${path.relative(rootDir, assetConfig.splashSourcePath)}`,
        `ANDROID_RELEASE_SIGNING=${signingState.configured ? `ready(${signingState.source})` : 'missing'}`,
        `ANDROID_SHELL=${androidShellStatus.message}`,
        `ANDROID_WEB_ASSETS=${androidWebAssetsStatus.message}`,
        `ANDROID_CAP_PLUGIN_WIRING=${capacitorPluginWiringStatus.message}`,
        `CHILD_PROCESS_BUILD=${probe.ok ? 'ready' : `blocked(${probe.stage})`}`,
    ];

    for (const line of lines) {
        console.log(line);
    }

    if (!probe.ok) {
        console.log('提示: 当前环境无法直接完成 build/sync，这通常是沙箱限制，不是项目配置错误。');
    }
};

const run = async () => {
    if (new Set(['prepare-release', 'build-release', 'build-bundle']).has(command)) {
        applyReleaseShellDefaults();
    }

    switch (command) {
        case 'doctor':
            await printDoctor();
            return;
        case 'assets':
            await ensureAndroidProject();
            console.log('Android 图标和启动图已更新。');
            return;
        case 'prepare-release':
            await prepareRelease({ required: false });
            return;
        case 'init':
            await syncAndroid();
            return;
        case 'sync':
            await syncAndroid();
            return;
        case 'open':
            await ensureAndroidProject();
            await runCapacitor(['open', 'android']);
            return;
        case 'run':
            await syncAndroid();
            await runCapacitor(['run', 'android']);
            return;
        case 'build-debug':
            if (getAndroidWebviewMode() === 'remote') {
                await prepareRemoteShellBuild();
            } else {
                await syncAndroid();
            }
            await runGradle(['assembleDebug']);
            console.log('Debug APK 输出目录: android/app/build/outputs/apk/debug/');
            return;
        case 'build-release':
            if (getAndroidWebviewMode() === 'remote') {
                await prepareRemoteShellBuild();
            } else {
                await syncAndroid();
            }
            await prepareRelease({ required: true });
            await runGradle(['assembleRelease']);
            console.log('Signed Release APK 输出目录: android/app/build/outputs/apk/release/');
            return;
        case 'build-bundle':
            if (getAndroidWebviewMode() === 'remote') {
                await prepareRemoteShellBuild();
            } else {
                await syncAndroid();
            }
            await prepareRelease({ required: true });
            await runGradle(['bundleRelease']);
            console.log('Signed Release AAB 输出目录: android/app/build/outputs/bundle/release/');
            return;
        default:
            throw new Error(
                '未知命令。可用命令: doctor | assets | prepare-release | init | sync | open | run | build-debug | build-release | build-bundle',
            );
    }
};

run().catch((error) => {
    console.error(`[android] ${error instanceof Error ? error.message : String(error)}`);
    process.exit(1);
});
