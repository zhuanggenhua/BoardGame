export type TranslateFn = (key: string, options?: Record<string, unknown>) => string | string[];

export const resolveI18nList = (value: unknown): string[] => (
    Array.isArray(value) ? (value as string[]) : []
);
