import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import './index.css';
// 初始化 i18n（语言检测 + 本地缓存）
import { i18nInitPromise } from './lib/i18n';
import App from './App.tsx';
import * as Sentry from '@sentry/react';
import { SENTRY_DSN } from './config/server';

// 初始化 Sentry（错误捕获 + 性能追踪 + 出错时低采样率回放）
if (SENTRY_DSN) {
  Sentry.init({
    dsn: SENTRY_DSN,
    integrations: [
      Sentry.browserTracingIntegration(),
      Sentry.replayIntegration({ maskAllText: false, blockAllMedia: false }),
    ],
    tracesSampleRate: 1.0,
    // 常规会话不录制，仅出错时以 10% 采样率录制回放
    replaysSessionSampleRate: 0,
    replaysOnErrorSampleRate: 0.1,
  });
}

const rootElement = document.getElementById('root');
if (rootElement) {
  let hasRendered = false;
  const renderApp = () => {
    if (hasRendered) return;
    hasRendered = true;
    createRoot(rootElement).render(
      <StrictMode>
        <App />
      </StrictMode>,
    );
  };

  const fallbackTimer = window.setTimeout(renderApp, 2000);
  void i18nInitPromise
    .then(() => {
      window.clearTimeout(fallbackTimer);
      renderApp();
    })
    .catch(() => {
      window.clearTimeout(fallbackTimer);
      renderApp();
    });
}
