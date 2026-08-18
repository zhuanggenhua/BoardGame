const FORWARDED_REQUEST_HEADERS = [
    'accept',
    'if-match',
    'if-modified-since',
    'if-none-match',
    'if-unmodified-since',
    'range',
];

const FALLBACK_TCP_MAX_BYTES = 1024 * 1024;

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

const resolveFallbackOriginConfig = (request, env) => {
    const fallbackBaseUrl = (env.ORIGIN_FALLBACK_BASE_URL || '').trim();
    if (!fallbackBaseUrl) return null;

    const primaryConfig = resolveOriginConfig(request, env);
    if (normalizeComparableBaseUrl(primaryConfig.baseUrl) === normalizeComparableBaseUrl(fallbackBaseUrl)) {
        return null;
    }

    return {
        baseUrl: fallbackBaseUrl,
        hostHeader: new URL(fallbackBaseUrl).host,
        resolveOverride: env.ORIGIN_FALLBACK_RESOLVE_OVERRIDE || '',
        route: 'fallback-ip',
        transport: env.ORIGIN_FALLBACK_TRANSPORT || 'fetch',
    };
};

const normalizeComparableBaseUrl = (value = '') => {
    try {
        const url = new URL(value);
        url.pathname = url.pathname.replace(/\/+$/, '');
        url.search = '';
        url.hash = '';
        return url.toString();
    } catch {
        return value.trim().replace(/\/+$/, '');
    }
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
    if (originConfig.hostHeader) headers.set('Host', originConfig.hostHeader);
    const clientIp = request.headers.get('CF-Connecting-IP');
    if (clientIp) headers.set('X-Asset-Client-IP', clientIp);

    return new Request(originUrl, {
        method: request.method,
        headers,
        redirect: 'manual',
    });
};

const appendBytes = (left, right) => {
    const output = new Uint8Array(left.length + right.length);
    output.set(left);
    output.set(right, left.length);
    return output;
};

const findHeaderEnd = (bytes) => {
    for (let index = 0; index <= bytes.length - 4; index += 1) {
        if (
            bytes[index] === 13
            && bytes[index + 1] === 10
            && bytes[index + 2] === 13
            && bytes[index + 3] === 10
        ) {
            return index;
        }
    }
    return -1;
};

const parseHeaderLines = (headerText) => {
    const headers = new Headers();
    const [, ...headerLines] = headerText.split('\r\n');
    for (const line of headerLines) {
        const separatorIndex = line.indexOf(':');
        if (separatorIndex <= 0) continue;
        headers.append(line.slice(0, separatorIndex).trim(), line.slice(separatorIndex + 1).trim());
    }
    return headers;
};

const hasCompleteChunkedBody = (bodyBytes) => {
    let offset = 0;
    const decoder = new TextDecoder('iso-8859-1');
    while (offset < bodyBytes.length) {
        let lineEnd = -1;
        for (let index = offset; index < bodyBytes.length - 1; index += 1) {
            if (bodyBytes[index] === 13 && bodyBytes[index + 1] === 10) {
                lineEnd = index;
                break;
            }
        }
        if (lineEnd < 0) return false;

        const sizeText = decoder.decode(bodyBytes.slice(offset, lineEnd)).split(';')[0].trim();
        const chunkSize = Number.parseInt(sizeText, 16);
        if (!Number.isFinite(chunkSize)) return false;
        const chunkStart = lineEnd + 2;
        const chunkEnd = chunkStart + chunkSize;
        if (bodyBytes.length < chunkEnd + 2) return false;
        if (chunkSize === 0) return true;
        offset = chunkEnd + 2;
    }
    return false;
};

const decodeChunkedBody = (bodyBytes) => {
    let offset = 0;
    let output = new Uint8Array();
    const decoder = new TextDecoder('iso-8859-1');
    while (offset < bodyBytes.length) {
        let lineEnd = -1;
        for (let index = offset; index < bodyBytes.length - 1; index += 1) {
            if (bodyBytes[index] === 13 && bodyBytes[index + 1] === 10) {
                lineEnd = index;
                break;
            }
        }
        if (lineEnd < 0) break;

        const sizeText = decoder.decode(bodyBytes.slice(offset, lineEnd)).split(';')[0].trim();
        const chunkSize = Number.parseInt(sizeText, 16);
        if (!Number.isFinite(chunkSize) || chunkSize === 0) break;
        const chunkStart = lineEnd + 2;
        const chunkEnd = chunkStart + chunkSize;
        if (bodyBytes.length < chunkEnd) break;
        output = appendBytes(output, bodyBytes.slice(chunkStart, chunkEnd));
        offset = chunkEnd + 2;
    }
    return output;
};

const isTcpResponseComplete = (bytes) => {
    const headerEnd = findHeaderEnd(bytes);
    if (headerEnd < 0) return false;

    const headerText = new TextDecoder('iso-8859-1').decode(bytes.slice(0, headerEnd));
    const headers = parseHeaderLines(headerText);
    const bodyBytes = bytes.slice(headerEnd + 4);
    if ((headers.get('transfer-encoding') || '').toLowerCase().includes('chunked')) {
        return hasCompleteChunkedBody(bodyBytes);
    }

    const contentLength = Number.parseInt(headers.get('content-length') || '', 10);
    return Number.isFinite(contentLength) ? bodyBytes.length >= contentLength : false;
};

const buildTcpHttpRequest = (request, originUrl, hostHeader) => {
    const requestUrl = new URL(request.url);
    const lines = [
        `${request.method} ${requestUrl.pathname}${requestUrl.search} HTTP/1.1`,
        `Host: ${hostHeader || originUrl.host}`,
        'Connection: close',
    ];

    for (const name of FORWARDED_REQUEST_HEADERS) {
        const value = request.headers.get(name);
        if (value !== null) lines.push(`${name}: ${value}`);
    }

    return `${lines.join('\r\n')}\r\n\r\n`;
};

const fetchHttpOriginOverTcp = async (request, env, originConfig) => {
    const originUrl = new URL(originConfig.baseUrl);
    if (originUrl.protocol !== 'http:') {
        throw new Error('TCP fallback only supports plain HTTP origins');
    }

    const { connect } = await import('cloudflare:sockets');
    const socket = connect({
        hostname: originUrl.hostname,
        port: Number(originUrl.port || 80),
    }, { secureTransport: 'off' });
    const writer = socket.writable.getWriter();
    const encoder = new TextEncoder();
    await writer.write(encoder.encode(buildTcpHttpRequest(request, originUrl, originConfig.hostHeader)));
    writer.releaseLock();

    const reader = socket.readable.getReader();
    let chunks = new Uint8Array();
    try {
        while (chunks.length < FALLBACK_TCP_MAX_BYTES) {
            const { value, done } = await reader.read();
            if (done) break;
            chunks = appendBytes(chunks, value);
            if (isTcpResponseComplete(chunks)) break;
        }
    } finally {
        reader.releaseLock();
        await socket.close().catch(() => {});
    }

    const headerEnd = findHeaderEnd(chunks);
    if (headerEnd < 0) {
        throw new Error('TCP fallback returned an invalid HTTP response');
    }

    const headerText = new TextDecoder('iso-8859-1').decode(chunks.slice(0, headerEnd));
    const [statusLine] = headerText.split('\r\n');
    const statusMatch = /^HTTP\/\d(?:\.\d)?\s+(\d{3})(?:\s+(.*))?$/i.exec(statusLine || '');
    if (!statusMatch) {
        throw new Error('TCP fallback returned an invalid HTTP status line');
    }

    const headers = parseHeaderLines(headerText);
    let bodyBytes = chunks.slice(headerEnd + 4);
    if ((headers.get('transfer-encoding') || '').toLowerCase().includes('chunked')) {
        bodyBytes = decodeChunkedBody(bodyBytes);
        headers.delete('transfer-encoding');
        headers.set('content-length', String(bodyBytes.length));
    }

    return new Response(request.method === 'HEAD' ? null : bodyBytes, {
        status: Number(statusMatch[1]),
        statusText: statusMatch[2] || '',
        headers,
    });
};

const fetchOriginWithConfig = async (request, env, fetchImpl, originConfig) => {
    const controller = new AbortController();
    const timer = setTimeout(
        () => controller.abort('origin response timeout'),
        resolveTimeoutMs(env.ORIGIN_TIMEOUT_MS),
    );
    const mediaCacheTtl = resolveMediaCacheTtlSeconds(request);
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
        if (originConfig.transport === 'tcp') {
            return await fetchHttpOriginOverTcp(request, env, originConfig);
        }
        return await fetchImpl(buildOriginRequest(request, env, originConfig), fetchOptions);
    } finally {
        clearTimeout(timer);
    }
};

const fetchOrigin = async (request, env, fetchImpl, originConfig = resolveOriginConfig(request, env)) => (
    fetchOriginWithConfig(request, env, fetchImpl, originConfig)
);

const fetchOriginWithFallback = async (request, env, fetchImpl) => {
    const primaryConfig = resolveOriginConfig(request, env);
    const fallbackConfig = resolveFallbackOriginConfig(request, env);

    try {
        const primaryResponse = await fetchOrigin(request, env, fetchImpl, primaryConfig);
        if (!fallbackConfig || primaryResponse.status < 500) {
            return { response: primaryResponse, originConfig: primaryConfig };
        }
    } catch {
        if (!fallbackConfig) throw new Error('primary origin unavailable');
    }

    const fallbackResponse = await fetchOrigin(request, env, fetchImpl, fallbackConfig);
    return { response: fallbackResponse, originConfig: fallbackConfig };
};

const withServerSource = (request, response, originConfig) => {
    const source = response.status >= 500 ? 'server-error' : 'server';
    const headers = new Headers(response.headers);
    headers.delete('CDN-Cache-Control');
    headers.delete('Cloudflare-CDN-Cache-Control');
    applySharedHeaders(headers, source);
    headers.set('X-Asset-Origin-Route', originConfig.route);
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
        const { response, originConfig } = await fetchOriginWithFallback(request, env, fetchImpl);
        return withServerSource(request, response, originConfig);
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
