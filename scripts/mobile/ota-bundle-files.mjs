import { DIST_LOGOS_RETAIN_RELATIVE_PATHS } from '../deploy/prune-web-dist-assets.mjs';
import { APP_HOME_MEDIA_PATHS, isExcludedAppMedia } from './app-bundle-media.mjs';

const OTA_ALLOWED_LOCALE_PREFIX = 'locales/zh-CN/';
const OTA_ASSET_MANIFEST_PATTERN = /^assets\/(?:.+\/)?assets-manifest\.json$/;
const OTA_PLATFORM_LOGOS = new Set(DIST_LOGOS_RETAIN_RELATIVE_PATHS.map((file) => `logos/${file}`));

const normalizeRelativePath = (relativePath) => relativePath.replace(/\\/g, '/').replace(/^\/+/, '');

export const classifyOtaBundleFile = (relativePath) => {
    const normalized = normalizeRelativePath(relativePath);

    if (isExcludedAppMedia(normalized)) return 'remote-skip';
    if (APP_HOME_MEDIA_PATHS.has(normalized)) return 'include';

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

    if (normalized.startsWith('logos/')) {
        return OTA_PLATFORM_LOGOS.has(normalized) ? 'include' : 'remote-skip';
    }

    if (normalized.endsWith('.md')) {
        return 'remote-skip';
    }

    return 'include';
};
