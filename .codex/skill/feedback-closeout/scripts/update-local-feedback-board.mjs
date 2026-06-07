#!/usr/bin/env node
import fs from 'node:fs/promises';
import path from 'node:path';

const VALID_STATUSES = new Set(['open', 'in_progress', 'resolved', 'closed', 'blocked']);
const DEFAULT_BOARD_PATH = 'temp/feedback-closeout/status-board.json';

function parseArgs(argv) {
    const options = {
        boardPath: DEFAULT_BOARD_PATH,
        id: '',
        status: '',
        owner: '',
        notes: '',
        evidence: [],
        verification: [],
        screenshots: [],
    };

    for (let index = 0; index < argv.length; index += 1) {
        const arg = argv[index];
        if (arg === '--board') {
            options.boardPath = argv[++index] || options.boardPath;
            continue;
        }
        if (arg === '--id') {
            options.id = argv[++index] || '';
            continue;
        }
        if (arg === '--status') {
            options.status = argv[++index] || '';
            continue;
        }
        if (arg === '--owner') {
            options.owner = argv[++index] || '';
            continue;
        }
        if (arg === '--notes') {
            options.notes = argv[++index] || '';
            continue;
        }
        if (arg === '--evidence') {
            options.evidence.push(argv[++index] || '');
            continue;
        }
        if (arg === '--verification') {
            options.verification.push(argv[++index] || '');
            continue;
        }
        if (arg === '--screenshot') {
            options.screenshots.push(argv[++index] || '');
            continue;
        }
        throw new Error(`未知参数: ${arg}`);
    }

    if (!options.id) {
        throw new Error('缺少 --id');
    }
    if (!VALID_STATUSES.has(options.status)) {
        throw new Error(`非法状态: ${options.status}`);
    }

    return {
        ...options,
        boardPath: path.resolve(options.boardPath),
        evidence: options.evidence.filter(Boolean),
        verification: options.verification.filter(Boolean),
        screenshots: options.screenshots.filter(Boolean),
    };
}

async function readJson(filePath) {
    const raw = await fs.readFile(filePath, 'utf8');
    return JSON.parse(raw);
}

function mergeUnique(existing, incoming) {
    const merged = [...existing, ...incoming].filter(
        (item) => typeof item === 'string' && item.trim().length > 0,
    );
    return Array.from(new Set(merged));
}

function assertItemCanUseStatus(item) {
    if (item.status === 'resolved') {
        if (!Array.isArray(item.evidence) || item.evidence.length === 0) {
            throw new Error('resolved 状态至少需要 1 条 evidence');
        }
        if (!Array.isArray(item.verification) || item.verification.length === 0) {
            throw new Error('resolved 状态至少需要 1 条 verification');
        }
    }

    if (item.status === 'closed') {
        const hasNotes = typeof item.notes === 'string' && item.notes.trim().length > 0;
        const hasEvidence = Array.isArray(item.evidence) && item.evidence.length > 0;
        if (!hasNotes && !hasEvidence) {
            throw new Error('closed 状态至少需要 notes 或 evidence');
        }
    }
}

async function main() {
    const options = parseArgs(process.argv.slice(2));
    const board = await readJson(options.boardPath);
    if (!Array.isArray(board.items)) {
        throw new Error('状态板缺少 items 数组');
    }

    const item = board.items.find((entry) => entry.id === options.id || entry.feedbackId === options.id);
    if (!item) {
        throw new Error(`状态板中未找到反馈: ${options.id}`);
    }

    const nextEvidence = mergeUnique(Array.isArray(item.evidence) ? item.evidence : [], options.evidence);
    const nextVerification = mergeUnique(
        Array.isArray(item.verification) ? item.verification : [],
        options.verification,
    );
    const nextScreenshots = mergeUnique(
        Array.isArray(item.screenshots) ? item.screenshots : [],
        options.screenshots,
    );
    const nextItem = {
        ...item,
        status: options.status,
        updatedAt: new Date().toISOString(),
        owner: options.owner || item.owner || '',
        notes: options.notes || item.notes || '',
        evidence: nextEvidence,
        verification: nextVerification,
        screenshots: nextScreenshots,
    };

    assertItemCanUseStatus(nextItem);
    Object.assign(item, nextItem);

    board.updatedAt = new Date().toISOString();
    await fs.writeFile(options.boardPath, `${JSON.stringify(board, null, 2)}\n`, 'utf8');
    process.stdout.write(`feedback-status-board: updated ${item.id} -> ${item.status}\n`);
}

main().catch((error) => {
    process.stderr.write(`${error instanceof Error ? error.stack || error.message : String(error)}\n`);
    process.exitCode = 1;
});
