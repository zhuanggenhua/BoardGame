const normalizeUrl = (url: string) => url.replace(/\/$/, '');

const metaEnv = (import.meta as { env?: Record<string, string | boolean | undefined> }).env ?? {};
const isDev = metaEnv.DEV === true;
const safeWindowOrigin = typeof window !== 'undefined' ? window.location.origin : '';
const isTruthyFlag = (value: string | boolean | undefined) => /^(1|true|yes|on)$/i.test(String(value ?? '').trim());

// dev:lite 会显式关闭 API，仅保留前端 + game server 以便快速复现 UI / 对局问题。
// 该模式下前端不得再主动发起 auth/social 相关后台请求，否则会把 Vite 代理打进预期外的失败路径。
export const IS_DEV_API_DISABLED = isDev && isTruthyFlag(metaEnv.VITE_DEV_SKIP_API as string | boolean | undefined);

// 部署模式判断：
// - 同域部署（Docker 单体）：前后端同源，使用相对路径
// - 分离部署（Pages + 服务器）：前端在 Pages，后端在服务器，需配置 VITE_BACKEND_URL

// 后端基础地址（仅分离部署时需要配置）
const BACKEND_URL = (metaEnv.VITE_BACKEND_URL as string | undefined) || '';

// 游戏服务地址
// - 开发：空字符串（走 Vite 代理）
// - 同域部署：window.location.origin
// - 分离部署：VITE_BACKEND_URL
const FALLBACK_GAME_SERVER_URL = isDev
    ? ''
    : (BACKEND_URL || safeWindowOrigin);

export const GAME_SERVER_URL = normalizeUrl(
    (metaEnv.VITE_GAME_SERVER_URL as string | undefined) || FALLBACK_GAME_SERVER_URL
);

/**
 * 运行时获取游戏服务器地址。
 * E2E 测试可通过 window.__FORCE_GAME_SERVER_URL__ 覆盖，
 * 绕过 Vite 代理（多 WebSocket 并发时代理不稳定）。
 */
export const getGameServerUrl = (): string => {
    if (typeof window !== 'undefined') {
        const force = (window as Window & { __FORCE_GAME_SERVER_URL__?: string }).__FORCE_GAME_SERVER_URL__;
        if (force) return normalizeUrl(force);
    }
    return GAME_SERVER_URL;
};

// 认证 API 地址
const FALLBACK_AUTH_API_URL = isDev
    ? '/auth'
    : (BACKEND_URL ? `${BACKEND_URL}/auth` : '/auth');

export const AUTH_API_URL = normalizeUrl(
    (metaEnv.VITE_AUTH_API_URL as string | undefined) || FALLBACK_AUTH_API_URL
);

// 管理 API 地址
const FALLBACK_ADMIN_API_URL = isDev
    ? '/admin-api'
    : (BACKEND_URL ? `${BACKEND_URL}/admin-api` : '/admin-api');

export const ADMIN_API_URL = normalizeUrl(
    (metaEnv.VITE_ADMIN_API_URL as string | undefined) || FALLBACK_ADMIN_API_URL
);

// 反馈 API 地址
const FALLBACK_FEEDBACK_API_URL = isDev
    ? '/feedback'
    : (BACKEND_URL ? `${BACKEND_URL}/feedback` : '/feedback');

export const FEEDBACK_API_URL = normalizeUrl(
    (metaEnv.VITE_FEEDBACK_API_URL as string | undefined) || FALLBACK_FEEDBACK_API_URL
);

// 赞助列表 API 地址
const FALLBACK_SPONSOR_API_URL = isDev
    ? '/sponsors'
    : (BACKEND_URL ? `${BACKEND_URL}/sponsors` : '/sponsors');

export const SPONSOR_API_URL = normalizeUrl(
    (metaEnv.VITE_SPONSOR_API_URL as string | undefined) || FALLBACK_SPONSOR_API_URL
);

// 通知 API 地址
const FALLBACK_NOTIFICATION_API_URL = isDev
    ? '/notifications'
    : (BACKEND_URL ? `${BACKEND_URL}/notifications` : '/notifications');

export const NOTIFICATION_API_URL = normalizeUrl(
    (metaEnv.VITE_NOTIFICATION_API_URL as string | undefined) || FALLBACK_NOTIFICATION_API_URL
);

// 更新日志 API 地址
const FALLBACK_GAME_CHANGELOG_API_URL = isDev
    ? '/game-changelogs'
    : (BACKEND_URL ? `${BACKEND_URL}/game-changelogs` : '/game-changelogs');

export const GAME_CHANGELOG_API_URL = normalizeUrl(
    (metaEnv.VITE_GAME_CHANGELOG_API_URL as string | undefined) || FALLBACK_GAME_CHANGELOG_API_URL
);

// UGC API 地址
const FALLBACK_UGC_API_URL = isDev
    ? '/ugc'
    : (BACKEND_URL ? `${BACKEND_URL}/ugc` : '/ugc');

export const UGC_API_URL = normalizeUrl(
    (metaEnv.VITE_UGC_API_URL as string | undefined) || FALLBACK_UGC_API_URL
);

// UGC 资源基址
const FALLBACK_UGC_ASSET_BASE_URL = '/assets';

export const UGC_ASSET_BASE_URL = normalizeUrl(
    (metaEnv.VITE_UGC_ASSET_BASE_URL as string | undefined) || FALLBACK_UGC_ASSET_BASE_URL
);

// 布局保存 API 地址
const FALLBACK_LAYOUT_API_URL = isDev
    ? '/layout'
    : (BACKEND_URL ? `${BACKEND_URL}/layout` : '/layout');

export const LAYOUT_API_URL = normalizeUrl(
    (metaEnv.VITE_LAYOUT_API_URL as string | undefined) || FALLBACK_LAYOUT_API_URL
);

const FALLBACK_DEVTOOLS_AI_REPO_WORKBENCH_API_URL = isDev
    ? '/devtools/ai-repo-workbench'
    : (BACKEND_URL ? `${BACKEND_URL}/devtools/ai-repo-workbench` : '/devtools/ai-repo-workbench');

export const DEVTOOLS_AI_REPO_WORKBENCH_API_URL = normalizeUrl(
    (metaEnv.VITE_DEVTOOLS_AI_REPO_WORKBENCH_API_URL as string | undefined) || FALLBACK_DEVTOOLS_AI_REPO_WORKBENCH_API_URL
);

const FALLBACK_DEVTOOLS_AI_REPO_WORKBENCH_FLOWISE_URL = isDev
    ? 'http://127.0.0.1:3100'
    : (BACKEND_URL || safeWindowOrigin);

export const DEVTOOLS_AI_REPO_WORKBENCH_FLOWISE_URL = normalizeUrl(
    (metaEnv.VITE_DEVTOOLS_AI_REPO_WORKBENCH_FLOWISE_URL as string | undefined) || FALLBACK_DEVTOOLS_AI_REPO_WORKBENCH_FLOWISE_URL
);

// 第三方监控配置
export const SENTRY_DSN = (metaEnv.VITE_SENTRY_DSN as string | undefined) || '';
