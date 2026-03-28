import { I18N_NAMESPACES } from './namespaces';

export const SUPPORTED_LANGUAGES = ['zh-CN', 'en'] as const;

export type SupportedLanguage = typeof SUPPORTED_LANGUAGES[number];

export const DEFAULT_LANGUAGE: SupportedLanguage = 'zh-CN';

export function normalizeI18nLanguage(input: string | null | undefined): SupportedLanguage {
    const normalized = input?.trim().toLowerCase();
    if (!normalized) return DEFAULT_LANGUAGE;
    if (normalized === 'en' || normalized.startsWith('en-')) {
        return 'en';
    }
    if (normalized === 'zh-cn' || normalized === 'zh-hans-cn') {
        return 'zh-CN';
    }
    if (normalized === 'zh' || normalized.startsWith('zh-')) {
        return 'zh-CN';
    }
    return DEFAULT_LANGUAGE;
}

export { I18N_NAMESPACES };

export type I18nNamespace = typeof I18N_NAMESPACES[number];

export type I18nLanguageOption = {
    code: SupportedLanguage;
    label: string;
};

export const LANGUAGE_OPTIONS: I18nLanguageOption[] = [
    { code: 'zh-CN', label: '中文' },
    { code: 'en', label: 'English' },
];
