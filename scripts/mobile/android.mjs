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

const rootDir = process.cwd();
const androidDir = path.join(rootDir, 'android');
const capacitorCliPath = path.join(rootDir, 'node_modules', '@capacitor', 'cli', 'bin', 'capacitor');
const capacitorAndroidBuildGradlePath = path.join(rootDir, 'node_modules', '@capacitor', 'android', 'capacitor', 'build.gradle');
const viteCliPath = path.join(rootDir, 'node_modules', 'vite', 'bin', 'vite.js');
const gradleWrapper = process.platform === 'win32'
    ? path.join(androidDir, 'gradlew.bat')
    : path.join(androidDir, 'gradlew');
const defaultAppId = 'top.easyboardgame.app';
const defaultAppName = '易桌游';
const defaultAndroidWebviewMode = 'embedded';
const supportedAndroidWebviewModes = new Set(['embedded', 'remote']);
const command = process.argv[2];
const distDir = path.join(rootDir, 'dist');
const androidPublicDir = path.join(androidDir, 'app', 'src', 'main', 'assets', 'public');
const androidBuildMetaFileName = 'android-build-meta.json';

const envFiles = ['.env', '.env.android', '.env.android.local'];
for (const file of envFiles) {
    const fullPath = path.join(rootDir, file);
    if (!existsSync(fullPath)) continue;
    dotenv.config({ path: fullPath, override: true, quiet: true });
}

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

const runWindowsBatch = async (scriptPath, args, options = {}) => {
    const comSpec = process.env.ComSpec || 'cmd.exe';
    const cmdLine = [scriptPath, ...args].map(quoteCmdArg).join(' ');
    await runCommand(comSpec, ['/d', '/s', '/c', cmdLine], options);
};

const runCapacitor = async (args) => {
    await runNodeScript(capacitorCliPath, args);
};

const runAndroidWebBuild = async () => {
    await runNodeScript(viteCliPath, ['build', '--mode', 'android']);
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
    appId: process.env.CAPACITOR_APP_ID?.trim() || defaultAppId,
    appName: process.env.CAPACITOR_APP_NAME?.trim() || defaultAppName,
});

const getAndroidWebviewMode = () => {
    const mode = (process.env.ANDROID_WEBVIEW_MODE?.trim().toLowerCase() || defaultAndroidWebviewMode);
    if (!supportedAndroidWebviewModes.has(mode)) {
        throw new Error(`ANDROID_WEBVIEW_MODE 只支持 embedded 或 remote，当前值为: ${mode}`);
    }
    return mode;
};

const getAndroidRemoteWebUrl = () => process.env.ANDROID_REMOTE_WEB_URL?.trim() || '';

const ensureRemoteWebUrl = () => {
    const remoteUrl = getAndroidRemoteWebUrl();
    if (!remoteUrl) {
        throw new Error('remote 模式必须配置 ANDROID_REMOTE_WEB_URL，且必须是绝对 HTTPS 地址。');
    }
    if (!/^https:\/\//i.test(remoteUrl)) {
        throw new Error(`ANDROID_REMOTE_WEB_URL 必须是绝对 HTTPS 地址，当前值为: ${remoteUrl}`);
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
        if (!/^https:\/\//i.test(remoteUrl)) {
            return {
                ok: false,
                code: 'remote-invalid-url',
                message: `ANDROID_REMOTE_WEB_URL 必须是绝对 HTTPS 地址，当前值为: ${remoteUrl}`,
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
            '移动端壳构建必须显式配置 VITE_BACKEND_URL。请在 .env.android 或 .env.android.local 中设置绝对 HTTPS 地址。',
        );
    }
    if (!/^https?:\/\//i.test(backendUrl)) {
        throw new Error(`VITE_BACKEND_URL 必须是绝对地址，当前值为: ${backendUrl}`);
    }
};

const hasAndroidProject = () => existsSync(path.join(androidDir, 'app', 'build.gradle'));

const ensureGeneratedAndroidFiles = () => {
    const capacitorAndroidDir = path.join(rootDir, 'node_modules', '@capacitor', 'android', 'capacitor');
    const capacitorAndroidRelativePath = existsSync(capacitorAndroidDir)
        ? toUnixPath(path.relative(androidDir, capacitorAndroidDir))
        : '../node_modules/@capacitor/android/capacitor';

    writeText(
        path.join(androidDir, 'capacitor.settings.gradle'),
        `// DO NOT EDIT THIS FILE! IT IS GENERATED EACH TIME "capacitor update" IS RUN
include ':capacitor-android'
project(':capacitor-android').projectDir = new File('${capacitorAndroidRelativePath}')
`,
    );

    writeText(
        path.join(androidDir, 'app', 'capacitor.build.gradle'),
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

        if (!next.includes('import java.util.Properties')) {
            next = `import java.util.Properties\n\n${next}`;
        }

        if (!next.includes('import groovy.json.JsonSlurper')) {
            next = `import groovy.json.JsonSlurper\n${next}`;
        }

        next = next
            .replace(/namespace\s*=\s*"[^"]+"/, `namespace = "${appId}"`)
            .replace(/applicationId\s+"[^"]+"/, `applicationId "${appId}"`)
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
            `}\n`;

        if (!next.includes('capacitorConfigFile = file(\'src/main/assets/capacitor.config.json\')')) {
            next = `${next}\n${androidShellValidationBlock}`;
        } else {
            next = next.replace(
                /def capacitorConfigFile = file\('src\/main\/assets\/capacitor\.config\.json'\)[\s\S]*?if \(requiresSyncedWebAssets\) \{[\s\S]*?\n\}/,
                androidShellValidationBlock.trimEnd(),
            );
        }

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

    moveJavaFileToPackage(mainJavaRoot, 'MainActivity.java', appId);
    moveJavaFileToPackage(testJavaRoot, 'ExampleUnitTest.java', appId);
    moveJavaFileToPackage(androidTestJavaRoot, 'ExampleInstrumentedTest.java', appId, (content) => (
        content.replace(/assertEquals\(".*?", appContext\.getPackageName\(\)\);/, `assertEquals("${appId}", appContext.getPackageName());`)
    ));

    ensureGeneratedAndroidFiles();
    prepareCapacitorAndroidModule();
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
        ensureAndroidDistBuildReady();
    }
    await ensureAndroidProject();
    if (mode === 'embedded') {
        await runCapacitor(['sync', 'android']);
    } else {
        await runCapacitor(['update', 'android']);
        await runCapacitor(['copy', 'android']);
    }
    await prepareAndroidProject();
    if (mode === 'embedded') {
        ensureAndroidWebAssetsSynced();
    } else {
        clearBundledWebAssetsForRemote();
    }
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

    const lines = [
        `JAVA_HOME=${process.env.JAVA_HOME || '(未设置)'}`,
        `ANDROID_HOME=${process.env.ANDROID_HOME || '(未设置)'}`,
        `ANDROID_SDK_ROOT=${process.env.ANDROID_SDK_ROOT || '(未设置)'}`,
        `VITE_BACKEND_URL=${process.env.VITE_BACKEND_URL || '(未设置)'}`,
        `ANDROID_WEBVIEW_MODE=${getAndroidWebviewMode()}`,
        `ANDROID_REMOTE_WEB_URL=${getAndroidRemoteWebUrl() || '(未设置)'}`,
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
            await syncAndroid();
            await runGradle(['assembleDebug']);
            console.log('Debug APK 输出目录: android/app/build/outputs/apk/debug/');
            return;
        case 'build-release':
            await syncAndroid();
            await prepareRelease({ required: true });
            await runGradle(['assembleRelease']);
            console.log('Signed Release APK 输出目录: android/app/build/outputs/apk/release/');
            return;
        case 'build-bundle':
            await syncAndroid();
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
