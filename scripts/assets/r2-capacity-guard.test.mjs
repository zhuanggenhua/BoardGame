import assert from 'node:assert/strict';
import test from 'node:test';
import {
    assertR2CapacityForUploads,
    evaluateR2Capacity,
    listR2ObjectInventory,
} from './r2-capacity-guard.mjs';

test('分页读取 R2 对象并保留大小和 ETag', async () => {
    const calls = [];
    const s3Client = {
        async send(command) {
            calls.push(command.input);
            if (!command.input.ContinuationToken) {
                return {
                    Contents: [{ Key: 'a', Size: 10, ETag: '"aaa"' }],
                    IsTruncated: true,
                    NextContinuationToken: 'next',
                };
            }
            return {
                Contents: [{ Key: 'b', Size: 20, ETag: '"bbb"' }],
                IsTruncated: false,
            };
        },
    };

    const inventory = await listR2ObjectInventory({
        s3Client,
        bucketName: 'bucket',
    });

    assert.equal(calls.length, 2);
    assert.deepEqual(inventory.get('a'), { size: 10, etag: 'aaa' });
    assert.deepEqual(inventory.get('b'), { size: 20, etag: 'bbb' });
});

test('覆盖已有对象时只计算净增量', () => {
    const result = evaluateR2Capacity({
        currentObjects: new Map([
            ['same', { size: 100 }],
            ['keep', { size: 200 }],
        ]),
        uploads: [
            { key: 'same', size: 130 },
            { key: 'new', size: 50 },
        ],
        limitBytes: 400,
    });

    assert.equal(result.currentBytes, 300);
    assert.equal(result.replacedBytes, 100);
    assert.equal(result.uploadBytes, 180);
    assert.equal(result.netIncreaseBytes, 80);
    assert.equal(result.projectedBytes, 380);
    assert.equal(result.allowed, true);
});

test('同一个 key 重复出现在计划中时只采用最终对象大小', () => {
    const result = evaluateR2Capacity({
        currentObjects: new Map(),
        uploads: [
            { key: 'latest.json', size: 10 },
            { key: 'latest.json', size: 12 },
        ],
        limitBytes: 20,
    });

    assert.equal(result.uploadObjectCount, 1);
    assert.equal(result.uploadBytes, 12);
    assert.equal(result.projectedBytes, 12);
});

test('预计超过上限时在上传前抛出明确错误', async () => {
    const logs = [];
    await assert.rejects(
        () => assertR2CapacityForUploads({
            s3Client: null,
            bucketName: 'bucket',
            currentObjects: new Map([['existing', { size: 90 }]]),
            uploads: [{ key: 'new', size: 20 }],
            limitBytes: 100,
            logger: (message) => logs.push(message),
        }),
        (error) => {
            assert.equal(error.code, 'R2_CAPACITY_LIMIT_EXCEEDED');
            assert.equal(error.capacity.projectedBytes, 110);
            assert.match(error.message, /本批未上传任何对象/);
            return true;
        },
    );
    assert.equal(logs.length, 1);
});
