import assert from 'node:assert/strict';
import test from 'node:test';
import {
    createAssetRouter,
    isDirectR2Path,
    shouldFallbackToR2,
} from './index.mjs';

const createR2Object = ({
    body = 'r2-body',
    etag = '"r2-etag"',
    range,
    size = Buffer.byteLength(body),
} = {}) => ({
    body,
    httpEtag: etag,
    range,
    size,
    writeHttpMetadata(headers) {
        headers.set('Content-Type', 'application/octet-stream');
    },
});

const createR2Metadata = (options) => {
    const object = createR2Object(options);
    delete object.body;
    return object;
};

test('大型发布路径必须直接走 R2', () => {
    assert.equal(isDirectR2Path('/official/app-updates/android/stable/latest.json'), true);
    assert.equal(isDirectR2Path('/official/mobile-packages/android/stable/game.json'), true);
    assert.equal(isDirectR2Path('/official/native-app-updates/android/stable/app.apk'), true);
    assert.equal(isDirectR2Path('/official/common/images/noise.svg'), false);
});

test('R2 直出完整 GET 即使返回全范围信息也必须保持 200', async () => {
    const router = createAssetRouter({
        fetchImpl: async () => {
            throw new Error('直出路径不应请求源站');
        },
    });
    const env = {
        ASSETS_BUCKET: {
            get: async () => createR2Object({
                body: 'data',
                range: { offset: 0, length: 4 },
                size: 4,
            }),
        },
        ORIGIN_BASE_URL: 'https://origin.example.test',
        ORIGIN_TIMEOUT_MS: '1500',
        ORIGIN_TOKEN: 'test-token',
    };

    const response = await router(
        new Request('https://assets.example.test/official/app-updates/file.bin'),
        env,
    );

    assert.equal(response.status, 200);
    assert.equal(response.headers.get('Content-Range'), null);
    assert.equal(response.headers.get('Content-Length'), '4');
    assert.equal(response.headers.get('X-Asset-Source'), 'r2-direct');
    assert.equal(await response.text(), 'data');
});

test('R2 直出完整 HEAD 即使返回全范围信息也必须保持 200', async () => {
    const router = createAssetRouter({
        fetchImpl: async () => {
            throw new Error('直出路径不应请求源站');
        },
    });
    const env = {
        ASSETS_BUCKET: {
            get: async () => createR2Object({
                body: 'data',
                range: { offset: 0, length: 4 },
                size: 4,
            }),
        },
        ORIGIN_BASE_URL: 'https://origin.example.test',
        ORIGIN_TIMEOUT_MS: '1500',
        ORIGIN_TOKEN: 'test-token',
    };

    const response = await router(
        new Request('https://assets.example.test/official/app-updates/file.bin', {
            method: 'HEAD',
        }),
        env,
    );

    assert.equal(response.status, 200);
    assert.equal(response.headers.get('Content-Range'), null);
    assert.equal(response.headers.get('Content-Length'), '4');
    assert.equal(response.headers.get('X-Asset-Source'), 'r2-direct');
    assert.equal(await response.text(), '');
});

test('源站缺失、限流和服务错误必须触发回退', () => {
    assert.equal(shouldFallbackToR2(404), true);
    assert.equal(shouldFallbackToR2(429), true);
    assert.equal(shouldFallbackToR2(503), true);
    assert.equal(shouldFallbackToR2(206), false);
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
    const env = {
        ASSETS_BUCKET: { get: async () => null },
        ORIGIN_BASE_URL: 'https://origin.example.test',
        ORIGIN_TIMEOUT_MS: '1500',
        ORIGIN_TOKEN: 'test-token',
    };

    const response = await router(
        new Request('https://assets.example.test/official/common/image.webp'),
        env,
    );

    assert.equal(response.status, 200);
    assert.equal(response.headers.get('X-Asset-Source'), 'server');
    assert.equal(response.headers.get('Access-Control-Allow-Origin'), '*');
    assert.equal(response.headers.has('CDN-Cache-Control'), false);
    assert.equal(await response.text(), 'origin-body');
});

test('源站 503 时从 R2 返回 Range 响应', async () => {
    let requestedKey = '';
    const router = createAssetRouter({
        fetchImpl: async () => new Response('unavailable', { status: 503 }),
    });
    const env = {
        ASSETS_BUCKET: {
            async get(key) {
                requestedKey = key;
                return createR2Object({
                    body: 'bc',
                    range: { offset: 1, length: 2 },
                    size: 4,
                });
            },
        },
        ORIGIN_BASE_URL: 'https://origin.example.test',
        ORIGIN_TIMEOUT_MS: '1500',
        ORIGIN_TOKEN: 'test-token',
    };

    const response = await router(
        new Request('https://assets.example.test/official/common/file.bin', {
            headers: { Range: 'bytes=1-2' },
        }),
        env,
    );

    assert.equal(requestedKey, 'official/common/file.bin');
    assert.equal(response.status, 206);
    assert.equal(response.headers.get('Content-Range'), 'bytes 1-2/4');
    assert.equal(response.headers.get('X-Asset-Source'), 'r2-fallback');
    assert.equal(await response.text(), 'bc');
});

test('HEAD 回退不返回响应体', async () => {
    const router = createAssetRouter({
        fetchImpl: async () => {
            throw new Error('origin offline');
        },
    });
    const env = {
        ASSETS_BUCKET: {
            get: async () => createR2Object({ body: 'data', size: 4 }),
        },
        ORIGIN_BASE_URL: 'https://origin.example.test',
        ORIGIN_TIMEOUT_MS: '10',
        ORIGIN_TOKEN: 'test-token',
    };

    const response = await router(
        new Request('https://assets.example.test/official/common/file.bin', {
            method: 'HEAD',
        }),
        env,
    );

    assert.equal(response.status, 200);
    assert.equal(response.headers.get('Content-Length'), '4');
    assert.equal(response.headers.get('X-Asset-Source'), 'r2-fallback');
    assert.equal(await response.text(), '');
});

test('R2 条件请求未修改时返回 304 且不返回响应体', async () => {
    const router = createAssetRouter({
        fetchImpl: async () => new Response('unavailable', { status: 503 }),
    });
    const env = {
        ASSETS_BUCKET: {
            get: async () => createR2Metadata({ size: 4 }),
        },
        ORIGIN_BASE_URL: 'https://origin.example.test',
        ORIGIN_TIMEOUT_MS: '1500',
        ORIGIN_TOKEN: 'test-token',
    };

    const response = await router(
        new Request('https://assets.example.test/official/common/file.bin', {
            headers: { 'If-None-Match': '"r2-etag"' },
        }),
        env,
    );

    assert.equal(response.status, 304);
    assert.equal(response.headers.get('ETag'), '"r2-etag"');
    assert.equal(response.headers.get('X-Asset-Source'), 'r2-fallback');
    assert.equal(await response.text(), '');
});

test('R2 条件请求前置条件失败时返回 412 且不返回响应体', async () => {
    const router = createAssetRouter({
        fetchImpl: async () => new Response('unavailable', { status: 503 }),
    });
    const env = {
        ASSETS_BUCKET: {
            get: async () => createR2Metadata({ size: 4 }),
        },
        ORIGIN_BASE_URL: 'https://origin.example.test',
        ORIGIN_TIMEOUT_MS: '1500',
        ORIGIN_TOKEN: 'test-token',
    };

    const response = await router(
        new Request('https://assets.example.test/official/common/file.bin', {
            headers: { 'If-Match': '"different-etag"' },
        }),
        env,
    );

    assert.equal(response.status, 412);
    assert.equal(response.headers.get('ETag'), '"r2-etag"');
    assert.equal(response.headers.get('X-Asset-Source'), 'r2-fallback');
    assert.equal(await response.text(), '');
});

test('R2 读取异常不得伪装成范围请求错误', async () => {
    const router = createAssetRouter({
        fetchImpl: async () => new Response('unavailable', { status: 503 }),
    });
    const storageError = new Error('R2 service unavailable');
    const env = {
        ASSETS_BUCKET: {
            get: async () => {
                throw storageError;
            },
        },
        ORIGIN_BASE_URL: 'https://origin.example.test',
        ORIGIN_TIMEOUT_MS: '1500',
        ORIGIN_TOKEN: 'test-token',
    };

    await assert.rejects(
        router(new Request('https://assets.example.test/official/common/file.bin'), env),
        storageError,
    );
});
