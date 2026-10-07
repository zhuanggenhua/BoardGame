import 'dotenv/config';
import mongoose from 'mongoose';
import { writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';

const readArg = (name: string): string | null => {
    const prefix = `--${name}=`;
    const argv = process.argv.slice(2);
    for (let i = 0; i < argv.length; i += 1) {
        const arg = argv[i];
        if (arg.startsWith(prefix)) return arg.slice(prefix.length);
        if (arg === `--${name}` && argv[i + 1]) return argv[i + 1];
    }
    return process.env[`npm_config_${name.replace(/-/g, '_')}`] || null;
};

const requireMongoUri = (): string => {
    const mongoUri = process.env.MONGO_URI?.trim();
    if (!mongoUri) {
        throw new Error('[ReportFeedbackDiagnosticGaps] 缺少 MONGO_URI，报告只读且禁止猜测数据源。');
    }
    return mongoUri;
};

const parsePacket = (value: unknown): Record<string, unknown> | null => {
    if (value && typeof value === 'object' && !Array.isArray(value)) return value as Record<string, unknown>;
    if (typeof value !== 'string' || !value.trim()) return null;
    try {
        const parsed = JSON.parse(value) as unknown;
        return parsed && typeof parsed === 'object' && !Array.isArray(parsed)
            ? parsed as Record<string, unknown>
            : null;
    } catch {
        return null;
    }
};

const run = async (): Promise<void> => {
    const mongoUri = requireMongoUri();
    const limit = Math.max(1, Number(readArg('limit') || 50));
    const outputPath = resolve(readArg('output') || 'temp/feedback-closeout/diagnostic-packet-gap-report.json');

    await mongoose.connect(mongoUri);
    try {
        const collection = mongoose.connection.collection('feedbacks');
        const rows = await collection.find({}, {
            projection: {
                _id: 1,
                content: 1,
                status: 1,
                source: 1,
                reporterType: 1,
                gameName: 1,
                diagnosticPacket: 1,
                stateSnapshot: 1,
                actionLog: 1,
                createdAt: 1,
            },
        }).sort({ createdAt: -1 }).toArray();

        const gapRows = rows.map((row) => {
            const packet = parsePacket(row.diagnosticPacket);
            const missingFields = Array.isArray(packet?.missingFields)
                ? packet.missingFields.filter((value): value is string => typeof value === 'string')
                : [];
            const gapReasons = [
                ...(!packet ? ['缺少 diagnosticPacket'] : []),
                ...(packet && missingFields.length > 0 ? ['现场包仍缺字段'] : []),
                ...(!packet && typeof row.stateSnapshot !== 'string' ? ['缺少旧 stateSnapshot'] : []),
                ...(!packet && typeof row.actionLog !== 'string' ? ['缺少旧 actionLog'] : []),
            ];
            return {
                feedbackId: String(row._id),
                status: row.status ?? null,
                source: row.source ?? null,
                reporterType: row.reporterType ?? null,
                gameName: row.gameName ?? null,
                createdAt: row.createdAt ?? null,
                replayability: typeof packet?.replayability === 'string' ? packet.replayability : null,
                missingFields,
                gapReasons,
                contentPreview: typeof row.content === 'string' ? row.content.slice(0, 160) : '',
            };
        }).filter((row) => row.gapReasons.length > 0);

        const countBy = (key: 'status' | 'source' | 'reporterType' | 'replayability') => (
            gapRows.reduce<Record<string, number>>((counts, row) => {
                const value = row[key] || '未提供';
                counts[String(value)] = (counts[String(value)] || 0) + 1;
                return counts;
            }, {})
        );

        const report = {
            generatedAt: new Date().toISOString(),
            readOnly: true,
            mongoInfo: {
                database: mongoose.connection.name,
                ...(mongoose.connection.host ? { host: mongoose.connection.host } : {}),
            },
            totalFeedbacks: rows.length,
            gapCount: gapRows.length,
            completePacketCount: rows.length - gapRows.length,
            counts: {
                status: countBy('status'),
                source: countBy('source'),
                reporterType: countBy('reporterType'),
                replayability: countBy('replayability'),
            },
            sample: gapRows.slice(0, limit),
            rule: '本报告只读；不补 diagnosticPacket，不推测 roomId/requestId/stateId，不改反馈状态。',
        };

        await writeFile(outputPath, `${JSON.stringify(report, null, 2)}\n`, 'utf8');
        console.log(`[ReportFeedbackDiagnosticGaps] gaps=${gapRows.length} total=${rows.length} report=${outputPath}`);
    } finally {
        await mongoose.disconnect();
    }
};

run().catch((error) => {
    console.error(`[ReportFeedbackDiagnosticGaps] error=${error instanceof Error ? error.message : String(error)}`);
    process.exitCode = 1;
});
