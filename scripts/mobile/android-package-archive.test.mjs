import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import fs from 'node:fs';
import { syncBuiltinESMExports } from 'node:module';
import os from 'node:os';
import path from 'node:path';
import { Writable } from 'node:stream';
import { unzipSync } from 'fflate';
import test from 'node:test';

test('ZIP writer honors slow-output backpressure and preserves archive bytes', async () => {
    const root = fs.mkdtempSync(path.join(os.tmpdir(), 'boardgame-zip-backpressure-'));
    const originalCreateWriteStream = fs.createWriteStream;
    let maxWritableLength = 0;

    fs.createWriteStream = (zipPath, options) => {
        const file = originalCreateWriteStream(zipPath, options);
        let slowWriter;
        slowWriter = new Writable({
            highWaterMark: 16 * 1024,
            write(chunk, encoding, callback) {
                setTimeout(() => {
                    if (file.write(chunk)) callback();
                    else file.once('drain', callback);
                }, 1);
            },
            final(callback) {
                file.end(callback);
            },
            destroy(error, callback) {
                file.destroy(error);
                callback(error);
            },
        });
        file.on('error', (error) => slowWriter.destroy(error));
        const write = slowWriter.write;
        slowWriter.write = (...args) => {
            const result = Reflect.apply(write, slowWriter, args);
            maxWritableLength = Math.max(maxWritableLength, slowWriter.writableLength);
            return result;
        };
        return slowWriter;
    };
    syncBuiltinESMExports();

    try {
        const { createAndroidCompatibleZipFile } = await import('./android-package-archive.mjs');
        const body = Buffer.alloc(2 * 1024 * 1024, 0x5a);
        const sourcePath = path.join(root, 'slow.ogg');
        const zipPath = path.join(root, 'package.zip');
        const entryPath = 'common/audio/test/compressed/slow.ogg';
        fs.writeFileSync(sourcePath, body);

        const result = await createAndroidCompatibleZipFile(
            [{ relativePath: entryPath, fullPath: sourcePath }],
            zipPath,
        );
        const archive = fs.readFileSync(zipPath);

        assert.ok(
            maxWritableLength < 256 * 1024,
            `slow writer buffered ${maxWritableLength} bytes despite a 16 KiB high-water mark`,
        );
        assert.equal(result.bytes, archive.byteLength);
        assert.equal(result.checksum, createHash('sha256').update(archive).digest('hex'));
        assert.deepEqual(Buffer.from(unzipSync(archive)[entryPath]), body);
    } finally {
        fs.createWriteStream = originalCreateWriteStream;
        syncBuiltinESMExports();
        fs.rmSync(root, { recursive: true, force: true });
    }
});
