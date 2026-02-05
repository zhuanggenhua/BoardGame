import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import './index.css';
// 初始化 i18n（语言检测 + 本地缓存）
import { i18nInitPromise } from './lib/i18n';
import App from './App.tsx';

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
