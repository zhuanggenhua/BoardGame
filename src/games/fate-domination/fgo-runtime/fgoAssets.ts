import { getAssetsBaseUrl } from '../../../core/AssetLoader';

const ROOT = 'fate-domination/fgo/v2';
const CACHE = 'fate-fgo-v2';

export interface FgoAssetManifest {
  version: string;
  files: Array<{ path: string; bytes: number; sha256: string }>;
}

const urlFor = (path: string) => `${getAssetsBaseUrl().replace(/\/$/, '')}/${ROOT}/${path}`;

/** 下载确认展示清单的完整体积，不以已缓存体积冒充下载包大小。 */
export async function getFgoAssetSize(): Promise<number> {
  const response = await fetchFgoAsset(urlFor('manifest.json'), { cache: 'no-cache' });
  if (!response.ok) throw new Error(`素材清单加载失败：HTTP ${response.status}`);
  const manifest = await response.json() as FgoAssetManifest;
  if (manifest.version !== 'v2' || !Array.isArray(manifest.files) || manifest.files.some(file => !Number.isSafeInteger(file.bytes) || file.bytes < 0)) throw new Error('素材清单格式错误');
  return manifest.files.reduce((total, file) => total + file.bytes, 0);
}

/** 网关错误和浏览器网络失败可能是短暂的；重试耗尽仍交给调用方处理。 */
async function fetchWithRetry(url: string, options?: RequestInit): Promise<Response> {
  for (let attempt = 0; ; attempt += 1) {
    options?.signal?.throwIfAborted();
    let response: Response;
    try {
      response = await fetch(url, options);
    } catch (error) {
      options?.signal?.throwIfAborted();
      if (!(error instanceof TypeError)) throw error;
      if (attempt === 2) throw new Error(`素材网络请求失败：${url}`, { cause: error });
      await new Promise(resolve => setTimeout(resolve, 350 * (attempt + 1)));
      continue;
    }
    if (![502, 503, 504].includes(response.status) || attempt === 2) return response;
    await response.body?.cancel();
    await new Promise(resolve => setTimeout(resolve, 350 * (attempt + 1)));
  }
}

/** 部分网关无法稳定转发较大对象；按服务器的 Range 合同恢复完整文件。 */
async function fetchFgoAssetInRanges(url: string, options?: RequestInit): Promise<Response> {
  const chunks: ArrayBuffer[] = [];
  let offset = 0;
  let total = Infinity;
  let contentType = 'application/octet-stream';
  while (offset < total) {
    const headers = new Headers(options?.headers);
    headers.set('Range', `bytes=${offset}-${offset + 131071}`);
    const response = await fetchWithRetry(url, { ...options, headers });
    if (offset === 0 && response.status === 200) return response;
    const range = /^bytes (\d+)-(\d+)\/(\d+)$/.exec(response.headers.get('Content-Range') ?? '');
    if (response.status !== 206 || !range || Number(range[1]) !== offset) {
      throw new Error(`素材分段读取失败：${url} (HTTP ${response.status})`);
    }
    const bytes = await response.arrayBuffer();
    const end = Number(range[2]);
    const reportedTotal = Number(range[3]);
    if ((total !== Infinity && total !== reportedTotal) || end >= reportedTotal
      || bytes.byteLength !== end - offset + 1 || !bytes.byteLength) {
      throw new Error(`素材分段长度不符：${url}`);
    }
    total = reportedTotal;
    contentType = response.headers.get('Content-Type') ?? contentType;
    chunks.push(bytes);
    offset += bytes.byteLength;
  }
  const combined = new Uint8Array(total);
  let position = 0;
  for (const chunk of chunks) { combined.set(new Uint8Array(chunk), position); position += chunk.byteLength; }
  return new Response(combined, { headers: { 'Content-Type': contentType } });
}

async function fetchFgoAsset(url: string, options?: RequestInit): Promise<Response> {
  const path = new URL(url, globalThis.location?.href ?? 'http://localhost').pathname;
  if (/\.json\.parts\/\d+\.json$/i.test(path)) return fetchFgoAssetInRanges(url, options);
  const canUseRanges = /\.(webp|png|jpg|jpeg)$/i.test(path);
  try {
    const response = await fetchWithRetry(url, options);
    if (!canUseRanges || ![502, 503, 504].includes(response.status)) return response;
    await response.body?.cancel();
  } catch (error) {
    options?.signal?.throwIfAborted();
    if (!canUseRanges || !(error instanceof Error && error.cause instanceof TypeError)) throw error;
  }
  return fetchFgoAssetInRanges(url, options);
}

/** 本地缓存与演出加载共用相同 URL；缓存不可用时仍允许线上读取。 */
export async function readFgoAsset(path: string, priority: 'high' | 'low' = 'low', signal?: AbortSignal): Promise<Response> {
  signal?.throwIfAborted();
  const url = urlFor(path);
  let cache: Cache | undefined;
  try { cache = typeof caches === 'undefined' ? undefined : await caches.open(CACHE); }
  catch (error) { console.warn('素材缓存不可用', error); }
  const cached = await cache?.match(url);
  signal?.throwIfAborted();
  if (cached) return cached;
  const response = await fetchFgoAsset(url, { priority, signal });
  if (!response.ok) throw new Error(`素材加载失败 ${path}: HTTP ${response.status}`);
  // 永久缓存只由显式下载写入，以免网关返回不完整内容后长期复用坏文件。
  return response;
}

export async function readFgoJson<T>(path: string, priority: 'high' | 'low' = 'low', signal?: AbortSignal): Promise<T> {
  const value = await (await readFgoAsset(path, priority, signal)).json();
  if (!value || value.format !== 'fgo-gzip-base64-v1') return value as T;
  const parts = value.parts as string[];
  if (!Array.isArray(parts) || parts.some(part => typeof part !== 'string')) throw new Error(`素材分片清单无效：${path}`);
  const decoded: Uint8Array<ArrayBuffer>[] = [];
  // 限制并发，避免后台预载抢占玩家正在使用的网络连接。
  for (let index = 0; index < parts.length; index += 3) {
    const batch = await Promise.all(parts.slice(index, index + 3).map(async part => {
      const base64 = await (await readFgoAsset(part, priority, signal)).json() as string;
      const binary = atob(base64);
      return Uint8Array.from(binary, character => character.charCodeAt(0));
    }));
    decoded.push(...batch);
  }
  const compressed = new ReadableStream<BufferSource>({
    start(controller) { decoded.forEach(chunk => controller.enqueue(chunk)); controller.close(); },
  });
  const stream = compressed.pipeThrough(new DecompressionStream('gzip'));
  return new Response(stream).json() as Promise<T>;
}

/** 用户主动下载时校验内容并报告真实进度；已正确缓存的对象不会重新下载。 */
export async function downloadFgoAssets(onProgress: (done: number, total: number) => void): Promise<void> {
  if (typeof caches === 'undefined' || !crypto.subtle) throw new Error('当前浏览器不支持本地素材下载');
  const manifestResponse = await fetchFgoAsset(urlFor('manifest.json'), { cache: 'no-cache' });
  if (!manifestResponse.ok) throw new Error(`素材清单加载失败：HTTP ${manifestResponse.status}`);
  const savedManifestResponse = manifestResponse.clone();
  const manifest = await manifestResponse.json() as FgoAssetManifest;
  if (manifest.version !== 'v2' || !Array.isArray(manifest.files)) throw new Error('素材清单格式错误');
  const cache = await caches.open(CACHE);
  let completed = 0;
  onProgress(completed, manifest.files.length);
  const downloadFile = async (file: FgoAssetManifest['files'][number]) => {
    const url = urlFor(file.path);
    let response = await cache.match(url);
    if (!response) {
      response = await fetchFgoAsset(url);
      if (!response.ok) throw new Error(`素材下载失败 ${file.path}: HTTP ${response.status}`);
    }
    const matches = async (candidate: Response) => {
      let bytes: ArrayBuffer;
      try { bytes = await candidate.clone().arrayBuffer(); }
      catch (error) { if (error instanceof TypeError) return false; throw error; }
      const digest = [...new Uint8Array(await crypto.subtle.digest('SHA-256', bytes))]
        .map(value => value.toString(16).padStart(2, '0')).join('');
      return bytes.byteLength === file.bytes && digest === file.sha256;
    };
    if (!await matches(response)) {
      await cache.delete(url);
      response = await fetchFgoAssetInRanges(url);
      if (!await matches(response)) throw new Error(`素材校验失败：${file.path}`);
    }
    await cache.put(url, response);
    onProgress(++completed, manifest.files.length);
  };
  let next = 0;
  let failure: { error: unknown } | undefined;
  const worker = async () => {
    while (!failure && next < manifest.files.length) {
      const file = manifest.files[next++];
      try { await downloadFile(file); }
      catch (error) { failure ??= { error }; }
    }
  };
  // 并发下载减少等待，但失败后等已开始的请求收口，再报告错误。
  await Promise.all(Array.from({ length: Math.min(3, manifest.files.length) }, worker));
  if (failure) throw failure.error;
  await cache.put(urlFor('manifest.json'), savedManifestResponse);
  if (navigator.storage?.persist) await navigator.storage.persist().catch(error => console.warn('无法请求持久存储', error));
}

/** 已校验清单与每个缓存对象都存在时，才显示已下载状态。 */
export async function hasDownloadedFgoAssets(): Promise<boolean> {
  if (typeof caches === 'undefined') return false;
  const cache = await caches.open(CACHE);
  const response = await cache.match(urlFor('manifest.json'));
  if (!response) return false;
  const manifest = await response.json() as FgoAssetManifest;
  if (manifest.version !== 'v2' || !Array.isArray(manifest.files) || manifest.files.length === 0) return false;
  for (const file of manifest.files) if (!await cache.match(urlFor(file.path))) return false;
  return true;
}
