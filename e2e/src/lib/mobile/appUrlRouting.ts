const normalizeRoutePath = (value: string) => {
    const normalized = value.replace(/\/{2,}/g, '/');
    return normalized.startsWith('/') ? normalized : `/${normalized}`;
};

export const resolveInAppUrlPath = (url: string): string | null => {
    try {
        const parsed = new URL(url);

        let pathname = parsed.pathname;
        if (!pathname || pathname === '/') {
            pathname = '';
        }

        if (/^https?:$/i.test(parsed.protocol)) {
            const routePath = `${normalizeRoutePath(parsed.pathname || '/')}${parsed.search}${parsed.hash}`;
            return routePath === '/' ? null : routePath;
        }

        const hostPath = parsed.hostname ? `/${parsed.hostname}` : '';
        const routePath = `${normalizeRoutePath(`${hostPath}${pathname || '/'}`)}${parsed.search}${parsed.hash}`;
        return routePath === '/' ? null : routePath;
    } catch {
        return null;
    }
};
