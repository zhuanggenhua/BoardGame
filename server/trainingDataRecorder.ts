import { appendFile, mkdir, readFile, readdir, rename, rm } from 'node:fs/promises';
import path from 'node:path';
import type { TrainingDataRecorder, TrainingDecisionSample } from '../src/engine/transport/trainingData.js';

const DEFAULT_TRAINING_DATA_DIR = path.join(process.cwd(), 'memory', 'training-data');
const DEFAULT_TRAINING_DATA_RETENTION_DAYS = 30;

export interface JsonlTrainingDataRecorderOptions {
    baseDir?: string;
    rawDir?: string;
    archiveDir?: string;
    retentionDays?: number;
    now?: () => Date;
}

export interface TrainingDataCaptureEnv {
    ENABLE_TRAINING_DATA_CAPTURE?: string;
    TRAINING_DATA_DIR?: string;
    TRAINING_DATA_RAW_DIR?: string;
    TRAINING_DATA_ARCHIVE_DIR?: string;
    TRAINING_DATA_RETENTION_DAYS?: string;
    NODE_ENV?: string;
}

export interface TrainingDataArchiveSummary {
    archivedFiles: number;
    archivedBytes: number;
}

function toSchemaDirName(schemaVersion: number): string {
    return `v${schemaVersion}`;
}

function toDayKey(timestamp: number): string {
    return new Date(timestamp).toISOString().slice(0, 10);
}

function parseDayKey(dayKey: string): number | null {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(dayKey)) {
        return null;
    }

    const timestamp = Date.parse(`${dayKey}T00:00:00.000Z`);
    return Number.isNaN(timestamp) ? null : timestamp;
}

function resolveRecorderDirs(options?: JsonlTrainingDataRecorderOptions): { rawDir: string; archiveDir: string } {
    const baseDir = options?.baseDir ?? DEFAULT_TRAINING_DATA_DIR;
    return {
        rawDir: options?.rawDir ?? path.join(baseDir, 'raw'),
        archiveDir: options?.archiveDir ?? path.join(baseDir, 'archive'),
    };
}

export class JsonlTrainingDataRecorder implements TrainingDataRecorder {
    private readonly rawDir: string;
    private readonly archiveDir: string;
    private readonly retentionDays: number;
    private readonly now: () => Date;
    private dirReady: Promise<void> | null = null;
    private lastArchiveSweepDay: string | null = null;

    constructor(options?: JsonlTrainingDataRecorderOptions) {
        const dirs = resolveRecorderDirs(options);
        this.rawDir = dirs.rawDir;
        this.archiveDir = dirs.archiveDir;
        this.retentionDays = options?.retentionDays ?? DEFAULT_TRAINING_DATA_RETENTION_DAYS;
        this.now = options?.now ?? (() => new Date());
    }

    async recordDecisionSample(sample: TrainingDecisionSample): Promise<void> {
        await this.ensureDir();
        const day = toDayKey(sample.capturedAt);
        const gameDir = path.join(this.rawDir, toSchemaDirName(sample.schemaVersion), sample.gameId);
        await mkdir(gameDir, { recursive: true });
        const filePath = path.join(gameDir, `${day}.jsonl`);
        await appendFile(filePath, `${JSON.stringify(sample)}\n`, 'utf8');
        await this.maybeArchiveExpiredRawFiles();
    }

    async archiveExpiredRawFiles(): Promise<TrainingDataArchiveSummary> {
        await this.ensureDir();
        if (!Number.isFinite(this.retentionDays) || this.retentionDays <= 0) {
            return { archivedFiles: 0, archivedBytes: 0 };
        }

        const cutoffDay = toDayKey(
            this.now().getTime() - this.retentionDays * 24 * 60 * 60 * 1000,
        );
        const summary: TrainingDataArchiveSummary = {
            archivedFiles: 0,
            archivedBytes: 0,
        };

        const schemaDirs = await this.readDirectoryNames(this.rawDir, 'directory');
        for (const schemaDir of schemaDirs) {
            const schemaRawDir = path.join(this.rawDir, schemaDir);
            const gameDirs = await this.readDirectoryNames(schemaRawDir, 'directory');

            for (const gameId of gameDirs) {
                const gameRawDir = path.join(schemaRawDir, gameId);
                const filenames = await this.readDirectoryNames(gameRawDir, 'file');

                for (const filename of filenames) {
                    if (!filename.endsWith('.jsonl')) {
                        continue;
                    }

                    const day = filename.slice(0, -'.jsonl'.length);
                    if (!this.shouldArchiveDay(day, cutoffDay)) {
                        continue;
                    }

                    const sourcePath = path.join(gameRawDir, filename);
                    const targetDir = path.join(this.archiveDir, schemaDir, gameId);
                    const targetPath = path.join(targetDir, filename);
                    await mkdir(targetDir, { recursive: true });
                    summary.archivedBytes += await this.moveOrMergeJsonlFile(sourcePath, targetPath);
                    summary.archivedFiles += 1;
                }
            }
        }

        return summary;
    }

    private ensureDir(): Promise<void> {
        if (!this.dirReady) {
            this.dirReady = Promise.all([
                mkdir(this.rawDir, { recursive: true }),
                mkdir(this.archiveDir, { recursive: true }),
            ]).then(() => undefined);
        }
        return this.dirReady;
    }

    private async maybeArchiveExpiredRawFiles(): Promise<void> {
        if (!Number.isFinite(this.retentionDays) || this.retentionDays <= 0) {
            return;
        }

        const today = toDayKey(this.now().getTime());
        if (this.lastArchiveSweepDay === today) {
            return;
        }

        await this.archiveExpiredRawFiles();
        this.lastArchiveSweepDay = today;
    }

    private shouldArchiveDay(dayKey: string, cutoffDay: string): boolean {
        const dayTimestamp = parseDayKey(dayKey);
        const cutoffTimestamp = parseDayKey(cutoffDay);
        if (dayTimestamp === null || cutoffTimestamp === null) {
            return false;
        }
        return dayTimestamp < cutoffTimestamp;
    }

    private async moveOrMergeJsonlFile(sourcePath: string, targetPath: string): Promise<number> {
        const content = await readFile(sourcePath, 'utf8');
        try {
            await rename(sourcePath, targetPath);
        } catch {
            await appendFile(targetPath, content, 'utf8');
            await rm(sourcePath, { force: true });
        }
        return Buffer.byteLength(content, 'utf8');
    }

    private async readDirectoryNames(
        dirPath: string,
        kind: 'directory' | 'file',
    ): Promise<string[]> {
        const entries = await readdir(dirPath, { withFileTypes: true });
        return entries
            .filter((entry) => (kind === 'directory' ? entry.isDirectory() : entry.isFile()))
            .map((entry) => entry.name);
    }
}

export function createTrainingDataRecorderFromEnv(
    env: TrainingDataCaptureEnv = process.env,
): TrainingDataRecorder | undefined {
    const explicitToggle = env.ENABLE_TRAINING_DATA_CAPTURE?.trim().toLowerCase();
    if (explicitToggle === 'false') {
        return undefined;
    }
    if (explicitToggle !== 'true' && env.NODE_ENV !== 'production') {
        return undefined;
    }

    const parsedRetentionDays = Number.parseInt(
        env.TRAINING_DATA_RETENTION_DAYS ?? `${DEFAULT_TRAINING_DATA_RETENTION_DAYS}`,
        10,
    );

    return new JsonlTrainingDataRecorder({
        baseDir: env.TRAINING_DATA_DIR,
        rawDir: env.TRAINING_DATA_RAW_DIR,
        archiveDir: env.TRAINING_DATA_ARCHIVE_DIR,
        retentionDays: Number.isNaN(parsedRetentionDays)
            ? DEFAULT_TRAINING_DATA_RETENTION_DAYS
            : parsedRetentionDays,
    });
}
