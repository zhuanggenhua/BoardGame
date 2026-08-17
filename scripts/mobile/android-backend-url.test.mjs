import assert from 'node:assert/strict';
import test from 'node:test';
import {
    DEFAULT_ANDROID_BACKEND_URL,
    resolveAndroidBackendUrl,
} from './android-backend-url.mjs';

test('未配置公开入口时默认使用当前公网 IP', () => {
    assert.equal(resolveAndroidBackendUrl({}), DEFAULT_ANDROID_BACKEND_URL);
});

test('Android 构建继承 Web 使用的公开后端入口', () => {
    assert.equal(resolveAndroidBackendUrl({
        VITE_BACKEND_URL: 'https://api.easyboardgame.top/',
    }), 'https://api.easyboardgame.top');

    assert.equal(resolveAndroidBackendUrl({
        VITE_BACKEND_URL: 'http://203.0.113.10/',
    }), 'http://203.0.113.10');
});

test('没有公开入口时兼容旧 Android 后端变量名', () => {
    assert.equal(resolveAndroidBackendUrl({
        VITE_ANDROID_BACKEND_URL: 'http://192.0.2.10/',
    }), 'http://192.0.2.10');

    assert.equal(resolveAndroidBackendUrl({
        ANDROID_VITE_BACKEND_URL: 'http://198.51.100.10',
    }), 'http://198.51.100.10');
});

test('公开入口和 Android 旧变量同时存在时必须一致', () => {
    assert.equal(resolveAndroidBackendUrl({
        VITE_BACKEND_URL: 'http://8.148.71.102/',
        VITE_ANDROID_BACKEND_URL: 'http://8.148.71.102',
    }), 'http://8.148.71.102');

    assert.throws(
        () => resolveAndroidBackendUrl({
            VITE_BACKEND_URL: 'http://8.148.71.102',
            VITE_ANDROID_BACKEND_URL: 'https://api.easyboardgame.top',
        }),
        /Web\/App 后端入口不一致/,
    );
});

test('同一类来源内部冲突会阻止构建', () => {
    assert.throws(
        () => resolveAndroidBackendUrl({
            BG_VITE_BACKEND_URL_VAR: 'http://8.148.71.102',
            BG_VITE_BACKEND_URL_SECRET: 'https://api.easyboardgame.top',
        }),
        /公开后端入口配置冲突/,
    );
});

test('后端地址必须是 HTTP 或 HTTPS 绝对地址', () => {
    assert.throws(
        () => resolveAndroidBackendUrl({
            VITE_BACKEND_URL: '8.148.71.102',
        }),
        /绝对 HTTP\/HTTPS URL/,
    );
});
