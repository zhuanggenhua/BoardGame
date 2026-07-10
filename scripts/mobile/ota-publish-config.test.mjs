import assert from 'node:assert/strict';
import test from 'node:test';
import {
    DEFAULT_FORCE_UPDATE_MESSAGE,
    DEFAULT_FORCE_UPDATE_TITLE,
    resolveOtaForceUpdateOptions,
} from './ota-publish-config.mjs';

test('所有 OTA 默认强制更新', () => {
    assert.deepEqual(resolveOtaForceUpdateOptions(), {
        forceUpdate: true,
        forceUpdateTitle: DEFAULT_FORCE_UPDATE_TITLE,
        forceUpdateMessage: DEFAULT_FORCE_UPDATE_MESSAGE,
    });
});

test('OTA 允许自定义强制更新文案', () => {
    assert.deepEqual(resolveOtaForceUpdateOptions({
        forceUpdateTitle: '自定义标题',
        forceUpdateMessage: '自定义正文',
    }), {
        forceUpdate: true,
        forceUpdateTitle: '自定义标题',
        forceUpdateMessage: '自定义正文',
    });
});

test('禁止关闭 OTA 强制更新', () => {
    assert.throws(
        () => resolveOtaForceUpdateOptions({ noForceUpdateFlag: true }),
        /禁止使用 --no-force-update/,
    );
});
