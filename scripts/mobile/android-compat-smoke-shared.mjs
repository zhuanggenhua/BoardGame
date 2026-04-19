export const DEFAULT_ANDROID_COMPAT_OUTPUT_ROOT = 'test-results/android-compat-smoke';
export const DEFAULT_ANDROID_COMPAT_MIN_WEBVIEW_MAJOR = 88;
export const DEFAULT_ANDROID_COMPAT_BOOT_TIMEOUT_MS = 240000;
export const DEFAULT_ANDROID_COMPAT_LAUNCH_DELAY_MS = 12000;
export const DEFAULT_ANDROID_COMPAT_BLACK_PIXEL_THRESHOLD = 18;
export const DEFAULT_ANDROID_COMPAT_BLACK_RATIO_THRESHOLD = 0.92;

const normalizeRoutePath = (value) => {
    const normalized = value.replace(/\/{2,}/g, '/');
    return normalized.startsWith('/') ? normalized : `/${normalized}`;
};

export const parseMajorVersion = (input) => {
    if (typeof input !== 'string') {
        return null;
    }

    const match = input.match(/(\d+)(?:\.\d+){0,3}/);
    if (!match) {
        return null;
    }

    const value = Number.parseInt(match[1], 10);
    return Number.isFinite(value) ? value : null;
};

export const parsePackageVersionName = (input) => {
    if (typeof input !== 'string' || !input.trim()) {
        return '';
    }

    const patterns = [
        /versionName=([^\s]+)/i,
        /versionName:\s*([^\s]+)/i,
        /Current WebView package \(name, version\): \([^,]+,\s*([^)]+)\)/i,
        /version\s*\)\s*:\s*([^\s]+)/i,
    ];

    for (const pattern of patterns) {
        const match = input.match(pattern);
        if (match?.[1]) {
            return match[1].trim();
        }
    }

    return '';
};

export const resolveCompatSmokeRoutePath = (input) => {
    if (typeof input !== 'string' || !input.trim()) {
        return '';
    }

    const value = input.trim();
    if (!/^[a-z][a-z0-9+.-]*:/i.test(value)) {
        return normalizeRoutePath(value);
    }

    try {
        const parsed = new URL(value);

        let pathname = parsed.pathname;
        if (!pathname || pathname === '/') {
            pathname = '';
        }

        if (/^https?:$/i.test(parsed.protocol)) {
            const routePath = `${normalizeRoutePath(parsed.pathname || '/')}${parsed.search}${parsed.hash}`;
            return routePath === '/' ? '' : routePath;
        }

        const hostPath = parsed.hostname ? `/${parsed.hostname}` : '';
        const routePath = `${normalizeRoutePath(`${hostPath}${pathname || '/'}`)}${parsed.search}${parsed.hash}`;
        return routePath === '/' ? '' : routePath;
    } catch {
        return '';
    }
};

export const buildCompatNavigationUrl = (input, origin = 'http://localhost') => {
    const routePath = resolveCompatSmokeRoutePath(input);
    if (!routePath) {
        return '';
    }

    const normalizedOrigin = origin.replace(/\/+$/u, '');
    return `${normalizedOrigin}${routePath}`;
};

const decodeXmlEntities = (value) => value
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, '\'')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&amp;/g, '&');

export const extractUiStrings = (xmlText) => {
    if (typeof xmlText !== 'string' || !xmlText.trim()) {
        return [];
    }

    const values = [];
    const pattern = /(?:text|content-desc)="([^"]+)"/g;

    let match;
    while ((match = pattern.exec(xmlText)) !== null) {
        const value = decodeXmlEntities(match[1]).trim();
        if (!value) {
            continue;
        }
        if (!values.includes(value)) {
            values.push(value);
        }
    }

    return values;
};

export const analyzeRawScreenshot = ({
    data,
    width,
    height,
    channels,
    blackPixelThreshold = DEFAULT_ANDROID_COMPAT_BLACK_PIXEL_THRESHOLD,
    blackRatioThreshold = DEFAULT_ANDROID_COMPAT_BLACK_RATIO_THRESHOLD,
}) => {
    if (!data || !width || !height || !channels || channels < 3) {
        return {
            pixelCount: 0,
            averageLuminance: 0,
            nearBlackRatio: 1,
            blackScreenSuspected: true,
        };
    }

    const pixelCount = width * height;
    let nearBlackCount = 0;
    let luminanceSum = 0;

    for (let index = 0; index < data.length; index += channels) {
        const red = data[index] ?? 0;
        const green = data[index + 1] ?? 0;
        const blue = data[index + 2] ?? 0;
        const luminance = (0.2126 * red) + (0.7152 * green) + (0.0722 * blue);
        luminanceSum += luminance;
        if (luminance <= blackPixelThreshold) {
            nearBlackCount += 1;
        }
    }

    const averageLuminance = pixelCount > 0 ? luminanceSum / pixelCount : 0;
    const nearBlackRatio = pixelCount > 0 ? nearBlackCount / pixelCount : 1;

    return {
        pixelCount,
        averageLuminance: Number(averageLuminance.toFixed(2)),
        nearBlackRatio: Number(nearBlackRatio.toFixed(4)),
        blackScreenSuspected: nearBlackRatio >= blackRatioThreshold,
    };
};

export const detectFriendlyPrompt = (uiStrings) => {
    const text = Array.isArray(uiStrings) ? uiStrings.join('\n') : '';
    const keywords = [
        '页面没有正常显示',
        '刷新重试',
        '返回大厅',
        '不兼容',
        '兼容性',
        '正在更新',
        '下载必要更新',
    ];

    return keywords.some((keyword) => text.includes(keyword));
};
