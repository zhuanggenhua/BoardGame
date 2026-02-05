import 'reflect-metadata';
import { config } from 'dotenv';
import { existsSync } from 'fs';
import { resolve } from 'path';

const envPath = resolve(process.cwd(), '.env.test.local');

if (existsSync(envPath)) {
    config({ path: envPath });
}

const DEFAULT_TEST_MONGO_URI = 'mongodb://localhost:27017/boardgame_test';

if (!process.env.MONGO_URI) {
    process.env.MONGO_URI = DEFAULT_TEST_MONGO_URI;
}

const resolveDbName = (uri: string): string | undefined => {
    const match = uri.match(/\/([^/?]+)(\?|$)/);
    return match?.[1];
};

const mongoUri = process.env.MONGO_URI;
const dbName = mongoUri ? resolveDbName(mongoUri) : undefined;
if (!dbName) {
    throw new Error('[Test] MONGO_URI 缺少数据库名，请使用 boardgame_test。');
}
if (dbName === 'boardgame') {
    throw new Error('[Test] 禁止使用 boardgame 作为测试库，请改为 boardgame_test。');
}
