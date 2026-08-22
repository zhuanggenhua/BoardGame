#!/usr/bin/env node
import { spawn } from 'node:child_process';
import { readFile, readdir } from 'node:fs/promises';
import process from 'node:process';
import { createInterface } from 'node:readline/promises';
import { pathToFileURL } from 'node:url';

const rootDir = process.cwd();
const rawArgs = process.argv.slice(2);

const helpText = `
自动发布游戏更新日志

用法:
  node scripts/release/publish-game-changelog.mjs [选项]

默认行为:
  1. 优先读取当前分支相对上游的未推送提交范围
  2. 若没有未推送提交，则退回最近一笔提交（可用 --no-last-commit-fallback 禁止）
  3. 根据改动路径识别受影响游戏
  4. 默认跳过 manifest 标记为实施中的游戏
  5. 根据提交信息生成 Steam 风格更新日志
  6. 通过 /auth/login 获取 JWT，再调用 /admin-api/game-changelogs 创建日志

常用示例:
  npm run release:game-changelog -- --dry-run
  npm run release:game-changelog -- --game dicethrone --summary "修复不可防御伤害错误打开防御减伤窗口"
  npm run release:game-changelog -- --range origin/main..HEAD --published=false

选项:
  --dry-run                    只输出将创建的日志，不登录也不写后台
  --range <gitRange>           指定提交范围，例如 origin/main..HEAD
  --base <ref>                 与 --head 组合为 <base>..<head>
  --head <ref>                 提交范围终点，默认 HEAD
  --commit <sha>               使用单个提交，等价于 <sha>^..<sha>
  --no-last-commit-fallback    没有未推送提交时不退回最近一笔提交
  --game <id>                  手动指定游戏，可重复或用逗号分隔
  --include-under-construction 显式允许为实施中游戏生成公开日志
  --summary <text>             手动指定更新摘要
  --type <fix|feature|improve|change>
                               手动摘要归类，默认 change
  --title <text>               手动指定标题
  --content <text>             手动指定正文
  --content-file <path>        从文件读取正文
  --version <label>            版本号标签，默认 package.json version
  --published=<true|false>     是否直接发布，默认 true；也可用 --draft
  --pinned=<true|false>        是否置顶，默认 false
  --api-base-url <url>         API 基础地址，默认 BG_CHANGELOG_API_BASE_URL 或 http://127.0.0.1:18001
  --account <email>            后台账号；默认 BG_CHANGELOG_ACCOUNT / BG_ADMIN_EMAIL / ADMIN_EMAIL
  --password <password>        后台密码；默认 BG_CHANGELOG_PASSWORD / BG_ADMIN_PASSWORD / ADMIN_PASSWORD
  --no-prompt                  缺少账号密码时直接失败，不交互询问
  --skip-duplicate-check       不查询后台重复日志
`.trim();

const sectionLabels = {
    fix: '修复',
    feature: '新增',
    improve: '优化',
    change: '调整',
};

const sectionOrder = ['修复', '新增', '优化', '调整'];

const fallbackGameNames = {
    betrayal: '山屋惊魂',
    cardia: '卡迪亚',
    dicethrone: '王权骰铸',
    fantasyrealms: '奇幻国度',
    qidahen: '七大恨',
    smashup: '大杀四方',
    splendor: '璀璨宝石',
    summonerwars: '召唤师战争',
    'the-gang': '帮派',
    tictactoe: '井字棋',
};

const gameAliases = {
    betrayal: ['betrayal', '山屋惊魂'],
    dicethrone: ['dicethrone', 'dice throne', '王权骰铸'],
    smashup: ['smashup', 'smash up', '大杀四方'],
    summonerwars: ['summonerwars', 'summoner wars', '召唤师战争'],
    'the-gang': ['the-gang', 'the gang', '纸牌帮', '帮派'],
};

const readArgValue = (args, name, fallback = '') => {
    const prefix = `--${name}=`;
    const direct = args.find((arg) => arg.startsWith(prefix));
    if (direct) {
        return direct.slice(prefix.length);
    }
    const index = args.findIndex((arg) => arg === `--${name}`);
    if (index >= 0 && args[index + 1] && !args[index + 1].startsWith('--')) {
        return args[index + 1];
    }
    return fallback;
};

const readArgValues = (args, name) => {
    const values = [];
    const prefix = `--${name}=`;
    for (let index = 0; index < args.length; index += 1) {
        const arg = args[index];
        if (arg.startsWith(prefix)) {
            values.push(arg.slice(prefix.length));
            continue;
        }
        if (arg === `--${name}` && args[index + 1] && !args[index + 1].startsWith('--')) {
            values.push(args[index + 1]);
            index += 1;
        }
    }
    return values
        .flatMap((value) => value.split(','))
        .map((value) => value.trim())
        .filter(Boolean);
};

const hasFlag = (args, name) => args.includes(`--${name}`);

const parseBoolean = (value, fallback) => {
    if (value === undefined || value === null || value === '') {
        return fallback;
    }
    const normalized = String(value).trim().toLowerCase();
    if (['1', 'true', 'yes', 'y', 'on'].includes(normalized)) return true;
    if (['0', 'false', 'no', 'n', 'off'].includes(normalized)) return false;
    throw new Error(`布尔值只能是 true/false，当前值: ${value}`);
};

export const parsePublishOptions = (args = rawArgs, env = process.env) => {
    const publishedArg = readArgValue(args, 'published', '');
    const pinnedArg = readArgValue(args, 'pinned', '');
    const type = readArgValue(args, 'type', 'change');
    if (!Object.keys(sectionLabels).includes(type)) {
        throw new Error(`--type 只支持 ${Object.keys(sectionLabels).join(' | ')}，当前值: ${type}`);
    }

    return {
        dryRun: hasFlag(args, 'dry-run'),
        noPrompt: hasFlag(args, 'no-prompt'),
        skipDuplicateCheck: hasFlag(args, 'skip-duplicate-check'),
        noLastCommitFallback: hasFlag(args, 'no-last-commit-fallback'),
        includeUnderConstruction: hasFlag(args, 'include-under-construction'),
        range: readArgValue(args, 'range', ''),
        base: readArgValue(args, 'base', ''),
        head: readArgValue(args, 'head', 'HEAD'),
        commit: readArgValue(args, 'commit', ''),
        games: readArgValues(args, 'game').map(normalizeGameId).filter(Boolean),
        summary: readArgValue(args, 'summary', '').trim(),
        type,
        title: readArgValue(args, 'title', '').trim(),
        content: readArgValue(args, 'content', '').trim(),
        contentFile: readArgValue(args, 'content-file', '').trim(),
        versionLabel: readArgValue(args, 'version', env.BG_CHANGELOG_VERSION || env.npm_package_version || '').trim(),
        published: hasFlag(args, 'draft')
            ? false
            : parseBoolean(publishedArg || env.BG_CHANGELOG_PUBLISH, true),
        pinned: parseBoolean(pinnedArg || env.BG_CHANGELOG_PINNED, false),
        apiBaseUrl: trimTrailingSlash(
            readArgValue(
                args,
                'api-base-url',
                env.BG_CHANGELOG_API_BASE_URL || env.VITE_BACKEND_URL || 'http://127.0.0.1:18001',
            ),
        ),
        account: readArgValue(args, 'account', env.BG_CHANGELOG_ACCOUNT || env.BG_ADMIN_EMAIL || env.ADMIN_EMAIL || '').trim(),
        password: readArgValue(args, 'password', env.BG_CHANGELOG_PASSWORD || env.BG_ADMIN_PASSWORD || env.ADMIN_PASSWORD || ''),
    };
};

const trimTrailingSlash = (value) => value.replace(/\/+$/, '');

export const normalizeGameId = (value) => value.trim().toLowerCase();

const normalizePath = (value) => value.replace(/\\/g, '/').replace(/^\.?\//, '');

const gameIdFromPath = (filePath) => {
    const normalized = normalizePath(filePath);
    const directGame = normalized.match(/^src\/games\/([^/]+)\//);
    if (directGame) return directGame[1];

    const e2eGame = normalized.match(/^e2e\/([^/]+)/);
    if (e2eGame) return e2eGame[1];

    const docsGame = normalized.match(/^docs\/games\/([^/]+)/);
    if (docsGame) return docsGame[1];

    const localeGame = normalized.match(/^public\/locales\/[^/]+\/game-([^/]+)\.json$/);
    if (localeGame) return localeGame[1];

    const directAssetGame = normalized.match(/^public\/assets\/([^/]+)/);
    if (directAssetGame && !['common', 'i18n', 'rules', 'atlas-configs'].includes(directAssetGame[1])) {
        return directAssetGame[1];
    }

    const i18nAssetGame = normalized.match(/^public\/assets\/i18n\/[^/]+\/([^/]+)/);
    if (i18nAssetGame) return i18nAssetGame[1];

    return '';
};

export const detectGameIdsFromPaths = (paths, explicitGames = []) => {
    const explicitIds = explicitGames.map(normalizeGameId).filter(Boolean);
    if (explicitIds.length > 0) {
        return [...new Set(explicitIds)].sort((a, b) => a.localeCompare(b));
    }

    const ids = new Set();
    for (const filePath of paths) {
        const gameId = gameIdFromPath(filePath);
        if (gameId && gameId !== '__tests__') {
            ids.add(normalizeGameId(gameId));
        }
    }
    return [...ids].sort((a, b) => a.localeCompare(b));
};

export const filterPublishableGameIds = (
    gameIds,
    underConstructionGameIds,
    { includeUnderConstruction = false } = {},
) => {
    const normalizedGameIds = [...new Set(gameIds.map(normalizeGameId).filter(Boolean))]
        .sort((a, b) => a.localeCompare(b));
    if (includeUnderConstruction) {
        return { gameIds: normalizedGameIds, skippedGameIds: [] };
    }

    const underConstruction = new Set(underConstructionGameIds.map(normalizeGameId).filter(Boolean));
    const publishableIds = [];
    const skippedGameIds = [];
    for (const gameId of normalizedGameIds) {
        if (underConstruction.has(gameId)) {
            skippedGameIds.push(gameId);
            continue;
        }
        publishableIds.push(gameId);
    }
    return { gameIds: publishableIds, skippedGameIds };
};

export const loadUnderConstructionGameIds = async () => {
    const gamesDir = 'src/games';
    let entries = [];
    try {
        entries = await readdir(gamesDir, { withFileTypes: true });
    } catch {
        return [];
    }

    const ids = [];
    await Promise.all(entries
        .filter((entry) => entry.isDirectory())
        .map(async (entry) => {
            try {
                const manifest = await readFile(`${gamesDir}/${entry.name}/manifest.ts`, 'utf8');
                if (/statusTag\s*:\s*['"`]under_construction['"`]/.test(manifest)) {
                    ids.push(normalizeGameId(entry.name));
                }
            } catch {
                // Some src/games folders are shared helpers rather than concrete games.
            }
        }));
    return [...new Set(ids)].sort((a, b) => a.localeCompare(b));
};

const runCommandCapture = (command, args, label, { allowFailure = false } = {}) => new Promise((resolve, reject) => {
    const child = spawn(command, args, {
        cwd: rootDir,
        env: process.env,
        stdio: ['ignore', 'pipe', 'pipe'],
        windowsHide: true,
        shell: false,
    });
    let stdout = '';
    let stderr = '';
    child.stdout.on('data', (chunk) => {
        stdout += chunk.toString();
    });
    child.stderr.on('data', (chunk) => {
        stderr += chunk.toString();
    });
    child.on('exit', (code) => {
        if (code === 0) {
            resolve({ stdout, stderr, code });
            return;
        }
        if (allowFailure) {
            resolve({ stdout, stderr, code });
            return;
        }
        reject(new Error(`${label} 失败，退出码: ${code ?? 'unknown'}: ${stderr.trim() || stdout.trim()}`));
    });
    child.on('error', reject);
});

const runGitCapture = (args, label, options) => runCommandCapture('git', args, label, options);

const getChangedPathsForRange = async (range) => {
    const { stdout } = await runGitCapture(['diff', '--name-only', range], `读取提交范围改动 ${range}`);
    return stdout.split(/\r?\n/).map((line) => line.trim()).filter(Boolean);
};

const resolveDefaultRange = async (options) => {
    if (options.range) {
        return {
            range: options.range,
            source: 'manual-range',
            paths: await getChangedPathsForRange(options.range),
        };
    }

    if (options.commit) {
        const range = `${options.commit}^..${options.commit}`;
        return {
            range,
            source: 'manual-commit',
            paths: await getChangedPathsForRange(range),
        };
    }

    if (options.base) {
        const range = `${options.base}..${options.head || 'HEAD'}`;
        return {
            range,
            source: 'manual-base',
            paths: await getChangedPathsForRange(range),
        };
    }

    const upstream = await runGitCapture(
        ['rev-parse', '--abbrev-ref', '--symbolic-full-name', '@{u}'],
        '读取当前分支上游',
        { allowFailure: true },
    );
    const upstreamRef = upstream.code === 0 ? upstream.stdout.trim() : '';
    if (upstreamRef) {
        const range = `${upstreamRef}..HEAD`;
        const paths = await getChangedPathsForRange(range);
        if (paths.length > 0) {
            return { range, source: 'unpushed', paths };
        }
    }

    if (options.noLastCommitFallback) {
        throw new Error('当前没有检测到未推送提交；请指定 --range/--commit，或去掉 --no-last-commit-fallback。');
    }

    const hasParent = await runGitCapture(
        ['rev-parse', '--verify', 'HEAD~1'],
        '确认最近提交父提交',
        { allowFailure: true },
    );
    if (hasParent.code !== 0) {
        throw new Error('无法自动确定提交范围；请使用 --range 或 --commit 指定。');
    }

    const range = 'HEAD~1..HEAD';
    return {
        range,
        source: upstreamRef ? 'last-commit-fallback-after-upstream-empty' : 'last-commit-fallback-no-upstream',
        paths: await getChangedPathsForRange(range),
    };
};

const getCommitMessages = async (range) => {
    const { stdout } = await runGitCapture(['log', '--reverse', '--format=%s%n%b', range], `读取提交信息 ${range}`);
    return Array.from(new Set(
        stdout
            .split(/\r?\n/)
            .map((line) => cleanCommitMessage(line))
            .filter(Boolean)
            .filter((line) => !/^co-authored-by:/i.test(line)),
    ));
};

const cleanCommitMessage = (value) => value
    .replace(/^(feat|fix|perf|refactor|test|docs|chore)(\([^)]+\))?:\s*/i, '')
    .replace(/^[a-f0-9]{7,}\s+/i, '')
    .trim();

const playerVisiblePattern = /(fix|bug|修复|新增|添加|增加|上线|支持|开放|优化|改进|改善|体验|稳定|不可防御|减伤|伤害|攻击|能力|目标|骰|资源|布局|加载|交互|响应|友方|筹码|预加载|选择|触发)/i;

const isInternalOnlyMessage = (text) => {
    const lower = text.toLowerCase();
    if (playerVisiblePattern.test(text)) return false;
    return /^(test|docs|chore)(\([^)]+\))?:/i.test(text)
        || /(e2e|lint|eslint|openspec|文档|规范|审计|测试|验证|验收|覆盖|回归用例|门禁|提交|push)/i.test(lower);
};

const classifyText = (text) => {
    if (isInternalOnlyMessage(text)) return '';
    const lower = text.toLowerCase();
    if (/(fix|bug|修复|回归|错误|异常|崩溃|失败|不可防御|减伤窗口)/i.test(lower)) return '修复';
    if (/(feat|新增|添加|增加|上线|支持|开放|功能)/i.test(lower)) return '新增';
    if (/(perf|优化|改进|改善|调整|体验|稳定|超时|部署|ota)/i.test(lower)) return '优化';
    return '调整';
};

const classifyPathFallback = (filePath) => {
    const normalized = normalizePath(filePath).toLowerCase();
    if (/(__tests__|\.test\.|\.spec\.|^e2e\/|^(docs|openspec)\/|\.md$)/.test(normalized)) return '';
    return '调整';
};

const escapeRegExp = (value) => value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

const aliasesForGame = (gameId) => gameAliases[gameId] || [gameId];

const messageMentionsAlias = (message, alias) => message.toLowerCase().includes(alias.toLowerCase());

const shouldUseCommitMessageForGame = (message, gameId) => {
    const currentAliases = aliasesForGame(gameId);
    const mentionsCurrentGame = currentAliases.some((alias) => messageMentionsAlias(message, alias));
    const mentionsOtherGame = Object.entries(gameAliases)
        .filter(([id]) => id !== gameId)
        .some(([, aliases]) => aliases.some((alias) => messageMentionsAlias(message, alias)));
    return mentionsCurrentGame || !mentionsOtherGame;
};

const removeGameContextPrefix = (text, gameId) => {
    const colonIndex = text.search(/[:：]/);
    if (colonIndex < 0) return text;

    const prefix = text.slice(0, colonIndex);
    const mentionsCurrentGame = aliasesForGame(gameId).some((alias) => messageMentionsAlias(prefix, alias));
    return mentionsCurrentGame ? text.slice(colonIndex + 1).trim() : text;
};

const stripInternalClauses = (text) => text
    .split(/[，,；;]/)
    .map((part) => part.trim())
    .filter(Boolean)
    .filter((part) => {
        if (!/(测试|验证|验收|审计|规范|文档|回归覆盖|覆盖|门禁)/i.test(part)) return true;
        return /(修复|修正|优化|改进|改善|新增|支持|开放|上线|接入|正确|提升|解决)/i.test(part);
    })
    .map((part) => part.replace(/(测试|验证|验收|审计|规范|文档|回归覆盖|覆盖|门禁).*$/i, '').trim())
    .filter(Boolean)
    .join('；');

const formatBullet = (message, gameId = '') => {
    const normalized = cleanCommitMessage(message)
        .replace(/^[-*]\s+/, '')
        .replace(/\bE2E\b/gi, '')
        .replace(/合同/g, '规则')
        .replace(/\s+/g, ' ')
        .replace(/[。.;；\s]+$/, '')
        .trim();
    const withoutGamePrefix = aliasesForGame(gameId).reduce(
        (value, alias) => value.replace(new RegExp(`^${escapeRegExp(alias)}\\s*[:：]\\s*`, 'i'), ''),
        removeGameContextPrefix(normalized, gameId),
    );
    return stripInternalClauses(withoutGamePrefix) || '更新游戏内容';
};

const pushGroupedBullet = (groups, section, bullet) => {
    if (!section || !bullet) return;
    if (!groups.has(section)) {
        groups.set(section, []);
    }
    const items = groups.get(section);
    if (!items.includes(bullet)) {
        items.push(bullet);
    }
};

const contentFromGroups = (groups) => sectionOrder
    .filter((section) => groups.has(section))
    .map((section) => [
        `## ${section}`,
        ...groups.get(section).map((item) => `- ${item}`),
    ].join('\n'))
    .join('\n\n');

export const buildChangelogDraft = ({
    gameId,
    gameName,
    changedPaths = [],
    commitMessages = [],
    summary = '',
    type = 'change',
    title = '',
    content = '',
    versionLabel = '',
    published = true,
    pinned = false,
}) => {
    const groups = new Map();
    if (content) {
        const firstLine = content.split(/\r?\n/).map((line) => line.trim()).find(Boolean) || '更新日志';
        return {
            gameId,
            title: title || `${gameName} 更新：${firstLine.replace(/^#+\s*/, '').slice(0, 48)}`,
            versionLabel,
            content,
            published,
            pinned,
        };
    }

    if (summary) {
        pushGroupedBullet(groups, sectionLabels[type] || '调整', formatBullet(summary, gameId));
    }

    for (const message of commitMessages) {
        if (!shouldUseCommitMessageForGame(message, gameId)) continue;
        pushGroupedBullet(groups, classifyText(message), formatBullet(message, gameId));
    }

    if (groups.size === 0) {
        const fallbackSection = changedPaths.map(classifyPathFallback).find(Boolean) || '优化';
        const fileCount = changedPaths.length || 0;
        pushGroupedBullet(
            groups,
            fallbackSection,
            fileCount > 0 ? '提升游戏稳定性与操作体验' : '更新游戏内容',
        );
    }

    const firstBullet = sectionOrder
        .flatMap((section) => groups.get(section) || [])
        .find(Boolean) || '更新游戏内容';
    const titleSource = summary || firstBullet;
    const resolvedTitle = title || `${gameName} 更新：${titleSource.slice(0, 42)}`;
    return {
        gameId,
        title: resolvedTitle,
        versionLabel,
        content: contentFromGroups(groups),
        published,
        pinned,
    };
};

const readJsonIfExists = async (filePath) => {
    try {
        return JSON.parse(await readFile(filePath, 'utf8'));
    } catch {
        return {};
    }
};

const loadGameNames = async () => {
    const [common, lobby] = await Promise.all([
        readJsonIfExists('public/locales/zh-CN/common.json'),
        readJsonIfExists('public/locales/zh-CN/lobby.json'),
    ]);
    const names = { ...fallbackGameNames };
    for (const [gameId, name] of Object.entries(common.game_names || {})) {
        if (typeof name === 'string') names[gameId] = name;
    }
    for (const [gameId, value] of Object.entries(common.games || {})) {
        if (value && typeof value.title === 'string') names[gameId] = value.title;
    }
    for (const [gameId, value] of Object.entries(lobby.games || {})) {
        if (value && typeof value.title === 'string') names[gameId] = value.title;
    }
    return names;
};

const readPackageVersion = async () => {
    try {
        const pkg = JSON.parse(await readFile('package.json', 'utf8'));
        return typeof pkg.version === 'string' ? pkg.version : '';
    } catch {
        return '';
    }
};

const promptText = async (question) => {
    if (!process.stdin.isTTY) {
        throw new Error(`${question} 未配置，且当前不是交互式终端。`);
    }
    const rl = createInterface({ input: process.stdin, output: process.stdout });
    try {
        return (await rl.question(question)).trim();
    } finally {
        rl.close();
    }
};

const promptSecret = async (question) => new Promise((resolve, reject) => {
    const stdin = process.stdin;
    if (!stdin.isTTY || typeof stdin.setRawMode !== 'function') {
        reject(new Error(`${question} 未配置，且当前终端不支持隐藏输入。`));
        return;
    }

    const wasRaw = stdin.isRaw;
    let value = '';
    let settled = false;

    const cleanup = () => {
        stdin.off('data', onData);
        stdin.setRawMode(Boolean(wasRaw));
        stdin.pause();
    };

    const finish = () => {
        if (settled) return;
        settled = true;
        cleanup();
        process.stdout.write('\n');
        resolve(value);
    };

    const fail = (error) => {
        if (settled) return;
        settled = true;
        cleanup();
        process.stdout.write('\n');
        reject(error);
    };

    const onData = (chunk) => {
        for (const char of chunk.toString('utf8')) {
            if (char === '\u0003') {
                fail(new Error('用户取消输入。'));
                return;
            }
            if (char === '\r' || char === '\n') {
                finish();
                return;
            }
            if (char === '\u007f' || char === '\b') {
                value = value.slice(0, -1);
                continue;
            }
            value += char;
        }
    };

    process.stdout.write(question);
    stdin.setRawMode(true);
    stdin.resume();
    stdin.setEncoding('utf8');
    stdin.on('data', onData);
});

const resolveCredentials = async (options) => {
    if (options.dryRun) {
        return { account: '', password: '' };
    }
    let account = options.account;
    let password = options.password;
    if (!account) {
        if (options.noPrompt) {
            throw new Error('缺少后台账号，请设置 BG_CHANGELOG_ACCOUNT 或传入 --account。');
        }
        account = await promptText('后台账号邮箱: ');
    }
    if (!password) {
        if (options.noPrompt) {
            throw new Error('缺少后台密码，请设置 BG_CHANGELOG_PASSWORD 或传入 --password。');
        }
        password = await promptSecret('后台密码: ');
    }
    return { account, password };
};

const requestJson = async (url, options, label) => {
    const response = await fetch(url, options);
    const text = await response.text();
    let body = {};
    if (text) {
        try {
            body = JSON.parse(text);
        } catch {
            body = { message: text };
        }
    }
    if (!response.ok) {
        throw new Error(`${label} 失败: HTTP ${response.status} ${body.error || body.message || text}`);
    }
    return body;
};

const login = async ({ apiBaseUrl, account, password }) => {
    const body = await requestJson(`${apiBaseUrl}/auth/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ account, password }),
    }, '登录后台');

    if (!body?.success || !body?.data?.token) {
        throw new Error(`登录后台失败: ${body?.message || body?.code || '未返回 token'}`);
    }
    return body.data.token;
};

const findDuplicateChangelog = async ({ apiBaseUrl, token, draft }) => {
    const url = `${apiBaseUrl}/admin-api/game-changelogs?gameId=${encodeURIComponent(draft.gameId)}`;
    const body = await requestJson(url, {
        method: 'GET',
        headers: { Authorization: `Bearer ${token}` },
    }, '查询已有更新日志');
    const items = Array.isArray(body?.items) ? body.items : [];
    return items.find((item) => (
        item.title === draft.title
        && (item.versionLabel || '') === (draft.versionLabel || '')
        && item.content === draft.content
    ));
};

const createChangelog = async ({ apiBaseUrl, token, draft }) => requestJson(`${apiBaseUrl}/admin-api/game-changelogs`, {
    method: 'POST',
    headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify(draft),
}, '创建更新日志');

const printDraft = (draft) => {
    console.log(`\n[publish-game-changelog] ${draft.gameId}`);
    console.log(`标题: ${draft.title}`);
    if (draft.versionLabel) console.log(`版本: ${draft.versionLabel}`);
    console.log(`状态: ${draft.published ? '发布' : '草稿'}${draft.pinned ? ' / 置顶' : ''}`);
    console.log('正文:');
    console.log(draft.content);
};

const main = async () => {
    if (hasFlag(rawArgs, 'help') || rawArgs.includes('-h')) {
        console.log(helpText);
        return;
    }

    const options = parsePublishOptions(rawArgs, process.env);
    if (!options.versionLabel) {
        options.versionLabel = await readPackageVersion();
    }
    if (options.contentFile) {
        options.content = (await readFile(options.contentFile, 'utf8')).trim();
    }

    const rangeInfo = await resolveDefaultRange(options);
    const commitMessages = options.summary ? [] : await getCommitMessages(rangeInfo.range);
    const detectedGameIds = detectGameIdsFromPaths(rangeInfo.paths, options.games);
    const underConstructionGameIds = await loadUnderConstructionGameIds();
    const { gameIds, skippedGameIds } = filterPublishableGameIds(
        detectedGameIds,
        underConstructionGameIds,
        { includeUnderConstruction: options.includeUnderConstruction },
    );
    if (skippedGameIds.length > 0) {
        console.log(`[publish-game-changelog] 跳过实施中游戏: ${skippedGameIds.join(', ')}`);
    }
    if (gameIds.length === 0) {
        throw new Error(
            detectedGameIds.length > 0
                ? '识别到的游戏均为实施中游戏；公开玩家日志默认跳过它们，如确需发布请加 --include-under-construction。'
                : `无法从提交范围 ${rangeInfo.range} 识别受影响游戏；请用 --game <id> 指定。`,
        );
    }

    const gameNames = await loadGameNames();
    const drafts = gameIds.map((gameId) => buildChangelogDraft({
        gameId,
        gameName: gameNames[gameId] || gameId,
        changedPaths: rangeInfo.paths.filter((filePath) => gameIdFromPath(filePath) === gameId || options.games.includes(gameId)),
        commitMessages,
        summary: options.summary,
        type: options.type,
        title: options.title,
        content: options.content,
        versionLabel: options.versionLabel,
        published: options.published,
        pinned: options.pinned,
    }));

    console.log(`[publish-game-changelog] 提交范围: ${rangeInfo.range} (${rangeInfo.source})`);
    console.log(`[publish-game-changelog] 识别游戏: ${gameIds.join(', ')}`);
    drafts.forEach(printDraft);

    if (options.dryRun) {
        console.log('\n[publish-game-changelog] dry-run 模式，不写入后台。');
        return;
    }

    const credentials = await resolveCredentials(options);
    const token = await login({ ...options, ...credentials });
    for (const draft of drafts) {
        if (!options.skipDuplicateCheck) {
            const duplicate = await findDuplicateChangelog({ ...options, token, draft });
            if (duplicate) {
                console.log(`[publish-game-changelog] 已存在相同日志，跳过: ${draft.gameId} ${duplicate.id || ''}`);
                continue;
            }
        }
        const result = await createChangelog({ ...options, token, draft });
        console.log(`[publish-game-changelog] 已创建: ${draft.gameId} ${result?.changelog?.id || ''}`);
    }
};

const isDirectRun = process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href;
if (isDirectRun) {
    main().catch((error) => {
        console.error(`[publish-game-changelog] ${error instanceof Error ? error.message : String(error)}`);
        process.exit(1);
    });
}
