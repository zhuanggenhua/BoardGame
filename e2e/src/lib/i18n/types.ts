import { I18N_NAMESPACES } from './namespaces';

export const I18N_RUNTIME_MODE = typeof import.meta !== 'undefined' ? import.meta.env?.MODE : undefined;

const isAndroidRuntimeBuild = I18N_RUNTIME_MODE === 'android';

export const SUPPORTED_LANGUAGES = ['zh-CN', 'en'] as const;

export type SupportedLanguage = typeof SUPPORTED_LANGUAGES[number];

export const RUNTIME_SUPPORTED_LANGUAGES: readonly SupportedLanguage[] = isAndroidRuntimeBuild
    ? ['zh-CN']
    : [...SUPPORTED_LANGUAGES];

export const DEFAULT_LANGUAGE: SupportedLanguage = 'zh-CN';

export function normalizeI18nLanguage(input: string | null | undefined): SupportedLanguage {
    if (isAndroidRuntimeBuild) return DEFAULT_LANGUAGE;

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

const ALL_LANGUAGE_OPTIONS: I18nLanguageOption[] = [
    { code: 'zh-CN', label: '中文' },
    { code: 'en', label: 'English' },
];

export const LANGUAGE_OPTIONS: I18nLanguageOption[] = isAndroidRuntimeBuild
    ? ALL_LANGUAGE_OPTIONS.filter(option => option.code === DEFAULT_LANGUAGE)
    : ALL_LANGUAGE_OPTIONS;
