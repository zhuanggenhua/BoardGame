import { setAssetsBaseUrl } from './src/core/AssetLoader';
import '@testing-library/jest-dom/vitest';

// Vite 插件在构建时注入 __LOCALE_HASHES__，测试环境需要提供默认值
// @ts-expect-error -- 全局变量由 Vite define 注入，测试环境手动补齐
globalThis.__LOCALE_HASHES__ = {};

// Tests should be deterministic and not depend on external/CDN base URLs.
setAssetsBaseUrl('/assets');
