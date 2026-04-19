import i18n from 'i18next';
import Backend from 'i18next-http-backend';
import LanguageDetector from 'i18next-browser-languagedetector';
import { initReactI18next } from 'react-i18next';
import { DEFAULT_LANGUAGE, I18N_NAMESPACES, RUNTIME_SUPPORTED_LANGUAGES, normalizeI18nLanguage } from './types';
import { zhCNBundled } from './zh-CN-bundled';

const LANGUAGE_PREFERENCE_STORAGE_KEY = 'bg_locale_preference';
const LEGACY_LANGUAGE_STORAGE_KEY = 'i18nextLng';

const getInitialLanguage = () => {
    // 全站默认锁定 zh-CN：忽略历史偏好/浏览器语言
    return DEFAULT_LANGUAGE;
};

// 构建时注入的 locale JSON content hash 映射。
// Node 侧 bundle / E2E 启动时可能没有 Vite define 注入，此时安全回退为空对象。
const localeHashes: Record<string, string> =
    typeof __LOCALE_HASHES__ !== 'undefined' ? __LOCALE_HASHES__ : {};

/**
 * 根据语言和 namespace 生成带 content hash 的加载路径
 * 内容不变 → hash 不变 → CDN/浏览器继续用缓存
 * 内容变了 → hash 变了 → 缓存自动失效
 */
function getLoadPath(lngs: string[], namespaces: string[]): string {
    const lng = normalizeI18nLanguage(lngs[0]);
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
        lng: getInitialLanguage(),
        fallbackLng: DEFAULT_LANGUAGE,
        supportedLngs: [...RUNTIME_SUPPORTED_LANGUAGES],
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
            order: ['localStorage'],
            lookupLocalStorage: LANGUAGE_PREFERENCE_STORAGE_KEY,
            caches: ['localStorage'],
            convertDetectedLanguage: (lng: string) => normalizeI18nLanguage(lng),
        },
        react: {
            useSuspense: false,
        },
    });

export default i18n;
