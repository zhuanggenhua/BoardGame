#!/usr/bin/env node
import {
    DEFAULT_BOARD_PATH,
    normalizeBoardPath,
    normalizeStringArray,
    readJson,
    syncBoardFromSummaryFile,
    updateBoardItems,
    writeBoard,
} from './lib/status-board.mjs';

const VALID_STATUSES = new Set(['open', 'in_progress', 'resolved', 'closed', 'blocked']);

function parseArgs(argv) {
    const options = {
        boardPath: DEFAULT_BOARD_PATH,
        summaryPath: '',
        ids: [],
        status: '',
        owner: '',
        notes: '',
        closedReason: '',
        resolvedMethod: '',
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
        if (arg === '--summary') {
            options.summaryPath = argv[++index] || '';
            continue;
        }
        if (arg === '--id') {
            options.ids.push(argv[++index] || '');
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
        if (arg === '--closed-reason') {
            options.closedReason = argv[++index] || '';
            continue;
        }
        if (arg === '--resolved-method') {
            options.resolvedMethod = argv[++index] || '';
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

    options.ids = normalizeStringArray(options.ids);
    if (options.ids.length === 0) {
        throw new Error('缺少 --id');
    }
    if (!VALID_STATUSES.has(options.status)) {
        throw new Error(`非法状态: ${options.status}`);
    }

    return {
        ...options,
        boardPath: normalizeBoardPath(options.boardPath),
        evidence: normalizeStringArray(options.evidence),
        verification: normalizeStringArray(options.verification),
        screenshots: normalizeStringArray(options.screenshots),
    };
}

async function main() {
    const options = parseArgs(process.argv.slice(2));
    const board = options.summaryPath
        ? (await syncBoardFromSummaryFile(options.summaryPath, options.boardPath)).board
        : await readJson(options.boardPath);

    const updatedItems = updateBoardItems(board, options.ids, options);
    await writeBoard(options.boardPath, board);
    process.stdout.write(
        `feedback-status-board: updated ${updatedItems.map((item) => item.id).join(', ')} -> ${options.status}\n`,
    );
}

main().catch((error) => {
    process.stderr.write(`${error instanceof Error ? error.stack || error.message : String(error)}\n`);
    process.exitCode = 1;
});
