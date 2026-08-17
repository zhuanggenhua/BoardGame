export const DEFAULT_PUBLIC_BACKEND_URL: string;
export const DEFAULT_ANDROID_BACKEND_URL: string;
export function normalizeBackendUrl(value?: unknown): string;
export function resolvePublicBackendUrl(env?: Record<string, string | undefined>): string;
export function resolveAndroidBackendUrl(env?: Record<string, string | undefined>): string;
export function assertNoPublicBackendSplit(env?: Record<string, string | undefined>, publicBackendUrl?: string): void;
