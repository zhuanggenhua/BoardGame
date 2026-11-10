import { webcrypto } from 'node:crypto';
import { gzipSync } from 'node:zlib';
import { afterEach, describe, expect, it, vi } from 'vitest';

vi.mock('../../../../core/AssetLoader', () => ({ getAssetsBaseUrl: () => 'https://assets.example/official' }));
import { downloadFgoAssets, hasDownloadedFgoAssets, readFgoAsset, readFgoJson } from '../fgoAssets';

describe('Fate PC 素材下载', () => {
  afterEach(() => vi.unstubAllGlobals());

  it('校验并保存素材，第二次下载与演出读取均复用同一份本地文件', async () => {
    const content = new TextEncoder().encode('battle model');
    const sha256 = [...new Uint8Array(await webcrypto.subtle.digest('SHA-256', content))]
      .map(value => value.toString(16).padStart(2, '0')).join('');
    const stored = new Map<string, Response>();
    const cache = {
      match: vi.fn(async (url: string) => stored.get(url)?.clone()),
      put: vi.fn(async (url: string, response: Response) => { stored.set(url, response.clone()); }),
      delete: vi.fn(async (url: string) => stored.delete(url)),
    };
    const fetcher = vi.fn(async (url: string) => url.endsWith('manifest.json')
      ? new Response(JSON.stringify({ version: 'v2', files: [{ path: 'model.json', bytes: content.length, sha256 }] }))
      : new Response(content));
    vi.stubGlobal('crypto', webcrypto);
    vi.stubGlobal('caches', { open: vi.fn(async () => cache) });
    vi.stubGlobal('fetch', fetcher);
    const progress: Array<[number, number]> = [];
    expect(await hasDownloadedFgoAssets()).toBe(false);
    await downloadFgoAssets((done, total) => progress.push([done, total]));
    expect(progress).toEqual([[0, 1], [1, 1]]);
    expect(await hasDownloadedFgoAssets()).toBe(true);
    expect(await (await readFgoAsset('model.json')).text()).toBe('battle model');
    await downloadFgoAssets(() => {});
    expect(fetcher.mock.calls.filter(([url]) => !url.endsWith('manifest.json'))).toHaveLength(1);
    stored.delete('https://assets.example/official/fate-domination/fgo/v2/model.json');
    expect(await hasDownloadedFgoAssets()).toBe(false);
  });

  it('校验失败不标记为下载完成', async () => {
    const cache = { match: vi.fn(async () => undefined), put: vi.fn(), delete: vi.fn(async () => true) };
    vi.stubGlobal('crypto', webcrypto);
    vi.stubGlobal('caches', { open: vi.fn(async () => cache) });
    vi.stubGlobal('fetch', vi.fn(async (url: string) => url.endsWith('manifest.json')
      ? new Response(JSON.stringify({ version: 'v2', files: [{ path: 'model.json', bytes: 100, sha256: 'bad' }] }))
      : new Response('wrong')));
    await expect(downloadFgoAssets(() => {})).rejects.toThrow('素材校验失败');
    expect(cache.put).not.toHaveBeenCalled();
  });

  it('演出网络读取不会把未校验的响应写入已安装素材缓存', async () => {
    const cache = { match: vi.fn(async () => undefined), put: vi.fn(async () => {}) };
    vi.stubGlobal('caches', { open: vi.fn(async () => cache) });
    vi.stubGlobal('fetch', vi.fn(async () => new Response('unverified')));
    expect(await (await readFgoAsset('texture.webp')).text()).toBe('unverified');
    expect(cache.put).not.toHaveBeenCalled();
  });

  it('按清单重组压缩分片，恢复原始 JSON 内容', async () => {
    const source = { name: '阿尔托莉雅', values: [1, 2, 3] };
    const compressed = gzipSync(JSON.stringify(source));
    const middle = Math.floor(compressed.length / 2);
    const parts = ['one.json', 'two.json'];
    const cache = { match: vi.fn(async () => undefined), put: vi.fn(async () => {}) };
    vi.stubGlobal('caches', { open: vi.fn(async () => cache) });
    vi.stubGlobal('fetch', vi.fn(async (url: string) => {
      if (url.endsWith('model.json')) return new Response(JSON.stringify({ format: 'fgo-gzip-base64-v1', parts }));
      return new Response(JSON.stringify((url.endsWith(parts[0]) ? compressed.subarray(0, middle) : compressed.subarray(middle)).toString('base64')));
    }));
    await expect(readFgoJson('model.json')).resolves.toEqual(source);
  });

  it('服务器短暂返回 503 时重试，持续失败则明确报错', async () => {
    vi.stubGlobal('caches', undefined);
    const fetcher = vi.fn()
      .mockResolvedValueOnce(new Response('busy', { status: 503 }))
      .mockResolvedValueOnce(new Response('ready'));
    vi.stubGlobal('fetch', fetcher);
    expect(await (await readFgoAsset('model.json')).text()).toBe('ready');
    expect(fetcher).toHaveBeenCalledTimes(2);
    fetcher.mockImplementation(async () => new Response('busy', { status: 503 }));
    await expect(readFgoAsset('model.json')).rejects.toThrow('HTTP 503');
    expect(fetcher).toHaveBeenCalledTimes(5);
  });

  it('浏览器网络请求失败时有限重试，取消请求不重试', async () => {
    vi.stubGlobal('caches', undefined);
    const fetcher = vi.fn()
      .mockRejectedValueOnce(new TypeError('Failed to fetch'))
      .mockResolvedValueOnce(new Response('ready'));
    vi.stubGlobal('fetch', fetcher);
    expect(await (await readFgoAsset('model.json')).text()).toBe('ready');
    expect(fetcher).toHaveBeenCalledTimes(2);
    const controller = new AbortController();
    controller.abort();
    await expect(readFgoAsset('model.json', 'low', controller.signal)).rejects.toMatchObject({ name: 'AbortError' });
    expect(fetcher).toHaveBeenCalledTimes(2);
    fetcher.mockRejectedValue(new TypeError('Failed to fetch'));
    await expect(readFgoAsset('model.json')).rejects.toThrow('素材网络请求失败');
    expect(fetcher).toHaveBeenCalledTimes(5);
  });

  it('模型分片用较小的数据段还原原文件', async () => {
    vi.stubGlobal('caches', undefined);
    const source = new Uint8Array(131072 + 23).map((_, index) => index % 251);
    const fetcher = vi.fn(async (_url: string, options?: RequestInit) => {
      const range = new Headers(options?.headers).get('Range');
      if (!range) throw new TypeError('Failed to fetch');
      const [, first, last] = /^bytes=(\d+)-(\d+)$/.exec(range)!;
      const start = Number(first), end = Math.min(Number(last), source.length - 1);
      return new Response(source.slice(start, end + 1), {
        status: 206, headers: { 'Content-Range': `bytes ${start}-${end}/${source.length}` },
      });
    });
    vi.stubGlobal('fetch', fetcher);
    const result = await (await readFgoAsset('fgo-characters/300100/model.json.parts/0010.json')).arrayBuffer();
    expect(Buffer.from(result).equals(Buffer.from(source))).toBe(true);
    expect(fetcher).toHaveBeenCalledTimes(2);
  });

  it('下载遇到不完整贴图时分段重取，通过哈希后才标记完成', async () => {
    const source = new Uint8Array(131072 + 23).map((_, index) => index % 251);
    const sha256 = [...new Uint8Array(await webcrypto.subtle.digest('SHA-256', source))]
      .map(value => value.toString(16).padStart(2, '0')).join('');
    const stored = new Map<string, Response>();
    const cache = {
      match: vi.fn(async (url: string) => stored.get(url)?.clone()),
      put: vi.fn(async (url: string, response: Response) => { stored.set(url, response.clone()); }),
      delete: vi.fn(async (url: string) => stored.delete(url)),
    };
    const fetcher = vi.fn(async (url: string, options?: RequestInit) => {
      if (url.endsWith('manifest.json')) return new Response(JSON.stringify({ version: 'v2', files: [{ path: 'texture.webp', bytes: source.length, sha256 }] }));
      const range = new Headers(options?.headers).get('Range');
      if (!range) return new Response(source.slice(0, 100), { headers: { 'Content-Type': 'image/webp' } });
      const [, first, last] = /^bytes=(\d+)-(\d+)$/.exec(range)!;
      const start = Number(first), end = Math.min(Number(last), source.length - 1);
      return new Response(source.slice(start, end + 1), {
        status: 206, headers: { 'Content-Range': `bytes ${start}-${end}/${source.length}`, 'Content-Type': 'image/webp' },
      });
    });
    vi.stubGlobal('crypto', webcrypto);
    vi.stubGlobal('caches', { open: vi.fn(async () => cache) });
    vi.stubGlobal('fetch', fetcher);
    await downloadFgoAssets(() => {});
    expect(await hasDownloadedFgoAssets()).toBe(true);
    const saved = await cache.match('https://assets.example/official/fate-domination/fgo/v2/texture.webp');
    expect(saved?.headers.get('Content-Type')).toBe('image/webp');
    expect(Buffer.from(await saved!.arrayBuffer()).equals(Buffer.from(source))).toBe(true);
    expect(fetcher).toHaveBeenCalledTimes(4);
  });

  it('PC 下载并行处理多个素材且限制并发，进度按完成数递增', async () => {
    const content = new TextEncoder().encode('asset');
    const sha256 = [...new Uint8Array(await webcrypto.subtle.digest('SHA-256', content))]
      .map(value => value.toString(16).padStart(2, '0')).join('');
    const files = Array.from({ length: 5 }, (_, index) => ({ path: `asset-${index}.webp`, bytes: content.length, sha256 }));
    const stored = new Map<string, Response>();
    const cache = {
      match: vi.fn(async (url: string) => stored.get(url)?.clone()),
      put: vi.fn(async (url: string, response: Response) => { stored.set(url, response.clone()); }),
      delete: vi.fn(async (url: string) => stored.delete(url)),
    };
    let active = 0, peak = 0;
    vi.stubGlobal('crypto', webcrypto);
    vi.stubGlobal('caches', { open: vi.fn(async () => cache) });
    vi.stubGlobal('fetch', vi.fn(async (url: string) => {
      if (url.endsWith('manifest.json')) return new Response(JSON.stringify({ version: 'v2', files }));
      active += 1; peak = Math.max(peak, active);
      await new Promise(resolve => setTimeout(resolve, 20));
      active -= 1;
      return new Response(content);
    }));
    const progress: number[] = [];
    await downloadFgoAssets(done => progress.push(done));
    expect(peak).toBeGreaterThan(1);
    expect(peak).toBeLessThanOrEqual(3);
    expect(progress).toEqual([0, 1, 2, 3, 4, 5]);
  });
});
