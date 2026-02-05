import { afterAll, describe, expect, it, vi } from 'vitest';
import { resolveUgcEntryPath, resolveUgcFilePath, resolvePlayerRange, loadUgcDomainCode } from '../ugcRegistration';

const originalEnv = { ...process.env };

describe('UGC 注册辅助函数', () => {
    it('resolveUgcEntryPath: 优先使用 entryPoints.rules', () => {
        const manifest = {
            entryPoints: { rules: 'ugc/u1/p1/domain.js' },
        };
        const result = resolveUgcEntryPath(manifest, 'u1', 'p1');
        expect(result).toBe('ugc/u1/p1/domain.js');
    });

    it('resolveUgcEntryPath: 缺少 entryPoints 时回退 domain.js', () => {
        const manifest = {
            files: ['domain.js'],
        };
        const result = resolveUgcEntryPath(manifest, 'u1', 'p1');
        expect(result).toBe('ugc/u1/p1/domain.js');
    });

    it('resolveUgcFilePath: 解析本地路径并阻断越界', () => {
        process.env.UGC_LOCAL_PATH = 'C:/ugc-test';
        process.env.UGC_PUBLIC_URL_BASE = '/assets';
        const ok = resolveUgcFilePath('/assets/ugc/u1/p1/domain.js');
        expect(ok?.replace(/\\/g, '/')).toBe('C:/ugc-test/ugc/u1/p1/domain.js');

        const invalid = resolveUgcFilePath('../secret.txt');
        expect(invalid).toBeNull();
    });

    it('resolvePlayerRange: 取 metadata.playerOptions 最小/最大', () => {
        const manifest = {
            metadata: { playerOptions: [2, 4, 3] },
        };
        const result = resolvePlayerRange(manifest);
        expect(result.minPlayers).toBe(2);
        expect(result.maxPlayers).toBe(4);
    });

    it('loadUgcDomainCode: 路径无效时返回 null', async () => {
        const warn = vi.spyOn(console, 'warn').mockImplementation(() => undefined);
        process.env.UGC_LOCAL_PATH = 'C:/ugc-test';
        process.env.UGC_PUBLIC_URL_BASE = '/assets';
        const result = await loadUgcDomainCode('http://example.com/no-ugc', 'pkg-1');
        expect(result).toBeNull();
        expect(warn).toHaveBeenCalled();
        warn.mockRestore();
    });

    it('loadUgcDomainCode: 读取失败时返回 null', async () => {
        const warn = vi.spyOn(console, 'warn').mockImplementation(() => undefined);
        process.env.UGC_LOCAL_PATH = 'C:/ugc-test';
        process.env.UGC_PUBLIC_URL_BASE = '/assets';
        const result = await loadUgcDomainCode('/assets/ugc/u1/p1/missing.js', 'pkg-1');
        expect(result).toBeNull();
        expect(warn).toHaveBeenCalled();
        warn.mockRestore();
    });

    it('resolveUgcFilePath: 支持 URL 带 query/hash', () => {
        process.env.UGC_LOCAL_PATH = 'C:/ugc-test';
        process.env.UGC_PUBLIC_URL_BASE = '/assets';
        const result = resolveUgcFilePath('https://example.com/assets/ugc/u1/p1/domain.js?x=1#hash');
        expect(result?.replace(/\\/g, '/')).toBe('C:/ugc-test/ugc/u1/p1/domain.js');
    });

    it('resolveUgcFilePath: http URL 无 /ugc/ 时返回 null', () => {
        process.env.UGC_LOCAL_PATH = 'C:/ugc-test';
        process.env.UGC_PUBLIC_URL_BASE = '/assets';
        const result = resolveUgcFilePath('https://example.com/assets/no-ugc/domain.js');
        expect(result).toBeNull();
    });

    afterAll(() => {
        process.env = originalEnv;
    });
});
