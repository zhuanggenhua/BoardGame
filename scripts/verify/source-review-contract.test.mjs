import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { test } from 'node:test';
import { validateRequestedSourceReview } from './source-review-contract.mjs';

function fixture(t) {
    const root = mkdtempSync(path.join(tmpdir(), 'boardgame-source-review-'));
    t.after(() => {
        assert.equal(path.dirname(root), path.resolve(tmpdir()));
        assert.ok(path.basename(root).startsWith('boardgame-source-review-'));
        rmSync(root, { recursive: true });
    });
    const source = path.join(root, 'original.png');
    const file = path.join(root, 'display.png');
    writeFileSync(source, 'original image bytes');
    writeFileSync(file, readFileSync(source));
    const manifestPath = path.join(root, 'source-review-manifest.json');
    const manifest = { purpose: 'user-requested-source-review', userRequest: '把对应原图给我核对', productAcceptance: 'not-claimed',
        media: [{ file, source, sha256: createHash('sha256').update(readFileSync(source)).digest('hex'), description: '待核对的原始截图', priorVerdict: 'REVISE' }] };
    const validate = () => { writeFileSync(manifestPath, JSON.stringify(manifest)); return validateRequestedSourceReview({ manifestPath, imagePaths: [file] }); };
    return { source, file, manifest, validate };
}

test('用户点名的 REVISE 原图可核查，不伪造产品 PASS', t => {
    assert.deepEqual(fixture(t).validate(), { mode: 'source-review', mediaCount: 1, productAcceptance: 'not-claimed' });
});
test('拒绝以原图核查声明产品验收通过或省略用户请求', t => {
    const f = fixture(t);
    f.manifest.productAcceptance = 'PASS';
    assert.throws(f.validate, /not-claimed/);
    f.manifest.productAcceptance = 'not-claimed'; f.manifest.userRequest = '';
    assert.throws(f.validate, /用户点名/);
});
test('拒绝替换原图或改写交付像素', t => {
    const f = fixture(t);
    writeFileSync(f.file, 'changed pixels');
    assert.throws(f.validate, /哈希/);
    writeFileSync(f.file, readFileSync(f.source)); writeFileSync(f.source, 'different original');
    assert.throws(f.validate, /哈希/);
});
test('拒绝清单混入范围外图片', t => {
    const f = fixture(t);
    f.manifest.media[0].file = f.source;
    assert.throws(f.validate, /范围外/);
});
