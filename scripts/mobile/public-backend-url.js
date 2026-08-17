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

const PUBLIC_SERVICE_BACKEND_URL_SOURCES = [
    ['VITE_GAME_SERVER_URL', ''],
    ['VITE_AUTH_API_URL', '/auth'],
    ['VITE_ADMIN_API_URL', '/admin'],
    ['VITE_FEEDBACK_API_URL', '/feedback'],
    ['VITE_SPONSOR_API_URL', '/sponsors'],
    ['VITE_NOTIFICATION_API_URL', '/notifications'],
    ['VITE_GAME_CHANGELOG_API_URL', '/game-changelogs'],
    ['VITE_UGC_API_URL', '/ugc'],
    ['VITE_LAYOUT_API_URL', '/layout'],
];

export const normalizeBackendUrl = (value) => String(value || '').trim().replace(/\/+$/u, '');

const isHttpBackendUrl = (value) => /^https?:\/\//iu.test(value);

const isRelativeBackendPath = (value) => value === '' || value.startsWith('/');

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

const joinBackendPath = (backendUrl, pathname) => {
    const normalizedBackendUrl = normalizeBackendUrl(backendUrl);
    if (!pathname) return normalizedBackendUrl;
    return `${normalizedBackendUrl}${pathname}`;
};

const describeExpectedBackendUrl = (publicBackendUrl, expectedPath) => {
    const normalizedPublicBackendUrl = normalizeBackendUrl(publicBackendUrl);
    if (normalizedPublicBackendUrl) {
        return joinBackendPath(normalizedPublicBackendUrl, expectedPath);
    }
    return expectedPath || '(unset)';
};

export const assertNoPublicBackendSplit = (env = process.env, publicBackendUrl = '') => {
    const normalizedPublicBackendUrl = normalizeBackendUrl(publicBackendUrl || env?.VITE_BACKEND_URL || '');
    const mismatches = [];

    for (const [name, expectedPath] of PUBLIC_SERVICE_BACKEND_URL_SOURCES) {
        const configuredValue = normalizeBackendUrl(env?.[name] || '');
        if (!configuredValue) continue;

        const expectedValue = describeExpectedBackendUrl(normalizedPublicBackendUrl, expectedPath);
        if (isHttpBackendUrl(configuredValue)) {
            if (!normalizedPublicBackendUrl) {
                mismatches.push(`${name}=${configuredValue}，但未配置 VITE_BACKEND_URL`);
                continue;
            }
            if (configuredValue !== expectedValue) {
                mismatches.push(`${name}=${configuredValue}，应为 ${expectedValue}`);
            }
            continue;
        }

        if (!isRelativeBackendPath(configuredValue)) {
            mismatches.push(`${name}=${configuredValue}，必须是绝对 HTTP/HTTPS URL 或同源路径`);
            continue;
        }

        if (normalizedPublicBackendUrl) {
            mismatches.push(`${name}=${configuredValue}，但 VITE_BACKEND_URL=${normalizedPublicBackendUrl} 时应使用 ${expectedValue}`);
            continue;
        }

        if (configuredValue !== expectedValue) {
            mismatches.push(`${name}=${configuredValue}，同源部署时应为 ${expectedValue}`);
        }
    }

    if (mismatches.length > 0) {
        throw new Error(
            '公开后端必须保持单一真相：生产构建只允许 VITE_BACKEND_URL 作为公开后端入口，'
            + `服务级覆盖不能让 Web/App 或 API/Socket 分叉：${mismatches.join('; ')}`,
        );
    }
};
