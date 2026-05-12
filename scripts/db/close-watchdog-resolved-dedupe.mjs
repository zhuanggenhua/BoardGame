#!/usr/bin/env node
import 'dotenv/config';
import fs from 'node:fs/promises';
import path from 'node:path';
import mongoose from 'mongoose';

const WATCHDOG_AGGREGATION_WINDOW_MS = 6 * 60 * 60 * 1000;

function readArg(name) {
    const prefix = `--${name}=`;
    const argv = process.argv.slice(2);
    for (let i = 0; i < argv.length; i += 1) {
        const arg = argv[i];
        if (arg.startsWith(prefix)) {
            return arg.slice(prefix.length);
        }
        if (arg === `--${name}` && argv[i + 1]) {
            return argv[i + 1];
        }
    }
    const npmConfigKey = `npm_config_${name.replace(/-/g, '_')}`;
    return process.env[npmConfigKey] || null;
}

function hasFlag(name) {
    const argv = process.argv.slice(2);
    return argv.includes(`--${name}`) || argv.includes(`--${name}=true`);
}

function isNonEmptyString(value) {
    return typeof value === 'string' && value.trim().length > 0;
}

function requireMongoUri() {
    const mongoUri = process.env.MONGO_URI?.trim();
    if (!mongoUri) {
        throw new Error('[CloseWatchdogDedupe] 缺少 MONGO_URI，禁止回退到本机 Mongo。请显式指定线上或本地数据源。');
    }
    return mongoUri;
}

function normalizePath(rawPath, defaultPath) {
    return path.resolve(rawPath || defaultPath);
}

function normalizeGameId(value) {
    if (typeof value !== 'string') {
        return null;
    }
    const normalized = value.trim().toLowerCase();
    return normalized || null;
}

function resolveGameIdentity(row) {
    return normalizeGameId(row?.gameId)
        || normalizeGameId(row?.clientContext?.gameId)
        || normalizeGameId(row?.gameName);
}

function normalizeAggregationSegment(value, fallback) {
    if (typeof value !== 'string') {
        return fallback;
    }
    const normalized = value
        .trim()
        .toLowerCase()
        .replace(/\s+/g, '-')
        .replace(/[^a-z0-9:_-]/g, '');
    return normalized || fallback;
}

function normalizeWatchdogAutoReportFamily(value) {
    const normalized = typeof value === 'string'
        ? value.trim().toLowerCase()
        : '';
    if (!normalized) {
        return 'unknown';
    }
    if (normalized.startsWith('force-end-turn-')) {
        return 'force-end-turn';
    }
    return normalized;
}

function normalizeWatchdogReason(value) {
    if (typeof value !== 'string') {
        return 'unknown';
    }
    const normalized = value
        .trim()
        .toLowerCase()
        .replace(/:steps=\d+\b/g, ':steps')
        .replace(/\s+/g, ' ')
        || 'unknown';
    const segments = normalized.split(':').filter(Boolean);
    if (segments.length >= 2 && ['recover-interaction', 'follow-up-advance'].includes(segments[1])) {
        return `${segments[0]}:${segments[1]}`;
    }
    if (segments.length >= 3 && segments[1] === 'legal-action') {
        return `${segments[0]}:${segments[1]}:${segments[2]}`;
    }
    return normalized;
}

function computeDedupeKey(row, gameId) {
    const source = 'online-ai-watchdog';
    const autoReportFamily = normalizeWatchdogAutoReportFamily(
        row.autoReportKind ?? row.errorContext?.name,
    );
    const normalizedReason = normalizeWatchdogReason(
        row.errorContext?.message
        ?? String(row.content || '').replace(/^\[system\]\[online-ai-watchdog\]\s+/i, ''),
    );
    const route = normalizeAggregationSegment(row.clientContext?.route, 'unknown-route');
    const mode = normalizeAggregationSegment(row.clientContext?.mode, 'unknown-mode');
    return [
        'system-feedback',
        source,
        gameId,
        route,
        mode,
        autoReportFamily,
        normalizedReason || 'unknown',
    ].join(':');
}

function chooseTimeValue(row) {
    const candidates = [row.lastOccurredAt, row.createdAt, row.updatedAt];
    for (const candidate of candidates) {
        const value = candidate ? new Date(candidate).getTime() : Number.NaN;
        if (Number.isFinite(value)) {
            return value;
        }
    }
    return 0;
}

function appendBoardNote(existingNotes, line) {
    if (!isNonEmptyString(existingNotes)) {
        return line;
    }
    if (existingNotes.includes(line)) {
        return existingNotes;
    }
    return `${existingNotes}\n${line}`;
}

async function readBoard(boardPath) {
    const raw = await fs.readFile(boardPath, 'utf8');
    return JSON.parse(raw);
}

async function writeJson(filePath, payload) {
    await fs.mkdir(path.dirname(filePath), { recursive: true });
    await fs.writeFile(filePath, `${JSON.stringify(payload, null, 2)}\n`, 'utf8');
}

function buildWindowSessions(rows) {
    const sorted = [...rows].sort((a, b) => chooseTimeValue(a) - chooseTimeValue(b));
    const sessions = [];
    let current = [];
    let previousTimestamp = null;
    for (const row of sorted) {
        const nowTimestamp = chooseTimeValue(row);
        if (previousTimestamp === null || nowTimestamp - previousTimestamp <= WATCHDOG_AGGREGATION_WINDOW_MS) {
            current.push(row);
        } else {
            sessions.push(current);
            current = [row];
        }
        previousTimestamp = nowTimestamp;
    }
    if (current.length > 0) {
        sessions.push(current);
    }
    return sessions;
}

function compareCanonicalPriority(a, b) {
    const statusRank = {
        in_progress: 4,
        open: 3,
        resolved: 2,
        closed: 1,
    };
    const aRank = statusRank[String(a.status)] ?? 0;
    const bRank = statusRank[String(b.status)] ?? 0;
    if (bRank !== aRank) {
        return bRank - aRank;
    }
    const timeDiff = chooseTimeValue(b) - chooseTimeValue(a);
    if (timeDiff !== 0) {
        return timeDiff;
    }
    const aResolvedScore = a.status === 'resolved' ? 1 : 0;
    const bResolvedScore = b.status === 'resolved' ? 1 : 0;
    if (bResolvedScore !== aResolvedScore) {
        return bResolvedScore - aResolvedScore;
    }
    return String(b._id).localeCompare(String(a._id));
}

async function main() {
    const apply = hasFlag('apply');
    const boardPath = normalizePath(readArg('board'), 'temp/feedback-closeout/status-board.json');
    const outputPath = normalizePath(
        readArg('output'),
        'temp/feedback-closeout/close-watchdog-resolved-dedupe-report.json',
    );
    const mongoUri = requireMongoUri();
    const windowHours = WATCHDOG_AGGREGATION_WINDOW_MS / (60 * 60 * 1000);

    const board = await readBoard(boardPath);

    await mongoose.connect(mongoUri);
    const collection = mongoose.connection.collection('feedbacks');

    const systemScopeQuery = {
        $or: [
            { source: 'online-ai-watchdog' },
            { contactInfo: 'system:online-ai-watchdog' },
            { 'errorContext.source': 'online-ai-watchdog' },
            { content: /^\[system\]\[online-ai-watchdog\]\s+/ },
        ],
        status: { $in: ['open', 'in_progress', 'resolved', 'closed'] },
    };

    const rows = await collection.find(
        systemScopeQuery,
        {
            projection: {
                _id: 1,
                content: 1,
                status: 1,
                source: 1,
                reporterType: 1,
                gameId: 1,
                gameName: 1,
                autoReportKind: 1,
                clientContext: 1,
                errorContext: 1,
                incidentKey: 1,
                aggregationKey: 1,
                lastOccurredAt: 1,
                createdAt: 1,
                updatedAt: 1,
            },
        },
    ).toArray();

    const clusters = new Map();
    const dedupeKeyByFeedbackId = new Map();
    const skippedMissingGameIdentityFeedbackIds = [];
    for (const row of rows) {
        const gameIdentity = resolveGameIdentity(row);
        if (!gameIdentity) {
            skippedMissingGameIdentityFeedbackIds.push(String(row._id));
            continue;
        }
        const dedupeKey = computeDedupeKey(row, gameIdentity);
        if (!clusters.has(dedupeKey)) {
            clusters.set(dedupeKey, []);
        }
        clusters.get(dedupeKey).push(row);
        dedupeKeyByFeedbackId.set(String(row._id), dedupeKey);
    }

    const clusterSummaries = [];
    const latestSessionCanonicals = [];
    const shouldBeClosed = [];
    let skippedReopenConflictCount = 0;

    for (const [dedupeKey, groupedRows] of clusters.entries()) {
        const sessions = buildWindowSessions(groupedRows);
        const perSession = [];
        const latestSessionIndex = Math.max(0, sessions.length - 1);
        for (let sessionIndex = 0; sessionIndex < sessions.length; sessionIndex += 1) {
            const sessionRows = sessions[sessionIndex];
            const canonical = [...sessionRows].sort(compareCanonicalPriority)[0];
            const isLatestSession = sessionIndex === latestSessionIndex;
            const duplicateRows = sessionRows.filter((row) => String(row._id) !== String(canonical._id));
            if (isLatestSession) {
                latestSessionCanonicals.push(canonical);
                shouldBeClosed.push(...duplicateRows);
            } else {
                shouldBeClosed.push(...sessionRows);
            }

            perSession.push({
                canonicalFeedbackId: String(canonical._id),
                memberFeedbackIds: sessionRows.map((row) => String(row._id)),
                duplicateFeedbackIds: duplicateRows.map((row) => String(row._id)),
                keepLatestSessionCanonical: isLatestSession,
            });
        }

        clusterSummaries.push({
            dedupeKey,
            count: groupedRows.length,
            sessionCount: perSession.length,
            sessions: perSession,
        });
    }

    clusterSummaries.sort((a, b) => b.count - a.count);

    const closeRows = shouldBeClosed.filter((row) => row.status !== 'closed');
    const closeRowIdSet = new Set(closeRows.map((row) => String(row._id)));
    const shouldSkipReopenRows = latestSessionCanonicals.filter((row) => {
        if (row.status !== 'closed') {
            return false;
        }
        const dedupeKey = dedupeKeyByFeedbackId.get(String(row._id));
        if (!dedupeKey) {
            return false;
        }
        return rows.some(
            (candidate) => String(candidate._id) !== String(row._id)
                && dedupeKeyByFeedbackId.get(String(candidate._id)) === dedupeKey
                && !closeRowIdSet.has(String(candidate._id))
                && ['open', 'in_progress', 'resolved'].includes(String(candidate.status)),
        );
    });
    skippedReopenConflictCount = shouldSkipReopenRows.length;
    const reopenRows = latestSessionCanonicals.filter((row) => {
        if (row.status !== 'closed') {
            return false;
        }
        const dedupeKey = dedupeKeyByFeedbackId.get(String(row._id));
        if (!dedupeKey) {
            return false;
        }
        const hasOtherActive = rows.some(
            (candidate) => String(candidate._id) !== String(row._id)
                && dedupeKeyByFeedbackId.get(String(candidate._id)) === dedupeKey
                && !closeRowIdSet.has(String(candidate._id))
                && ['open', 'in_progress', 'resolved'].includes(String(candidate.status)),
        );
        return !hasOtherActive;
    });

    const report = {
        generatedAt: new Date().toISOString(),
        apply,
        dedupeWindowHours: windowHours,
        boardPath,
        outputPath,
        totalSystemCandidates: rows.length,
        skippedMissingGameIdentityCount: skippedMissingGameIdentityFeedbackIds.length,
        skippedMissingGameIdentityFeedbackIds,
        totalClusterCount: clusterSummaries.length,
        latestSessionCanonicalCount: latestSessionCanonicals.length,
        closeTargetCount: closeRows.length,
        reopenTargetCount: reopenRows.length,
        skippedReopenConflictCount,
        clusterSummaries,
        updateResult: null,
    };

    if (apply && (closeRows.length > 0 || reopenRows.length > 0)) {
        const applyTimestamp = new Date().toISOString();

        const closeIds = closeRows.map((row) => new mongoose.Types.ObjectId(String(row._id)));
        const reopenIds = reopenRows.map((row) => new mongoose.Types.ObjectId(String(row._id)));

        const closeResult = closeIds.length > 0
            ? await collection.updateMany(
                { _id: { $in: closeIds }, status: { $in: ['open', 'in_progress', 'resolved'] } },
                {
                    $set: { status: 'closed', updatedAt: new Date(applyTimestamp) },
                    $unset: { aggregationActiveKey: '' },
                },
            )
            : { matchedCount: 0, modifiedCount: 0 };

        let reopenResult = { matchedCount: 0, modifiedCount: 0, duplicateKeyConflicts: 0 };
        if (reopenIds.length > 0) {
            const reopenOps = reopenRows.map((row) => {
                const feedbackId = String(row._id);
                return {
                    updateOne: {
                        filter: { _id: new mongoose.Types.ObjectId(feedbackId), status: 'closed' },
                        update: {
                            $set: {
                                status: 'resolved',
                                updatedAt: new Date(applyTimestamp),
                                aggregationKey: dedupeKeyByFeedbackId.get(feedbackId) || row.aggregationKey,
                                incidentKey: dedupeKeyByFeedbackId.get(feedbackId) || row.aggregationKey,
                                aggregationActiveKey: dedupeKeyByFeedbackId.get(feedbackId) || row.aggregationKey,
                            },
                        },
                    },
                };
            });
            try {
                const reopenWriteResult = await collection.bulkWrite(reopenOps, { ordered: false });
                reopenResult = {
                    matchedCount: reopenWriteResult.matchedCount ?? 0,
                    modifiedCount: reopenWriteResult.modifiedCount ?? 0,
                    duplicateKeyConflicts: 0,
                };
            } catch (error) {
                const writeErrors = Array.isArray(error?.writeErrors) ? error.writeErrors : [];
                const hasNonDuplicateKeyError = writeErrors.some((entry) => Number(entry?.code) !== 11000);
                if (hasNonDuplicateKeyError) {
                    throw error;
                }
                const partialResult = error?.result;
                reopenResult = {
                    matchedCount: Number(partialResult?.matchedCount ?? 0),
                    modifiedCount: Number(partialResult?.modifiedCount ?? 0),
                    duplicateKeyConflicts: writeErrors.length,
                };
            }
        }

        const closedRows = closeIds.length > 0
            ? await collection.find({ _id: { $in: closeIds }, status: 'closed' }, { projection: { _id: 1 } }).toArray()
            : [];
        const reopenedRows = reopenIds.length > 0
            ? await collection.find({ _id: { $in: reopenIds }, status: 'resolved' }, { projection: { _id: 1 } }).toArray()
            : [];

        const closedIds = new Set(closedRows.map((item) => String(item._id)));
        const reopenedIds = new Set(reopenedRows.map((item) => String(item._id)));

        let boardUpdatedCount = 0;
        for (const item of board.items) {
            const feedbackId = String(item?.feedbackId || item?.id || '').trim();
            if (!feedbackId) {
                continue;
            }
            if (closedIds.has(feedbackId)) {
                item.status = 'closed';
                item.lastFetchedStatus = 'closed';
                item.updatedAt = applyTimestamp;
                item.notes = appendBoardNote(
                    item.notes,
                    `${applyTimestamp} watchdog 窗口去重闭环：非最新窗口或同窗口重复项归档为 closed。`,
                );
                boardUpdatedCount += 1;
                continue;
            }
            if (reopenedIds.has(feedbackId)) {
                item.status = 'resolved';
                item.lastFetchedStatus = 'resolved';
                item.updatedAt = applyTimestamp;
                item.notes = appendBoardNote(
                    item.notes,
                    `${applyTimestamp} watchdog 窗口去重修正：仅最新窗口 canonical 保留为 resolved。`,
                );
                boardUpdatedCount += 1;
            }
        }

        if (boardUpdatedCount > 0) {
            board.updatedAt = applyTimestamp;
            if (Number.isInteger(board.version)) {
                board.version += 1;
            }
            await writeJson(boardPath, board);
        }

        report.updateResult = {
            closeMatchedCount: closeResult.matchedCount,
            closeModifiedCount: closeResult.modifiedCount,
            reopenMatchedCount: reopenResult.matchedCount,
            reopenModifiedCount: reopenResult.modifiedCount,
            reopenDuplicateKeyConflictCount: reopenResult.duplicateKeyConflicts,
            closedInMongoCount: closedIds.size,
            reopenedInMongoCount: reopenedIds.size,
            boardUpdatedCount,
            appliedAt: applyTimestamp,
        };
    }

    await writeJson(outputPath, report);
    await mongoose.disconnect();

    console.log(
        `[WatchdogResolvedDedupeCloseout] apply=${apply} total=${report.totalSystemCandidates} `
        + `clusters=${report.totalClusterCount} closeTargets=${report.closeTargetCount} `
        + `reopenTargets=${report.reopenTargetCount} report=${outputPath}`,
    );
    if (report.updateResult) {
        console.log(
            `[WatchdogResolvedDedupeCloseout] closeModified=${report.updateResult.closeModifiedCount} `
            + `reopenModified=${report.updateResult.reopenModifiedCount} `
            + `reopenConflict=${report.updateResult.reopenDuplicateKeyConflictCount} `
            + `closedInMongo=${report.updateResult.closedInMongoCount} `
            + `reopenedInMongo=${report.updateResult.reopenedInMongoCount} `
            + `boardUpdated=${report.updateResult.boardUpdatedCount}`,
        );
    }
}

main().catch(async (error) => {
    try {
        await mongoose.disconnect();
    } catch {
        // ignore disconnect errors during failure handling
    }
    const message = error instanceof Error ? error.stack || error.message : String(error);
    console.error(`[WatchdogResolvedDedupeCloseout] error=${message}`);
    process.exitCode = 1;
});
