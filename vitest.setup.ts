import os from 'node:os';
import path from 'node:path';
import { setAssetsBaseUrl } from './src/core/AssetLoader';
import '@testing-library/jest-dom/vitest';

// Vite 插件在构建时注入 __LOCALE_HASHES__，测试环境需要提供默认值
// @ts-expect-error -- 全局变量由 Vite define 注入，测试环境手动补齐
globalThis.__LOCALE_HASHES__ = {};
// @ts-expect-error -- 全局变量由 Vite define 注入，测试环境手动补齐
globalThis.__ASSET_HASHES__ = {};
// @ts-expect-error -- 测试环境禁用 Portal，避免 server renderer 报错
globalThis.__BG_DISABLE_PORTAL__ = true;

// 统一使用用户级缓存，避免不同 worktree 首次跑测试时重复走 mongodb-memory-server 下载逻辑。
process.env.MONGOMS_PREFER_GLOBAL_PATH ??= 'true';
process.env.MONGOMS_DOWNLOAD_DIR ??= path.join(os.homedir(), '.cache', 'mongodb-binaries');
if (process.env.TEST_MONGOD_PATH && !process.env.MONGOMS_SYSTEM_BINARY) {
    process.env.MONGOMS_SYSTEM_BINARY = process.env.TEST_MONGOD_PATH;
}

// Tests should be deterministic and not depend on external/CDN base URLs.
setAssetsBaseUrl('/assets');
