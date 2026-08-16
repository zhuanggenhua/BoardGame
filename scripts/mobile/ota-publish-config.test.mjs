import assert from 'node:assert/strict';
import test from 'node:test';
import {
    ANDROID_OTA_VERSION_FLOOR,
    DEFAULT_FORCE_UPDATE_MESSAGE,
    DEFAULT_FORCE_UPDATE_TITLE,
    resolveAndroidOtaClientBuildEnv,
    resolveAndroidOtaVersionBase,
    resolveOtaForceUpdateOptions,
} from './ota-publish-config.mjs';

test('Android OTA 客户端构建默认指向正式 stable 清单', () => {
    assert.deepEqual(resolveAndroidOtaClientBuildEnv(), {
        VITE_ANDROID_OTA_ENABLED: 'true',
        VITE_ANDROID_OTA_MANIFEST_URL: 'https://assets.easyboardgame.top/official/app-updates/android/stable/latest.json',
        VITE_ANDROID_OTA_MANIFEST_FALLBACK_URLS: 'http://8.148.71.102/official/app-updates/android/stable/latest.json',
        VITE_ANDROID_OTA_CHANNEL: 'stable',
    });
});

test('Android OTA 客户端构建使用命令指定的 channel', () => {
    assert.deepEqual(resolveAndroidOtaClientBuildEnv({
        channel: 'gray',
        assetsBaseUrl: 'https://assets.example.com/root/',
    }), {
        VITE_ANDROID_OTA_ENABLED: 'true',
        VITE_ANDROID_OTA_MANIFEST_URL: 'https://assets.example.com/root/app-updates/android/gray/latest.json',
        VITE_ANDROID_OTA_MANIFEST_FALLBACK_URLS: 'http://8.148.71.102/official/app-updates/android/gray/latest.json',
        VITE_ANDROID_OTA_CHANNEL: 'gray',
    });
});

test('Android OTA 客户端构建支持控制域名和下载 IP 分离', () => {
    assert.deepEqual(resolveAndroidOtaClientBuildEnv({
        channel: 'stable',
        controlAssetsBaseUrl: 'https://assets.example.com/official/',
        downloadAssetsBaseUrl: 'http://192.0.2.10/official/',
    }), {
        VITE_ANDROID_OTA_ENABLED: 'true',
        VITE_ANDROID_OTA_MANIFEST_URL: 'https://assets.example.com/official/app-updates/android/stable/latest.json',
        VITE_ANDROID_OTA_MANIFEST_FALLBACK_URLS: 'http://192.0.2.10/official/app-updates/android/stable/latest.json',
        VITE_ANDROID_OTA_CHANNEL: 'stable',
    });
});

test('Android OTA 默认游标不得低于历史桥接下限', () => {
    assert.equal(resolveAndroidOtaVersionBase({
        packageVersion: '0.6.3',
    }), ANDROID_OTA_VERSION_FLOOR);
});

test('Android OTA 产品版本超过桥接下限后沿用产品版本', () => {
    assert.equal(resolveAndroidOtaVersionBase({
        packageVersion: '6.1.0',
    }), '6.1.0');
});

test('Android OTA 拒绝显式降到历史桥接下限以下', () => {
    assert.throws(
        () => resolveAndroidOtaVersionBase({
            packageVersion: '0.6.3',
            requestedVersionBase: '0.6.4',
        }),
        /不能低于 6\.0\.0/,
    );
});

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
