import { createHash } from 'node:crypto';
import {
    appendFile,
    mkdir,
    open,
    readFile,
    readdir,
    rename,
    rm,
    stat,
} from 'node:fs/promises';
import path from 'node:path';
import type {
    TrainingCompletedMatch,
    TrainingDataRecorder,
    TrainingDecisionSample,
    TrainingMatchCommitResult,
} from '../src/engine/transport/trainingData.js';

const DEFAULT_TRAINING_DATA_DIR = path.join(process.cwd(), 'memory', 'training-data');
const DEFAULT_TRAINING_DATA_RETENTION_DAYS = 30;
const DEFAULT_MAX_BYTES_PER_GAME = 300 * 1024 * 1024;
const DEFAULT_PENDING_RETENTION_HOURS = 24;

export interface JsonlTrainingDataRecorderOptions {
    baseDir?: string;
    rawDir?: string;
    archiveDir?: string;
    pendingDir?: string;
    completedDir?: string;
    retentionDays?: number;
    maxBytesPerGame?: number;
    pendingRetentionHours?: number;
    now?: () => Date;
}

export interface TrainingDataCaptureEnv {
    ENABLE_TRAINING_DATA_CAPTURE?: string;
    TRAINING_DATA_DIR?: string;
    TRAINING_DATA_RAW_DIR?: string;
    TRAINING_DATA_ARCHIVE_DIR?: string;
    TRAINING_DATA_PENDING_DIR?: string;
    TRAINING_DATA_COMPLETED_DIR?: string;
    TRAINING_DATA_RETENTION_DAYS?: string;
    TRAINING_DATA_PENDING_RETENTION_HOURS?: string;
    NODE_ENV?: string;
}

export interface TrainingDataArchiveSummary {
    archivedFiles: number;
    archivedBytes: number;
}

export interface TrainingDataPendingCleanupSummary {
    removedFiles: number;
    removedBytes: number;
}

interface RecorderDirs {
    rawDir: string;
    archiveDir: string;
    pendingDir: string;
    completedDir: string;
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

function toMatchFileKey(matchId: string): string {
    return createHash('sha256').update(matchId).digest('hex');
}

function resolveRecorderDirs(options?: JsonlTrainingDataRecorderOptions): RecorderDirs {
    const baseDir = options?.baseDir ?? DEFAULT_TRAINING_DATA_DIR;
    return {
        rawDir: options?.rawDir ?? path.join(baseDir, 'raw'),
        archiveDir: options?.archiveDir ?? path.join(baseDir, 'archive'),
        pendingDir: options?.pendingDir ?? path.join(baseDir, 'pending'),
        completedDir: options?.completedDir ?? path.join(baseDir, 'completed'),
    };
}

function isMissingPathError(error: unknown): boolean {
    return (error as NodeJS.ErrnoException | undefined)?.code === 'ENOENT';
}

export class JsonlTrainingDataRecorder implements TrainingDataRecorder {
    private readonly rawDir: string;
    private readonly archiveDir: string;
    private readonly pendingDir: string;
    private readonly completedDir: string;
    private readonly retentionDays: number;
    private readonly maxBytesPerGame: number;
    private readonly pendingRetentionHours: number;
    private readonly now: () => Date;
    private readonly matchOperations = new Map<string, Promise<unknown>>();
    private readonly gameCommitOperations = new Map<string, Promise<unknown>>();
    private readonly failedMatches = new Set<string>();
    private readonly activePendingFiles = new Set<string>();
    private dirReady: Promise<void> | null = null;
    private lastMaintenanceSweepDay: string | null = null;

    constructor(options?: JsonlTrainingDataRecorderOptions) {
        const dirs = resolveRecorderDirs(options);
        this.rawDir = dirs.rawDir;
        this.archiveDir = dirs.archiveDir;
        this.pendingDir = dirs.pendingDir;
        this.completedDir = dirs.completedDir;
        this.retentionDays = options?.retentionDays ?? DEFAULT_TRAINING_DATA_RETENTION_DAYS;
        this.maxBytesPerGame = Number.isFinite(options?.maxBytesPerGame)
            && (options?.maxBytesPerGame ?? 0) > 0
            ? options!.maxBytesPerGame!
            : DEFAULT_MAX_BYTES_PER_GAME;
        this.pendingRetentionHours = Number.isFinite(options?.pendingRetentionHours)
            && (options?.pendingRetentionHours ?? 0) > 0
            ? options!.pendingRetentionHours!
            : DEFAULT_PENDING_RETENTION_HOURS;
        this.now = options?.now ?? (() => new Date());
    }

    async stageDecisionSample(sample: TrainingDecisionSample): Promise<void> {
        const operationKey = this.toOperationKey(sample.schemaVersion, sample.gameId, sample.matchId);
        await this.withQueue(this.matchOperations, operationKey, async () => {
            try {
                await this.appendPendingSample(sample);
            } catch (error) {
                this.failedMatches.add(operationKey);
                throw error;
            }
        });
    }

    async commitCompletedMatch(match: TrainingCompletedMatch): Promise<TrainingMatchCommitResult> {
        const operationKey = this.toOperationKey(match.schemaVersion, match.gameId, match.matchId);
        return this.withQueue(this.matchOperations, operationKey, async () => {
            await this.ensureDir();

            if (this.failedMatches.has(operationKey)) {
                return this.createNonCommitResult('failed');
            }

            if (match.finalSample) {
                this.assertFinalSampleMatches(match, match.finalSample);
                try {
                    await this.appendPendingSample(match.finalSample);
                } catch (error) {
                    this.failedMatches.add(operationKey);
                    throw error;
                }
            }

            const pendingPath = this.getPendingFilePath(match);
            const pendingBytes = await this.getFileSize(pendingPath);
            if (pendingBytes === null || pendingBytes === 0) {
                await rm(pendingPath, { force: true });
                this.failedMatches.delete(operationKey);
                return this.createNonCommitResult('empty');
            }

            return this.withQueue(this.gameCommitOperations, match.gameId, async () => {
                const finalPath = this.getCompletedFilePath(match);
                const existingFinalBytes = await this.getFileSize(finalPath);
                if (existingFinalBytes !== null) {
                    await rm(pendingPath, { force: true });
                    this.failedMatches.delete(operationKey);
                    return {
                        status: 'already-committed',
                        committedBytes: existingFinalBytes,
                        gameBytes: await this.getCommittedGameBytes(match.gameId),
                        maxBytes: this.maxBytesPerGame,
                    };
                }

                const gameBytes = await this.getCommittedGameBytes(match.gameId);
                if (gameBytes >= this.maxBytesPerGame || gameBytes + pendingBytes > this.maxBytesPerGame) {
                    await rm(pendingPath, { force: true });
                    this.failedMatches.delete(operationKey);
                    return {
                        status: 'capacity-reached',
                        pendingBytes,
                        gameBytes,
                        maxBytes: this.maxBytesPerGame,
                    };
                }

                await mkdir(path.dirname(finalPath), { recursive: true });
                const pendingHandle = await open(pendingPath, 'r+');
                try {
                    await pendingHandle.sync();
                } finally {
                    await pendingHandle.close();
                }
                await rename(pendingPath, finalPath);
                this.failedMatches.delete(operationKey);

                try {
                    await this.maybeRunMaintenance();
                } catch {
                    // 历史维护不能反向把已原子提交的完整对局标记为失败。
                }

                return {
                    status: 'committed',
                    committedBytes: pendingBytes,
                    gameBytes: gameBytes + pendingBytes,
                    maxBytes: this.maxBytesPerGame,
                };
            });
        });
    }

    async discardPendingMatch(
        match: Pick<TrainingCompletedMatch, 'schemaVersion' | 'gameId' | 'matchId'>,
    ): Promise<void> {
        const operationKey = this.toOperationKey(match.schemaVersion, match.gameId, match.matchId);
        await this.withQueue(this.matchOperations, operationKey, async () => {
            await rm(this.getPendingFilePath(match), { force: true });
            this.failedMatches.delete(operationKey);
        });
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

    async cleanupExpiredPendingFiles(): Promise<TrainingDataPendingCleanupSummary> {
        await this.ensureDir();
        if (!Number.isFinite(this.pendingRetentionHours) || this.pendingRetentionHours <= 0) {
            return { removedFiles: 0, removedBytes: 0 };
        }

        const cutoffMs = this.now().getTime() - this.pendingRetentionHours * 60 * 60 * 1000;
        const summary: TrainingDataPendingCleanupSummary = {
            removedFiles: 0,
            removedBytes: 0,
        };

        const schemaDirs = await this.readDirectoryNames(this.pendingDir, 'directory');
        for (const schemaDir of schemaDirs) {
            const schemaPendingDir = path.join(this.pendingDir, schemaDir);
            const gameDirs = await this.readDirectoryNames(schemaPendingDir, 'directory');
            for (const gameId of gameDirs) {
                const gamePendingDir = path.join(schemaPendingDir, gameId);
                const filenames = await this.readDirectoryNames(gamePendingDir, 'file');
                for (const filename of filenames) {
                    if (!filename.endsWith('.jsonl.pending')) continue;
                    const pendingPath = path.join(gamePendingDir, filename);
                    if (this.activePendingFiles.has(pendingPath)) continue;
                    const fileStat = await stat(pendingPath);
                    if (fileStat.mtimeMs >= cutoffMs) continue;
                    if (this.activePendingFiles.has(pendingPath)) continue;
                    await rm(pendingPath, { force: true });
                    summary.removedFiles += 1;
                    summary.removedBytes += fileStat.size;
                }
            }
        }

        return summary;
    }

    private async appendPendingSample(sample: TrainingDecisionSample): Promise<void> {
        await this.ensureDir();
        const pendingPath = this.getPendingFilePath(sample);
        await mkdir(path.dirname(pendingPath), { recursive: true });
        this.activePendingFiles.add(pendingPath);
        try {
            await appendFile(pendingPath, `${JSON.stringify(sample)}\n`, 'utf8');
        } finally {
            this.activePendingFiles.delete(pendingPath);
        }
        try {
            await this.maybeRunMaintenance();
        } catch {
            // 清理失败不应污染当前对局的采集状态，下一次采集会再次尝试。
        }
    }

    private assertFinalSampleMatches(match: TrainingCompletedMatch, sample: TrainingDecisionSample): void {
        if (
            sample.schemaVersion !== match.schemaVersion
            || sample.gameId !== match.gameId
            || sample.matchId !== match.matchId
        ) {
            throw new Error('training final sample does not match completed match identity');
        }
    }

    private getPendingFilePath(
        match: Pick<TrainingCompletedMatch, 'schemaVersion' | 'gameId' | 'matchId'>,
    ): string {
        return path.join(
            this.pendingDir,
            toSchemaDirName(match.schemaVersion),
            match.gameId,
            `${toMatchFileKey(match.matchId)}.jsonl.pending`,
        );
    }

    private getCompletedFilePath(match: TrainingCompletedMatch): string {
        return path.join(
            this.completedDir,
            toSchemaDirName(match.schemaVersion),
            match.gameId,
            toDayKey(match.completedAt),
            `${toMatchFileKey(match.matchId)}.jsonl`,
        );
    }

    private toOperationKey(schemaVersion: number, gameId: string, matchId: string): string {
        return `${schemaVersion}:${gameId}:${matchId}`;
    }

    private createNonCommitResult(
        status: 'empty' | 'failed',
    ): TrainingMatchCommitResult {
        return {
            status,
            committedBytes: 0,
            gameBytes: 0,
            maxBytes: this.maxBytesPerGame,
        };
    }

    private ensureDir(): Promise<void> {
        if (!this.dirReady) {
            this.dirReady = Promise.all([
                mkdir(this.rawDir, { recursive: true }),
                mkdir(this.archiveDir, { recursive: true }),
                mkdir(this.pendingDir, { recursive: true }),
                mkdir(this.completedDir, { recursive: true }),
            ]).then(() => undefined);
        }
        return this.dirReady;
    }

    private async maybeRunMaintenance(): Promise<void> {
        const today = toDayKey(this.now().getTime());
        if (this.lastMaintenanceSweepDay === today) {
            return;
        }

        await this.archiveExpiredRawFiles();
        await this.cleanupExpiredPendingFiles();
        this.lastMaintenanceSweepDay = today;
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

    private async getCommittedGameBytes(gameId: string): Promise<number> {
        let total = 0;
        const schemaDirs = await this.readDirectoryNames(this.completedDir, 'directory');
        for (const schemaDir of schemaDirs) {
            total += await this.sumDirectoryFiles(path.join(this.completedDir, schemaDir, gameId));
        }
        return total;
    }

    private async sumDirectoryFiles(dirPath: string): Promise<number> {
        let entries;
        try {
            entries = await readdir(dirPath, { withFileTypes: true });
        } catch (error) {
            if (isMissingPathError(error)) return 0;
            throw error;
        }

        let total = 0;
        for (const entry of entries) {
            const entryPath = path.join(dirPath, entry.name);
            if (entry.isDirectory()) {
                total += await this.sumDirectoryFiles(entryPath);
            } else if (entry.isFile()) {
                total += (await stat(entryPath)).size;
            }
        }
        return total;
    }

    private async getFileSize(filePath: string): Promise<number | null> {
        try {
            return (await stat(filePath)).size;
        } catch (error) {
            if (isMissingPathError(error)) return null;
            throw error;
        }
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

    private withQueue<T>(
        queues: Map<string, Promise<unknown>>,
        key: string,
        operation: () => Promise<T>,
    ): Promise<T> {
        const previous = queues.get(key) ?? Promise.resolve();
        const queued = previous.catch(() => undefined).then(operation);
        const tracked = queued.finally(() => {
            if (queues.get(key) === tracked) {
                queues.delete(key);
            }
        });
        queues.set(key, tracked);
        return tracked;
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
    const parsedPendingRetentionHours = Number.parseInt(
        env.TRAINING_DATA_PENDING_RETENTION_HOURS ?? `${DEFAULT_PENDING_RETENTION_HOURS}`,
        10,
    );

    return new JsonlTrainingDataRecorder({
        baseDir: env.TRAINING_DATA_DIR,
        rawDir: env.TRAINING_DATA_RAW_DIR,
        archiveDir: env.TRAINING_DATA_ARCHIVE_DIR,
        pendingDir: env.TRAINING_DATA_PENDING_DIR,
        completedDir: env.TRAINING_DATA_COMPLETED_DIR,
        retentionDays: Number.isNaN(parsedRetentionDays)
            ? DEFAULT_TRAINING_DATA_RETENTION_DAYS
            : parsedRetentionDays,
        pendingRetentionHours: Number.isNaN(parsedPendingRetentionHours)
            ? DEFAULT_PENDING_RETENTION_HOURS
            : parsedPendingRetentionHours,
    });
}
