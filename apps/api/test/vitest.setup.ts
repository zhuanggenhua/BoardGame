import 'reflect-metadata';
import { config } from 'dotenv';
import { existsSync } from 'fs';
import { MongoMemoryServer } from 'mongodb-memory-server';
import os from 'node:os';
import { resolve } from 'path';

const envPath = resolve(process.cwd(), '.env.test.local');
if (existsSync(envPath)) {
    config({ path: envPath });
}

process.env.MONGOMS_PREFER_GLOBAL_PATH ??= 'true';
process.env.MONGOMS_DOWNLOAD_DIR ??= resolve(os.homedir(), '.cache', 'mongodb-binaries');
process.env.MONGOMS_EXP_NET0LISTEN ??= 'false';

if (process.env.TEST_MONGOD_PATH && !process.env.MONGOMS_SYSTEM_BINARY) {
    process.env.MONGOMS_SYSTEM_BINARY = process.env.TEST_MONGOD_PATH;
}

const originalMongoMemoryServerCreate = MongoMemoryServer.create.bind(MongoMemoryServer);
const TEST_MONGO_FIRST_PORT = Number(process.env.BG_TEST_MONGO_FIRST_PORT ?? 37017);
const TEST_MONGO_START_RETRIES = 5;

const delay = async (ms: number) => {
    await new Promise((resolve) => setTimeout(resolve, ms));
};

const isRetryableMongoStartError = (error: unknown) => {
    if (!(error instanceof Error)) {
        return false;
    }

    const code = 'code' in error ? String(error.code) : '';
    return code === 'EACCES' || code === 'EADDRINUSE' || code === 'EBUSY' || code === 'ETXTBSY';
};

MongoMemoryServer.create = (async (opts) => {
    let lastError: unknown;

    for (let attempt = 1; attempt <= TEST_MONGO_START_RETRIES; attempt += 1) {
        try {
            const requestedPort = opts?.instance?.port;
            const firstPort = typeof requestedPort === 'number' && requestedPort > 0
                ? requestedPort
                : TEST_MONGO_FIRST_PORT + attempt - 1;

            return await originalMongoMemoryServerCreate({
                ...opts,
                instance: {
                    ip: '127.0.0.1',
                    ...(opts?.instance ?? {}),
                    port: firstPort,
                },
            });
        } catch (error) {
            lastError = error;
            if (!isRetryableMongoStartError(error) || attempt === TEST_MONGO_START_RETRIES) {
                throw error;
            }
            await delay(attempt * 250);
        }
    }

    throw lastError instanceof Error ? lastError : new Error('创建 MongoMemoryServer 失败');
}) as typeof MongoMemoryServer.create;

const resolveDbName = (uri: string): string | undefined => {
    const match = uri.match(/\/([^/?]+)(\?|$)/);
    return match?.[1];
};

const mongoUri = process.env.MONGO_URI;
if (mongoUri) {
    const dbName = resolveDbName(mongoUri);
    if (!dbName) {
        throw new Error('[Test] MONGO_URI 缺少数据库名，请使用 boardgame_test。');
    }
    if (dbName === 'boardgame') {
        throw new Error('[Test] 禁止使用 boardgame 作为测试库，请改为 boardgame_test。');
    }
}
