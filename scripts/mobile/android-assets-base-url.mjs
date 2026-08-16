export const DEFAULT_ANDROID_CONTROL_ASSETS_BASE_URL = 'https://assets.easyboardgame.top/official';
export const DEFAULT_ANDROID_DOWNLOAD_ASSETS_BASE_URL = 'http://8.148.71.102/official';
export const DEFAULT_ANDROID_ASSETS_BASE_URL = DEFAULT_ANDROID_DOWNLOAD_ASSETS_BASE_URL;

const normalizeBaseUrl = (value) => String(value || '').trim().replace(/\/+$/, '');

export const resolveAndroidControlAssetsBaseUrl = (env = process.env) => {
    const configured = env.VITE_ANDROID_CONTROL_ASSETS_BASE_URL?.trim()
        || env.ANDROID_CONTROL_ASSETS_BASE_URL?.trim()
        || env.VITE_ANDROID_OTA_CONTROL_ASSETS_BASE_URL?.trim()
        || env.ANDROID_OTA_CONTROL_ASSETS_BASE_URL?.trim()
        || '';
    return normalizeBaseUrl(configured || DEFAULT_ANDROID_CONTROL_ASSETS_BASE_URL);
};

export const resolveAndroidAssetsBaseUrl = (env = process.env) => {
    const configured = env.VITE_ANDROID_DOWNLOAD_ASSETS_BASE_URL?.trim()
        || env.ANDROID_DOWNLOAD_ASSETS_BASE_URL?.trim()
        || env.VITE_ANDROID_ASSETS_BASE_URL?.trim()
        || env.ANDROID_VITE_ASSETS_BASE_URL?.trim()
        || env.ANDROID_ASSETS_BASE_URL?.trim()
        || '';
    return normalizeBaseUrl(configured || DEFAULT_ANDROID_DOWNLOAD_ASSETS_BASE_URL);
};
