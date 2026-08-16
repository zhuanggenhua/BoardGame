export const DEFAULT_ANDROID_ASSETS_BASE_URL = 'http://8.148.71.102/official';

export const resolveAndroidAssetsBaseUrl = (env = process.env) => {
    const configured = env.VITE_ANDROID_ASSETS_BASE_URL?.trim()
        || env.ANDROID_VITE_ASSETS_BASE_URL?.trim()
        || '';
    return (configured || DEFAULT_ANDROID_ASSETS_BASE_URL).replace(/\/+$/, '');
};
