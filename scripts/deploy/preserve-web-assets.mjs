#!/usr/bin/env node
import { spawnSync } from 'node:child_process';
import { constants } from 'node:fs';
import { copyFile, link, mkdir, mkdtemp, readFile, readdir, rm } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

// 与 API 的历史资源访问范围一致：只有构建指纹文件可跨版本保留。
const BUILD_ASSET = /^[A-Za-z0-9_.-]+-[A-Za-z0-9_-]{8,}\.(?:js|mjs|css|svg|png|jpe?g|webp|avif|gif|woff2?|ttf|otf|wasm)$/i;

export function verifyRetainedAssetsMount(compose, destination) {
  const mounts = compose?.services?.web?.volumes;
  const expected = path.resolve(destination);
  const found = Array.isArray(mounts) && mounts.some(mount => mount.type === 'bind'
    && typeof mount.source === 'string'
    && path.resolve(mount.source) === expected
    && mount.target === '/app/retained-web-assets'
    && mount.read_only === true);
  if (!found) throw new Error('部署配置缺少正确的 web 历史资源挂载，不能继续替换旧容器');
}

export function getPublishedWebPorts(compose) {
  if (!compose?.services?.web) throw new Error('部署配置缺少 web 服务');
  const ports = compose.services.web.ports ?? [];
  if (!Array.isArray(ports)) throw new Error('部署配置的 web 端口格式无效');
  const result = new Set();
  for (const entry of ports) {
    const protocol = entry.protocol ?? 'tcp';
    if (protocol !== 'tcp' && protocol !== 'udp') throw new Error(`不支持的端口协议: ${protocol}`);
    if (entry.published === undefined || entry.published === '0' || entry.published === 0) continue;
    const port = String(entry.published);
    if (!/^\d+$/.test(port) || Number(port) < 1 || Number(port) > 65535) {
      throw new Error(`无法检查 web 映射端口: ${port}`);
    }
    result.add(`${protocol} ${Number(port)}`);
  }
  return [...result];
}

export async function retainFingerprintedAssets(source, destination) {
  await mkdir(destination, { recursive: true });
  const staging = await mkdtemp(path.join(destination, '.incoming-'));
  let count = 0;
  try {
    for (const entry of await readdir(source, { withFileTypes: true })) {
      if (!entry.isFile() || !BUILD_ASSET.test(entry.name)) continue;
      const from = path.join(source, entry.name);
      const to = path.join(destination, entry.name);
      const staged = path.join(staging, entry.name);
      await copyFile(from, staged, constants.COPYFILE_EXCL);
      try {
        // 确保旧页面只会看到完整文件，且并发发布不能覆盖已有指纹。
        await link(staged, to);
        count++;
      } catch (error) {
        if (error.code !== 'EEXIST') throw error;
        const [oldBytes, newBytes] = await Promise.all([readFile(to), readFile(staged)]);
        if (!oldBytes.equals(newBytes)) throw new Error(`指纹资源内容冲突: ${entry.name}`);
      }
    }
  } finally {
    await rm(staging, { recursive: true, force: true });
  }
  return count;
}

async function main() {
  const args = process.argv.slice(2);
  const value = name => { const index = args.indexOf(name); return index < 0 ? undefined : args[index + 1]; };
  const container = value('--container');
  const destination = value('--destination');
  const composeFile = value('--verify-compose');
  const portsComposeFile = value('--published-web-ports');
  if (composeFile || portsComposeFile) {
    const config = spawnSync('docker', ['compose', '-f', composeFile || portsComposeFile, 'config', '--format', 'json'], { encoding: 'utf8' });
    if (config.error || config.status !== 0) throw new Error(`无法读取部署配置: ${config.error?.message || config.stderr.trim()}`);
    const parsed = JSON.parse(config.stdout);
    if (composeFile) {
      if (!destination) throw new Error('检查部署配置需要 --destination');
      verifyRetainedAssetsMount(parsed, destination);
      console.log('[web-assets] 历史资源挂载检查通过');
    } else {
      for (const port of getPublishedWebPorts(parsed)) console.log(port);
    }
    return;
  }
  if (!container || !destination) throw new Error('需要 --container 和 --destination');
  const inspect = spawnSync('docker', ['container', 'inspect', container], { encoding: 'utf8' });
  if (inspect.error) throw inspect.error;
  if (inspect.status !== 0) {
    if (/no such (?:container|object)/i.test(inspect.stderr)) {
      console.log('[web-assets] 旧容器不存在，跳过历史资源采集');
      return;
    }
    throw new Error(`无法检查旧 web 容器: ${inspect.stderr.trim()}`);
  }
  const staging = await mkdtemp(path.join(os.tmpdir(), 'boardgame-web-assets-'));
  try {
    const result = spawnSync('docker', ['cp', `${container}:/app/dist/assets/.`, staging], { encoding: 'utf8' });
    if (result.error || result.status !== 0) throw new Error(`无法读取旧版静态资源: ${result.error?.message || result.stderr.trim()}`);
    const count = await retainFingerprintedAssets(staging, destination);
    console.log(`[web-assets] 保留旧版静态资源，新收录 ${count} 个`);
  } finally {
    await rm(staging, { recursive: true, force: true });
  }
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  main().catch(error => { console.error(`[web-assets] ${error.message}`); process.exitCode = 1; });
}
