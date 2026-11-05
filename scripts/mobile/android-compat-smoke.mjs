#!/usr/bin/env node

import { spawn, spawnSync } from 'node:child_process';
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { createServer } from 'node:net';
import path from 'node:path';
import sharp from 'sharp';
import { acquireGlobalHeavyBudget } from '../infra/global-heavy-budget.mjs';
import { acquireTaskGuard } from '../infra/heavy-task-guard.mjs';
import {
    DEFAULT_ANDROID_COMPAT_BOOT_TIMEOUT_MS,
    DEFAULT_ANDROID_COMPAT_LAUNCH_DELAY_MS,
    DEFAULT_ANDROID_COMPAT_MIN_WEBVIEW_MAJOR,
    DEFAULT_ANDROID_COMPAT_OUTPUT_ROOT,
    analyzeRawScreenshot,
    buildCompatNavigationUrl,
    detectFriendlyPrompt,
    extractUiStrings,
    parseMajorVersion,
    parsePackageVersionName,
    resolveCompatSmokeRoutePath,
} from './android-compat-smoke-shared.mjs';

const rootDir = process.cwd();
const args = process.argv.slice(2);
const defaultAppId = 'top.easyboardgame.app.debug';
const defaultCustomUrlScheme = 'top.easyboardgame.app.debug';
const defaultEmulatorPortStart = 5560;
const defaultEmulatorPortEnd = 5680;
const webViewCdpLoadingHints = [
    '正在加载对局资源',
    '加载素材',
    '正在更新',
    '下载必要更新',
    'loading',
];

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

const createCompatSmokeMetadata = ({
    serial,
    avd,
    route,
    skipInstall,
    keepEmulator,
    minWebViewMajor,
    launchDelayMs,
    bootTimeoutMs,
}) => ({
    serial: serial || '<auto>',
    avd: avd || '<auto>',
    route: route || '<default>',
    skipInstall,
    keepEmulator,
    minWebViewMajor,
    launchDelayMs,
    bootTimeoutMs,
});

const readArgValue = (name, defaultValue = '') => {
    const direct = `--${name}`;
    const inline = `--${name}=`;

    for (let index = 0; index < args.length; index += 1) {
        const arg = args[index];
        if (arg === direct) {
            return args[index + 1] ?? defaultValue;
        }
        if (arg.startsWith(inline)) {
            return arg.slice(inline.length);
        }
    }

    return defaultValue;
};

const hasFlag = (name) => args.includes(`--${name}`);

const timestampForPath = () => new Date().toISOString().replace(/[:.]/g, '-');

const printUsage = () => {
    console.log([
        '用法: node scripts/mobile/android-compat-smoke.mjs [选项]',
        '',
        '选项:',
        '  --serial <adb serial>          直接使用已连接设备/模拟器',
        '  --avd <name>                   优先使用/启动指定 AVD，并忽略其他已连接实体机',
        '  --apk <path>                   安装指定 APK；默认优先用 debug APK',
        '  --app-id <id>                  默认 top.easyboardgame.app.debug',
        '  --route <path>                 启动后直接深链到指定应用内路由，例如 /play/dicethrone/local',
        `  --custom-url-scheme <scheme>   默认 ${defaultCustomUrlScheme}`,
        `  --min-webview-major <n>        默认 ${DEFAULT_ANDROID_COMPAT_MIN_WEBVIEW_MAJOR}`,
        `  --launch-delay-ms <ms>         默认 ${DEFAULT_ANDROID_COMPAT_LAUNCH_DELAY_MS}`,
        `  --boot-timeout-ms <ms>         默认 ${DEFAULT_ANDROID_COMPAT_BOOT_TIMEOUT_MS}`,
        '  --output-dir <path>            输出目录；默认 test-results/android-compat-smoke/<时间戳>',
        '  --skip-install                 跳过 APK 安装',
        '  --keep-emulator                脚本启动的模拟器结束后不自动关闭',
        '  --help                         显示帮助',
    ].join('\n'));
};

const resolveAndroidSdkRoot = () => {
    const value = process.env.ANDROID_SDK_ROOT?.trim() || process.env.ANDROID_HOME?.trim() || '';
    if (!value) {
        throw new Error('未设置 ANDROID_SDK_ROOT / ANDROID_HOME，无法运行本地 Android smoke。');
    }
    return value;
};

const resolveSdkBinary = (sdkRoot, relativePath) => {
    const candidate = path.join(sdkRoot, relativePath);
    return process.platform === 'win32' ? `${candidate}.exe` : candidate;
};

const runBuffered = (command, commandArgs, options = {}) => new Promise((resolve, reject) => {
    const child = spawn(command, commandArgs, {
        cwd: rootDir,
        env: process.env,
        stdio: ['ignore', 'pipe', 'pipe'],
        windowsHide: true,
        shell: false,
        ...options,
    });

    let stdout = '';
    let stderr = '';
    child.stdout.on('data', (chunk) => {
        stdout += chunk.toString();
    });
    child.stderr.on('data', (chunk) => {
        stderr += chunk.toString();
    });

    child.on('error', reject);
    child.on('exit', (code) => {
        if (code === 0) {
            resolve({ stdout, stderr });
            return;
        }
        reject(new Error(`命令失败: ${command} ${commandArgs.join(' ')}\n${stderr || stdout}`.trim()));
    });
});

const runBufferedAllowFailure = async (command, commandArgs, options = {}) => {
    try {
        return await runBuffered(command, commandArgs, options);
    } catch (error) {
        return {
            stdout: '',
            stderr: error instanceof Error ? error.message : String(error),
        };
    }
};

const runAdb = async (adbPath, serial, commandArgs) => {
    const scopedArgs = serial ? ['-s', serial, ...commandArgs] : commandArgs;
    return runBuffered(adbPath, scopedArgs);
};

const runAdbAllowFailure = async (adbPath, serial, commandArgs) => {
    const scopedArgs = serial ? ['-s', serial, ...commandArgs] : commandArgs;
    return runBufferedAllowFailure(adbPath, scopedArgs);
};

const listAdbDeviceEntries = async (adbPath) => {
    const { stdout } = await runBuffered(adbPath, ['devices']);
    return stdout
        .split(/\r?\n/u)
        .slice(1)
        .map((line) => line.trim())
        .filter(Boolean)
        .map((line) => {
            const [serial, state] = line.split(/\s+/u);
            return { serial, state: state ?? '' };
        });
};

const listAdbDevices = async (adbPath) => {
    const entries = await listAdbDeviceEntries(adbPath);
    return entries.filter((entry) => entry.state === 'device');
};

const formatDeviceEntries = (entries) => {
    if (!entries.length) {
        return '(none)';
    }

    return entries.map((entry) => `${entry.serial}:${entry.state || 'unknown'}`).join(', ');
};

const listAvds = (emulatorPath) => {
    const result = spawnSync(emulatorPath, ['-list-avds'], {
        cwd: rootDir,
        env: process.env,
        encoding: 'utf8',
        windowsHide: true,
    });
    if (result.status !== 0) {
        throw new Error(`列出 AVD 失败: ${result.stderr || result.stdout}`.trim());
    }

    return (result.stdout || '')
        .split(/\r?\n/u)
        .map((line) => line.trim())
        .filter(Boolean);
};

const chooseAvd = (avds, preferredName) => {
    if (preferredName) {
        const exact = avds.find((item) => item === preferredName);
        if (!exact) {
            throw new Error(`未找到指定 AVD: ${preferredName}`);
        }
        return exact;
    }

    const preferredPatterns = [/api[_ -]?24/i, /_24/i, /nougat/i];
    for (const pattern of preferredPatterns) {
        const hit = avds.find((item) => pattern.test(item));
        if (hit) {
            return hit;
        }
    }

    return avds[0] ?? '';
};

const resolveCompatDeviceTarget = async ({
    adbPath,
    emulatorPath,
    serialArg,
    avdArg,
    bootTimeoutMs,
}) => {
    const existingEntries = await listAdbDeviceEntries(adbPath);
    const existingDevices = existingEntries.filter((entry) => entry.state === 'device');

    if (serialArg) {
        const matched = existingDevices.find((entry) => entry.serial === serialArg);
        if (!matched) {
            throw new Error(`指定设备未连接: ${serialArg}。当前 adb 设备: ${formatDeviceEntries(existingEntries)}`);
        }
        return {
            serial: serialArg,
            startedEmulator: false,
        };
    }

    if (avdArg) {
        const existingEmulator = existingDevices.find((device) => device.serial.startsWith('emulator-'));
        if (existingEmulator) {
            return {
                serial: existingEmulator.serial,
                startedEmulator: false,
            };
        }

        const avds = listAvds(emulatorPath);
        const avdName = chooseAvd(avds, avdArg);
        const emulatorPort = allocateEmulatorPort(existingEntries);
        spawn(emulatorPath, [
            '-avd',
            avdName,
            '-port',
            String(emulatorPort),
            '-no-snapshot-load',
            '-no-snapshot-save',
            '-no-boot-anim',
            '-gpu',
            'swiftshader_indirect',
        ], {
            cwd: rootDir,
            env: process.env,
            stdio: 'ignore',
            windowsHide: true,
            detached: true,
            shell: false,
        }).unref();

        return {
            serial: await waitForNewEmulatorSerial(adbPath, emulatorPort, bootTimeoutMs),
            startedEmulator: true,
        };
    }

    const existingEmulator = existingDevices.find((device) => device.serial.startsWith('emulator-'));
    if (existingEmulator) {
        return {
            serial: existingEmulator.serial,
            startedEmulator: false,
        };
    }

    if (existingDevices.length > 0) {
        return {
            serial: existingDevices[0].serial,
            startedEmulator: false,
        };
    }

    const avds = listAvds(emulatorPath);
    const avdName = chooseAvd(avds, avdArg);
    if (!avdName) {
        throw new Error('没有检测到可用 AVD，请先在 Android Studio 创建设备，或显式传 --serial。');
    }

    const emulatorPort = allocateEmulatorPort(existingEntries);
    spawn(emulatorPath, [
        '-avd',
        avdName,
        '-port',
        String(emulatorPort),
        '-no-snapshot-load',
        '-no-snapshot-save',
        '-no-boot-anim',
        '-gpu',
        'swiftshader_indirect',
    ], {
        cwd: rootDir,
        env: process.env,
        stdio: 'ignore',
        windowsHide: true,
        detached: true,
        shell: false,
    }).unref();

    return {
        serial: await waitForNewEmulatorSerial(adbPath, emulatorPort, bootTimeoutMs),
        startedEmulator: true,
    };
};

const allocateEmulatorPort = (entries) => {
    const usedPorts = new Set();

    for (const entry of entries) {
        const emulatorMatch = entry.serial.match(/^emulator-(\d+)$/);
        if (emulatorMatch) {
            usedPorts.add(Number.parseInt(emulatorMatch[1], 10));
        }

        const hostMatch = entry.serial.match(/^127\.0\.0\.1:(\d+)$/);
        if (hostMatch) {
            const adbPort = Number.parseInt(hostMatch[1], 10);
            if (Number.isFinite(adbPort)) {
                usedPorts.add(adbPort - 1);
            }
        }
    }

    for (let port = defaultEmulatorPortStart; port <= defaultEmulatorPortEnd; port += 2) {
        if (!usedPorts.has(port)) {
            return port;
        }
    }

    throw new Error('没有找到可用的 emulator 端口。');
};

const waitForNewEmulatorSerial = async (adbPath, emulatorPort, timeoutMs) => {
    const startedAt = Date.now();
    const emulatorSerial = `emulator-${emulatorPort}`;
    const hostSerial = `127.0.0.1:${emulatorPort + 1}`;

    while ((Date.now() - startedAt) < timeoutMs) {
        await runBufferedAllowFailure(adbPath, ['connect', hostSerial]);

        const entries = await listAdbDeviceEntries(adbPath);
        const emulatorEntry = entries.find((device) => device.serial === emulatorSerial);
        if (emulatorEntry?.state === 'device') {
            return emulatorSerial;
        }

        const hostEntry = entries.find((device) => device.serial === hostSerial);
        if (hostEntry?.state === 'device') {
            return emulatorSerial;
        }

        await sleep(2000);
    }

    throw new Error(`启动模拟器后超时，未发现可用设备 ${emulatorSerial}。`);
};

const waitForBootCompleted = async (adbPath, serial, timeoutMs) => {
    const startedAt = Date.now();
    await runBuffered(adbPath, ['-s', serial, 'wait-for-device']);

    while ((Date.now() - startedAt) < timeoutMs) {
        const [boot, packageManager] = await Promise.all([
            runAdbAllowFailure(adbPath, serial, ['shell', 'getprop', 'sys.boot_completed']),
            runAdbAllowFailure(adbPath, serial, ['shell', 'getprop', 'init.svc.bootanim']),
        ]);

        const bootCompleted = boot.stdout.trim() === '1';
        const bootAnimationStopped = packageManager.stdout.trim() === 'stopped';
        if (bootCompleted && bootAnimationStopped) {
            return;
        }

        await sleep(2000);
    }

    throw new Error(`等待设备 ${serial} 启动完成超时。`);
};

const waitForDeviceOnline = async (adbPath, serial, timeoutMs) => {
    const startedAt = Date.now();

    while ((Date.now() - startedAt) < timeoutMs) {
        const entries = await listAdbDeviceEntries(adbPath);
        const entry = entries.find((item) => item.serial === serial);

        if (entry?.state === 'device') {
            const probe = await runAdbAllowFailure(adbPath, serial, ['shell', 'echo', 'ready']);
            if ((probe.stdout || '').trim().includes('ready')) {
                return;
            }
        }

        await sleep(2000);
    }

    throw new Error(`设备 ${serial} 长时间未进入可操作状态。`);
};

const ensureDirectory = (dirPath) => {
    mkdirSync(dirPath, { recursive: true });
};

const resolveDefaultApk = () => {
    const candidates = [
        path.join(rootDir, 'android', 'app', 'build', 'outputs', 'apk', 'debug', 'easyboardgame-debug.apk'),
        path.join(rootDir, 'android', 'app', 'build', 'outputs', 'apk', 'release', 'easyboardgame-release.apk'),
    ];

    for (const candidate of candidates) {
        if (existsSync(candidate)) {
            return candidate;
        }
    }

    throw new Error('未找到可安装 APK。请先执行 npm run mobile:android:build:debug 或显式传 --apk。');
};

const writeTextFile = (filePath, content) => {
    ensureDirectory(path.dirname(filePath));
    writeFileSync(filePath, content, 'utf8');
};

const buildDeepLinkUrl = (route, scheme) => {
    if (!route) return '';
    if (/^[a-z][a-z0-9+.-]*:/i.test(route)) {
        return route;
    }

    const normalized = resolveCompatSmokeRoutePath(route);
    const [pathnameWithEmpty, searchAndHash = ''] = normalized.split(/(?=[?#])/u, 2);
    const pathname = pathnameWithEmpty.replace(/^\/+/u, '');
    if (!pathname) {
        throw new Error('route 不能为空。');
    }

    return `${scheme}://${pathname}${searchAndHash}`;
};

const captureScreenshot = async (adbPath, serial, filePath) => {
    ensureDirectory(path.dirname(filePath));

    await new Promise((resolve, reject) => {
        const child = spawn(adbPath, ['-s', serial, 'exec-out', 'screencap', '-p'], {
            cwd: rootDir,
            env: process.env,
            stdio: ['ignore', 'pipe', 'pipe'],
            windowsHide: true,
            shell: false,
        });

        const chunks = [];
        let stderr = '';
        child.stdout.on('data', (chunk) => chunks.push(chunk));
        child.stderr.on('data', (chunk) => {
            stderr += chunk.toString();
        });
        child.on('error', reject);
        child.on('exit', (code) => {
            if (code !== 0) {
                reject(new Error(`抓取截图失败: ${stderr}`.trim()));
                return;
            }
            writeFileSync(filePath, Buffer.concat(chunks));
            resolve();
        });
    });
};

const dumpUiHierarchy = async (adbPath, serial, outputDir) => {
    const remotePath = '/sdcard/android-compat-smoke-ui.xml';
    const localPath = path.join(outputDir, 'window_dump.xml');
    await runAdbAllowFailure(adbPath, serial, ['shell', 'uiautomator', 'dump', remotePath]);
    const pulled = await runAdbAllowFailure(adbPath, serial, ['pull', remotePath, localPath]);
    await runAdbAllowFailure(adbPath, serial, ['shell', 'rm', remotePath]);

    if (pulled.stderr && !readSafe(localPath)) {
        return '';
    }

    return readSafe(localPath);
};

const dismissImmersiveClingIfPresent = async (adbPath, serial, outputDir) => {
    const uiDumpText = await dumpUiHierarchy(adbPath, serial, outputDir);
    if (!uiDumpText.includes('android:id/ok') || !uiDumpText.includes('Viewing full screen')) {
        return false;
    }

    const match = uiDumpText.match(/resource-id="android:id\/ok"[\s\S]*?bounds="\[(\d+),(\d+)\]\[(\d+),(\d+)\]"/u);
    if (!match) {
        return false;
    }

    const left = Number.parseInt(match[1], 10);
    const top = Number.parseInt(match[2], 10);
    const right = Number.parseInt(match[3], 10);
    const bottom = Number.parseInt(match[4], 10);
    if (![left, top, right, bottom].every(Number.isFinite)) {
        return false;
    }

    const centerX = Math.round((left + right) / 2);
    const centerY = Math.round((top + bottom) / 2);
    await runAdbAllowFailure(adbPath, serial, ['shell', 'input', 'tap', String(centerX), String(centerY)]);
    await sleep(1200);
    return true;
};

const readSafe = (filePath) => {
    try {
        return readFileSync(filePath, 'utf8');
    } catch {
        return '';
    }
};

const collectPackageDump = async (adbPath, serial, packageName, outputDir) => {
    const result = await runAdbAllowFailure(adbPath, serial, ['shell', 'dumpsys', 'package', packageName]);
    const outputPath = path.join(outputDir, `${packageName.replace(/\./g, '_')}.txt`);
    writeTextFile(outputPath, result.stdout || result.stderr || '');
    return result.stdout || '';
};

const analyzeScreenshotFile = async (filePath) => {
    const { data, info } = await sharp(filePath)
        .ensureAlpha()
        .raw()
        .toBuffer({ resolveWithObject: true });

    return analyzeRawScreenshot({
        data,
        width: info.width,
        height: info.height,
        channels: info.channels,
    });
};

const allocateLocalTcpPort = () => new Promise((resolve, reject) => {
    const server = createServer();
    server.unref();
    server.on('error', reject);
    server.listen(0, '127.0.0.1', () => {
        const address = server.address();
        const port = typeof address === 'object' && address ? address.port : 0;
        server.close((error) => {
            if (error) {
                reject(error);
                return;
            }
            if (!port) {
                reject(new Error('无法分配本地 CDP 端口。'));
                return;
            }
            resolve(port);
        });
    });
});

const waitForWebViewSocketName = async (adbPath, serial, appId, timeoutMs) => {
    const startedAt = Date.now();

    while ((Date.now() - startedAt) < timeoutMs) {
        const pidResult = await runAdbAllowFailure(adbPath, serial, ['shell', 'pidof', '-s', appId]);
        const pid = (pidResult.stdout || '').trim().split(/\s+/u)[0] || '';
        if (pid) {
            const unixResult = await runAdbAllowFailure(adbPath, serial, ['shell', 'cat', '/proc/net/unix']);
            const expectedSocket = `webview_devtools_remote_${pid}`;
            const unixText = `${unixResult.stdout || ''}\n${unixResult.stderr || ''}`;
            if (unixText.includes(expectedSocket)) {
                return expectedSocket;
            }

            const anySocketMatch = unixText.match(/webview_devtools_remote_\d+/u);
            if (anySocketMatch?.[0]) {
                return anySocketMatch[0];
            }
        }

        await sleep(1000);
    }

    return '';
};

const forwardWebViewDevtoolsPort = async (adbPath, serial, socketName) => {
    const localPort = await allocateLocalTcpPort();
    const localSpec = `tcp:${localPort}`;

    await runAdbAllowFailure(adbPath, serial, ['forward', '--remove', localSpec]);
    await runAdb(adbPath, serial, ['forward', localSpec, `localabstract:${socketName}`]);

    return {
        endpoint: `http://127.0.0.1:${localPort}`,
        dispose: async () => {
            await runAdbAllowFailure(adbPath, serial, ['forward', '--remove', localSpec]);
        },
    };
};

const waitForCdpPageTarget = async (endpoint, timeoutMs) => {
    const startedAt = Date.now();

    while ((Date.now() - startedAt) < timeoutMs) {
        try {
            const response = await fetch(`${endpoint}/json/list`);
            if (!response.ok) {
                throw new Error(`HTTP ${response.status}`);
            }

            const targets = await response.json();
            if (Array.isArray(targets)) {
                const pageTarget = targets.find((target) => target?.type === 'page' && typeof target?.webSocketDebuggerUrl === 'string');
                if (pageTarget) {
                    return pageTarget;
                }
            }
        } catch {}

        await sleep(1000);
    }

    throw new Error(`等待 WebView CDP 页面目标超时: ${endpoint}`);
};

const openCdpPageClient = async (endpoint, timeoutMs) => {
    const target = await waitForCdpPageTarget(endpoint, timeoutMs);
    const socket = new WebSocket(target.webSocketDebuggerUrl);
    let nextId = 1;
    const pending = new Map();

    socket.addEventListener('message', (event) => {
        const payload = JSON.parse(event.data.toString());
        if (payload.id && pending.has(payload.id)) {
            const { resolve, reject } = pending.get(payload.id);
            pending.delete(payload.id);
            if (payload.error) {
                reject(new Error(JSON.stringify(payload.error)));
            } else {
                resolve(payload.result ?? {});
            }
        }
    });

    await new Promise((resolve, reject) => {
        socket.addEventListener('open', resolve, { once: true });
        socket.addEventListener('error', reject, { once: true });
    });

    const send = (method, params = {}) => new Promise((resolve, reject) => {
        const id = nextId;
        nextId += 1;
        pending.set(id, { resolve, reject });
        socket.send(JSON.stringify({ id, method, params }));
    });

    return {
        target,
        send,
        close: async () => {
            for (const { reject } of pending.values()) {
                reject(new Error('CDP 连接已关闭。'));
            }
            pending.clear();

            if (socket.readyState === WebSocket.OPEN || socket.readyState === WebSocket.CONNECTING) {
                socket.close();
            }

            if (socket.readyState !== WebSocket.CLOSED) {
                await new Promise((resolve) => {
                    socket.addEventListener('close', resolve, { once: true });
                    setTimeout(resolve, 1000);
                });
            }
        },
    };
};

const readCdpStringValue = async (client, expression) => {
    const result = await client.send('Runtime.evaluate', {
        expression,
        returnByValue: true,
        awaitPromise: true,
    });
    return result?.result?.value ?? '';
};

const looksLikeTransientLoadingState = (text) => {
    const normalized = typeof text === 'string' ? text.trim().toLowerCase() : '';
    if (!normalized) {
        return true;
    }
    return webViewCdpLoadingHints.some((hint) => normalized.includes(hint.toLowerCase()));
};

const hideSmokeBlockingOverlays = async (client) => {
    await client.send('Runtime.evaluate', {
        expression: `(() => {
            const styleId = 'bg-android-compat-smoke-hide-overlays';
            let style = document.getElementById(styleId);
            if (!style) {
                style = document.createElement('style');
                style.id = styleId;
                document.head.appendChild(style);
            }
            style.textContent = [
                '[data-testid="game-page-rescue-gate"] { display: none !important; }',
                '[data-bg-rescue-gate="true"] { display: none !important; }'
            ].join('\\n');
            return true;
        })()`,
        returnByValue: true,
        awaitPromise: true,
    });
};

const driveRouteInWebView = async (adbPath, serial, appId, route, outputDir, waitMs) => {
    const targetPath = resolveCompatSmokeRoutePath(route);
    const navigationUrl = buildCompatNavigationUrl(route);
    if (!targetPath || !navigationUrl) {
        return {
            attempted: false,
            succeeded: false,
            reason: 'route-empty',
        };
    }

    const socketName = await waitForWebViewSocketName(adbPath, serial, appId, Math.max(waitMs, 15000));
    if (!socketName) {
        return {
            attempted: true,
            succeeded: false,
            reason: 'cdp-socket-missing',
        };
    }

    const forwarded = await forwardWebViewDevtoolsPort(adbPath, serial, socketName);
    let client = null;

    try {
        client = await openCdpPageClient(forwarded.endpoint, Math.max(waitMs, 15000));
        await client.send('Page.enable');
        await client.send('Runtime.enable');

        const beforeUrl = await readCdpStringValue(client, 'location.href');
        if (beforeUrl !== navigationUrl) {
            await client.send('Page.navigate', { url: navigationUrl });
        }

        const startedAt = Date.now();
        let finalUrl = beforeUrl;
        let bodyText = '';

        while ((Date.now() - startedAt) < Math.max(waitMs, 20000)) {
            await sleep(1000);
            finalUrl = await readCdpStringValue(client, 'location.href');
            bodyText = await readCdpStringValue(client, 'document.body ? document.body.innerText.slice(0, 4000) : ""');

            const routeReached = finalUrl.includes(targetPath.split('?')[0]);
            if (routeReached && !looksLikeTransientLoadingState(bodyText)) {
                break;
            }
        }

        await hideSmokeBlockingOverlays(client);
        await sleep(300);

        const cdpScreenshot = await client.send('Page.captureScreenshot', {
            format: 'png',
            fromSurface: true,
        });
        const cdpScreenshotPath = path.join(outputDir, 'webview-cdp.png');
        if (typeof cdpScreenshot?.data === 'string' && cdpScreenshot.data) {
            writeFileSync(cdpScreenshotPath, Buffer.from(cdpScreenshot.data, 'base64'));
        }

        finalUrl = await readCdpStringValue(client, 'location.href');
        const finalBodyText = await readCdpStringValue(client, 'document.body ? document.body.innerText.slice(0, 4000) : ""');
        writeTextFile(path.join(outputDir, 'webview-cdp.txt'), [
            `target=${navigationUrl}`,
            `before=${beforeUrl}`,
            `final=${finalUrl}`,
            '',
            finalBodyText,
        ].join('\n'));

        return {
            attempted: true,
            succeeded: finalUrl.includes(targetPath.split('?')[0]),
            reason: '',
            socketName,
            endpoint: forwarded.endpoint,
            beforeUrl,
            finalUrl,
            bodyTextSample: finalBodyText.slice(0, 400),
            screenshot: existsSync(cdpScreenshotPath) ? path.relative(rootDir, cdpScreenshotPath) : '',
        };
    } catch (error) {
        return {
            attempted: true,
            succeeded: false,
            reason: error instanceof Error ? error.message : String(error),
            socketName,
            endpoint: forwarded.endpoint,
        };
    } finally {
        if (client) {
            await client.close().catch(() => {});
        }
        await forwarded.dispose().catch(() => {});
    }
};

const launchApp = async (adbPath, serial, appId, { route = '', customUrlScheme = defaultCustomUrlScheme } = {}) => {
    await runAdbAllowFailure(adbPath, serial, ['shell', 'input', 'keyevent', '224']);
    await runAdbAllowFailure(adbPath, serial, ['shell', 'wm', 'dismiss-keyguard']);
    await runAdbAllowFailure(adbPath, serial, ['shell', 'input', 'keyevent', '3']);
    await sleep(500);

    if (route) {
        const url = buildDeepLinkUrl(route, customUrlScheme);
        await runAdb(adbPath, serial, [
            'shell',
            'am',
            'start',
            '-W',
            '-a',
            'android.intent.action.VIEW',
            '-d',
            url,
            appId,
        ]);
        return;
    }

    await runAdb(adbPath, serial, ['shell', 'monkey', '-p', appId, '-c', 'android.intent.category.LAUNCHER', '1']);
};

const collectDeviceInfo = async (adbPath, serial) => {
    const commands = {
        manufacturer: ['shell', 'getprop', 'ro.product.manufacturer'],
        model: ['shell', 'getprop', 'ro.product.model'],
        androidRelease: ['shell', 'getprop', 'ro.build.version.release'],
        androidSdk: ['shell', 'getprop', 'ro.build.version.sdk'],
        webViewProviderSetting: ['shell', 'settings', 'get', 'global', 'webview_provider'],
        webViewProviderCurrent: ['shell', 'cmd', 'webviewupdate', 'getCurrentWebViewPackage'],
    };

    const entries = await Promise.all(Object.entries(commands).map(async ([key, commandArgs]) => {
        const result = await runAdbAllowFailure(adbPath, serial, commandArgs);
        return [key, (result.stdout || result.stderr || '').trim()];
    }));

    return Object.fromEntries(entries);
};

const toSummaryText = (summary) => [
    `status=${summary.status}`,
    `serial=${summary.device.serial}`,
    `device=${summary.device.manufacturer} ${summary.device.model}`.trim(),
    `android=${summary.device.androidRelease} (sdk ${summary.device.androidSdk})`,
    `webViewPackage=${summary.webView.packageName || '(unknown)'}`,
    `webViewVersion=${summary.webView.versionName || '(unknown)'}`,
    `webViewMajor=${summary.webView.majorVersion ?? '(unknown)'}`,
    `baselineSatisfied=${summary.webView.baselineSatisfied ? 'true' : 'false'}`,
    `blackScreenSuspected=${summary.analysis.blackScreenSuspected ? 'true' : 'false'}`,
    `nearBlackRatio=${summary.analysis.nearBlackRatio}`,
    `friendlyPromptDetected=${summary.analysis.friendlyPromptDetected ? 'true' : 'false'}`,
    `cdpAttempted=${summary.launch.cdpNavigation?.attempted ? 'true' : 'false'}`,
    `cdpSucceeded=${summary.launch.cdpNavigation?.succeeded ? 'true' : 'false'}`,
    `cdpFinalUrl=${summary.launch.cdpNavigation?.finalUrl || '(unknown)'}`,
    `screenshot=${summary.artifacts.screenshot}`,
    `webviewCdpScreenshot=${summary.launch.cdpNavigation?.screenshot || '(none)'}`,
    `uiDump=${summary.artifacts.uiDump}`,
    `logcat=${summary.artifacts.logcat}`,
].join('\n');

const main = async () => {
    if (hasFlag('help') || hasFlag('h')) {
        printUsage();
        return;
    }

    const sdkRoot = resolveAndroidSdkRoot();
    const adbPath = resolveSdkBinary(sdkRoot, path.join('platform-tools', 'adb'));
    const emulatorPath = resolveSdkBinary(sdkRoot, path.join('emulator', 'emulator'));
    const serialArg = readArgValue('serial', '').trim();
    const avdArg = readArgValue('avd', '').trim();
    const appId = readArgValue('app-id', defaultAppId).trim() || defaultAppId;
    const route = readArgValue('route', '').trim();
    const customUrlScheme = readArgValue('custom-url-scheme', defaultCustomUrlScheme).trim() || defaultCustomUrlScheme;
    const skipInstall = hasFlag('skip-install');
    const keepEmulator = hasFlag('keep-emulator');
    const bootTimeoutMs = Number.parseInt(readArgValue('boot-timeout-ms', String(DEFAULT_ANDROID_COMPAT_BOOT_TIMEOUT_MS)), 10);
    const launchDelayMs = Number.parseInt(readArgValue('launch-delay-ms', String(DEFAULT_ANDROID_COMPAT_LAUNCH_DELAY_MS)), 10);
    const minWebViewMajor = Number.parseInt(readArgValue('min-webview-major', String(DEFAULT_ANDROID_COMPAT_MIN_WEBVIEW_MAJOR)), 10);
    const outputDir = path.resolve(
        rootDir,
        readArgValue('output-dir', path.join(DEFAULT_ANDROID_COMPAT_OUTPUT_ROOT, timestampForPath())),
    );
    const apkPath = path.resolve(rootDir, readArgValue('apk', resolveDefaultApk()));
    const metadata = createCompatSmokeMetadata({
        serial: serialArg,
        avd: avdArg,
        route,
        skipInstall,
        keepEmulator,
        minWebViewMajor,
        launchDelayMs,
        bootTimeoutMs,
    });
    const command = process.argv.join(' ');
    const taskGuard = acquireTaskGuard({
        name: 'android-compat-smoke',
        command,
        metadata,
    });
    let globalBudgetHandle = null;

    try {
        globalBudgetHandle = await acquireGlobalHeavyBudget({
            group: 'android-compat',
            weight: 2,
            command,
            metadata,
        });
        ensureDirectory(outputDir);

        const resolvedTarget = await resolveCompatDeviceTarget({
            adbPath,
            emulatorPath,
            serialArg,
            avdArg,
            bootTimeoutMs,
        });
        const serial = resolvedTarget.serial;
        const startedEmulator = resolvedTarget.startedEmulator;

        await waitForBootCompleted(adbPath, serial, bootTimeoutMs);
        await waitForDeviceOnline(adbPath, serial, Math.min(bootTimeoutMs, 120000));
        writeTextFile(path.join(outputDir, 'device-serial.txt'), `${serial}\n`);

        if (!skipInstall) {
            await runAdb(adbPath, serial, ['install', '-r', apkPath]);
        }

        await runAdbAllowFailure(adbPath, serial, ['logcat', '-c']);
        await launchApp(adbPath, serial, appId);
        await sleep(launchDelayMs);
        let cdpNavigation = route
            ? await driveRouteInWebView(adbPath, serial, appId, route, outputDir, launchDelayMs)
            : {
                attempted: false,
                succeeded: false,
                reason: '',
            };
        if (route && !cdpNavigation.succeeded) {
            await launchApp(adbPath, serial, appId, { route, customUrlScheme });
            await sleep(Math.min(launchDelayMs, 5000));
            cdpNavigation = await driveRouteInWebView(adbPath, serial, appId, route, outputDir, launchDelayMs);
        }
        if (cdpNavigation.attempted && cdpNavigation.succeeded) {
            await sleep(2000);
        }
        await dismissImmersiveClingIfPresent(adbPath, serial, outputDir);

        const screenshotPath = path.join(outputDir, 'screen.png');
        await captureScreenshot(adbPath, serial, screenshotPath);
        const uiDumpText = await dumpUiHierarchy(adbPath, serial, outputDir);
        const logcatResult = await runAdbAllowFailure(adbPath, serial, ['logcat', '-d', '-v', 'time']);
        const logcatPath = path.join(outputDir, 'logcat.txt');
        writeTextFile(logcatPath, logcatResult.stdout || logcatResult.stderr || '');

        const deviceInfo = await collectDeviceInfo(adbPath, serial);
        const webViewDump = await collectPackageDump(adbPath, serial, 'com.google.android.webview', outputDir);
        const chromeDump = await collectPackageDump(adbPath, serial, 'com.android.chrome', outputDir);
        const trichromeDump = await collectPackageDump(adbPath, serial, 'com.google.android.trichromelibrary', outputDir);
        const screenshotAnalysis = await analyzeScreenshotFile(screenshotPath);
        const uiStrings = extractUiStrings(uiDumpText);
        const providerText = deviceInfo.webViewProviderCurrent || deviceInfo.webViewProviderSetting || webViewDump || chromeDump;
        const currentVersionName = parsePackageVersionName(providerText)
            || parsePackageVersionName(webViewDump)
            || parsePackageVersionName(chromeDump)
            || parsePackageVersionName(trichromeDump);
        const currentMajorVersion = parseMajorVersion(currentVersionName);
        const currentProviderPackage = (() => {
            const providerMatch = providerText.match(/\(([^,]+),/);
            if (providerMatch?.[1]) {
                return providerMatch[1].trim();
            }
            if (deviceInfo.webViewProviderSetting && deviceInfo.webViewProviderSetting !== 'null') {
                return deviceInfo.webViewProviderSetting;
            }
            return currentVersionName ? 'com.google.android.webview' : '';
        })();

        const friendlyPromptDetected = detectFriendlyPrompt(uiStrings);
        const baselineSatisfied = currentMajorVersion === null ? false : currentMajorVersion >= minWebViewMajor;
        const status = screenshotAnalysis.blackScreenSuspected && !friendlyPromptDetected
            ? 'suspected-black-screen'
            : friendlyPromptDetected
                ? 'friendly-fallback-visible'
                : 'visible-ui';

        const summary = {
            status,
            device: {
                serial,
                manufacturer: deviceInfo.manufacturer || '',
                model: deviceInfo.model || '',
                androidRelease: deviceInfo.androidRelease || '',
                androidSdk: deviceInfo.androidSdk || '',
            },
            webView: {
                packageName: currentProviderPackage,
                versionName: currentVersionName,
                majorVersion: currentMajorVersion,
                baselineSatisfied,
                requiredMinimumMajor: minWebViewMajor,
            },
            launch: {
                route,
                customUrlScheme,
                cdpNavigation,
            },
            analysis: {
                ...screenshotAnalysis,
                uiStringSample: uiStrings.slice(0, 20),
                friendlyPromptDetected,
            },
            artifacts: {
                outputDir,
                screenshot: screenshotPath,
                uiDump: path.join(outputDir, 'window_dump.xml'),
                logcat: logcatPath,
                webViewDump: path.join(outputDir, 'com_google_android_webview.txt'),
                chromeDump: path.join(outputDir, 'com_android_chrome.txt'),
                trichromeDump: path.join(outputDir, 'com_google_android_trichromelibrary.txt'),
            },
        };

        writeTextFile(path.join(outputDir, 'summary.json'), `${JSON.stringify(summary, null, 2)}\n`);
        writeTextFile(path.join(outputDir, 'summary.txt'), `${toSummaryText(summary)}\n`);

        console.log(`Android smoke 输出目录: ${outputDir}`);
        console.log(toSummaryText(summary));

        if (startedEmulator && !keepEmulator) {
            await runAdbAllowFailure(adbPath, serial, ['emu', 'kill']);
        }

        if (!baselineSatisfied) {
            throw new Error(`当前 WebView/Chrome 主版本 ${currentMajorVersion ?? 'unknown'} 低于要求 ${minWebViewMajor}。`);
        }

        if (status === 'suspected-black-screen') {
            throw new Error('截图分析疑似黑屏，且 UI dump 未检测到友好提示。');
        }
    } finally {
        globalBudgetHandle?.release();
        taskGuard.release();
    }
};

main().catch(async (error) => {
    console.error(`[android-compat-smoke] ${error instanceof Error ? error.message : String(error)}`);
    process.exit(1);
});
