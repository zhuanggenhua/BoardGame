import i18n from 'i18next';
import Backend from 'i18next-http-backend';
import LanguageDetector from 'i18next-browser-languagedetector';
import { initReactI18next } from 'react-i18next';
import { DEFAULT_LANGUAGE, I18N_NAMESPACES, SUPPORTED_LANGUAGES } from './types';

const CORE_I18N_NAMESPACES = I18N_NAMESPACES.filter(
    (namespace: string) => !namespace.startsWith('game-'),
);

export const i18nInitPromise = i18n
    .use(Backend)
    .use(LanguageDetector)
    .use(initReactI18next)
    .init({
        fallbackLng: DEFAULT_LANGUAGE,
        supportedLngs: [...SUPPORTED_LANGUAGES],
        defaultNS: 'common',
        ns: [...CORE_I18N_NAMESPACES],
        interpolation: {
            escapeValue: false,
        },
        backend: {
            loadPath: '/locales/{{lng}}/{{ns}}.json',
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
