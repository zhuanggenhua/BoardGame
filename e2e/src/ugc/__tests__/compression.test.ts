/**
 * UGC 资源压缩测试 (2.2)
 */

import { describe, it, expect, beforeEach } from 'vitest';
import {
    ImageCompressor,
    createImageCompressor,
    AudioCompressor,
    createAudioCompressor,
} from '../server/compression';
import {
    COMPRESSED_IMAGE_FORMATS,
    COMPRESSED_AUDIO_FORMATS,
    DEFAULT_IMAGE_COMPRESSION,
    DEFAULT_AUDIO_COMPRESSION,
} from '../assets/types';

describe('UGC 资源压缩', () => {
    describe('图片压缩器', () => {
        let compressor: ImageCompressor;

        beforeEach(() => {
            compressor = createImageCompressor();
        });

        it('应创建图片压缩器', () => {
            expect(compressor).toBeInstanceOf(ImageCompressor);
        });

        it('应识别需要压缩的格式', () => {
            expect(compressor.shouldCompress('png')).toBe(true);
            expect(compressor.shouldCompress('jpg')).toBe(true);
            expect(compressor.shouldCompress('jpeg')).toBe(true);
            expect(compressor.shouldCompress('bmp')).toBe(true);
            expect(compressor.shouldCompress('.PNG')).toBe(true);
        });

        it('应识别已压缩的格式（跳过）', () => {
            expect(compressor.shouldCompress('webp')).toBe(false);
            expect(compressor.shouldCompress('avif')).toBe(false);
            expect(compressor.shouldCompress('.WEBP')).toBe(false);
        });

        it('应有正确的默认压缩配置', () => {
            expect(DEFAULT_IMAGE_COMPRESSION.quality).toBeGreaterThan(0);
            expect(DEFAULT_IMAGE_COMPRESSION.quality).toBeLessThanOrEqual(100);
            expect(DEFAULT_IMAGE_COMPRESSION.targetFormat).toBe('webp');
        });

        it('应有正确的压缩格式列表', () => {
            expect(COMPRESSED_IMAGE_FORMATS).toContain('webp');
            expect(COMPRESSED_IMAGE_FORMATS).toContain('avif');
        });

        it('应处理已压缩格式的输入（跳过压缩）', async () => {
            const input = {
                buffer: Buffer.from('fake-webp-data'),
                filename: 'test.webp',
                format: 'webp',
                userId: 'user-1',
                packageId: 'pkg-1',
                assetId: 'asset-1',
            };

            const result = await compressor.compress(input);
            expect(result.success).toBe(true);
            expect(result.skipped).toBe(true);
            expect(result.variant).toBeDefined();
            expect(result.variant?.format).toBe('webp');
        });
    });

    describe('音频压缩器', () => {
        let compressor: AudioCompressor;

        beforeEach(() => {
            compressor = createAudioCompressor();
        });

        it('应创建音频压缩器', () => {
            expect(compressor).toBeInstanceOf(AudioCompressor);
        });

        it('应识别需要压缩的格式', () => {
            expect(compressor.shouldCompress('wav')).toBe(true);
            expect(compressor.shouldCompress('flac')).toBe(true);
            expect(compressor.shouldCompress('aiff')).toBe(true);
            expect(compressor.shouldCompress('.WAV')).toBe(true);
        });

        it('应识别已压缩的格式（跳过）', () => {
            expect(compressor.shouldCompress('ogg')).toBe(false);
            expect(compressor.shouldCompress('mp3')).toBe(false);
            expect(compressor.shouldCompress('.OGG')).toBe(false);
        });

        it('应有正确的默认压缩配置', () => {
            expect(DEFAULT_AUDIO_COMPRESSION.bitrate).toBeGreaterThan(0);
            expect(DEFAULT_AUDIO_COMPRESSION.targetFormat).toBe('ogg');
        });

        it('应有正确的压缩格式列表', () => {
            expect(COMPRESSED_AUDIO_FORMATS).toContain('ogg');
            expect(COMPRESSED_AUDIO_FORMATS).toContain('mp3');
        });

        it('应处理已压缩格式的输入（跳过压缩）', async () => {
            const input = {
                buffer: Buffer.from('fake-ogg-data'),
                filename: 'test.ogg',
                format: 'ogg',
                userId: 'user-1',
                packageId: 'pkg-1',
                assetId: 'asset-1',
            };

            const result = await compressor.compress(input);
            expect(result.success).toBe(true);
            expect(result.skipped).toBe(true);
            expect(result.variant).toBeDefined();
            expect(result.variant?.format).toBe('ogg');
        });
    });
});
