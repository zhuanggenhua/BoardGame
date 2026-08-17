export const DEFAULT_PUBLIC_BACKEND_URL = 'http://8.148.71.102';
export const DEFAULT_ANDROID_BACKEND_URL = DEFAULT_PUBLIC_BACKEND_URL;

const PRIMARY_PUBLIC_BACKEND_URL_SOURCES = [
    'VITE_BACKEND_URL',
    'BG_VITE_BACKEND_URL_VAR',
    'BG_VITE_BACKEND_URL_SECRET',
];

const LEGACY_ANDROID_BACKEND_URL_SOURCES = [
    'VITE_ANDROID_BACKEND_URL',
    'ANDROID_VITE_BACKEND_URL',
    'ANDROID_BACKEND_URL',
    'BG_VITE_ANDROID_BACKEND_URL_VAR',
    'BG_VITE_ANDROID_BACKEND_URL_SECRET',
    'BG_ANDROID_VITE_BACKEND_URL_VAR',
    'BG_ANDROID_VITE_BACKEND_URL_SECRET',
    'BG_ANDROID_BACKEND_URL_VAR',
    'BG_ANDROID_BACKEND_URL_SECRET',
];

export const normalizeBackendUrl = (value) => String(value || '').trim().replace(/\/+$/u, '');

const isHttpBackendUrl = (value) => /^https?:\/\//iu.test(value);

const collectSources = (env, names) => names
    .map((name) => ({
        name,
        value: normalizeBackendUrl(env?.[name] || ''),
    }))
    .filter(({ value }) => value.length > 0);

const assertHttpUrls = (sources) => {
    for (const source of sources) {
        if (!isHttpBackendUrl(source.value)) {
            throw new Error(`公开后端地址必须是绝对 HTTP/HTTPS URL：${source.name}=${source.value}`);
        }
    }
};

const resolveSingleValue = (label, sources) => {
    const uniqueValues = [...new Set(sources.map(({ value }) => value))];
    if (uniqueValues.length <= 1) {
        return uniqueValues[0] || '';
    }

    const details = sources
        .map(({ name, value }) => `${name}=${value}`)
        .join(', ');
    throw new Error(`${label}配置冲突，不能让 Web/App 指向不同后端：${details}`);
};

export const resolvePublicBackendUrl = (env = process.env) => {
    const primarySources = collectSources(env, PRIMARY_PUBLIC_BACKEND_URL_SOURCES);
    const legacySources = collectSources(env, LEGACY_ANDROID_BACKEND_URL_SOURCES);
    assertHttpUrls([...primarySources, ...legacySources]);

    const primaryUrl = resolveSingleValue('公开后端入口', primarySources);
    const legacyUrl = resolveSingleValue('Android 旧后端入口', legacySources);

    if (primaryUrl && legacyUrl && primaryUrl !== legacyUrl) {
        const details = [...primarySources, ...legacySources]
            .map(({ name, value }) => `${name}=${value}`)
            .join(', ');
        throw new Error(`Web/App 后端入口不一致，已阻止构建：${details}`);
    }

    return primaryUrl || legacyUrl || DEFAULT_PUBLIC_BACKEND_URL;
};

export const resolveAndroidBackendUrl = resolvePublicBackendUrl;
