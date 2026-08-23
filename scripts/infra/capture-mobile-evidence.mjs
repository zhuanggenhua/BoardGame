#!/usr/bin/env node

import { spawnSync } from 'node:child_process';
import { existsSync, readdirSync } from 'node:fs';
import path from 'node:path';
import { E2E_SINGLE_WORKER_PORTS } from './e2e-port-config.js';

const repoRoot = process.cwd();
const PHONE_LANDSCAPE_VIEWPORT = { width: 936, height: 432 };
const TABLET_LANDSCAPE_VIEWPORT = { width: 1024, height: 768 };
const DEFAULT_VITE_PORT = String(E2E_SINGLE_WORKER_PORTS.frontend);

const scenarioMap = {
    'betrayal-tutorial-phone-landscape': {
        route: '/play/betrayal/tutorial/basic-setup-and-turn',
        output: 'test-results/evidence-screenshots/betrayal/山屋惊魂-教程移动端横屏验收/01-手机横屏-教程书本使用入口.png',
        ...PHONE_LANDSCAPE_VIEWPORT,
        forceCoarsePointer: true,
    },
    'betrayal-tutorial-mobile-landscape': {
        route: '/play/betrayal/tutorial/basic-setup-and-turn',
        output: 'test-results/evidence-screenshots/betrayal/山屋惊魂-教程移动端横屏验收/01-手机横屏-教程书本使用入口.png',
        ...PHONE_LANDSCAPE_VIEWPORT,
        forceCoarsePointer: true,
    },
    'smashup-tutorial-mobile-landscape': {
        route: '/play/smashup/tutorial',
        output: 'test-results/evidence-screenshots/smashup/smashup-tutorial.e2e/手机横屏下教程浮层不应跑出视口/tutorial-mobile-landscape.png',
        ...PHONE_LANDSCAPE_VIEWPORT,
        forceCoarsePointer: true,
    },
    'summonerwars-tutorial-phone-landscape': {
        route: '/play/summonerwars/tutorial',
        output: 'test-results/evidence-screenshots/summonerwars/summonerwars.e2e/移动横屏：触屏放大入口与阶段说明在手机和平板都可达/10-phone-landscape-board.png',
        ...PHONE_LANDSCAPE_VIEWPORT,
        forceCoarsePointer: true,
    },
    'summonerwars-mobile-10-phone-landscape-board': {
        route: '/play/summonerwars/tutorial',
        output: 'test-results/evidence-screenshots/summonerwars/summonerwars.e2e/移动横屏：触屏放大入口与阶段说明在手机和平板都可达/10-phone-landscape-board.png',
        ...PHONE_LANDSCAPE_VIEWPORT,
        forceCoarsePointer: true,
    },
    'summonerwars-mobile-11-hand-magnify-open': {
        route: '/play/summonerwars/tutorial',
        output: 'test-results/evidence-screenshots/summonerwars/summonerwars.e2e/移动横屏：触屏放大入口与阶段说明在手机和平板都可达/11-phone-hand-magnify-open.png',
        ...PHONE_LANDSCAPE_VIEWPORT,
        forceCoarsePointer: true,
    },
    'summonerwars-mobile-12-phase-detail-open': {
        route: '/play/summonerwars/tutorial',
        output: 'test-results/evidence-screenshots/summonerwars/summonerwars.e2e/移动横屏：触屏放大入口与阶段说明在手机和平板都可达/12-phone-phase-detail-open.png',
        ...PHONE_LANDSCAPE_VIEWPORT,
        forceCoarsePointer: true,
    },
    'summonerwars-mobile-13-action-log-open': {
        route: '/play/summonerwars/tutorial',
        output: 'test-results/evidence-screenshots/summonerwars/summonerwars.e2e/移动横屏：触屏放大入口与阶段说明在手机和平板都可达/13-phone-action-log-open.png',
        ...PHONE_LANDSCAPE_VIEWPORT,
        forceCoarsePointer: true,
    },
    'summonerwars-mobile-20-tablet-landscape-board': {
        route: '/play/summonerwars/tutorial',
        output: 'test-results/evidence-screenshots/summonerwars/summonerwars.e2e/移动横屏：触屏放大入口与阶段说明在手机和平板都可达/20-tablet-landscape-board.png',
        ...TABLET_LANDSCAPE_VIEWPORT,
        forceCoarsePointer: true,
    },
    'smashup-4p-mobile-attached-actions': {
        route: '/play/smashup?numPlayers=4&skipFactionSelect=true&skipInitialization=true',
        output: 'test-results/evidence-screenshots/smashup/smashup-4p-layout-test.e2e/移动端横屏应保持四人局布局可用，并支持手牌长按看牌/05-mobile-single-tap-expands-attached-actions.png',
        ...PHONE_LANDSCAPE_VIEWPORT,
        forceCoarsePointer: true,
    },
    'smashup-4p-mobile-05-attached-actions': {
        route: '/play/smashup?numPlayers=4&skipFactionSelect=true&skipInitialization=true',
        output: 'test-results/evidence-screenshots/smashup/smashup-4p-layout-test.e2e/移动端横屏应保持四人局布局可用，并支持手牌长按看牌/05-mobile-single-tap-expands-attached-actions.png',
        ...PHONE_LANDSCAPE_VIEWPORT,
        forceCoarsePointer: true,
    },
    'smashup-4p-mobile-07-minion-long-press': {
        route: '/play/smashup?numPlayers=4&skipFactionSelect=true&skipInitialization=true',
        output: 'test-results/evidence-screenshots/smashup/smashup-4p-layout-test.e2e/移动端横屏应保持四人局布局可用，并支持手牌长按看牌/07-mobile-minion-long-press-magnify.png',
        ...PHONE_LANDSCAPE_VIEWPORT,
        forceCoarsePointer: true,
    },
    'smashup-4p-mobile-08-base-long-press': {
        route: '/play/smashup?numPlayers=4&skipFactionSelect=true&skipInitialization=true',
        output: 'test-results/evidence-screenshots/smashup/smashup-4p-layout-test.e2e/移动端横屏应保持四人局布局可用，并支持手牌长按看牌/08-mobile-base-long-press-magnify.png',
        ...PHONE_LANDSCAPE_VIEWPORT,
        forceCoarsePointer: true,
    },
    'smashup-4p-mobile-09-base-ongoing-long-press': {
        route: '/play/smashup?numPlayers=4&skipFactionSelect=true&skipInitialization=true',
        output: 'test-results/evidence-screenshots/smashup/smashup-4p-layout-test.e2e/移动端横屏应保持四人局布局可用，并支持手牌长按看牌/09-mobile-base-ongoing-long-press-magnify.png',
        ...PHONE_LANDSCAPE_VIEWPORT,
        forceCoarsePointer: true,
    },
    'smashup-4p-mobile-10-attached-action-long-press': {
        route: '/play/smashup?numPlayers=4&skipFactionSelect=true&skipInitialization=true',
        output: 'test-results/evidence-screenshots/smashup/smashup-4p-layout-test.e2e/移动端横屏应保持四人局布局可用，并支持手牌长按看牌/10-mobile-attached-action-long-press-magnify.png',
        ...PHONE_LANDSCAPE_VIEWPORT,
        forceCoarsePointer: true,
    },
    'smashup-4p-mobile-11-hand-long-press': {
        route: '/play/smashup?numPlayers=4&skipFactionSelect=true&skipInitialization=true',
        output: 'test-results/evidence-screenshots/smashup/smashup-4p-layout-test.e2e/移动端横屏应保持四人局布局可用，并支持手牌长按看牌/11-mobile-hand-long-press-magnify.png',
        ...PHONE_LANDSCAPE_VIEWPORT,
        forceCoarsePointer: true,
    },
    'smashup-4p-mobile-12-tablet-landscape': {
        route: '/play/smashup?numPlayers=4&skipFactionSelect=true&skipInitialization=true',
        output: 'test-results/evidence-screenshots/smashup/smashup-4p-layout-test.e2e/移动端横屏应保持四人局布局可用，并支持手牌长按看牌/12-tablet-landscape-layout.png',
        ...TABLET_LANDSCAPE_VIEWPORT,
        forceCoarsePointer: true,
    },
};

function printUsage() {
    console.log(`用法: npm run capture:mobile:evidence -- --scenario <场景名> [--browserPath <浏览器路径>] [--vitePort ${DEFAULT_VITE_PORT}] [--timeoutSeconds 90]`);
    console.log('支持场景:');
    for (const scenario of Object.keys(scenarioMap)) {
        console.log(`- ${scenario}`);
    }
}

function parseArgs(argv) {
    const options = {
        scenario: '',
        browserPath: '',
        vitePort: DEFAULT_VITE_PORT,
        timeoutSeconds: '90',
    };

    for (let index = 0; index < argv.length; index += 1) {
        const arg = argv[index];
        const next = argv[index + 1];

        if (arg === '--help' || arg === '-h') {
            options.help = true;
            continue;
        }

        if ((arg === '--scenario' || arg === '-Scenario') && next) {
            options.scenario = next.trim();
            index += 1;
            continue;
        }

        if (arg.startsWith('--scenario=')) {
            options.scenario = arg.slice('--scenario='.length).trim();
            continue;
        }

        if (arg === '--browserPath' && next) {
            options.browserPath = next.trim();
            index += 1;
            continue;
        }

        if (arg.startsWith('--browserPath=')) {
            options.browserPath = arg.slice('--browserPath='.length).trim();
            continue;
        }

        if (arg === '--vitePort' && next) {
            options.vitePort = next.trim();
            index += 1;
            continue;
        }

        if (arg.startsWith('--vitePort=')) {
            options.vitePort = arg.slice('--vitePort='.length).trim();
            continue;
        }

        if (arg === '--timeoutSeconds' && next) {
            options.timeoutSeconds = next.trim();
            index += 1;
            continue;
        }

        if (arg.startsWith('--timeoutSeconds=')) {
            options.timeoutSeconds = arg.slice('--timeoutSeconds='.length).trim();
            continue;
        }

        if (!arg.startsWith('-') && !options.scenario) {
            options.scenario = arg.trim();
        }
    }

    return options;
}

function resolveBrowserPath(preferredPath) {
    if (preferredPath) {
        return preferredPath;
    }

    const candidates = [
        'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
        'C:\\Program Files (x86)\\Google\\Chrome\\Application\\chrome.exe',
        'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe',
        'C:\\Program Files\\Microsoft\\Edge\\Application\\msedge.exe',
    ];

    return candidates.find(candidate => existsSync(candidate)) ?? candidates[0];
}

function resolveHeadlessShellPath() {
    const localAppData = process.env.LOCALAPPDATA;
    if (!localAppData) {
        return '';
    }

    const playwrightRoot = path.join(localAppData, 'ms-playwright');
    if (!existsSync(playwrightRoot)) {
        return '';
    }

    const candidates = readdirSync(playwrightRoot, { withFileTypes: true })
        .filter((entry) => entry.isDirectory() && entry.name.startsWith('chromium_headless_shell-'))
        .map((entry) => path.join(
            playwrightRoot,
            entry.name,
            'chrome-headless-shell-win64',
            'chrome-headless-shell.exe',
        ))
        .filter((candidate) => existsSync(candidate))
        .sort((left, right) => right.localeCompare(left));

    return candidates[0] ?? '';
}

function buildCaptureUrl(route, scenario, port) {
    const separator = route.includes('?') ? '&' : '?';
    return `http://127.0.0.1:${port}${route}${separator}bgCapture=${encodeURIComponent(scenario)}`;
}

const options = parseArgs(process.argv.slice(2));

if (options.help) {
    printUsage();
    process.exit(0);
}

if (!options.scenario || !(options.scenario in scenarioMap)) {
    printUsage();
    process.exit(1);
}

const config = scenarioMap[options.scenario];
const browserPath = resolveBrowserPath(options.browserPath);
const headlessShellPath = resolveHeadlessShellPath();
const outputPath = path.resolve(repoRoot, config.output);
const browserScriptPath = path.resolve(repoRoot, 'scripts/infra/capture-mobile-evidence-browser.ps1');
const captureUrl = buildCaptureUrl(config.route, options.scenario, options.vitePort);

const powershellArgs = [
    '-ExecutionPolicy', 'Bypass',
    '-File', browserScriptPath,
    '-Port', options.vitePort,
    '-Url', captureUrl,
    '-OutputPath', outputPath,
    '-Root', repoRoot,
    '-EdgePath', browserPath,
    '-HeadlessShellPath', headlessShellPath,
    '-ReadyTimeoutSec', '30',
    '-CaptureTimeoutSec', options.timeoutSeconds,
    '-WindowWidth', String(config.width),
    '-WindowHeight', String(config.height),
];

if (config.forceCoarsePointer) {
    powershellArgs.push('-ForceCoarsePointer');
}

console.log(`[capture-mobile-evidence] 场景: ${options.scenario}`);
console.log(`[capture-mobile-evidence] 输出文件: ${outputPath}`);
console.log(`[capture-mobile-evidence] GUI 浏览器: ${browserPath}`);
if (headlessShellPath) {
    console.log(`[capture-mobile-evidence] headless-shell: ${headlessShellPath}`);
}

const result = spawnSync('powershell.exe', powershellArgs, {
    cwd: repoRoot,
    stdio: 'inherit',
    shell: false,
});

if (result.error) {
    throw result.error;
}

process.exit(typeof result.status === 'number' ? result.status : 1);
