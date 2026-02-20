import i18n from 'i18next';
import Backend from 'i18next-http-backend';
import LanguageDetector from 'i18next-browser-languagedetector';
import { initReactI18next } from 'react-i18next';
import { DEFAULT_LANGUAGE, I18N_NAMESPACES, SUPPORTED_LANGUAGES } from './types';
import { zhCNBundled } from './zh-CN-bundled';

// 构建时注入的 locale JSON content hash 映射
// 开发模式为空对象（Vite dev server 不缓存）
const localeHashes: Record<string, string> = __LOCALE_HASHES__;

/**
 * 根据语言和 namespace 生成带 content hash 的加载路径
 * 内容不变 → hash 不变 → CDN/浏览器继续用缓存
 * 内容变了 → hash 变了 → 缓存自动失效
 */
function getLoadPath(lngs: string[], namespaces: string[]): string {
    const lng = lngs[0];
    const ns = namespaces[0];
    const key = `${lng}/${ns}.json`;
    const hash = localeHashes[key];
    return hash
        ? `/locales/${key}?v=${hash}`
        : `/locales/${key}`;
}

export const i18nInitPromise = i18n
    .use(Backend)
    .use(LanguageDetector)
    .use(initReactI18next)
    .init({
        fallbackLng: DEFAULT_LANGUAGE,
        supportedLngs: [...SUPPORTED_LANGUAGES],
        defaultNS: 'common',
        ns: [...I18N_NAMESPACES],
        // 中文核心 namespace 内联打包，零网络请求
        // 游戏专属 namespace（game-dicethrone 等）仍走 HTTP backend 按需加载
        partialBundledLanguages: true,
        resources: {
            'zh-CN': zhCNBundled,
        },
        interpolation: {
            escapeValue: false,
        },
        backend: {
            loadPath: getLoadPath,
        },
        detection: {
            order: ['localStorage', 'navigator'],
            caches: ['localStorage'],
        },
        react: {
            useSuspense: false,
        },
    });

export default i18n;
