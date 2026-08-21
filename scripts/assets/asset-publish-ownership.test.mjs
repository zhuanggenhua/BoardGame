import assert from 'node:assert/strict';
import test from 'node:test';
import {
    formatNumericOwner,
    normalizePathOwnership,
    shouldNormalizeAssetOwnership,
} from './asset-publish-ownership.mjs';

test('只在 Linux root 写入非 root 素材根时归一权限', () => {
    assert.equal(shouldNormalizeAssetOwnership({
        platform: 'linux',
        effectiveUid: 0,
        targetUid: 1000,
        targetGid: 1000,
    }), true);
    assert.equal(shouldNormalizeAssetOwnership({
        platform: 'linux',
        effectiveUid: 1000,
        targetUid: 1000,
        targetGid: 1000,
    }), false);
    assert.equal(shouldNormalizeAssetOwnership({
        platform: 'win32',
        effectiveUid: 0,
        targetUid: 1000,
        targetGid: 1000,
    }), false);
    assert.equal(shouldNormalizeAssetOwnership({
        platform: 'linux',
        effectiveUid: 0,
        targetUid: 0,
        targetGid: 0,
    }), false);
});

test('权限归一使用素材根目录的数字 UID/GID，避免写死 admin 名称', () => {
    const calls = [];
    const result = normalizePathOwnership({
        assetsRoot: '/srv/assets',
        targetPath: '/srv/assets/releases/20260821000000000',
        platform: 'linux',
        effectiveUid: 0,
        stat: () => ({ uid: 1001, gid: 1002 }),
        spawn: (command, args) => {
            calls.push([command, args]);
            return { status: 0, stdout: '', stderr: '' };
        },
    });

    assert.deepEqual(result, {
        normalized: true,
        owner: '1001:1002',
        reason: 'root-publish-normalized',
    });
    assert.deepEqual(calls, [[
        'chown',
        ['-R', '1001:1002', '/srv/assets/releases/20260821000000000'],
    ]]);
});

test('非 root 写入时不执行 chown', () => {
    const result = normalizePathOwnership({
        assetsRoot: '/srv/assets',
        targetPath: '/srv/assets/releases/20260821000000000',
        platform: 'linux',
        effectiveUid: 1001,
        stat: () => ({ uid: 1001, gid: 1002 }),
        spawn: () => {
            throw new Error('should not spawn');
        },
    });

    assert.deepEqual(result, {
        normalized: false,
        owner: '1001:1002',
        reason: 'not-required',
    });
});

test('chown 失败时明确暴露路径和目标 owner', () => {
    assert.throws(
        () => normalizePathOwnership({
            assetsRoot: '/srv/assets',
            targetPath: '/srv/assets/releases/20260821000000000',
            platform: 'linux',
            effectiveUid: 0,
            stat: () => ({ uid: 1001, gid: 1002 }),
            spawn: () => ({ status: 1, stdout: '', stderr: 'permission denied' }),
        }),
        /owner=1001:1002 path=\/srv\/assets\/releases\/20260821000000000/,
    );
});

test('数字 owner 格式稳定', () => {
    assert.equal(formatNumericOwner({ uid: 12, gid: 34 }), '12:34');
});
