export type BrowserCompatibilityReason =
    | 'runtime-core'
    | 'game-resize-observer';

export interface BrowserCompatibilityReport {
    isCompatible: boolean;
    reasons: BrowserCompatibilityReason[];
    isAndroidWebView: boolean;
    browserName: string;
    browserVersion: string | null;
}

export const BROWSER_COMPATIBILITY_BYPASS_KEY = 'bg.compatibility.bypass';

const UNKNOWN_BROWSER_NAME = 'Unknown Browser';

interface BrowserSignature {
    name: string;
    pattern: RegExp;
}

const DEV_RESIZE_OBSERVER_REQUIRED_PREFIXES: string[] = [];

const BROWSER_SIGNATURES: BrowserSignature[] = [
    { name: 'Edge', pattern: /Edg\/([\d.]+)/i },
    { name: 'Firefox', pattern: /Firefox\/([\d.]+)/i },
    { name: 'Samsung Internet', pattern: /SamsungBrowser\/([\d.]+)/i },
    { name: 'Android WebView', pattern: /Chrome\/([\d.]+).*\bwv\b/i },
    { name: 'Chrome', pattern: /Chrome\/([\d.]+)/i },
    { name: 'Safari', pattern: /Version\/([\d.]+).*Safari/i },
];

const parseBrowserIdentity = (userAgent: string): { browserName: string; browserVersion: string | null } => {
    for (const signature of BROWSER_SIGNATURES) {
        const match = userAgent.match(signature.pattern);
        if (match) {
            return {
                browserName: signature.name,
                browserVersion: match[1] ?? null,
            };
        }
    }

    return {
        browserName: UNKNOWN_BROWSER_NAME,
        browserVersion: null,
    };
};

const requiresResizeObserver = (pathname: string): boolean => {
    if (DEV_RESIZE_OBSERVER_REQUIRED_PREFIXES.some((prefix) => pathname.startsWith(prefix))) {
        return true;
    }
    return false;
};

export const detectBrowserCompatibility = (pathname = '/'): BrowserCompatibilityReport => {
    if (typeof window === 'undefined' || typeof navigator === 'undefined') {
        return {
            isCompatible: true,
            reasons: [],
            isAndroidWebView: false,
            browserName: UNKNOWN_BROWSER_NAME,
            browserVersion: null,
        };
    }

    const userAgent = navigator.userAgent || '';
    const browserIdentity = parseBrowserIdentity(userAgent);
    const reasons: BrowserCompatibilityReason[] = [];

    if (
        typeof Promise === 'undefined'
        || typeof Map === 'undefined'
        || typeof Set === 'undefined'
        || typeof Symbol === 'undefined'
        || typeof URLSearchParams === 'undefined'
        || typeof fetch !== 'function'
    ) {
        reasons.push('runtime-core');
    }

    if (requiresResizeObserver(pathname)) {
        if (typeof ResizeObserver !== 'function') {
            reasons.push('game-resize-observer');
        }
    }

    return {
        // 版本号只做识别展示；只有缺少项目当前没有 fallback 的关键能力时才拦截。
        isCompatible: reasons.length === 0,
        reasons,
        isAndroidWebView: /\bwv\b|; wv\)/i.test(userAgent),
        browserName: browserIdentity.browserName,
        browserVersion: browserIdentity.browserVersion,
    };
};

export const readBrowserCompatibilityBypass = (): boolean => {
    if (typeof window === 'undefined') {
        return false;
    }

    try {
        return window.sessionStorage.getItem(BROWSER_COMPATIBILITY_BYPASS_KEY) === '1';
    } catch {
        return false;
    }
};

export const writeBrowserCompatibilityBypass = (enabled: boolean): void => {
    if (typeof window === 'undefined') {
        return;
    }

    try {
        if (enabled) {
            window.sessionStorage.setItem(BROWSER_COMPATIBILITY_BYPASS_KEY, '1');
            return;
        }

        window.sessionStorage.removeItem(BROWSER_COMPATIBILITY_BYPASS_KEY);
    } catch {
        // sessionStorage 不可用时，保持静默降级
    }
};
