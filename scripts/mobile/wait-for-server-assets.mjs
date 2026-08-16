import { createHash } from 'node:crypto';

const sleep = (durationMs) => new Promise((resolve) => {
    setTimeout(resolve, durationMs);
});

const readPositiveInteger = (value, fallback) => {
    const parsed = Number.parseInt(value || '', 10);
    return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
};

export const DEFAULT_SERVER_PROPAGATION_TIMEOUT_MS = 30 * 60 * 1000;

const normalizeUrl = (value) => {
    if (typeof value !== 'string' || !value.trim()) {
        throw new Error(`服务器对象 URL 无效: ${String(value)}`);
    }
    const url = value.trim();
    let parsedUrl;
    try {
        parsedUrl = new URL(url);
    } catch {
        throw new Error(`服务器对象 URL 无效: ${url}`);
    }
    if (parsedUrl.protocol !== 'http:' && parsedUrl.protocol !== 'https:') {
        throw new Error(`服务器对象 URL 协议无效: ${url}`);
    }
    return url;
};

const normalizeTarget = (value) => {
    if (value === null || value === undefined || value === '') {
        return null;
    }
    if (typeof value === 'string') {
        return { url: normalizeUrl(value) };
    }
    if (typeof value !== 'object') {
        throw new Error(`服务器对象校验目标无效: ${String(value)}`);
    }
    const url = normalizeUrl(value.url);
    if (Object.hasOwn(value, 'expectedSize')
        && (!Number.isFinite(value.expectedSize) || value.expectedSize < 0)) {
        throw new Error(`服务器对象预期大小无效: ${url}`);
    }
    if (Object.hasOwn(value, 'expectedSha256')
        && (typeof value.expectedSha256 !== 'string' || !/^[a-f0-9]{64}$/i.test(value.expectedSha256))) {
        throw new Error(`服务器对象预期 SHA-256 无效: ${url}`);
    }
    const expectedSize = Number.isFinite(value.expectedSize) && value.expectedSize >= 0
        ? Number(value.expectedSize)
        : undefined;
    const expectedSha256 = typeof value.expectedSha256 === 'string' && /^[a-f0-9]{64}$/i.test(value.expectedSha256)
        ? value.expectedSha256.toLowerCase()
        : undefined;
    const forbidRedirect = value.forbidRedirect === true;
    return {
        url,
        expectedSize,
        expectedSha256,
        forbidRedirect,
    };
};

const normalizeTargets = (values) => {
    const targets = new Map();
    for (const value of values) {
        const target = normalizeTarget(value);
        if (!target) continue;
        const previous = targets.get(target.url);
        targets.set(target.url, {
            url: target.url,
            expectedSize: target.expectedSize ?? previous?.expectedSize,
            expectedSha256: target.expectedSha256 ?? previous?.expectedSha256,
            forbidRedirect: target.forbidRedirect || previous?.forbidRedirect === true,
        });
    }
    return [...targets.values()];
};

const validateResponse = async ({ response, target }) => {
    if (target.forbidRedirect && response.redirected) {
        return 'redirected=true';
    }
    if (target.forbidRedirect && response.status >= 300 && response.status < 400) {
        return `redirectStatus=${response.status} location=${response.headers.get('Location') || '(missing)'}`;
    }
    const source = response.headers.get('X-Asset-Source') || '(missing)';
    if (!response.ok || source !== 'server') {
        return `status=${response.status} source=${source}`;
    }

    if (target.expectedSha256) {
        const body = Buffer.from(await response.arrayBuffer());
        if (target.expectedSize !== undefined && body.length !== target.expectedSize) {
            return `size=${body.length} expectedSize=${target.expectedSize}`;
        }
        const actualSha256 = createHash('sha256').update(body).digest('hex');
        if (actualSha256 !== target.expectedSha256) {
            return `sha256=${actualSha256} expectedSha256=${target.expectedSha256}`;
        }
        return '';
    }

    if (target.expectedSize !== undefined) {
        const contentLength = Number.parseInt(response.headers.get('Content-Length') || '', 10);
        if (!Number.isFinite(contentLength) || contentLength !== target.expectedSize) {
            return `contentLength=${response.headers.get('Content-Length') || '(missing)'} expectedSize=${target.expectedSize}`;
        }
    }
    return '';
};

const validateCorsPreflight = async ({ fetchImpl, target }) => {
    const response = await fetchImpl(target.url, {
        method: 'OPTIONS',
        headers: {
            Origin: 'http://localhost',
            'Access-Control-Request-Method': 'GET',
            'Access-Control-Request-Headers': 'cache-control',
        },
        redirect: target.forbidRedirect ? 'manual' : 'follow',
        signal: AbortSignal.timeout(30_000),
    });
    if (target.forbidRedirect && (response.redirected || (response.status >= 300 && response.status < 400))) {
        return `corsPreflightRedirect=${response.status} location=${response.headers.get('Location') || '(missing)'}`;
    }
    const allowOrigin = response.headers.get('Access-Control-Allow-Origin') || '';
    const allowMethods = response.headers.get('Access-Control-Allow-Methods') || '';
    const allowHeaders = response.headers.get('Access-Control-Allow-Headers') || '';
    const normalizedHeaders = allowHeaders.toLowerCase();

    if (!response.ok) {
        return `corsPreflightStatus=${response.status}`;
    }
    if (allowOrigin !== '*' && allowOrigin !== 'http://localhost') {
        return `corsAllowOrigin=${allowOrigin || '(missing)'}`;
    }
    if (!allowMethods.toUpperCase().split(/\s*,\s*/).includes('GET')) {
        return `corsAllowMethods=${allowMethods || '(missing)'}`;
    }
    if (normalizedHeaders !== '*' && !normalizedHeaders.split(/\s*,\s*/).includes('cache-control')) {
        return `corsAllowHeaders=${allowHeaders || '(missing)'}`;
    }
    return '';
};

export const waitForServerAssets = async (values, options = {}) => {
    const pendingTargets = normalizeTargets(values);
    if (pendingTargets.length === 0) return;

    const timeoutMs = options.timeoutMs ?? readPositiveInteger(
        process.env.BG_ASSET_SERVER_PROPAGATION_TIMEOUT_MS,
        DEFAULT_SERVER_PROPAGATION_TIMEOUT_MS,
    );
    const intervalMs = options.intervalMs ?? readPositiveInteger(
        process.env.BG_ASSET_SERVER_PROPAGATION_INTERVAL_MS,
        10 * 1000,
    );
    const fetchImpl = options.fetchImpl ?? fetch;
    const requireCorsPreflight = options.requireCorsPreflight === true;
    const deadline = Date.now() + timeoutMs;
    let lastFailure = '';

    while (Date.now() < deadline) {
        const failures = [];
        for (const target of pendingTargets) {
            try {
                if (requireCorsPreflight) {
                    const preflightFailure = await validateCorsPreflight({ fetchImpl, target });
                    if (preflightFailure) {
                        failures.push(`${target.url} ${preflightFailure}`);
                        continue;
                    }
                }
                const checkUrl = new URL(target.url);
                checkUrl.searchParams.set('server-primary-check', String(Date.now()));
                const response = await fetchImpl(checkUrl, {
                    method: target.expectedSha256 ? 'GET' : 'HEAD',
                    cache: 'no-store',
                    redirect: target.forbidRedirect ? 'manual' : 'follow',
                    signal: AbortSignal.timeout(30_000),
                });
                const validationFailure = await validateResponse({ response, target });
                if (validationFailure) {
                    failures.push(`${target.url} ${validationFailure}`);
                }
            } catch (error) {
                failures.push(`${target.url} ${error instanceof Error ? error.message : String(error)}`);
            }
        }

        if (failures.length === 0) {
            console.log(`serverPrimaryAssetsReady=${pendingTargets.length}`);
            return;
        }

        lastFailure = failures.join('; ');
        console.log(`[server-primary] 等待服务器活动版本同步：${lastFailure}`);
        await sleep(intervalMs);
    }

    throw new Error(`服务器主源在 ${timeoutMs}ms 内未完成同步：${lastFailure}`);
};
