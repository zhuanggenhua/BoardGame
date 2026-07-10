import assert from 'node:assert/strict';
import test from 'node:test';
import {
    DEFAULT_SERVER_PROPAGATION_TIMEOUT_MS,
    waitForServerAssets,
} from './wait-for-server-assets.mjs';

test('服务器主源默认传播等待上限为 3 小时', () => {
    assert.equal(DEFAULT_SERVER_PROPAGATION_TIMEOUT_MS, 3 * 60 * 60 * 1000);
});

test('服务器已经返回目标对象时立即完成', async () => {
    let requestCount = 0;

    await waitForServerAssets(
        ['https://assets.easyboardgame.top/official/example.zip'],
        {
            fetchImpl: async () => {
                requestCount += 1;
                return new Response(null, {
                    status: 200,
                    headers: { 'X-Asset-Source': 'server' },
                });
            },
        },
    );

    assert.equal(requestCount, 1);
});
