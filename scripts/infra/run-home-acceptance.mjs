import path from 'node:path';
import { tmpdir } from 'node:os';
import { runE2ECommand } from './run-e2e-command.mjs';

// 每个运行组使用新的数据库和 UGC；容量合同必须从空大厅开始，不能复用前组创建的房间。
const requested = process.argv.slice(2);
const targets = requested.length ? requested : [
    'e2e/home-style-preference.e2e.ts', 'e2e/home-catalog-acceptance.e2e.ts',
    'e2e/home-room-entry.e2e.ts', 'e2e/home-profile-routes.e2e.ts',
    'e2e/home-user-corrections.e2e.ts', 'e2e/home-cover-lifecycle.e2e.ts',
    'e2e/home-utility-acceptance.e2e.ts', 'e2e/home-mobile-entry.e2e.ts',
    'e2e/home-floating-interactions.e2e.ts', 'e2e/home-detail-dialogs.e2e.ts',
    'e2e/home-avatar-selection.e2e.ts', 'e2e/home-modern-layout.e2e.ts',
    'e2e/home-feedback-touch.e2e.ts', 'e2e/home-library-news-layout.e2e.ts',
    'e2e/home-match-history.e2e.ts', 'e2e/home-room-capacity.e2e.ts',
];
const isolatedTargets = ['e2e/home-match-history.e2e.ts', 'e2e/home-room-capacity.e2e.ts'];
const sharedTargets = targets.filter(target => !isolatedTargets.includes(target));
const groups = [
    ...(sharedTargets.some(target => target.endsWith('.e2e.ts')) || !targets.some(target => isolatedTargets.includes(target)) ? [sharedTargets] : []),
    ...isolatedTargets.filter(target => targets.includes(target)).map(target => targets.filter(arg => !arg.endsWith('.e2e.ts') || arg === target)),
];
for (const group of groups) {
const run = `home-${Date.now()}`;
await runE2ECommand({
    mode: 'default', entrypoint: 'run-home-acceptance',
    extraArgs: [...group, '--retries=0'],
    envOverrides: {
        PLATFORM_E2E_ISOLATION_ID: run, PLATFORM_E2E_RUN_ID: run,
        MONGO_URI: `mongodb://127.0.0.1:37022/boardgame_home_acceptance_${run}`,
        UGC_STORAGE_MODE: 'local', UGC_LOCAL_PATH: path.join(tmpdir(), `boardgame-home-acceptance-${run}`, 'ugc'),
        PW_E2E_SERVICE_REUSE: 'isolated', PW_DISABLE_JPEG_REPORTER: 'true',
        USE_PERSISTENT_STORAGE: group.includes('e2e/home-match-history.e2e.ts') ? 'true' : 'false',
    },
});
}
