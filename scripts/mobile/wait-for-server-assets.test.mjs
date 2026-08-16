import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import test from 'node:test';
import {
    DEFAULT_SERVER_PROPAGATION_TIMEOUT_MS,
    waitForServerAssets,
} from './wait-for-server-assets.mjs';

test('服务器主源默认传播等待上限为 30 分钟', () => {
    assert.equal(DEFAULT_SERVER_PROPAGATION_TIMEOUT_MS, 30 * 60 * 1000);
});

test('非法 URL 和目标类型首轮立即失败', async () => {
    await assert.rejects(
        waitForServerAssets([{ url: '[object Object]' }]),
        /URL 无效/,
    );
    await assert.rejects(
        waitForServerAssets([42]),
        /校验目标无效/,
    );
});

test('非法大小或摘要不会静默降级为弱校验', async () => {
    await assert.rejects(
        waitForServerAssets([{
            url: 'https://assets.easyboardgame.top/official/example.zip',
            expectedSize: -1,
        }]),
        /预期大小无效/,
    );
    await assert.rejects(
        waitForServerAssets([{
            url: 'https://assets.easyboardgame.top/official/latest.json',
            expectedSha256: 'invalid',
        }]),
        /预期 SHA-256 无效/,
    );
});

test('服务器已经返回目标对象时立即完成', async () => {
    let requestCount = 0;
    let requestMethod = '';

    await waitForServerAssets(
        ['https://assets.easyboardgame.top/official/example.zip'],
        {
            fetchImpl: async (_url, init) => {
                requestCount += 1;
                requestMethod = init.method;
                return new Response(null, {
                    status: 200,
                    headers: { 'X-Asset-Source': 'server' },
                });
            },
        },
    );

    assert.equal(requestCount, 1);
    assert.equal(requestMethod, 'HEAD');
});

test('要求 CORS 预检时会先验证 cache-control 请求头可通过', async () => {
    const requestMethods = [];

    await waitForServerAssets(
        ['https://assets.easyboardgame.top/official/app-updates/android/stable/latest.json'],
        {
            requireCorsPreflight: true,
            fetchImpl: async (_url, init) => {
                requestMethods.push(init.method);
                if (init.method === 'OPTIONS') {
                    return new Response(null, {
                        status: 204,
                        headers: {
                            'Access-Control-Allow-Origin': '*',
                            'Access-Control-Allow-Methods': 'GET, HEAD, OPTIONS',
                            'Access-Control-Allow-Headers': 'cache-control',
                        },
                    });
                }
                return new Response(null, {
                    status: 200,
                    headers: { 'X-Asset-Source': 'server' },
                });
            },
        },
    );

    assert.deepEqual(requestMethods, ['OPTIONS', 'HEAD']);
});

test('要求 CORS 预检但线上不支持 OPTIONS 时继续等待并最终失败', async () => {
    await assert.rejects(
        waitForServerAssets(
            ['https://assets.easyboardgame.top/official/app-updates/android/stable/latest.json'],
            {
                requireCorsPreflight: true,
                intervalMs: 0,
                timeoutMs: 1,
                fetchImpl: async () => new Response('Method Not Allowed', { status: 405 }),
            },
        ),
        /corsPreflightStatus=405/,
    );
});

test('禁止重定向的目标会使用 manual redirect 并拒绝 30x', async () => {
    const redirects = [];

    await assert.rejects(
        waitForServerAssets(
            [{
                url: 'https://assets.easyboardgame.top/official/app-updates/android/stable/latest.json',
                forbidRedirect: true,
            }],
            {
                intervalMs: 0,
                timeoutMs: 1,
                fetchImpl: async (_url, init) => {
                    redirects.push(init.redirect);
                    return new Response(null, {
                        status: 302,
                        headers: {
                            Location: 'http://8.148.71.102/official/app-updates/android/stable/latest.json',
                        },
                    });
                },
            },
        ),
        /redirectStatus=302/,
    );

    assert.deepEqual(redirects, ['manual']);
});

test('禁止重定向的 CORS 预检同样不跟随 30x', async () => {
    const requests = [];

    await assert.rejects(
        waitForServerAssets(
            [{
                url: 'https://assets.easyboardgame.top/official/app-updates/android/stable/latest.json',
                forbidRedirect: true,
            }],
            {
                requireCorsPreflight: true,
                intervalMs: 0,
                timeoutMs: 1,
                fetchImpl: async (_url, init) => {
                    requests.push({ method: init.method, redirect: init.redirect });
                    return new Response(null, {
                        status: 307,
                        headers: {
                            Location: 'http://8.148.71.102/official/app-updates/android/stable/latest.json',
                        },
                    });
                },
            },
        ),
        /corsPreflightRedirect=307/,
    );

    assert.deepEqual(requests, [{ method: 'OPTIONS', redirect: 'manual' }]);
});

test('大型发布对象通过 HEAD 校验服务器来源和内容大小', async () => {
    let requestMethod = '';

    await waitForServerAssets(
        [{
            url: 'https://assets.easyboardgame.top/official/example.zip',
            expectedSize: 1024,
        }],
        {
            fetchImpl: async (_url, init) => {
                requestMethod = init.method;
                return new Response(null, {
                    status: 200,
                    headers: {
                        'Content-Length': '1024',
                        'X-Asset-Source': 'server',
                    },
                });
            },
        },
    );

    assert.equal(requestMethod, 'HEAD');
});

test('大型发布对象大小仍是旧值时继续等待', async () => {
    let requestCount = 0;

    await waitForServerAssets(
        [{
            url: 'https://assets.easyboardgame.top/official/example.zip',
            expectedSize: 1024,
        }],
        {
            intervalMs: 0,
            timeoutMs: 1_000,
            fetchImpl: async () => {
                requestCount += 1;
                return new Response(null, {
                    status: 200,
                    headers: {
                        'Content-Length': requestCount === 1 ? '512' : '1024',
                        'X-Asset-Source': 'server',
                    },
                });
            },
        },
    );

    assert.equal(requestCount, 2);
});

test('小型 JSON 发布对象通过 GET 校验正文摘要', async () => {
    const body = '{"version":"v2"}\n';
    const expectedSha256 = createHash('sha256').update(body).digest('hex');
    let requestMethod = '';

    await waitForServerAssets(
        [{
            url: 'https://assets.easyboardgame.top/official/latest.json',
            expectedSize: Buffer.byteLength(body),
            expectedSha256,
        }],
        {
            fetchImpl: async (_url, init) => {
                requestMethod = init.method;
                return new Response(body, {
                    status: 200,
                    headers: {
                        'Content-Length': String(Buffer.byteLength(body)),
                        'Content-Type': 'application/json',
                        'X-Asset-Source': 'server',
                    },
                });
            },
        },
    );

    assert.equal(requestMethod, 'GET');
});

test('小型 JSON 正文仍是旧版本时继续等待', async () => {
    const expectedBody = '{"version":"v2"}\n';
    const expectedSha256 = createHash('sha256').update(expectedBody).digest('hex');
    let requestCount = 0;

    await waitForServerAssets(
        [{
            url: 'https://assets.easyboardgame.top/official/latest.json',
            expectedSize: Buffer.byteLength(expectedBody),
            expectedSha256,
        }],
        {
            intervalMs: 0,
            timeoutMs: 1_000,
            fetchImpl: async () => {
                requestCount += 1;
                const body = requestCount === 1 ? '{"version":"v1"}\n' : expectedBody;
                return new Response(body, {
                    status: 200,
                    headers: {
                        'Content-Length': String(Buffer.byteLength(body)),
                        'Content-Type': 'application/json',
                        'X-Asset-Source': 'server',
                    },
                });
            },
        },
    );

    assert.equal(requestCount, 2);
});
