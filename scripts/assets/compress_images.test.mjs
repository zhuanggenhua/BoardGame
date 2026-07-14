import assert from 'node:assert/strict';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import test from 'node:test';
import { fileURLToPath } from 'node:url';
import sharp from 'sharp';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const repoRoot = path.resolve(__dirname, '../..');
const launcherPath = path.join(repoRoot, 'scripts/assets/compress_images.js');
sharp.cache(false);

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

const removeTempDir = async (dir) => {
    for (let attempt = 0; attempt < 5; attempt += 1) {
        try {
            rmSync(dir, { recursive: true, force: true });
            return;
        } catch (error) {
            if (attempt === 4 || error.code !== 'EPERM') {
                throw error;
            }
            await sleep(100 * (attempt + 1));
        }
    }
};

const withTempDir = async (fn) => {
    const dir = mkdtempSync(path.join(tmpdir(), 'boardgame-compress-images-'));
    try {
        return await fn(dir);
    } finally {
        await removeTempDir(dir);
    }
};

const createSourceImage = async (dir, name = 'cards.jpg') => {
    const sourcePath = path.join(dir, name);
    await sharp({
        create: {
            width: 3000,
            height: 600,
            channels: 3,
            background: { r: 48, g: 96, b: 160 },
        },
    })
        .jpeg({ quality: 92 })
        .toFile(sourcePath);
    return sourcePath;
};

const readDimensions = async (filePath) => {
    const metadata = await sharp(filePath).metadata();
    return { width: metadata.width, height: metadata.height };
};

const runCompress = (args, env = {}) => spawnSync(
    process.execPath,
    [launcherPath, ...args],
    {
        cwd: repoRoot,
        env: { ...process.env, ...env },
        encoding: 'utf8',
    },
);

test('默认正式素材模式只转 WebP，不降采样', async () => {
    await withTempDir(async (dir) => {
        await createSourceImage(dir);

        const result = runCompress([dir]);
        assert.equal(result.status, 0, result.stderr || result.stdout);

        const outputPath = path.join(dir, 'compressed/cards.webp');
        assert.deepEqual(await readDimensions(outputPath), { width: 3000, height: 600 });
    });
});

test('展示图模式才允许按长边 2048 降采样', async () => {
    await withTempDir(async (dir) => {
        await createSourceImage(dir);

        const result = runCompress(['--mode', 'display', dir]);
        assert.equal(result.status, 0, result.stderr || result.stdout);

        const outputPath = path.join(dir, 'compressed/cards.webp');
        assert.deepEqual(await readDimensions(outputPath), { width: 2048, height: 410 });
    });
});

test('正式素材模式会重生成旧的降采样产物', async () => {
    await withTempDir(async (dir) => {
        await createSourceImage(dir);

        const displayResult = runCompress(['--mode', 'display', dir]);
        assert.equal(displayResult.status, 0, displayResult.stderr || displayResult.stdout);
        const outputPath = path.join(dir, 'compressed/cards.webp');
        assert.deepEqual(await readDimensions(outputPath), { width: 2048, height: 410 });

        const runtimeResult = runCompress([dir]);
        assert.equal(runtimeResult.status, 0, runtimeResult.stderr || runtimeResult.stdout);
        assert.deepEqual(await readDimensions(outputPath), { width: 3000, height: 600 });
    });
});

test('正式素材模式拒绝环境变量强制缩图', async () => {
    await withTempDir(async (dir) => {
        await createSourceImage(dir);

        const result = runCompress([dir], { IMAGE_MAX_EDGE: '2048' });
        assert.notEqual(result.status, 0);
        assert.match(`${result.stdout}\n${result.stderr}`, /runtime/);
        assert.match(`${result.stdout}\n${result.stderr}`, /--mode display/);
    });
});
