import path from 'node:path';
import { tmpdir } from 'node:os';
import { runE2ECommand } from './run-e2e-command.mjs';

// 每次运行使用新的数据库和 UGC；可传入测试文件缩小回归范围。
const run = `home-${Date.now()}`;
const targets = process.argv.slice(2);
await runE2ECommand({
    mode: 'default', entrypoint: 'run-home-acceptance',
    extraArgs: [...(targets.length ? targets : [
        'e2e/home-style-preference.e2e.ts', 'e2e/home-catalog-acceptance.e2e.ts',
        'e2e/home-room-entry.e2e.ts', 'e2e/home-profile-routes.e2e.ts',
        'e2e/home-user-corrections.e2e.ts', 'e2e/home-cover-lifecycle.e2e.ts',
        'e2e/home-utility-acceptance.e2e.ts',
        'e2e/home-mobile-entry.e2e.ts',
        'e2e/home-floating-interactions.e2e.ts',
        'e2e/home-detail-dialogs.e2e.ts',
        'e2e/home-avatar-selection.e2e.ts',
    ]), '--retries=0'],
    envOverrides: {
        PLATFORM_E2E_ISOLATION_ID: run, PLATFORM_E2E_RUN_ID: run,
        MONGO_URI: `mongodb://127.0.0.1:37022/boardgame_home_acceptance_${run}`,
        UGC_STORAGE_MODE: 'local', UGC_LOCAL_PATH: path.join(tmpdir(), `boardgame-home-acceptance-${run}`, 'ugc'),
        PW_E2E_SERVICE_REUSE: 'isolated', PW_DISABLE_JPEG_REPORTER: 'true',
    },
});
