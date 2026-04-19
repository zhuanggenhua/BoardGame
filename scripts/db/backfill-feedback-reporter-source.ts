import 'dotenv/config';
import mongoose from 'mongoose';
import { writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';

const readArg = (name: string): string | null => {
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
    const npmConfigValue = process.env[npmConfigKey];
    if (npmConfigValue) {
        return npmConfigValue;
    }
    return null;
};

const hasFlag = (name: string): boolean => {
    const argv = process.argv.slice(2);
    return argv.includes(`--${name}`) || argv.includes(`--${name}=true`);
};

const run = async () => {
    const mongoUri = process.env.MONGO_URI || 'mongodb://localhost:27017/boardgame';
    const apply = hasFlag('apply');
    const limit = Math.max(1, Number(readArg('limit') || 20));
    const output = readArg('output') || 'temp/feedback-auto-report-backfill-report.json';
    const outputPath = resolve(output);

    await mongoose.connect(mongoUri);
    const collection = mongoose.connection.collection('feedbacks');
    const mongoInfo = {
        database: mongoose.connection.name,
        ...(mongoose.connection.host ? { host: mongoose.connection.host } : {}),
    };

    const legacyWatchdogFilter = {
        $or: [
            { contactInfo: 'system:online-ai-watchdog' },
            { 'errorContext.source': 'online-ai-watchdog' },
            { content: /^\[system\]\[online-ai-watchdog\]\s+/ },
        ],
    };

    const missingReporterFilter = {
        $or: [
            { reporterType: { $exists: false } },
            { reporterType: null },
        ],
    };

    const query = {
        $and: [legacyWatchdogFilter, missingReporterFilter],
    };

    const totalMatches = await collection.countDocuments(query);
    const sample = await collection.find(query)
        .project({ _id: 1, content: 1, contactInfo: 1, errorContext: 1, reporterType: 1, source: 1 })
        .limit(limit)
        .toArray();

    const kindStats = await collection.aggregate([
        { $match: query },
        { $group: { _id: '$errorContext.name', count: { $sum: 1 } } },
        { $sort: { count: -1 } },
    ]).toArray();

    let updateResult: { matchedCount: number; modifiedCount: number } | null = null;
    if (apply) {
        const result = await collection.updateMany(query, [
            {
                $set: {
                    reporterType: 'system',
                    source: 'online-ai-watchdog',
                    autoReportKind: { $ifNull: ['$autoReportKind', '$errorContext.name'] },
                },
            },
        ]);
        updateResult = { matchedCount: result.matchedCount, modifiedCount: result.modifiedCount };
    }

    const report = {
        mongoInfo,
        apply,
        limit,
        totalMatches,
        sampleCount: sample.length,
        sample,
        kindStats,
        updateResult,
        generatedAt: new Date().toISOString(),
    };

    await writeFile(outputPath, JSON.stringify(report, null, 2), 'utf8');
    console.log(`[BackfillFeedback] apply=${apply} matched=${totalMatches} report=${outputPath}`);
    if (apply && updateResult) {
        console.log(`[BackfillFeedback] updated=${updateResult.modifiedCount}`);
    }
    await mongoose.disconnect();
};

run().catch((error) => {
    const message = error instanceof Error ? error.message : String(error);
    console.error(`[BackfillFeedback] error=${message}`);
    process.exitCode = 1;
});
