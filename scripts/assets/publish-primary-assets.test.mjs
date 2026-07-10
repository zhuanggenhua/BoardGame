import assert from 'node:assert/strict';
import { createReadStream, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import test from 'node:test';
import {
    publishPrimaryAssetBatch,
    stagePrimaryAssetUploads,
} from './publish-primary-assets.mjs';

test('服务器发布成功即完成，不等待 R2', async () => {
    let publishedObjects = [];
    const result = await publishPrimaryAssetBatch([
        {
            key: 'official/app-updates/android/stable/latest.json',
            body: '{"version":"test"}\n',
            contentType: 'application/json',
            backupToR2: true,
        },
        {
            key: 'official/app-updates/android/stable/manifests/test.json',
            body: '{"version":"test"}\n',
            contentType: 'application/json',
        },
    ], {
        publishServer: async ({ objects }) => {
            publishedObjects = objects;
        },
    });

    assert.equal(result.serverPublished, true);
    assert.equal(result.queuedR2Backup, true);
    assert.equal(result.objectCount, 2);
    assert.equal(result.r2BackupObjectCount, 1);
    assert.equal(publishedObjects[0].key, 'official/app-updates/android/stable/latest.json');
    assert.equal(publishedObjects[0].backupToR2, true);
    assert.equal(publishedObjects[1].backupToR2, false);
});

test('未显式标记的发布对象不进入 R2 灾备', async () => {
    const result = await publishPrimaryAssetBatch([
        {
            key: 'official/common/rebuildable/file.json',
            body: '{}\n',
        },
    ], {
        publishServer: async () => {},
    });

    assert.equal(result.serverPublished, true);
    assert.equal(result.queuedR2Backup, false);
    assert.equal(result.r2BackupObjectCount, 0);
});

test('服务器发布失败时必须阻止发布完成', async () => {
    await assert.rejects(
        publishPrimaryAssetBatch([
            {
                key: 'official/app-updates/android/stable/latest.json',
                body: '{}\n',
            },
        ], {
            publishServer: async () => {
                throw new Error('server unavailable');
            },
        }),
        /server unavailable/,
    );
});

test('支持以文件流作为发布对象', async () => {
    const sourcePath = path.join(tmpdir(), `boardgame-primary-publish-${process.pid}.txt`);
    writeFileSync(sourcePath, 'stream-body');
    const staged = await stagePrimaryAssetUploads([
        {
            key: 'official/common/test/stream.txt',
            body: () => createReadStream(sourcePath),
            size: 11,
        },
    ]);

    assert.equal(staged.objects[0].size, 11);
    rmSync(staged.stagingRoot, { recursive: true, force: true });
    rmSync(sourcePath, { force: true });
});

test('拒绝越出 official 目录的对象 key', async () => {
    await assert.rejects(
        stagePrimaryAssetUploads([{ key: '../secret', body: 'x' }]),
        /key 非法/,
    );
});
