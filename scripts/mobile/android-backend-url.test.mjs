import assert from 'node:assert/strict';
import test from 'node:test';
import {
    DEFAULT_ANDROID_BACKEND_URL,
    resolveAndroidBackendUrl,
} from './android-backend-url.mjs';

test('Android 后端默认使用公网 IP，不依赖通用网页域名变量', () => {
    assert.equal(resolveAndroidBackendUrl({}), DEFAULT_ANDROID_BACKEND_URL);
    assert.equal(resolveAndroidBackendUrl({
        VITE_BACKEND_URL: 'https://api.easyboardgame.top',
    }), DEFAULT_ANDROID_BACKEND_URL);
});

test('Android 专用后端地址优先级高于通用网页后端地址', () => {
    assert.equal(resolveAndroidBackendUrl({
        VITE_ANDROID_BACKEND_URL: 'http://192.0.2.10/',
        VITE_BACKEND_URL: 'https://api.easyboardgame.top',
    }), 'http://192.0.2.10');
});

test('兼容旧 Android 后端变量名', () => {
    assert.equal(resolveAndroidBackendUrl({
        ANDROID_VITE_BACKEND_URL: 'http://198.51.100.10',
        VITE_BACKEND_URL: 'https://api.easyboardgame.top',
    }), 'http://198.51.100.10');
});

test('通用后端变量只有在已经是直连地址时才兼容沿用', () => {
    assert.equal(resolveAndroidBackendUrl({
        VITE_BACKEND_URL: 'http://203.0.113.10/',
    }), 'http://203.0.113.10');
});

test('Android 专用后端地址必须是 HTTP 或 HTTPS 绝对地址', () => {
    assert.throws(
        () => resolveAndroidBackendUrl({
            VITE_ANDROID_BACKEND_URL: '8.148.71.102',
        }),
        /绝对 HTTP\/HTTPS URL/,
    );
});
