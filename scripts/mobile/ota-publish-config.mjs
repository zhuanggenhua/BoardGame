export const DEFAULT_FORCE_UPDATE_TITLE = '正在更新';
export const DEFAULT_FORCE_UPDATE_MESSAGE = '正在下载必要更新，请稍候';
export const ANDROID_OTA_VERSION_FLOOR = '6.0.0';
export const DEFAULT_ANDROID_OTA_CHANNEL = 'stable';
export {
    DEFAULT_ANDROID_ASSETS_BASE_URL,
    DEFAULT_ANDROID_CONTROL_ASSETS_BASE_URL,
    DEFAULT_ANDROID_DOWNLOAD_ASSETS_BASE_URL,
} from './android-assets-base-url.mjs';
import {
    DEFAULT_ANDROID_CONTROL_ASSETS_BASE_URL,
    DEFAULT_ANDROID_DOWNLOAD_ASSETS_BASE_URL,
} from './android-assets-base-url.mjs';

const normalizeHttpBaseUrl = (value, label) => {
    const normalized = String(value || '').trim().replace(/\/+$/, '');

    if (!/^https?:\/\//i.test(normalized)) {
        throw new Error(`Android OTA ${label}必须是绝对 HTTP/HTTPS URL：${normalized || '(空)'}`);
    }

    return normalized;
};

const splitUrlList = (value) => {
    if (Array.isArray(value)) {
        return value.flatMap(splitUrlList);
    }
    return String(value || '')
        .split(/[\n,]+/)
        .map((entry) => entry.trim())
        .filter(Boolean);
};

const uniqueHttpUrls = (values) => {
    const seen = new Set();
    const urls = [];
    for (const value of values) {
        if (!/^https?:\/\//i.test(value)) {
            throw new Error(`Android OTA 兜底清单地址必须是绝对 HTTP/HTTPS URL：${value}`);
        }
        const normalized = value.replace(/\/+$/, '');
        if (seen.has(normalized)) continue;
        seen.add(normalized);
        urls.push(normalized);
    }
    return urls;
};

export const resolveAndroidOtaClientBuildEnv = ({
    channel = DEFAULT_ANDROID_OTA_CHANNEL,
    assetsBaseUrl,
    controlAssetsBaseUrl = assetsBaseUrl || DEFAULT_ANDROID_CONTROL_ASSETS_BASE_URL,
    downloadAssetsBaseUrl = DEFAULT_ANDROID_DOWNLOAD_ASSETS_BASE_URL,
    fallbackManifestUrls,
} = {}) => {
    const normalizedChannel = String(channel || '').trim() || DEFAULT_ANDROID_OTA_CHANNEL;
    const normalizedControlAssetsBaseUrl = normalizeHttpBaseUrl(controlAssetsBaseUrl, '控制入口根地址');
    const normalizedDownloadAssetsBaseUrl = normalizeHttpBaseUrl(downloadAssetsBaseUrl, '下载根地址');
    const primaryManifestUrl = `${normalizedControlAssetsBaseUrl}/app-updates/android/${normalizedChannel}/latest.json`;
    const defaultFallbackManifestUrl = `${normalizedDownloadAssetsBaseUrl}/app-updates/android/${normalizedChannel}/latest.json`;
    const manifestFallbackUrls = uniqueHttpUrls(
        splitUrlList(fallbackManifestUrls === undefined ? defaultFallbackManifestUrl : fallbackManifestUrls)
            .filter((url) => url !== primaryManifestUrl),
    );

    const env = {
        VITE_ANDROID_OTA_ENABLED: 'true',
        VITE_ANDROID_OTA_MANIFEST_URL: primaryManifestUrl,
        VITE_ANDROID_OTA_CHANNEL: normalizedChannel,
    };

    if (manifestFallbackUrls.length > 0) {
        env.VITE_ANDROID_OTA_MANIFEST_FALLBACK_URLS = manifestFallbackUrls.join(',');
    }

    return env;
};

const parseVersionTriplet = (value) => {
    const match = String(value || '').trim().match(/^(\d+)\.(\d+)\.(\d+)/);
    if (!match) {
        throw new Error(`非法 OTA 内部游标版本：${value || '(空)'}`);
    }
    return match.slice(1, 4).map(Number);
};

export const compareOtaVersionBase = (left, right) => {
    const leftParts = parseVersionTriplet(left);
    const rightParts = parseVersionTriplet(right);
    for (let index = 0; index < 3; index += 1) {
        if (leftParts[index] === rightParts[index]) continue;
        return leftParts[index] > rightParts[index] ? 1 : -1;
    }
    return 0;
};

export const resolveAndroidOtaVersionBase = ({
    packageVersion,
    requestedVersionBase = '',
    minimumVersionBase = ANDROID_OTA_VERSION_FLOOR,
} = {}) => {
    const requested = String(requestedVersionBase || '').trim();
    const fallback = String(packageVersion || '').trim();
    const candidate = requested || fallback;

    if (compareOtaVersionBase(candidate, minimumVersionBase) < 0) {
        if (requested) {
            throw new Error(
                `Android OTA 内部游标不能低于 ${minimumVersionBase}：收到 ${requested}。`
                + ' 历史客户端可能已记录更高游标，降低会导致强制更新也被判定为旧包。',
            );
        }
        return minimumVersionBase;
    }

    return candidate;
};

export const resolveOtaForceUpdateOptions = ({
    noForceUpdateFlag = false,
    forceUpdateTitle = '',
    forceUpdateMessage = '',
} = {}) => {
    if (noForceUpdateFlag) {
        throw new Error('所有 OTA 已强制更新，禁止使用 --no-force-update。');
    }

    return {
        forceUpdate: true,
        forceUpdateTitle: forceUpdateTitle.trim() || DEFAULT_FORCE_UPDATE_TITLE,
        forceUpdateMessage: forceUpdateMessage.trim() || DEFAULT_FORCE_UPDATE_MESSAGE,
    };
};
