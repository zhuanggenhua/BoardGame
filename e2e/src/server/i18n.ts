import fs from 'fs';
import path from 'path';
import type { Context } from 'koa';
import { DEFAULT_LANGUAGE, SUPPORTED_LANGUAGES, type SupportedLanguage } from '../lib/i18n/types';

type LocaleTable = Record<string, unknown>;

type MessageParams = Record<string, string | number>;

const localeCache = new Map<SupportedLanguage, LocaleTable>();

// 默认从仓库根目录定位 public/locales，生产环境可通过 LOCALES_DIR 覆盖
const DEFAULT_LOCALES_DIR = path.resolve(process.cwd(), 'public', 'locales');

const LOCALES_DIR = process.env.LOCALES_DIR || DEFAULT_LOCALES_DIR;

const resolveLocalePath = (language: SupportedLanguage) => (
    path.resolve(LOCALES_DIR, language, 'server.json')
);

const loadLocale = (language: SupportedLanguage): LocaleTable => {
    const cached = localeCache.get(language);
    if (cached) return cached;

    try {
        const raw = fs.readFileSync(resolveLocalePath(language), 'utf-8');
        const data = JSON.parse(raw) as LocaleTable;
        localeCache.set(language, data);
        return data;
    } catch {
        const fallback: LocaleTable = {};
        localeCache.set(language, fallback);
        return fallback;
    }
};

const normalizeLanguage = (value: string): SupportedLanguage | null => {
    const lower = value.trim().toLowerCase();
    if (lower.startsWith('zh')) return 'zh-CN';
    if (lower.startsWith('en')) return 'en';
    return null;
};

export const getServerLocale = (ctx?: Context): SupportedLanguage => {
    const header = ctx?.headers['accept-language'];
    if (!header) return DEFAULT_LANGUAGE;

    const tags = header.split(',');
    for (const tag of tags) {
        const token = tag.split(';')[0]?.trim();
        if (!token) continue;
        const resolved = normalizeLanguage(token);
        if (resolved && SUPPORTED_LANGUAGES.includes(resolved)) return resolved;
        if (SUPPORTED_LANGUAGES.includes(token as SupportedLanguage)) return token as SupportedLanguage;
    }

    return DEFAULT_LANGUAGE;
};

const resolveKey = (table: LocaleTable, key: string): unknown => {
    const parts = key.split('.');
    let current: unknown = table;

    for (const part of parts) {
        if (!current || typeof current !== 'object') return undefined;
        current = (current as Record<string, unknown>)[part];
    }

    return current;
};

const formatMessage = (template: string, params?: MessageParams): string => (
    template.replace(/\{\{(\w+)\}\}/g, (_, key: string) => {
        const value = params?.[key];
        return value == null ? '' : String(value);
    })
);

export const tServer = (language: SupportedLanguage, key: string, params?: MessageParams): string => {
    const table = loadLocale(language);
    const value = resolveKey(table, key);
    if (typeof value !== 'string') return key;
    return formatMessage(value, params);
};

export const createServerI18n = (ctx?: Context) => {
    const locale = getServerLocale(ctx);
    return {
        locale,
        t: (key: string, params?: MessageParams) => tServer(locale, key, params),
    };
};
