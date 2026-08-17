export const DEFAULT_ANDROID_BACKEND_URL = 'http://8.148.71.102';

const normalizeBackendUrl = (value) => String(value || '').trim().replace(/\/+$/, '');

const isHttpBackendUrl = (value) => /^https?:\/\//i.test(value);

const isDirectAddressBackendUrl = (value) => {
    if (!isHttpBackendUrl(value)) {
        return false;
    }

    try {
        const { hostname } = new URL(value);
        return hostname === 'localhost'
            || hostname === '127.0.0.1'
            || hostname === '0.0.0.0'
            || /^\d{1,3}(?:\.\d{1,3}){3}$/u.test(hostname)
            || hostname.includes(':');
    } catch {
        return false;
    }
};

export const resolveAndroidBackendUrl = (env = process.env) => {
    const explicitAndroidBackendUrl = normalizeBackendUrl(
        env.VITE_ANDROID_BACKEND_URL
            || env.ANDROID_VITE_BACKEND_URL
            || env.ANDROID_BACKEND_URL
            || '',
    );

    if (explicitAndroidBackendUrl) {
        if (!isHttpBackendUrl(explicitAndroidBackendUrl)) {
            throw new Error(`Android 后端地址必须是绝对 HTTP/HTTPS URL：${explicitAndroidBackendUrl}`);
        }
        return explicitAndroidBackendUrl;
    }

    const legacyGenericBackendUrl = normalizeBackendUrl(env.VITE_BACKEND_URL || '');
    if (isDirectAddressBackendUrl(legacyGenericBackendUrl)) {
        return legacyGenericBackendUrl;
    }

    return DEFAULT_ANDROID_BACKEND_URL;
};
