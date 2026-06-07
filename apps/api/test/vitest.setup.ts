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
process.env.MONGOMS_EXP_NET0LISTEN ??= 'true';

if (process.env.TEST_MONGOD_PATH && !process.env.MONGOMS_SYSTEM_BINARY) {
    process.env.MONGOMS_SYSTEM_BINARY = process.env.TEST_MONGOD_PATH;
}

const originalMongoMemoryServerCreate = MongoMemoryServer.create.bind(MongoMemoryServer);

MongoMemoryServer.create = ((opts) => {
    return originalMongoMemoryServerCreate({
        ...opts,
        instance: {
            ip: '127.0.0.1',
            port: 0,
            ...(opts?.instance ?? {}),
        },
    });
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
