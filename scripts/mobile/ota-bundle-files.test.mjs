import assert from 'node:assert/strict';
import test from 'node:test';
import { classifyOtaBundleFile } from './ota-bundle-files.mjs';

test('OTA 保留 H5 代码、样式、字体和中文语言包', () => {
    for (const relativePath of [
        'index.html',
        'assets/index-B0ae9Gwa.js',
        'assets/index-BCQru3Ul.css',
        'assets/region-mask-95tz5QvV.png',
        'fonts/inter-400-latin.woff2',
        'locales/zh-CN/lobby.json',
        'game-data/summonerwars.layout.json',
    ]) {
        assert.equal(classifyOtaBundleFile(relativePath), 'include', relativePath);
    }
});

test('OTA 仅保留资源清单，不携带嵌套游戏资源', () => {
    for (const relativePath of [
        'assets/common/assets-manifest.json',
        'assets/i18n/assets-manifest.json',
        'assets/i18n/zh-CN/dicethrone/assets-manifest.json',
        'assets/atlas-configs/assets-manifest.json',
    ]) {
        assert.equal(classifyOtaBundleFile(relativePath), 'include', relativePath);
    }

    for (const relativePath of [
        'assets/atlas-configs/smashup/2833984701.json',
        'assets/common/images/home-v2/book-catalog-wide/1.png',
        'assets/i18n/zh-CN/dicethrone/thumbnails/compressed/fengm.webp',
        'assets/i18n/zh-CN/dicethrone/images/monk/status-icons-atlas.json',
        'assets/common/audio/bgm/compressed/theme.ogg',
        'logos/weixin.jpg',
        'logos/zhifubao.jpg',
        'logos/logo_1_grid.png',
        'locales/en/lobby.json',
        'audio_assets.md',
    ]) {
        assert.equal(classifyOtaBundleFile(relativePath), 'remote-skip', relativePath);
    }
});
