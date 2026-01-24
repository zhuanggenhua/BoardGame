import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import './index.css';
// 初始化 i18n（语言检测 + 本地缓存）
import { i18nInitPromise } from './lib/i18n';
import App from './App.tsx';

const rootElement = document.getElementById('root');
if (rootElement) {
  void i18nInitPromise.then(() => {
    createRoot(rootElement).render(
      <StrictMode>
        <App />
      </StrictMode>,
    );
  });
}
