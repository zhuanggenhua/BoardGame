import fs from 'node:fs/promises';
import path from 'node:path';

export const DEFAULT_BOARD_PATH = 'temp/feedback-closeout/status-board.json';

export function normalizeBoardPath(rawPath) {
    return path.resolve(rawPath || DEFAULT_BOARD_PATH);
}

export async function readJson(filePath) {
    const raw = await fs.readFile(filePath, 'utf8');
    return JSON.parse(raw);
}

export async function readOptionalBoard(boardPath) {
    try {
        return await readJson(boardPath);
    } catch (error) {
        if (error && typeof error === 'object' && 'code' in error && error.code === 'ENOENT') {
            return null;
        }
        throw error;
    }
}

export function normalizeStringArray(value) {
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

function mergeUnique(existing, incoming) {
    const merged = [...existing, ...incoming].filter(
        (item) => typeof item === 'string' && item.trim().length > 0,
    );
    return Array.from(new Set(merged));
}

function groupFeedbackIds(group) {
    return [
        group.primaryId,
        ...normalizeStringArray(group.duplicateIds),
    ].filter((id) => typeof id === 'string' && id.trim().length > 0);
}

function historicalRemoteStatusMirrorFields(group, summaryPath, fetchedAt) {
    const evidence = normalizeStringArray([group.packetPath, summaryPath]);
    const status = group.status || 'open';

    if (status === 'resolved') {
        return {
            evidence,
            verification: [
                `线上反馈接口在 ${fetchedAt} 返回该记录状态为 resolved；本地状态板仅同步历史状态，不代表本轮重新复验具体修复。`,
            ],
            notes: '线上真实反馈记录已是“已修复”状态；本地状态板仅同步历史状态，本轮未重新复验具体修复。',
        };
    }

    if (status === 'closed') {
        return {
            evidence,
            verification: [
                `线上反馈接口在 ${fetchedAt} 返回该记录状态为 closed；本地状态板仅同步历史状态。`,
            ],
            notes: '线上真实反馈记录已是“已关闭”状态；本地状态板仅同步历史状态。',
        };
    }

    return {
        evidence: [],
        verification: [],
        notes: '',
    };
}

function toBoardItem(group, feedbackId, summaryPath, nowIso, fetchedAt) {
    const allGroupIds = groupFeedbackIds(group);
    const mirrorFields = historicalRemoteStatusMirrorFields(group, summaryPath, fetchedAt);

    return {
        id: feedbackId,
        feedbackId,
        groupPrimaryId: group.primaryId,
        isDuplicate: feedbackId !== group.primaryId,
        dedupeKey: group.dedupeKey,
        title: group.summary || `反馈 ${feedbackId}`,
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
        duplicateIds: allGroupIds.filter((id) => id !== feedbackId),
        evidence: mirrorFields.evidence,
        verification: mirrorFields.verification,
        screenshots: normalizeScreenshotPaths(group.screenshotPaths),
        notes: mirrorFields.notes,
        closedReason: '',
        resolvedMethod: '',
        updatedAt: nowIso,
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
        groupPrimaryId: baseItem.groupPrimaryId,
        isDuplicate: baseItem.isDuplicate,
        dedupeKey: baseItem.dedupeKey,
        title: existingItem.title || baseItem.title,
        gameId: baseItem.gameId,
        classification: baseItem.classification,
        type: baseItem.type,
        severity: baseItem.severity,
        conflictKey: baseItem.conflictKey,
        packetPath: baseItem.packetPath,
        summaryPath,
        duplicateIds: baseItem.duplicateIds,
        lastFetchedStatus: baseItem.lastFetchedStatus,
        evidence: mergeUnique(
            normalizeStringArray(existingItem.evidence),
            baseItem.evidence,
        ),
        verification: mergeUnique(
            normalizeStringArray(existingItem.verification),
            baseItem.verification,
        ),
        screenshots: normalizeStringArray(existingItem.screenshots).length > 0
            ? normalizeStringArray(existingItem.screenshots)
            : baseItem.screenshots,
        notes: typeof existingItem.notes === 'string' && existingItem.notes.trim()
            ? existingItem.notes
            : baseItem.notes,
        closedReason: typeof existingItem.closedReason === 'string'
            ? existingItem.closedReason
            : baseItem.closedReason,
        resolvedMethod: typeof existingItem.resolvedMethod === 'string'
            ? existingItem.resolvedMethod
            : baseItem.resolvedMethod,
    };
}

export function buildBoardFromSummary(summary, summaryPath, existingBoard = null) {
    if (!Array.isArray(summary.groups)) {
        throw new Error('summary.json 缺少 groups 数组');
    }

    const nowIso = new Date().toISOString();
    const existingItems = Array.isArray(existingBoard?.items) ? existingBoard.items : [];
    const existingMap = new Map(existingItems.map((item) => [item.feedbackId || item.id, item]));
    const mergedItems = [];
    const fetchedAt = summary.generatedAt || nowIso;

    for (const group of summary.groups) {
        for (const feedbackId of groupFeedbackIds(group)) {
            const baseItem = toBoardItem(group, feedbackId, summaryPath, nowIso, fetchedAt);
            const existingItem = existingMap.get(feedbackId);
            mergedItems.push(mergeItem(baseItem, existingItem, summaryPath));
        }
    }

    return {
        version: 1,
        updatedAt: nowIso,
        sourceSummaryPath: summaryPath,
        baseUrl: summary.baseUrl || '',
        items: mergedItems,
    };
}

export async function writeBoard(boardPath, board) {
    await fs.mkdir(path.dirname(boardPath), { recursive: true });
    await fs.writeFile(boardPath, `${JSON.stringify(board, null, 2)}\n`, 'utf8');
}

export async function syncBoardFromSummaryFile(summaryPath, boardPath) {
    const resolvedSummaryPath = path.resolve(summaryPath);
    const resolvedBoardPath = normalizeBoardPath(boardPath);
    const summary = await readJson(resolvedSummaryPath);
    const existingBoard = await readOptionalBoard(resolvedBoardPath);
    const board = buildBoardFromSummary(summary, resolvedSummaryPath, existingBoard);

    await writeBoard(resolvedBoardPath, board);
    return {
        summary,
        board,
        summaryPath: resolvedSummaryPath,
        boardPath: resolvedBoardPath,
    };
}

function hasText(value) {
    return typeof value === 'string' && value.trim().length > 0;
}

export function assertItemCanUseStatus(item) {
    if (item.status === 'resolved') {
        if (!Array.isArray(item.evidence) || item.evidence.length === 0) {
            throw new Error(`[${item.id}] resolved 状态至少需要 1 条 evidence`);
        }
        if (!Array.isArray(item.verification) || item.verification.length === 0) {
            throw new Error(`[${item.id}] resolved 状态至少需要 1 条 verification`);
        }
        if (!hasText(item.resolvedMethod) && !hasText(item.notes)) {
            throw new Error(`[${item.id}] resolved 状态至少需要 resolvedMethod（旧数据可临时用 notes 兼容）`);
        }
    }

    if (item.status === 'closed') {
        const hasClosedReason = hasText(item.closedReason);
        const hasNotes = hasText(item.notes);
        const hasEvidence = Array.isArray(item.evidence) && item.evidence.length > 0;
        if (!hasClosedReason && !hasNotes && !hasEvidence) {
            throw new Error(`[${item.id}] closed 状态至少需要 closedReason、notes 或 evidence`);
        }
    }
}

export function updateBoardItems(board, ids, update) {
    if (!Array.isArray(board.items)) {
        throw new Error('状态板缺少 items 数组');
    }

    const changedItems = [];
    const nowIso = new Date().toISOString();
    const targetIds = normalizeStringArray(ids);

    for (const id of targetIds) {
        const item = board.items.find((entry) => entry.id === id || entry.feedbackId === id);
        if (!item) {
            throw new Error(`状态板中未找到反馈: ${id}`);
        }

        const nextItem = {
            ...item,
            status: update.status || item.status,
            updatedAt: nowIso,
            owner: update.owner || item.owner || '',
            notes: update.notes || item.notes || '',
            closedReason: update.closedReason || item.closedReason || '',
            resolvedMethod: update.resolvedMethod || item.resolvedMethod || '',
            evidence: mergeUnique(
                Array.isArray(item.evidence) ? item.evidence : [],
                normalizeStringArray(update.evidence),
            ),
            verification: mergeUnique(
                Array.isArray(item.verification) ? item.verification : [],
                normalizeStringArray(update.verification),
            ),
            screenshots: mergeUnique(
                Array.isArray(item.screenshots) ? item.screenshots : [],
                normalizeStringArray(update.screenshots),
            ),
        };

        assertItemCanUseStatus(nextItem);
        Object.assign(item, nextItem);
        changedItems.push(item);
    }

    board.updatedAt = nowIso;
    return changedItems;
}

export function feedbackIdsForGroup(group, includeDuplicates = true) {
    if (!group) {
        return [];
    }
    if (!includeDuplicates) {
        return normalizeStringArray([group.primaryId]);
    }
    return groupFeedbackIds(group);
}
