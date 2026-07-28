import assert from 'node:assert/strict';
import test from 'node:test';
import { createAssetRouter } from './index.mjs';

const createEnv = (overrides = {}) => ({
    ORIGIN_BASE_URL: 'https://origin.example.test',
    ORIGIN_TIMEOUT_MS: '1500',
    ORIGIN_TOKEN: 'test-token',
    ...overrides,
});

test('大型发布路径必须请求服务器源', async () => {
    let requestedOriginUrl = '';
    const router = createAssetRouter({
        fetchImpl: async (request) => {
            requestedOriginUrl = request.url;
            return new Response('origin-package', { status: 200 });
        },
    });

    const response = await router(
        new Request('https://assets.example.test/official/app-updates/android/stable/latest.json'),
        createEnv(),
    );

    assert.equal(requestedOriginUrl, 'https://origin.example.test/official/app-updates/android/stable/latest.json');
    assert.equal(response.headers.get('X-Asset-Source'), 'server');
    assert.equal(await response.text(), 'origin-package');
});

test('OPTIONS 预检返回跨域头且不访问源站', async () => {
    let originRequested = false;
    const router = createAssetRouter({
        fetchImpl: async () => {
            originRequested = true;
            return new Response('origin-body', { status: 200 });
        },
    });

    const response = await router(
        new Request('https://assets.example.test/official/app-updates/android/stable/latest.json', {
            method: 'OPTIONS',
            headers: {
                Origin: 'http://localhost',
                'Access-Control-Request-Method': 'GET',
                'Access-Control-Request-Headers': 'cache-control',
            },
        }),
        createEnv(),
    );

    assert.equal(response.status, 204);
    assert.equal(originRequested, false);
    assert.equal(response.headers.get('Access-Control-Allow-Origin'), '*');
    assert.equal(response.headers.get('Access-Control-Allow-Methods'), 'GET, HEAD, OPTIONS');
    assert.equal(response.headers.get('Access-Control-Allow-Headers'), 'cache-control');
    assert.equal(response.headers.get('X-Asset-Source'), 'preflight');
    assert.equal(await response.text(), '');
});

test('源站成功时保留响应并标识 server', async () => {
    const router = createAssetRouter({
        fetchImpl: async () => new Response('origin-body', {
            status: 200,
            headers: {
                'CDN-Cache-Control': 'no-store',
                ETag: '"origin-etag"',
            },
        }),
    });

    const response = await router(
        new Request('https://assets.example.test/official/common/image.webp'),
        createEnv(),
    );

    assert.equal(response.status, 200);
    assert.equal(response.headers.get('X-Asset-Source'), 'server');
    assert.equal(response.headers.get('X-Asset-Origin-Route'), 'tunnel');
    assert.equal(response.headers.get('Access-Control-Allow-Origin'), '*');
    assert.equal(response.headers.has('CDN-Cache-Control'), false);
    assert.equal(await response.text(), 'origin-body');
});

test('配置直连 canary 时请求公网专用回源端口', async () => {
    let requestedOriginUrl = '';
    let fetchOptions;
    const router = createAssetRouter({
        fetchImpl: async (request, options) => {
            requestedOriginUrl = request.url;
            fetchOptions = options;
            return new Response('direct-origin-body', { status: 200 });
        },
    });

    const response = await router(
        new Request('https://assets-canary.example.test/official/common/image.webp'),
        createEnv({
            ORIGIN_DIRECT_BASE_URL: 'http://203.0.113.10:8080',
            ORIGIN_DIRECT_HOSTNAMES: 'assets-canary.example.test',
        }),
    );

    assert.equal(requestedOriginUrl, 'http://203.0.113.10:8080/official/common/image.webp');
    assert.equal(fetchOptions.cf.resolveOverride, undefined);
    assert.equal(response.headers.get('X-Asset-Origin-Route'), 'direct');
    assert.equal(await response.text(), 'direct-origin-body');
});

test('版本化媒体资源请求源站时启用边缘缓存', async () => {
    let fetchOptions;
    const router = createAssetRouter({
        fetchImpl: async (_request, options) => {
            fetchOptions = options;
            return new Response('image-body', { status: 200 });
        },
    });

    const response = await router(
        new Request('https://assets.example.test/official/i18n/en/smashup/cards/compressed/vigilantes_pod.webp?v=c98a24a2'),
        createEnv(),
    );

    assert.equal(response.status, 200);
    assert.equal(response.headers.get('X-Asset-Cache-Policy'), 'edge-media; ttl=31536000');
    assert.equal(fetchOptions.cf.cacheEverything, true);
    assert.equal(fetchOptions.cf.cacheTtlByStatus['200-299'], 31536000);
    assert.equal(fetchOptions.cf.cacheTtlByStatus['500-599'], 0);
});

test('Range 分片请求不启用边缘媒体缓存', async () => {
    let fetchOptions;
    const router = createAssetRouter({
        fetchImpl: async (_request, options) => {
            fetchOptions = options;
            return new Response('partial', {
                status: 206,
                headers: { 'Content-Range': 'bytes 0-0/10' },
            });
        },
    });

    const response = await router(
        new Request('https://assets.example.test/official/i18n/en/smashup/cards/compressed/vigilantes_pod.webp?v=c98a24a2', {
            headers: { Range: 'bytes=0-0' },
        }),
        createEnv(),
    );

    assert.equal(response.status, 206);
    assert.equal(response.headers.has('X-Asset-Cache-Policy'), false);
    assert.equal(fetchOptions.cf, undefined);
});

test('源站 404 不再回退对象存储', async () => {
    const router = createAssetRouter({
        fetchImpl: async () => new Response('missing', { status: 404 }),
    });

    const response = await router(
        new Request('https://assets.example.test/official/common/missing.webp'),
        createEnv(),
    );

    assert.equal(response.status, 404);
    assert.equal(response.headers.get('X-Asset-Source'), 'server');
    assert.equal(await response.text(), 'missing');
});

test('源站 5xx 标识 server-error 且不回退对象存储', async () => {
    const router = createAssetRouter({
        fetchImpl: async () => new Response('bad gateway', { status: 502 }),
    });

    const response = await router(
        new Request('https://assets.example.test/official/common/file.bin'),
        createEnv(),
    );

    assert.equal(response.status, 502);
    assert.equal(response.headers.get('X-Asset-Source'), 'server-error');
    assert.equal(await response.text(), 'bad gateway');
});
test('源站离线返回 server-error，不读取任何对象存储兜底', async () => {
    const router = createAssetRouter({
        fetchImpl: async () => {
            throw new Error('origin offline');
        },
    });

    const response = await router(
        new Request('https://assets.example.test/official/common/file.bin'),
        createEnv(),
    );

    assert.equal(response.status, 502);
    assert.equal(response.headers.get('X-Asset-Source'), 'server-error');
    assert.equal(await response.text(), 'Asset origin unavailable');
});

test('HEAD 请求不返回响应体', async () => {
    const router = createAssetRouter({
        fetchImpl: async () => new Response('origin-body', {
            status: 200,
            headers: {
                'Content-Length': '11',
            },
        }),
    });

    const response = await router(
        new Request('https://assets.example.test/official/common/file.bin', {
            method: 'HEAD',
        }),
        createEnv(),
    );

    assert.equal(response.status, 200);
    assert.equal(response.headers.get('X-Asset-Source'), 'server');
    assert.equal(await response.text(), '');
});
