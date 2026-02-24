import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import './index.css';

// 部署新版本后，浏览器缓存的旧 HTML 引用已不存在的 chunk（hash 变了），
// 服务器返回 HTML fallback 导致 MIME type 错误。检测到后自动刷新一次加载新版本。
window.addEventListener('vite:preloadError', () => {
  window.location.reload();
});
// 触发所有游戏光标主题的自注册（副作用 import，必须在组件渲染前）
import './games/cursorRegistry';
// 初始化 i18n（语言检测 + 本地缓存）
import { i18nInitPromise } from './lib/i18n';
import App from './App.tsx';
import { SENTRY_DSN } from './config/server';

// 异步初始化 Sentry（不阻塞首屏渲染，85KB gzip 延迟加载）
if (SENTRY_DSN) {
  void import('@sentry/react').then((Sentry) => {
    Sentry.init({
      dsn: SENTRY_DSN,
      integrations: [
        Sentry.browserTracingIntegration(),
        Sentry.replayIntegration({ maskAllText: false, blockAllMedia: false }),
      ],
      tracesSampleRate: 1.0,
      replaysSessionSampleRate: 0,
      replaysOnErrorSampleRate: 0.1,
    });
  });
}

const rootElement = document.getElementById('root');
if (rootElement) {
  // 立即渲染，不等 i18n 初始化完成。
  // react-i18next 已配置 useSuspense: false，未就绪时组件用 key 作 fallback，不会崩溃。
  // i18n 初始化完成后 react-i18next 会自动触发重渲染，文本无缝切换。
  createRoot(rootElement).render(
    <StrictMode>
      <App />
    </StrictMode>,
  );

  // 后台继续等待 i18n 完成（仅用于错误捕获，不阻塞渲染）
  void i18nInitPromise.catch(() => {
    console.warn('[i18n] 初始化失败，将使用 fallback key 显示文本');
  });
}
