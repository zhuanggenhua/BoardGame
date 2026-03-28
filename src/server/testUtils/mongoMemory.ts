import os from 'node:os';
import path from 'node:path';
import mongoose from 'mongoose';
import { MongoMemoryServer } from 'mongodb-memory-server';

const LOCAL_TEST_MONGO_URI = 'mongodb://127.0.0.1:27017';
export const MONGO_TEST_HOOK_TIMEOUT_MS = 180000;

function configureMongoMemoryServerEnv() {
    process.env.MONGOMS_PREFER_GLOBAL_PATH ??= 'true';
    process.env.MONGOMS_DOWNLOAD_DIR ??= path.join(os.homedir(), '.cache', 'mongodb-binaries');

    // 允许开发者显式指定系统 mongod，避免任何下载。
    if (process.env.TEST_MONGOD_PATH && !process.env.MONGOMS_SYSTEM_BINARY) {
        process.env.MONGOMS_SYSTEM_BINARY = process.env.TEST_MONGOD_PATH;
    }
}

async function delay(ms: number) {
    await new Promise((resolve) => setTimeout(resolve, ms));
}

export async function createSharedMongoMemoryServer(retries = 3): Promise<MongoMemoryServer> {
    configureMongoMemoryServerEnv();

    let lastError: unknown;
    for (let attempt = 1; attempt <= retries; attempt += 1) {
        try {
            return await MongoMemoryServer.create();
        } catch (error) {
            lastError = error;
            const code = error instanceof Error && 'code' in error ? String(error.code) : '';
            const isRetryable = code === 'EBUSY' || code === 'ETXTBSY';
            if (!isRetryable || attempt === retries) {
                throw error;
            }
            await delay(attempt * 1000);
        }
    }

    throw lastError instanceof Error ? lastError : new Error('创建 MongoMemoryServer 失败');
}

export async function resolvePreferredTestMongoUri(): Promise<{ mongo: MongoMemoryServer | null; mongoUri: string }> {
    const externalMongoUri = process.env.MONGO_URI;
    if (externalMongoUri) {
        return { mongo: null, mongoUri: externalMongoUri };
    }

    const probeConnection = mongoose.createConnection(LOCAL_TEST_MONGO_URI, {
        dbName: 'admin',
        serverSelectionTimeoutMS: 1500,
    });

    try {
        await probeConnection.asPromise();
        await probeConnection.close();
        return { mongo: null, mongoUri: LOCAL_TEST_MONGO_URI };
    } catch {
        try {
            await probeConnection.close();
        } catch {
            // ignore probe cleanup failure
        }
    }

    const mongo = await createSharedMongoMemoryServer();
    return { mongo, mongoUri: mongo.getUri() };
}

