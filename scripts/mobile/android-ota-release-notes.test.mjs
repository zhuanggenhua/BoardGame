import assert from 'node:assert/strict';
import test from 'node:test';
import {
    formatAndroidOtaReleaseNotes,
    resolvePreviousAndroidOtaSourceRef,
} from './android-ota-release-notes.mjs';

test('OTA 清单优先读取 sourceRef，并兼容旧 notes 中的完整 SHA', () => {
    const sourceRef = 'abcdef0123456789abcdef0123456789abcdef01';
    assert.equal(resolvePreviousAndroidOtaSourceRef({ sourceRef }), sourceRef);
    assert.equal(resolvePreviousAndroidOtaSourceRef({
        notes: `GitHub Actions manual OTA publish ${sourceRef}@abcdef0`,
    }), sourceRef);
    assert.equal(resolvePreviousAndroidOtaSourceRef({ notes: '旧版说明不含提交 SHA' }), undefined);
});

test('OTA 更新说明列出上次发布之后的提交标题并限制条数', () => {
    const notes = formatAndroidOtaReleaseNotes({
        previousRef: 'a'.repeat(40),
        currentRef: 'b'.repeat(40),
        subjects: ['首条更新', '第二条更新', '第三条更新'],
        maxEntries: 2,
    });

    assert.equal(notes, '- 首条更新\n- 第二条更新\n- 另有 1 项提交。');
});

test('同一源码重复发布时明确说明内容没有变化', () => {
    const sourceRef = 'c'.repeat(40);
    assert.equal(formatAndroidOtaReleaseNotes({
        previousRef: sourceRef,
        currentRef: sourceRef,
        subjects: [],
    }), '本次为同一代码版本的 OTA 重新发布，源码没有变化。');
});
