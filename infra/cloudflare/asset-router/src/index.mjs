const ORIGIN_FALLBACK_STATUSES = new Set([404, 408, 429]);
const FORWARDED_REQUEST_HEADERS = [
    'accept',
    'if-match',
    'if-modified-since',
    'if-none-match',
    'if-unmodified-since',
    'range',
];

export const shouldFallbackToR2 = (status) => (
    ORIGIN_FALLBACK_STATUSES.has(status) || status >= 500
);

const resolveTimeoutMs = (value) => {
    const parsed = Number(value);
    return Number.isFinite(parsed) && parsed > 0 ? parsed : 1500;
};

const applySharedHeaders = (headers, source) => {
    headers.set('Access-Control-Allow-Origin', '*');
    headers.set(
        'Access-Control-Expose-Headers',
        'Accept-Ranges, Content-Length, Content-Range, ETag, Last-Modified, X-Asset-Source',
    );
    headers.set('Accept-Ranges', 'bytes');
    headers.set('X-Asset-Source', source);
    headers.set('X-Content-Type-Options', 'nosniff');
};

const defaultCacheControl = (key) => (
    key.endsWith('.json')
        ? 'public, max-age=300, stale-while-revalidate=60'
        : 'public, max-age=31536000, immutable'
);

const buildOriginRequest = (request, env) => {
    const incomingUrl = new URL(request.url);
    const originUrl = new URL(`${incomingUrl.pathname}${incomingUrl.search}`, env.ORIGIN_BASE_URL);
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

    try {
        return await fetchImpl(buildOriginRequest(request, env), {
            signal: controller.signal,
        });
    } finally {
        clearTimeout(timer);
    }
};

const resolveConditionalStatus = (request) => (
    request.headers.has('if-none-match') || request.headers.has('if-modified-since')
        ? 304
        : 412
);

const resolveRange = (range, objectSize) => {
    if (!range) return null;
    if ('offset' in range && 'length' in range) {
        return { offset: range.offset, length: range.length };
    }
    if ('suffix' in range) {
        const length = Math.min(range.suffix, objectSize);
        return { offset: objectSize - length, length };
    }
    return null;
};

export const fetchFromR2 = async (request, env, source) => {
    const url = new URL(request.url);
    const key = decodeURIComponent(url.pathname.replace(/^\/+/, ''));

    const object = await env.ASSETS_BUCKET.get(key, {
        onlyIf: request.headers,
        range: request.headers,
    });

    if (object === null) {
        const headers = new Headers({ 'Cache-Control': 'no-store' });
        applySharedHeaders(headers, source);
        return new Response('Object Not Found', { status: 404, headers });
    }

    const headers = new Headers();
    object.writeHttpMetadata(headers);
    headers.set('ETag', object.httpEtag);
    if (!headers.has('Cache-Control')) {
        headers.set('Cache-Control', defaultCacheControl(key));
    }
    applySharedHeaders(headers, source);

    if (!('body' in object)) {
        headers.delete('Content-Length');
        return new Response(null, {
            status: resolveConditionalStatus(request),
            headers,
        });
    }

    const hasRangeRequest = request.headers.has('range');
    const resolvedRange = hasRangeRequest
        ? resolveRange(object.range, object.size)
        : null;
    let status = 200;
    if (resolvedRange) {
        status = 206;
        headers.set(
            'Content-Range',
            `bytes ${resolvedRange.offset}-${resolvedRange.offset + resolvedRange.length - 1}/${object.size}`,
        );
        headers.set('Content-Length', String(resolvedRange.length));
    } else {
        headers.set('Content-Length', String(object.size));
    }

    return new Response(request.method === 'HEAD' ? null : object.body, {
        status,
        headers,
    });
};

const withServerSource = (request, response) => {
    const headers = new Headers(response.headers);
    headers.delete('CDN-Cache-Control');
    headers.delete('Cloudflare-CDN-Cache-Control');
    applySharedHeaders(headers, 'server');
    return new Response(request.method === 'HEAD' ? null : response.body, {
        status: response.status,
        statusText: response.statusText,
        headers,
    });
};

export const createAssetRouter = ({ fetchImpl = fetch } = {}) => async (request, env) => {
    if (request.method !== 'GET' && request.method !== 'HEAD') {
        return new Response('Method Not Allowed', {
            status: 405,
            headers: { Allow: 'GET, HEAD' },
        });
    }

    try {
        const originResponse = await fetchOrigin(request, env, fetchImpl);
        if (!shouldFallbackToR2(originResponse.status)) {
            return withServerSource(request, originResponse);
        }
    } catch {
        // Origin connection and response-header timeouts intentionally fall through to R2.
    }

    return fetchFromR2(request, env, 'r2-fallback');
};

const assetRouter = createAssetRouter();

export default {
    fetch(request, env) {
        return assetRouter(request, env);
    },
};
