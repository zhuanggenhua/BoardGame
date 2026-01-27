const normalizeUrl = (url: string) => url.replace(/\/$/, '');

// 部署模式判断：
// - 同域部署（Docker 单体）：前后端同源，使用相对路径
// - 分离部署（Pages + 服务器）：前端在 Pages，后端在服务器，需配置 VITE_BACKEND_URL

// 后端基础地址（仅分离部署时需要配置）
const BACKEND_URL = import.meta.env.VITE_BACKEND_URL || '';

// 游戏服务地址
// - 开发：空字符串（走 Vite 代理）
// - 同域部署：window.location.origin
// - 分离部署：VITE_BACKEND_URL
const FALLBACK_GAME_SERVER_URL = import.meta.env.DEV
    ? ''
    : (BACKEND_URL || window.location.origin);

export const GAME_SERVER_URL = normalizeUrl(
    import.meta.env.VITE_GAME_SERVER_URL || FALLBACK_GAME_SERVER_URL
);

// 认证 API 地址
const FALLBACK_AUTH_API_URL = import.meta.env.DEV
    ? '/auth'
    : (BACKEND_URL ? `${BACKEND_URL}/auth` : '/auth');

export const AUTH_API_URL = normalizeUrl(
    import.meta.env.VITE_AUTH_API_URL || FALLBACK_AUTH_API_URL
);
