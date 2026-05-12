#!/usr/bin/env node
import 'dotenv/config';
import fs from 'node:fs/promises';
import path from 'node:path';
import mongoose from 'mongoose';

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

function normalizePath(rawPath, defaultPath) {
    return path.resolve(rawPath || defaultPath);
}

function isNonEmptyString(value) {
    return typeof value === 'string' && value.trim().length > 0;
}

function requireMongoUri() {
    const mongoUri = process.env.MONGO_URI?.trim();
    if (!mongoUri) {
        throw new Error('[CloseFeedbackCloseout] 缺少 MONGO_URI，禁止回退到本机 Mongo。请显式指定线上或本地数据源。');
    }
    return mongoUri;
}

function hasReviewableBasis(item) {
    const evidence = Array.isArray(item?.evidence) ? item.evidence.filter(isNonEmptyString) : [];
    const verification = Array.isArray(item?.verification) ? item.verification.filter(isNonEmptyString) : [];
    return item?.status === 'resolved' && evidence.length > 0 && verification.length > 0;
}

function buildCloseoutNote(existingNotes, timestamp) {
    const entry = `${timestamp} 批量闭环：状态板已具备 evidence 与 verification，可复核后同步将 Mongo resolved 收口为 closed。`;
    if (!isNonEmptyString(existingNotes)) {
        return entry;
    }
    if (existingNotes.includes(entry)) {
        return existingNotes;
    }
    return `${existingNotes}\n${entry}`;
}

function getSkipReason(boardItem) {
    if (!boardItem) {
        return 'missing_status_board_item';
    }
    if (boardItem.status !== 'resolved') {
        return `board_status_${boardItem.status || 'missing'}`;
    }
    if (!Array.isArray(boardItem.evidence) || boardItem.evidence.length === 0) {
        return 'missing_evidence';
    }
    if (!Array.isArray(boardItem.verification) || boardItem.verification.length === 0) {
        return 'missing_verification';
    }
    return 'unknown';
}

async function readBoard(boardPath) {
    const raw = await fs.readFile(boardPath, 'utf8');
    return JSON.parse(raw);
}

async function writeJson(filePath, payload) {
    await fs.mkdir(path.dirname(filePath), { recursive: true });
    await fs.writeFile(filePath, `${JSON.stringify(payload, null, 2)}\n`, 'utf8');
}

async function main() {
    const apply = hasFlag('apply');
    const boardPath = normalizePath(readArg('board'), 'temp/feedback-closeout/status-board.json');
    const outputPath = normalizePath(
        readArg('output'),
        'temp/feedback-closeout/close-feedback-closeout-resolved-report.json',
    );
    const mongoUri = requireMongoUri();

    const board = await readBoard(boardPath);
    const boardByFeedbackId = new Map();
    for (const item of Array.isArray(board.items) ? board.items : []) {
        const key = String(item?.feedbackId || item?.id || '').trim();
        if (key) {
            boardByFeedbackId.set(key, item);
        }
    }

    await mongoose.connect(mongoUri);
    const collection = mongoose.connection.collection('feedbacks');
    const mongoInfo = {
        database: mongoose.connection.name,
        ...(mongoose.connection.host ? { host: mongoose.connection.host } : {}),
    };

    const query = {
        status: 'resolved',
        $or: [
            { source: null },
            { source: { $exists: false } },
            { source: 'feedback-modal' },
        ],
        $nor: [
            { reporterType: 'system' },
            { source: 'online-ai-watchdog' },
            { contactInfo: 'system:online-ai-watchdog' },
            { 'errorContext.source': 'online-ai-watchdog' },
            { content: /^\[system\]\[online-ai-watchdog\]\s+/i },
        ],
    };

    const rows = await collection.find(query, {
        projection: {
            _id: 1,
            content: 1,
            source: 1,
            reporterType: 1,
            contactInfo: 1,
            errorContext: 1,
            status: 1,
            updatedAt: 1,
            createdAt: 1,
            gameId: 1,
        },
    }).sort({ updatedAt: -1, createdAt: -1 }).toArray();

    const eligible = [];
    const skipped = [];

    for (const row of rows) {
        const feedbackId = String(row._id);
        const boardItem = boardByFeedbackId.get(feedbackId);
        const baseRecord = {
            feedbackId,
            title: boardItem?.title || String(row.content || '').slice(0, 80),
            source: row.source ?? null,
            gameId: row.gameId ?? null,
            mongoStatus: row.status,
            boardStatus: boardItem?.status ?? null,
            updatedAt: row.updatedAt ?? null,
            evidenceCount: Array.isArray(boardItem?.evidence) ? boardItem.evidence.length : 0,
            verificationCount: Array.isArray(boardItem?.verification) ? boardItem.verification.length : 0,
        };

        if (hasReviewableBasis(boardItem)) {
            eligible.push(baseRecord);
        } else {
            skipped.push({
                ...baseRecord,
                skipReason: getSkipReason(boardItem),
            });
        }
    }

    const report = {
        generatedAt: new Date().toISOString(),
        apply,
        boardPath,
        outputPath,
        mongoInfo,
        query,
        totalCandidates: rows.length,
        eligibleCount: eligible.length,
        skippedCount: skipped.length,
        eligible,
        skipped,
        updateResult: null,
    };

    if (apply && eligible.length > 0) {
        const applyTimestamp = new Date().toISOString();
        const targetIds = eligible.map((item) => new mongoose.Types.ObjectId(item.feedbackId));

        const updateResult = await collection.updateMany(
            {
                _id: { $in: targetIds },
                status: 'resolved',
                $or: [
                    { source: null },
                    { source: { $exists: false } },
                    { source: 'feedback-modal' },
                ],
                $nor: [
                    { reporterType: 'system' },
                    { source: 'online-ai-watchdog' },
                    { contactInfo: 'system:online-ai-watchdog' },
                    { 'errorContext.source': 'online-ai-watchdog' },
                    { content: /^\[system\]\[online-ai-watchdog\]\s+/i },
                ],
            },
            {
                $set: {
                    status: 'closed',
                    updatedAt: new Date(applyTimestamp),
                },
                $unset: {
                    aggregationActiveKey: '',
                },
            },
        );

        const closedRows = await collection.find(
            { _id: { $in: targetIds }, status: 'closed' },
            { projection: { _id: 1 } },
        ).toArray();
        const closedIds = new Set(closedRows.map((item) => String(item._id)));

        let boardUpdatedCount = 0;
        for (const item of board.items) {
            const feedbackId = String(item?.feedbackId || item?.id || '').trim();
            if (!feedbackId || !closedIds.has(feedbackId)) {
                continue;
            }
            item.status = 'closed';
            item.lastFetchedStatus = 'closed';
            item.updatedAt = applyTimestamp;
            item.notes = buildCloseoutNote(item.notes, applyTimestamp);
            boardUpdatedCount += 1;
        }

        if (boardUpdatedCount > 0) {
            board.updatedAt = applyTimestamp;
            if (Number.isInteger(board.version)) {
                board.version += 1;
            }
            await writeJson(boardPath, board);
        }

        report.updateResult = {
            matchedCount: updateResult.matchedCount,
            modifiedCount: updateResult.modifiedCount,
            closedInMongoCount: closedIds.size,
            boardUpdatedCount,
            appliedAt: applyTimestamp,
        };
    }

    await writeJson(outputPath, report);
    await mongoose.disconnect();

    console.log(
        `[FeedbackCloseoutResolved] apply=${apply} candidates=${report.totalCandidates} `
        + `eligible=${report.eligibleCount} skipped=${report.skippedCount} `
        + `report=${outputPath}`,
    );
    if (report.updateResult) {
        console.log(
            `[FeedbackCloseoutResolved] matched=${report.updateResult.matchedCount} `
            + `modified=${report.updateResult.modifiedCount} `
            + `closedInMongo=${report.updateResult.closedInMongoCount} `
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
    console.error(`[FeedbackCloseoutResolved] error=${message}`);
    process.exitCode = 1;
});
