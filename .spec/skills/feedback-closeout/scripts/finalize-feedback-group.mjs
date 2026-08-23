#!/usr/bin/env node
import fs from 'node:fs/promises';
import path from 'node:path';
import {
    DEFAULT_BOARD_PATH,
    feedbackIdsForGroup,
    normalizeStringArray,
    syncBoardFromSummaryFile,
    updateBoardItems,
    writeBoard,
} from './lib/status-board.mjs';
import {
    normalizeBaseUrl,
    updateFeedbackStatusesViaBestAvailableWriter,
} from './lib/feedback-status-writer.mjs';

const VALID_STATUSES = new Set(['resolved', 'closed']);

function parseArgs(argv) {
    const options = {
        baseUrl: process.env.BOARDGAME_FEEDBACK_BASE_URL || 'https://api.easyboardgame.top',
        token: process.env.BOARDGAME_FEEDBACK_TOKEN || '',
        summaryPath: '',
        feedbackId: '',
        status: '',
        updateDuplicates: true,
        closedReason: '',
        resolvedMethod: '',
        boardPath: DEFAULT_BOARD_PATH,
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
        if (arg === '--keep-duplicates-open') {
            options.updateDuplicates = false;
            continue;
        }
        positional.push(arg);
    }

    options.summaryPath = positional[0] || '';
    options.feedbackId = positional[1] || '';
    options.status = positional[2] || '';

    if (!options.summaryPath) {
        throw new Error('缺少 summary.json 路径');
    }
    if (!options.feedbackId) {
        throw new Error('缺少代表项反馈 ID');
    }
    if (!VALID_STATUSES.has(options.status)) {
        throw new Error(`非法终态: ${options.status}`);
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
    const baseUrl = normalizeBaseUrl(options.baseUrl);
    const resolvedSummaryPath = path.resolve(options.summaryPath);
    const raw = await fs.readFile(resolvedSummaryPath, 'utf8');
    const summary = JSON.parse(raw);
    const groups = Array.isArray(summary.groups) ? summary.groups : [];
    const group = groups.find((entry) => entry.primaryId === options.feedbackId);

    if (!group) {
        throw new Error(`summary.json 中找不到代表项: ${options.feedbackId}`);
    }

    const details = {
        closedReason: options.closedReason,
        resolvedMethod: options.resolvedMethod,
    };
    const remoteIds = feedbackIdsForGroup(group, options.updateDuplicates);
    const remoteUpdate = await updateFeedbackStatusesViaBestAvailableWriter(
        remoteIds.map((id) => ({
                baseUrl,
                token: options.token,
                id,
                status: options.status,
                ...details,
        })),
    );
    const primary = remoteUpdate.results.find((entry) => entry.id === options.feedbackId);
    if (!primary) {
        throw new Error(`远端回写结果缺少代表项: ${options.feedbackId}`);
    }
    const duplicateResults = remoteUpdate.results
        .filter((entry) => entry.id !== options.feedbackId)
        .map((updated) => ({
            feedbackId: updated.id,
            status: updated.status,
            writer: updated.writer,
        }));

    const localIds = feedbackIdsForGroup(group, options.updateDuplicates);
    const { board, boardPath } = await syncBoardFromSummaryFile(resolvedSummaryPath, options.boardPath);
    const writerEvidence = primary.writer === 'http'
        ? `online-feedback-status:http:${baseUrl}/admin-api/feedback/${options.feedbackId}/status`
        : `online-feedback-status:mongo-ssh:feedbacks/${options.feedbackId}`;
    const mirrorEvidence = options.evidence.length > 0
        ? options.evidence
        : [writerEvidence];
    const mirrorVerification = options.verification.length > 0
        ? options.verification
        : [`线上反馈状态通过 ${primary.writer} 回写成功后同步本地状态镜像`];
    updateBoardItems(board, localIds, {
        status: options.status,
        owner: 'codex',
        closedReason: options.closedReason,
        resolvedMethod: options.resolvedMethod,
        evidence: mirrorEvidence,
        verification: mirrorVerification,
        screenshots: options.screenshots,
    });
    await writeBoard(boardPath, board);

    const result = {
        summaryPath: resolvedSummaryPath,
        localBoardPath: boardPath,
        feedbackId: options.feedbackId,
        finalStatus: primary.status,
        writer: primary.writer,
        writerReason: primary.reason,
        duplicateCount: Array.isArray(group.duplicateIds) ? group.duplicateIds.length : 0,
        updateDuplicates: options.updateDuplicates,
        duplicateFinalStatus: options.updateDuplicates ? options.status : null,
        duplicates: duplicateResults,
        localMirrorIds: localIds,
    };

    process.stdout.write(`${JSON.stringify(result, null, 2)}\n`);
}

main().catch((error) => {
    process.stderr.write(`${error instanceof Error ? error.stack || error.message : String(error)}\n`);
    process.exitCode = 1;
});
