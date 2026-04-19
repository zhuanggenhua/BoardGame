import type { TFunction } from 'i18next';

type I18nLike = {
    resolvedLanguage?: string;
    language?: string;
    exists?: (key: string, options?: Record<string, unknown>) => boolean;
    getResource?: (language: string, namespace: string, key: string) => unknown;
    services?: {
        interpolator?: {
            interpolate: (template: string, params: Record<string, unknown>, language?: string) => string;
        };
    };
};

const interpolateFallback = (template: string, params: Record<string, unknown> = {}) => (
    template.replace(/\{\{\s*([\w.-]+)\s*\}\}/g, (_match, key) => {
        const value = params[key];
        return value === undefined || value === null ? '' : String(value);
    })
);

export const resolveBonusDieText = (
    key: string,
    context: { t: TFunction; i18n: I18nLike },
    params?: Record<string, string | number>,
): string => {
    const { t, i18n } = context;
    const language = i18n.resolvedLanguage ?? i18n.language ?? 'zh-CN';

    if (i18n.exists?.(key, { ns: 'game-dicethrone' })) {
        return t(key, params);
    }

    if (key.startsWith('bonusDie.effect.')) {
        const suffix = key.slice('bonusDie.effect.'.length);
        const effectMap = i18n.getResource?.(language, 'game-dicethrone', 'bonusDie.effect') as Record<string, string> | undefined;
        const template = effectMap?.[suffix];
        if (typeof template === 'string') {
            const interpolator = i18n.services?.interpolator;
            if (interpolator?.interpolate) {
                return interpolator.interpolate(template, params ?? {}, language);
            }
            return interpolateFallback(template, params ?? {});
        }
    }

    return params ? t(key, params) : key;
};

