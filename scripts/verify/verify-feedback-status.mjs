#!/usr/bin/env node
import fs from 'node:fs/promises';
import path from 'node:path';

const VALID_STATUSES = new Set(['open', 'in_progress', 'resolved', 'closed', 'blocked']);
const VALID_REMOTE_STATUSES = new Set(['open', 'in_progress', 'resolved', 'closed']);

function formatMessage(itemId, message) {
    return itemId ? `[${itemId}] ${message}` : message;
}

function isNonEmptyString(value) {
    return typeof value === 'string' && value.trim().length > 0;
}

function isStringArray(value) {
    return Array.isArray(value) && value.every((item) => typeof item === 'string');
}

function normalizeBoardPath(rawPath) {
    if (!rawPath) {
        return path.resolve('temp/feedback-closeout/status-board.json');
    }
    return path.resolve(rawPath);
}

async function readBoard(boardPath) {
    const raw = await fs.readFile(boardPath, 'utf8');
    return JSON.parse(raw);
}

function validateBoard(board) {
    const issues = [];
    if (typeof board !== 'object' || board === null || Array.isArray(board)) {
        return ['根对象必须是 object'];
    }

    if (!Number.isInteger(board.version) || board.version <= 0) {
        issues.push('version 必须是正整数');
    }
    if (!isNonEmptyString(board.updatedAt)) {
        issues.push('updatedAt 必须是非空字符串');
    }
    if (!Array.isArray(board.items)) {
        issues.push('items 必须是数组');
        return issues;
    }

    const seenIds = new Set();
    for (const item of board.items) {
        const itemId = typeof item?.id === 'string' ? item.id : '';

        if (!isNonEmptyString(item?.id)) {
            issues.push(formatMessage(itemId, 'id 必须是非空字符串'));
        } else if (seenIds.has(item.id)) {
            issues.push(formatMessage(item.id, 'id 重复'));
        } else {
            seenIds.add(item.id);
        }

        if (!isNonEmptyString(item?.title)) {
            issues.push(formatMessage(itemId, 'title 必须是非空字符串'));
        }
        if (!isNonEmptyString(item?.status) || !VALID_STATUSES.has(item.status)) {
            issues.push(
                formatMessage(
                    itemId,
                    `status 必须是 ${Array.from(VALID_STATUSES).join(' / ')} 之一`,
                ),
            );
        }
        if (!isNonEmptyString(item?.updatedAt)) {
            issues.push(formatMessage(itemId, 'updatedAt 必须是非空字符串'));
        }

        if (item.lastFetchedStatus !== undefined) {
            if (
                !isNonEmptyString(item.lastFetchedStatus)
                || !VALID_REMOTE_STATUSES.has(item.lastFetchedStatus)
            ) {
                issues.push(
                    formatMessage(
                        itemId,
                        `lastFetchedStatus 必须是 ${Array.from(VALID_REMOTE_STATUSES).join(' / ')} 之一`,
                    ),
                );
            }
        }

        for (const key of ['evidence', 'verification', 'screenshots']) {
            if (item[key] !== undefined && !isStringArray(item[key])) {
                issues.push(formatMessage(itemId, `${key} 必须是字符串数组`));
            }
        }

        if (item.notes !== undefined && typeof item.notes !== 'string') {
            issues.push(formatMessage(itemId, 'notes 必须是字符串'));
        }
        if (item.closedReason !== undefined && typeof item.closedReason !== 'string') {
            issues.push(formatMessage(itemId, 'closedReason 必须是字符串'));
        }
        if (item.resolvedMethod !== undefined && typeof item.resolvedMethod !== 'string') {
            issues.push(formatMessage(itemId, 'resolvedMethod 必须是字符串'));
        }

        if (item.status === 'resolved') {
            if (!isStringArray(item.evidence) || item.evidence.length === 0) {
                issues.push(formatMessage(itemId, 'resolved 必须至少包含 1 条 evidence'));
            }
            if (!isStringArray(item.verification) || item.verification.length === 0) {
                issues.push(formatMessage(itemId, 'resolved 必须至少包含 1 条 verification'));
            }
            const hasResolvedMethod = isNonEmptyString(item.resolvedMethod);
            const hasLegacyNotes = isNonEmptyString(item.notes);
            if (!hasResolvedMethod && !hasLegacyNotes) {
                issues.push(formatMessage(itemId, 'resolved 必须提供 resolvedMethod（旧数据可临时用 notes 兼容）'));
            }
        }

        if (item.status === 'closed') {
            const hasClosedReason = isNonEmptyString(item.closedReason);
            const hasNotes = isNonEmptyString(item.notes);
            const hasEvidence = isStringArray(item.evidence) && item.evidence.length > 0;
            if (!hasClosedReason && !hasNotes && !hasEvidence) {
                issues.push(formatMessage(itemId, 'closed 必须至少提供 closedReason、notes 或 evidence'));
            }
        }
    }

    return issues;
}

async function main() {
    const boardPath = normalizeBoardPath(process.argv[2]);
    const board = await readBoard(boardPath);
    const issues = validateBoard(board);

    if (issues.length > 0) {
        process.stderr.write(`feedback-status: invalid (${boardPath})\n`);
        for (const issue of issues) {
            process.stderr.write(`- ${issue}\n`);
        }
        process.exitCode = 1;
        return;
    }

    process.stdout.write(`feedback-status: ok (${boardPath})\n`);
}

main().catch((error) => {
    process.stderr.write(`${error instanceof Error ? error.stack || error.message : String(error)}\n`);
    process.exitCode = 1;
});
