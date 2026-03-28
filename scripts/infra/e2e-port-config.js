import 'dotenv/config';

function resolvePort(value, fallback) {
  const port = Number(value);
  return Number.isFinite(port) && port > 0 ? port : fallback;
}

// 开发环境端口始终读取当前 .env，避免测试脚本误把本地开发前端当成 E2E 服务。
export const DEV_SERVER_PORTS = Object.freeze({
  frontend: resolvePort(process.env.VITE_DEV_PORT, 5173),
  gameServer: resolvePort(process.env.GAME_SERVER_PORT, 18000),
  apiServer: resolvePort(process.env.API_SERVER_PORT, 18001),
});

// 单 worker E2E 端口：供默认 `npm run test:e2e` / `test:e2e:ci` 使用。
// 6000 会被 Chromium 视为 unsafe port，导致 page.goto 直接报 ERR_UNSAFE_PORT。
export const E2E_SINGLE_WORKER_PORTS = Object.freeze({
  frontend: resolvePort(process.env.PW_E2E_FRONTEND_PORT || process.env.PW_PORT || process.env.E2E_PORT, 6174),
  gameServer: resolvePort(process.env.PW_E2E_GAME_SERVER_PORT || process.env.GAME_SERVER_PORT || process.env.PW_GAME_SERVER_PORT, 20000),
  apiServer: resolvePort(process.env.PW_E2E_API_SERVER_PORT || process.env.API_SERVER_PORT || process.env.PW_API_SERVER_PORT, 21000),
});

// 多 worker 端口基础值：worker 0 为 6273/20100/21100，后续 worker 每个 +100。
export const E2E_MULTI_WORKER_BASE_PORTS = Object.freeze({
  frontend: 6273,
  gameServer: 20100,
  apiServer: 21100,
});

export function toPortArray(ports) {
  return [ports.frontend, ports.gameServer, ports.apiServer];
}
