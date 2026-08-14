#!/usr/bin/env node
import {
    DEFAULT_BOARD_PATH,
    normalizeStringArray,
    readJson,
    syncBoardFromSummaryFile,
    updateBoardItems,
    writeBoard,
} from './lib/status-board.mjs';

const VALID_STATUSES = new Set(['open', 'in_progress', 'resolved', 'closed']);

function parseArgs(argv) {
    const options = {
        baseUrl: process.env.BOARDGAME_FEEDBACK_BASE_URL || 'https://api.easyboardgame.top',
        token: process.env.BOARDGAME_FEEDBACK_TOKEN || '',
        id: '',
        status: '',
        closedReason: '',
        resolvedMethod: '',
        boardPath: DEFAULT_BOARD_PATH,
        summaryPath: '',
        evidence: [],
        verification: [],
        screenshots: [],
    };

    const positional = [];
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
        if (arg === '--closed-reason') {
            options.closedReason = argv[++index] || '';
            continue;
        }
        if (arg === '--resolved-method') {
            options.resolvedMethod = argv[++index] || '';
            continue;
        }
        if (arg === '--board') {
            options.boardPath = argv[++index] || options.boardPath;
            continue;
        }
        if (arg === '--summary') {
            options.summaryPath = argv[++index] || '';
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
        positional.push(arg);
    }

    options.id = positional[0] || '';
    options.status = positional[1] || '';

    if (!options.id) {
        throw new Error('缺少反馈 ID');
    }
    if (!VALID_STATUSES.has(options.status)) {
        throw new Error(`非法状态: ${options.status}`);
    }
    if (options.status === 'resolved' && !options.resolvedMethod.trim()) {
        throw new Error('resolved 状态必须提供面向用户的 --resolved-method');
    }
    if (options.status === 'closed' && !options.closedReason.trim()) {
        throw new Error('closed 状态必须提供面向用户的 --closed-reason');
    }
    return {
        ...options,
        evidence: normalizeStringArray(options.evidence),
        verification: normalizeStringArray(options.verification),
        screenshots: normalizeStringArray(options.screenshots),
    };
}

async function main() {
    const options = parseArgs(process.argv.slice(2));
    const baseUrl = options.baseUrl.replace(/\/+$/, '');
    if (!options.token) {
        throw new Error('缺少反馈管理 Bearer 凭证；请通过 --token 或 BOARDGAME_FEEDBACK_TOKEN 提供');
    }
    const response = await fetch(`${baseUrl}/admin/feedback/${options.id}/status`, {
        method: 'PATCH',
        headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${options.token}`,
        },
        body: JSON.stringify({
            status: options.status,
            ...(options.closedReason.trim() ? { closedReason: options.closedReason.trim() } : {}),
            ...(options.resolvedMethod.trim() ? { resolvedMethod: options.resolvedMethod.trim() } : {}),
        }),
    });

    if (!response.ok) {
        const text = await response.text();
        throw new Error(`更新失败 ${response.status} ${response.statusText}: ${text}`);
    }

    const payload = await response.json();
    let localBoardPath = '';
    if (options.summaryPath) {
        const { board, boardPath } = await syncBoardFromSummaryFile(options.summaryPath, options.boardPath);
        localBoardPath = boardPath;
        const mirrorEvidence = options.evidence.length > 0
            ? options.evidence
            : [`online-feedback-status:${baseUrl}/admin/feedback/${options.id}/status`];
        const mirrorVerification = options.verification.length > 0
            ? options.verification
            : ['线上反馈状态回写成功后同步本地状态镜像'];
        updateBoardItems(board, [options.id], {
            status: options.status,
            owner: 'codex',
            closedReason: options.closedReason,
            resolvedMethod: options.resolvedMethod,
            evidence: mirrorEvidence,
            verification: mirrorVerification,
            screenshots: options.screenshots,
        });
        await writeBoard(boardPath, board);
    } else {
        const board = await readJson(options.boardPath);
        localBoardPath = options.boardPath;
        const mirrorEvidence = options.evidence.length > 0
            ? options.evidence
            : [`online-feedback-status:${baseUrl}/admin/feedback/${options.id}/status`];
        const mirrorVerification = options.verification.length > 0
            ? options.verification
            : ['线上反馈状态回写成功后同步本地状态镜像'];
        updateBoardItems(board, [options.id], {
            status: options.status,
            owner: 'codex',
            closedReason: options.closedReason,
            resolvedMethod: options.resolvedMethod,
            evidence: mirrorEvidence,
            verification: mirrorVerification,
            screenshots: options.screenshots,
        });
        await writeBoard(options.boardPath, board);
    }

    process.stdout.write(`${JSON.stringify({ ...payload, localBoardPath }, null, 2)}\n`);
}

main().catch((error) => {
    process.stderr.write(`${error instanceof Error ? error.stack || error.message : String(error)}\n`);
    process.exitCode = 1;
});
