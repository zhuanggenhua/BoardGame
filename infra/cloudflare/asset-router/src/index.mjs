const FORWARDED_REQUEST_HEADERS = [
    'accept',
    'if-match',
    'if-modified-since',
    'if-none-match',
    'if-unmodified-since',
    'range',
];

const CACHEABLE_MEDIA_EXTENSIONS = new Set([
    '.webp',
    '.png',
    '.jpg',
    '.jpeg',
    '.gif',
    '.svg',
    '.ogg',
]);

const resolveTimeoutMs = (value) => {
    const parsed = Number(value);
    return Number.isFinite(parsed) && parsed > 0 ? parsed : 1500;
};

const resolveMediaCacheTtlSeconds = (request) => {
    const url = new URL(request.url);
    if (request.method !== 'GET' && request.method !== 'HEAD') return null;
    if (request.headers.has('Range')) return null;

    const pathname = url.pathname.toLowerCase();
    const extension = pathname.includes('.')
        ? pathname.slice(pathname.lastIndexOf('.'))
        : '';
    if (!CACHEABLE_MEDIA_EXTENSIONS.has(extension)) return null;

    return url.searchParams.has('v') ? 31536000 : 86400;
};

const parseHostnameList = (value = '') => value
    .split(',')
    .map((entry) => entry.trim().toLowerCase())
    .filter(Boolean);

const resolveOriginConfig = (request, env) => {
    const incomingHost = new URL(request.url).hostname.toLowerCase();
    const directHostnames = parseHostnameList(env.ORIGIN_DIRECT_HOSTNAMES);
    const directEnabled = Boolean(env.ORIGIN_DIRECT_BASE_URL)
        && (directHostnames.includes('*') || directHostnames.includes(incomingHost));

    if (!directEnabled) {
        return {
            baseUrl: env.ORIGIN_BASE_URL,
            resolveOverride: '',
            route: 'tunnel',
        };
    }

    return {
        baseUrl: env.ORIGIN_DIRECT_BASE_URL,
        resolveOverride: env.ORIGIN_DIRECT_RESOLVE_OVERRIDE || '',
        route: 'direct',
    };
};

const applySharedHeaders = (headers, source) => {
    headers.set('Access-Control-Allow-Origin', '*');
    headers.set(
        'Access-Control-Expose-Headers',
        'Accept-Ranges, Content-Length, Content-Range, ETag, Last-Modified, X-Asset-Cache-Policy, X-Asset-Origin-Route, X-Asset-Source',
    );
    headers.set('Accept-Ranges', 'bytes');
    headers.set('X-Asset-Source', source);
    headers.set('X-Content-Type-Options', 'nosniff');
};

const buildCorsPreflightResponse = (request) => {
    const headers = new Headers({
        'Access-Control-Allow-Methods': 'GET, HEAD, OPTIONS',
        'Access-Control-Max-Age': '86400',
    });
    const requestedHeaders = request.headers.get('Access-Control-Request-Headers');
    headers.set(
        'Access-Control-Allow-Headers',
        requestedHeaders || 'Accept, Cache-Control, Content-Type, Range, If-Match, If-Modified-Since, If-None-Match, If-Unmodified-Since',
    );
    applySharedHeaders(headers, 'preflight');
    return new Response(null, { status: 204, headers });
};

const buildOriginRequest = (request, env, originConfig = resolveOriginConfig(request, env)) => {
    const incomingUrl = new URL(request.url);
    const originUrl = new URL(`${incomingUrl.pathname}${incomingUrl.search}`, originConfig.baseUrl);
    const headers = new Headers();

    for (const name of FORWARDED_REQUEST_HEADERS) {
        const value = request.headers.get(name);
        if (value !== null) headers.set(name, value);
    }

    headers.set('X-Asset-Origin-Token', env.ORIGIN_TOKEN);
    const clientIp = request.headers.get('CF-Connecting-IP');
    if (clientIp) headers.set('X-Asset-Client-IP', clientIp);

    return new Request(originUrl, {
        method: request.method,
        headers,
        redirect: 'manual',
    });
};

const fetchOrigin = async (request, env, fetchImpl) => {
    const controller = new AbortController();
    const timer = setTimeout(
        () => controller.abort('origin response timeout'),
        resolveTimeoutMs(env.ORIGIN_TIMEOUT_MS),
    );
    const mediaCacheTtl = resolveMediaCacheTtlSeconds(request);
    const originConfig = resolveOriginConfig(request, env);
    const fetchOptions = {
        signal: controller.signal,
    };

    if (mediaCacheTtl !== null) {
        fetchOptions.cf = {
            cacheEverything: true,
            cacheTtlByStatus: {
                '200-299': mediaCacheTtl,
                '300-399': 60,
                '400-499': 30,
                '500-599': 0,
            },
        };
    }
    if (originConfig.resolveOverride) {
        fetchOptions.cf = {
            ...(fetchOptions.cf || {}),
            resolveOverride: originConfig.resolveOverride,
        };
    }

    try {
        return await fetchImpl(buildOriginRequest(request, env, originConfig), fetchOptions);
    } finally {
        clearTimeout(timer);
    }
};

const withServerSource = (request, response, env) => {
    const source = response.status >= 500 ? 'server-error' : 'server';
    const headers = new Headers(response.headers);
    headers.delete('CDN-Cache-Control');
    headers.delete('Cloudflare-CDN-Cache-Control');
    applySharedHeaders(headers, source);
    headers.set('X-Asset-Origin-Route', resolveOriginConfig(request, env).route);
    const mediaCacheTtl = resolveMediaCacheTtlSeconds(request);
    if (mediaCacheTtl !== null) {
        headers.set('X-Asset-Cache-Policy', `edge-media; ttl=${mediaCacheTtl}`);
    }
    return new Response(request.method === 'HEAD' ? null : response.body, {
        status: response.status,
        statusText: response.statusText,
        headers,
    });
};

export const createAssetRouter = ({ fetchImpl = fetch } = {}) => async (request, env) => {
    if (request.method === 'OPTIONS') {
        return buildCorsPreflightResponse(request);
    }

    if (request.method !== 'GET' && request.method !== 'HEAD') {
        return new Response('Method Not Allowed', {
            status: 405,
            headers: { Allow: 'GET, HEAD, OPTIONS' },
        });
    }

    try {
        return withServerSource(request, await fetchOrigin(request, env, fetchImpl), env);
    } catch {
        const headers = new Headers({ 'Cache-Control': 'no-store' });
        applySharedHeaders(headers, 'server-error');
        headers.set('X-Asset-Origin-Route', resolveOriginConfig(request, env).route);
        return new Response('Asset origin unavailable', { status: 502, headers });
    }
};

const assetRouter = createAssetRouter();

export default {
    fetch(request, env) {
        return assetRouter(request, env);
    },
};
