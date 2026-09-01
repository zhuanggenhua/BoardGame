import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import './lib/structuredClonePolyfill';
import './index.css';
import { i18nInitPromise } from './lib/i18n';
import { SENTRY_DSN } from './config/server';
import { isStaleChunkError, reloadForStaleChunkOnce } from './lib/staleChunkReloadGuard';
import { isNativeMobileRuntime } from './lib/mobile/mobileRuntime';
import { notifyMobileBundleReady } from './lib/mobile/mobileLiveUpdates';
import { createNativeMobileFeatureInitializer } from './lib/mobile/mobileStartup';
import { isConfigReviewPath } from './config/gameConfigReviewRoutes';

const STALE_CHUNK_BOOTSTRAP_WINDOW_MS = 8000;
const bootstrapStartedAt = typeof performance !== 'undefined' ? performance.now() : Date.now();
const shouldAutoReloadStaleChunk = () => {
  const now = typeof performance !== 'undefined' ? performance.now() : Date.now();
  return now - bootstrapStartedAt <= STALE_CHUNK_BOOTSTRAP_WINDOW_MS;
};

const captureParams = typeof window !== 'undefined'
  ? new URLSearchParams(window.location.search)
  : null;
const captureScenario = captureParams?.get('bgCapture');
const captureStatusUrl = captureParams?.get('bgCaptureStatusUrl') || '/__capture/status';

const reportCaptureBootstrapStatus = (phase: string, message?: string) => {
  if (!import.meta.env.DEV || !captureScenario) {
    return;
  }

  void fetch(captureStatusUrl, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      scenario: captureScenario,
      phase,
      message,
    }),
  }).catch(() => {
    // capture 旁路诊断不能影响正常页面启动。
  });
};

if (import.meta.env.DEV && captureScenario) {
  document.title = `capture-bootstrap:${captureScenario}`;
  reportCaptureBootstrapStatus('capture-bootstrap');

  window.addEventListener('error', (event) => {
    const message = event.error instanceof Error
      ? event.error.message
      : (event.message || 'unknown');
    document.title = `capture-window-error:${message.slice(0, 80)}`;
    reportCaptureBootstrapStatus('capture-window-error', message.slice(0, 400));
  });

  window.addEventListener('unhandledrejection', (event) => {
    const reason = event.reason instanceof Error
      ? event.reason.message
      : String(event.reason ?? 'unknown');
    document.title = `capture-window-rejection:${reason.slice(0, 80)}`;
    reportCaptureBootstrapStatus('capture-window-rejection', reason.slice(0, 400));
  });
}

if (import.meta.env.DEV) {
  Error.stackTraceLimit = 10;
}

if (typeof window !== 'undefined') {
  window.addEventListener('vite:preloadError', (event) => {
    const reloaded = reloadForStaleChunkOnce('vite:preloadError', window, {
      shouldReload: shouldAutoReloadStaleChunk,
    });
    if (reloaded) {
      event.preventDefault();
    }
  });

  window.addEventListener('unhandledrejection', (event) => {
    if (!isStaleChunkError(event.reason)) return;
    const reloaded = reloadForStaleChunkOnce('unhandledrejection', window, {
      shouldReload: shouldAutoReloadStaleChunk,
    });
    if (reloaded) {
      event.preventDefault();
    }
  });
}

if (import.meta.env.PROD && SENTRY_DSN) {
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

const initializeNativeMobileFeatures = createNativeMobileFeatureInitializer({
  notifyBundleReady: notifyMobileBundleReady,
  loadPackageManager: () => import('./features/mobile-packages/packageManagerService'),
});

if (isNativeMobileRuntime()) {
  void initializeNativeMobileFeatures();
}

const rootElement = document.getElementById('root');
if (rootElement) {
  const loadApp = isConfigReviewPath(window.location.pathname)
    ? import('./pages/ConfigReviewApp')
    : import('./App.tsx');

  void loadApp.then(({ default: App }) => {
    createRoot(rootElement).render(
      <StrictMode>
        <App />
      </StrictMode>,
    );

    if (import.meta.env.DEV && captureScenario) {
      document.title = `capture-rendered:${captureScenario}`;
      reportCaptureBootstrapStatus('capture-rendered');
    }
  }).catch((error) => {
    console.error('[Bootstrap] 加载应用入口失败', error);
    reportCaptureBootstrapStatus('capture-app-load-failed', error instanceof Error ? error.message : String(error));
  });

  void i18nInitPromise.catch(() => {
    console.warn('[i18n] 初始化失败，将使用 fallback key 显示文本');
    reportCaptureBootstrapStatus('capture-i18n-init-failed', 'i18n initialization failed');
  });
}
