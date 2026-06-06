#!/usr/bin/env node
import fs from 'node:fs/promises';
import path from 'node:path';

const DEFAULT_BOARD_PATH = 'temp/feedback-closeout/status-board.json';

function parseArgs(argv) {
    const options = {
        summaryPath: '',
        boardPath: DEFAULT_BOARD_PATH,
    };

    const positional = [];
    for (let index = 0; index < argv.length; index += 1) {
        const arg = argv[index];
        if (arg === '--board') {
            options.boardPath = argv[++index] || options.boardPath;
            continue;
        }
        positional.push(arg);
    }

    options.summaryPath = positional[0] || '';
    if (!options.summaryPath) {
        throw new Error('缺少 summary.json 路径');
    }

    return {
        summaryPath: path.resolve(options.summaryPath),
        boardPath: path.resolve(options.boardPath),
    };
}

async function readJson(filePath) {
    const raw = await fs.readFile(filePath, 'utf8');
    return JSON.parse(raw);
}

async function readOptionalBoard(boardPath) {
    try {
        return await readJson(boardPath);
    } catch (error) {
        if (error && typeof error === 'object' && 'code' in error && error.code === 'ENOENT') {
            return null;
        }
        throw error;
    }
}

function normalizeStringArray(value) {
    if (!Array.isArray(value)) {
        return [];
    }
    return value.filter((item) => typeof item === 'string' && item.trim().length > 0);
}

function normalizeScreenshotPaths(value) {
    if (!Array.isArray(value)) {
        return [];
    }

    return value
        .map((item) => {
            if (typeof item === 'string') {
                return item;
            }
            if (item && typeof item === 'object' && typeof item.path === 'string') {
                return item.path;
            }
            return '';
        })
        .filter((item) => item.trim().length > 0);
}

function toBoardItem(group, summaryPath) {
    return {
        id: group.primaryId,
        feedbackId: group.primaryId,
        dedupeKey: group.dedupeKey,
        title: group.summary || `反馈 ${group.primaryId}`,
        gameId: group.gameId || '',
        classification: group.classification || '',
        type: group.type || '',
        severity: group.severity || '',
        conflictKey: group.conflictKey || '',
        status: group.status || 'open',
        lastFetchedStatus: group.status || 'open',
        owner: '',
        source: 'online_feedback',
        packetPath: group.packetPath || '',
        summaryPath,
        duplicateIds: normalizeStringArray(group.duplicateIds),
        evidence: [],
        verification: [],
        screenshots: normalizeScreenshotPaths(group.screenshotPaths),
        notes: '',
        updatedAt: new Date().toISOString(),
    };
}

function mergeItem(baseItem, existingItem, summaryPath) {
    if (!existingItem) {
        return baseItem;
    }

    return {
        ...baseItem,
        ...existingItem,
        id: existingItem.id || baseItem.id,
        feedbackId: existingItem.feedbackId || baseItem.feedbackId,
        dedupeKey: existingItem.dedupeKey || baseItem.dedupeKey,
        title: existingItem.title || baseItem.title,
        gameId: baseItem.gameId,
        classification: baseItem.classification,
        type: baseItem.type,
        severity: baseItem.severity,
        conflictKey: baseItem.conflictKey,
        packetPath: baseItem.packetPath,
        summaryPath,
        duplicateIds: normalizeStringArray(existingItem.duplicateIds).length > 0
            ? normalizeStringArray(existingItem.duplicateIds)
            : baseItem.duplicateIds,
        lastFetchedStatus: baseItem.lastFetchedStatus,
        screenshots: normalizeStringArray(existingItem.screenshots).length > 0
            ? normalizeStringArray(existingItem.screenshots)
            : baseItem.screenshots,
    };
}

async function writeBoard(boardPath, board) {
    await fs.mkdir(path.dirname(boardPath), { recursive: true });
    await fs.writeFile(boardPath, `${JSON.stringify(board, null, 2)}\n`, 'utf8');
}

async function main() {
    const options = parseArgs(process.argv.slice(2));
    const summary = await readJson(options.summaryPath);
    if (!Array.isArray(summary.groups)) {
        throw new Error('summary.json 缺少 groups 数组');
    }

    const existingBoard = await readOptionalBoard(options.boardPath);
    const existingItems = Array.isArray(existingBoard?.items) ? existingBoard.items : [];
    const existingMap = new Map(existingItems.map((item) => [item.feedbackId || item.id, item]));

    const mergedItems = summary.groups.map((group) => {
        const baseItem = toBoardItem(group, options.summaryPath);
        const existingItem = existingMap.get(group.primaryId);
        return mergeItem(baseItem, existingItem, options.summaryPath);
    });

    const board = {
        version: 1,
        updatedAt: new Date().toISOString(),
        sourceSummaryPath: options.summaryPath,
        baseUrl: summary.baseUrl || '',
        items: mergedItems,
    };

    await writeBoard(options.boardPath, board);
    process.stdout.write(
        `feedback-status-board: synced ${mergedItems.length} item(s) -> ${options.boardPath}\n`,
    );
}

main().catch((error) => {
    process.stderr.write(`${error instanceof Error ? error.stack || error.message : String(error)}\n`);
    process.exitCode = 1;
});
