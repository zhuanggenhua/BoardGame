#!/usr/bin/env node
import crypto from 'node:crypto';
import fs from 'node:fs/promises';
import path from 'node:path';
import {
    normalizeBaseUrl,
    updateFeedbackStatusViaBestAvailableWriter,
} from './lib/feedback-status-writer.mjs';

const EMBEDDED_IMG_RE = /!\[[^\]]*\]\((data:image\/[^)]+)\)/g;
const VALID_STATUSES = new Set(['open', 'in_progress', 'resolved', 'closed']);
const SEVERITY_RANK = {
    critical: 0,
    high: 1,
    medium: 2,
    low: 3,
};

function parseArgs(argv) {
    const options = {
        baseUrl: process.env.BOARDGAME_FEEDBACK_BASE_URL || 'https://api.easyboardgame.top',
        token: process.env.BOARDGAME_FEEDBACK_TOKEN || '',
        statuses: ['open', 'in_progress'],
        limit: 100,
        slots: 4,
        outDir: '',
        markInProgress: false,
    };

    for (let index = 0; index < argv.length; index += 1) {
        const arg = argv[index];
        if (arg === '--base-url') {
            options.baseUrl = argv[++index] || options.baseUrl;
            continue;
        }
        if (arg === '--token') {
            options.token = argv[++index] || options.token;
            continue;
        }
        if (arg === '--statuses') {
            const raw = argv[++index] || '';
            options.statuses = raw.split(',').map((item) => item.trim()).filter(Boolean);
            continue;
        }
        if (arg === '--limit') {
            options.limit = Number(argv[++index] || options.limit);
            continue;
        }
        if (arg === '--slots') {
            options.slots = Number(argv[++index] || options.slots);
            continue;
        }
        if (arg === '--out-dir') {
            options.outDir = argv[++index] || '';
            continue;
        }
        if (arg === '--mark-in-progress') {
            options.markInProgress = true;
            continue;
        }
        throw new Error(`未知参数: ${arg}`);
    }

    if (!options.statuses.length) {
        throw new Error('至少需要一个 status');
    }
    for (const status of options.statuses) {
        if (!VALID_STATUSES.has(status)) {
            throw new Error(`非法 status: ${status}`);
        }
    }
    if (!Number.isFinite(options.limit) || options.limit <= 0 || options.limit > 100) {
        throw new Error('--limit 必须在 1-100 之间');
    }
    if (!Number.isFinite(options.slots) || options.slots <= 0) {
        throw new Error('--slots 必须是正整数');
    }
    return options;
}

function buildHeaders(token, extraHeaders = {}) {
    return token
        ? {
            ...extraHeaders,
            Authorization: `Bearer ${token}`,
        }
        : extraHeaders;
}

async function fetchList(baseUrl, token, status, limit) {
    const items = [];
    let page = 1;
    let total = 0;

    while (true) {
        const url = `${baseUrl}/admin/feedback?status=${encodeURIComponent(status)}&page=${page}&limit=${limit}`;
        const response = await fetch(url, {
            headers: buildHeaders(token),
        });
        if (!response.ok) {
            throw new Error(`请求失败 ${response.status} ${response.statusText}: ${url}`);
        }
        const payload = await response.json();
        const batch = Array.isArray(payload.items) ? payload.items : [];
        total = Number(payload.total) || batch.length;
        items.push(...batch);
        if (items.length >= total || batch.length === 0) {
            break;
        }
        page += 1;
    }

    return items;
}

function extractText(content) {
    if (typeof content !== 'string') {
        return '';
    }
    return content.replace(EMBEDDED_IMG_RE, ' ').replace(/\s+/g, ' ').trim();
}

function extractEmbeddedImages(content) {
    if (typeof content !== 'string') {
        return [];
    }

    return Array.from(content.matchAll(EMBEDDED_IMG_RE), (match, index) => ({
        index,
        src: match[1],
    }));
}

function imageExtensionFromMime(mimeType) {
    const normalized = String(mimeType || '').toLowerCase();
    if (normalized.includes('png')) return 'png';
    if (normalized.includes('jpeg') || normalized.includes('jpg')) return 'jpg';
    if (normalized.includes('webp')) return 'webp';
    if (normalized.includes('gif')) return 'gif';
    if (normalized.includes('bmp')) return 'bmp';
    return 'bin';
}

async function materializeImages(item, outDir) {
    const images = extractEmbeddedImages(item?.content);
    if (images.length === 0) {
        return [];
    }

    const imageDir = path.join(outDir, 'images');
    await fs.mkdir(imageDir, { recursive: true });
    const saved = [];

    for (const image of images) {
        const dataUrlMatch = image.src.match(/^data:(image\/[^;]+);base64,(.+)$/);
        let buffer = null;
        let extension = 'bin';

        if (dataUrlMatch) {
            extension = imageExtensionFromMime(dataUrlMatch[1]);
            buffer = Buffer.from(dataUrlMatch[2], 'base64');
        } else if (/^https?:\/\//i.test(image.src)) {
            const response = await fetch(image.src);
            if (!response.ok) {
                throw new Error(`下载图片失败 ${response.status} ${response.statusText}: ${image.src}`);
            }
            extension = imageExtensionFromMime(response.headers.get('content-type'));
            buffer = Buffer.from(await response.arrayBuffer());
        }

        if (!buffer) {
            continue;
        }

        const filename = `${item._id}-${String(image.index + 1).padStart(2, '0')}.${extension}`;
        const targetPath = path.join(imageDir, filename);
        await fs.writeFile(targetPath, buffer);
        saved.push({
            index: image.index + 1,
            path: targetPath,
            source: image.src.startsWith('data:') ? 'embedded' : 'remote',
        });
    }

    return saved;
}

function normalizeInline(value) {
    return String(value || '')
        .toLowerCase()
        .replace(/https?:\/\/\S+/g, ' ')
        .replace(/[0-9a-f]{8,}/g, ' ')
        .replace(/\s+/g, ' ')
        .trim();
}

function firstStackLine(item) {
    const stack = item?.errorContext?.stack;
    if (typeof stack !== 'string') {
        return '';
    }
    return stack.split('\n').map((line) => line.trim()).find(Boolean) || '';
}

function deriveModuleKey(item) {
    const stackLine = firstStackLine(item);
    const fileMatch = stackLine.match(/\b([A-Za-z0-9_-]+\.(?:ts|tsx|js|jsx)):\d+/);
    if (fileMatch) {
        return fileMatch[1].toLowerCase();
    }

    const source = item?.errorContext?.source;
    if (typeof source === 'string' && source.trim()) {
        return source.trim().toLowerCase();
    }

    const route = item?.clientContext?.route;
    if (typeof route === 'string' && route.trim()) {
        const parts = route.split('/').filter(Boolean);
        return parts.slice(0, 3).join('/').toLowerCase() || 'route-unknown';
    }

    return 'module-unknown';
}

function deriveGameId(item) {
    return normalizeInline(item?.clientContext?.gameId || item?.gameName || 'unknown');
}

function buildErrorSignature(item) {
    return [
        item?.errorContext?.source || '',
        item?.errorContext?.name || '',
        item?.errorContext?.message || '',
        firstStackLine(item),
    ]
        .map(normalizeInline)
        .filter(Boolean)
        .join('|');
}

function buildDedupeKey(item) {
    const gameId = deriveGameId(item);
    const content = normalizeInline(extractText(item.content));
    const errorSignature = buildErrorSignature(item);
    const actionLog = normalizeInline(item?.actionLog || '').slice(0, 160);
    const textSignature = errorSignature || `${content}|${actionLog}`;

    return crypto
        .createHash('sha1')
        .update(`${gameId}|${item.type || ''}|${textSignature}`)
        .digest('hex')
        .slice(0, 16);
}

function classifyItem(item) {
    const text = normalizeInline(extractText(item.content));
    const hasDebugSignal = Boolean(
        buildErrorSignature(item)
        || normalizeInline(item?.actionLog || '')
        || normalizeInline(item?.stateSnapshot || '')
    );
    const suggestionHint = /(建议|优化|希望|体验|文案|排版|too hard|feature|improve|enhancement|request)/.test(text);
    const bugHint = /(bug|报错|错误|异常|白屏|卡死|崩溃|无法|不能|failed|undefined|null|crash|stuck)/.test(text);

    if (item.type === 'suggestion') {
        return 'non_bug';
    }
    if (item.type === 'other' && suggestionHint && !hasDebugSignal) {
        return 'non_bug';
    }
    if (item.type === 'bug' || hasDebugSignal || bugHint) {
        return 'bug_candidate';
    }
    return 'needs_review';
}

function buildConflictKey(item) {
    return `${deriveGameId(item)}::${deriveModuleKey(item)}`;
}

function makeRunDir(inputDir) {
    if (inputDir) {
        return inputDir;
    }
    const stamp = new Date().toISOString().replace(/[:.]/g, '-');
    return path.join('temp', 'feedback-closeout', stamp);
}

function buildPacket(group) {
    const item = group.primary;
    const text = extractText(item.content) || '(空)';
    const duplicateIds = group.members.slice(1).map((entry) => entry._id);
    const screenshots = Array.isArray(group.screenshotPaths) ? group.screenshotPaths : [];
    const actionLog = typeof item.actionLog === 'string' && item.actionLog.trim()
        ? item.actionLog.trim()
        : '(未附带)';
    const stateSnapshot = typeof item.stateSnapshot === 'string' && item.stateSnapshot.trim()
        ? item.stateSnapshot.trim()
        : '(未附带)';
    const stack = typeof item?.errorContext?.stack === 'string' && item.errorContext.stack.trim()
        ? item.errorContext.stack.trim()
        : '(未附带)';

    return [
        `# 反馈诊断包 ${item._id}`,
        '',
        '## 元信息',
        `- primaryId: ${item._id}`,
        `- duplicateIds: ${duplicateIds.length ? duplicateIds.join(', ') : '(无)'}`,
        `- classification: ${group.classification}`,
        `- conflictKey: ${group.conflictKey}`,
        `- gameId: ${deriveGameId(item)}`,
        `- type: ${item.type || '-'}`,
        `- severity: ${item.severity || '-'}`,
        `- status: ${item.status || '-'}`,
        `- createdAt: ${item.createdAt || '-'}`,
        `- screenshots: ${screenshots.length}`,
        '',
        '## 用户反馈',
        text,
        ...(screenshots.length > 0
            ? [
                '',
                '## 本地截图',
                ...screenshots.map((image) => `- screenshot${image.index}: ${image.path}`),
            ]
            : []),
        '',
        '## 错误上下文',
        `- source: ${item?.errorContext?.source || '-'}`,
        `- name: ${item?.errorContext?.name || '-'}`,
        `- message: ${item?.errorContext?.message || '-'}`,
        `- route: ${item?.clientContext?.route || '-'}`,
        '',
        '## 堆栈',
        '```text',
        stack,
        '```',
        '',
        '## 操作日志',
        '```text',
        actionLog,
        '```',
        '',
        '## 状态快照',
        '```text',
        stateSnapshot,
        '```',
    ].join('\n');
}

function sortGroups(groups) {
    return [...groups].sort((left, right) => {
        const leftRank = SEVERITY_RANK[left.primary.severity] ?? 99;
        const rightRank = SEVERITY_RANK[right.primary.severity] ?? 99;
        if (leftRank !== rightRank) {
            return leftRank - rightRank;
        }
        return String(left.primary.createdAt || '').localeCompare(String(right.primary.createdAt || ''));
    });
}

function pickParallelCandidates(groups, slots) {
    const picked = [];
    const usedKeys = new Set();
    for (const group of sortGroups(groups)) {
        if (group.classification !== 'bug_candidate') {
            continue;
        }
        if (usedKeys.has(group.conflictKey)) {
            continue;
        }
        picked.push({
            feedbackId: group.primary._id,
            duplicateIds: group.members.slice(1).map((entry) => entry._id),
            conflictKey: group.conflictKey,
            gameId: deriveGameId(group.primary),
            severity: group.primary.severity,
            type: group.primary.type,
            packetPath: group.packetPath,
            screenshotPaths: group.screenshotPaths,
        });
        usedKeys.add(group.conflictKey);
        if (picked.length >= slots) {
            break;
        }
    }
    return picked;
}

async function main() {
    const options = parseArgs(process.argv.slice(2));
    const baseUrl = normalizeBaseUrl(options.baseUrl);
    const outDir = makeRunDir(options.outDir);
    await fs.mkdir(outDir, { recursive: true });

    const fetchedByStatus = {};
    const merged = [];
    for (const status of options.statuses) {
        const items = await fetchList(baseUrl, options.token, status, options.limit);
        fetchedByStatus[status] = items.length;
        merged.push(...items);
    }

    const dedupeMap = new Map();
    for (const item of merged) {
        const dedupeKey = buildDedupeKey(item);
        const existing = dedupeMap.get(dedupeKey);
        if (existing) {
            existing.members.push(item);
            continue;
        }
        dedupeMap.set(dedupeKey, {
            dedupeKey,
            classification: classifyItem(item),
            conflictKey: buildConflictKey(item),
            primary: item,
            members: [item],
            packetPath: '',
            screenshotPaths: [],
        });
    }

    const groups = sortGroups([...dedupeMap.values()]);
    for (const group of groups) {
        group.screenshotPaths = await materializeImages(group.primary, outDir);
        const packetName = `${group.primary._id}.md`;
        group.packetPath = path.join(outDir, packetName);
        await fs.writeFile(group.packetPath, buildPacket(group), 'utf8');
    }

    const parallelCandidates = pickParallelCandidates(groups, options.slots);
    const claimedCandidates = [];
    if (options.markInProgress) {
        for (const candidate of parallelCandidates) {
            const updated = await updateFeedbackStatusViaBestAvailableWriter({
                baseUrl,
                token: options.token,
                id: candidate.feedbackId,
                status: 'in_progress',
            });
            candidate.status = updated.status;
            candidate.statusWriter = updated.writer;
            claimedCandidates.push({
                feedbackId: candidate.feedbackId,
                status: updated.status,
                writer: updated.writer,
                writerReason: updated.reason,
            });
        }
    }
    const summary = {
        baseUrl,
        fetchedByStatus,
        totalFetched: merged.length,
        uniqueGroups: groups.length,
        generatedAt: new Date().toISOString(),
        outDir,
        markInProgress: options.markInProgress,
        claimedCandidates,
        parallelCandidates,
        groups: groups.map((group) => ({
            dedupeKey: group.dedupeKey,
            classification: group.classification,
            conflictKey: group.conflictKey,
            primaryId: group.primary._id,
            duplicateIds: group.members.slice(1).map((entry) => entry._id),
            groupSize: group.members.length,
            gameId: deriveGameId(group.primary),
            type: group.primary.type,
            severity: group.primary.severity,
            status: group.primary.status,
            createdAt: group.primary.createdAt,
            summary: extractText(group.primary.content).slice(0, 140),
            packetPath: group.packetPath,
            screenshotPaths: group.screenshotPaths,
        })),
    };

    const summaryPath = path.join(outDir, 'summary.json');
    await fs.writeFile(summaryPath, `${JSON.stringify(summary, null, 2)}\n`, 'utf8');

    process.stdout.write(`${JSON.stringify(summary, null, 2)}\n`);
}

main().catch((error) => {
    process.stderr.write(`${error instanceof Error ? error.stack || error.message : String(error)}\n`);
    process.exitCode = 1;
});
