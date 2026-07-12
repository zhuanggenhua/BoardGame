const OTA_ALLOWED_LOCALE_PREFIX = 'locales/zh-CN/';
const OTA_ASSET_MANIFEST_PATTERN = /^assets\/(?:.+\/)?assets-manifest\.json$/;
const OTA_REQUIRED_LOGO_FILES = new Set([
    'logos/weixin.jpg',
    'logos/zhifubao.jpg',
]);

const normalizeRelativePath = (relativePath) => relativePath.replace(/\\/g, '/').replace(/^\/+/, '');

export const classifyOtaBundleFile = (relativePath) => {
    const normalized = normalizeRelativePath(relativePath);

    if (normalized.startsWith('locales/')) {
        return normalized.startsWith(OTA_ALLOWED_LOCALE_PREFIX) ? 'include' : 'remote-skip';
    }

    if (normalized.startsWith('assets/')) {
        const assetRelativePath = normalized.slice('assets/'.length);
        if (!assetRelativePath.includes('/')) {
            return 'include';
        }
        return OTA_ASSET_MANIFEST_PATTERN.test(normalized) ? 'include' : 'remote-skip';
    }

    if (OTA_REQUIRED_LOGO_FILES.has(normalized)) {
        return 'include';
    }

    if (normalized.startsWith('logos/') || normalized.endsWith('.md')) {
        return 'remote-skip';
    }

    return 'include';
};
