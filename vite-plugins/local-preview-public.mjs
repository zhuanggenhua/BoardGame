import { createHash, randomUUID } from 'node:crypto';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

const CACHE_DIR = '.boardgame-preview-public';
const MIN_FREE_BYTES = 2 * 1024 ** 3;
const CACHE_GRACE_MS = 24 * 60 * 60 * 1000;

function physicalPath(p) {
    if (fs.existsSync(p)) return fs.realpathSync.native(p);
    const parent = path.dirname(p);
    if (parent === p) return p;
    return path.join(physicalPath(parent), path.basename(p));
}

function isChild(root, child) {
    const relative = path.relative(root, child);
    return relative !== '' && !relative.startsWith('..' + path.sep)
        && relative !== '..' && !path.isAbsolute(relative);
}

function assertFreeSpace(directory, bytes = 0) {
    const { bavail, bsize } = fs.statfsSync(directory);
    if (bavail * bsize < MIN_FREE_BYTES + bytes) {
        throw new Error('临时预览的磁盘空间不足，已保留至少 2 GiB 可用空间。');
    }
}

// 保留仍有构建引用的文件。过期的写入中转文件也可以移除。
function pruneUnusedObjects(cache) {
    const cutoff = Date.now() - CACHE_GRACE_MS;
    for (const entry of fs.readdirSync(cache, { withFileTypes: true })) {
        if (!entry.isFile() || !/^(?:[a-f0-9]{64}|\.write-[a-f0-9-]{36})$/.test(entry.name)) continue;
        const object = path.join(cache, entry.name);
        try {
            const stat = fs.lstatSync(object);
            const expired = entry.name.startsWith('.write-') ? stat.mtimeMs < cutoff : stat.nlink === 1 && stat.atimeMs < cutoff;
            if (expired) fs.unlinkSync(object);
        } catch (error) {
            if (error.code !== 'ENOENT') throw error;
        }
    }
}

function linkCachedContent(content, object, target, cache) {
    if (!fs.existsSync(object)) {
        assertFreeSpace(cache, content.length);
        const staging = path.join(cache, '.write-' + randomUUID());
        try {
            fs.writeFileSync(staging, content, { flag: 'wx' });
            try {
                fs.linkSync(staging, object);
            } catch (error) {
                if (error.code !== 'EEXIST') throw error;
            }
        } finally {
            if (fs.existsSync(staging)) fs.unlinkSync(staging);
        }
    }
    fs.linkSync(object, target);
    fs.utimesSync(target, new Date(), fs.statSync(target).mtime);
}

function linkPublicFile(source, target, cache) {
    // 对写入的字节取哈希。源文件之后即使被原地修改，也不会改变已有预览。
    const content = fs.readFileSync(source);
    const object = path.join(cache, createHash('sha256').update(content).digest('hex'));
    try {
        linkCachedContent(content, object, target, cache);
    } catch (error) {
        // 另一个构建可能刚回收了尚未被引用的旧缓存。
        if (error.code !== 'ENOENT' || fs.existsSync(target)) throw error;
        linkCachedContent(content, object, target, cache);
    }
}

function linkPublicTree(source, target, cache) {
    fs.mkdirSync(target, { recursive: true });
    for (const entry of fs.readdirSync(source, { withFileTypes: true })) {
        const from = path.join(source, entry.name);
        const to = path.join(target, entry.name);
        if (entry.isDirectory()) {
            linkPublicTree(from, to, cache);
        } else if (!fs.existsSync(to)) {
            linkPublicFile(from, to, cache);
        }
    }
}

export function localPreviewPublicPlugin(repoRoot) {
    let localOutput;
    let publicRoot;
    let cache;
    return {
        name: 'boardgame-local-preview-public',
        apply: 'build',
        config(config, { mode }) {
            const out = config.build?.outDir;
            if (!out || config.build?.copyPublicDir === false || config.build?.ssr ||
                mode === 'android' || mode === 'ios' || process.env.CI || process.env.BG_STANDALONE_BUILD === '1') {
                return;
            }
            const root = physicalPath(repoRoot);
            const output = physicalPath(path.resolve(config.root ?? root, out));
            const scratchRoots = [path.join(root, 'temp'), path.join(root, '.tmp')];
            if (!isChild(root, output)) scratchRoots.push(os.tmpdir());
            const scratch = scratchRoots
                .map(physicalPath).find(root => isChild(root, output));
            if (!scratch || isChild(output, root) || output === root) return;
            const cacheDir = path.join(scratch, CACHE_DIR);
            if (output === cacheDir || isChild(cacheDir, output)) throw new Error('预览输出不能指向公共资源缓存。');
            // 使用临时目录外的输出，以及显式保留旧目录的打包请求，继续走 Vite 原流程。
            if (config.build.emptyOutDir === false) return;
            if (fs.existsSync(output) && !isChild(physicalPath(repoRoot), output) &&
                config.build.emptyOutDir !== true && fs.readdirSync(output).length > 0) {
                throw new Error('临时预览目录已有内容。请指定新目录，或显式传入 --emptyOutDir。');
            }
            localOutput = output;
            cache = cacheDir;
            return { build: { copyPublicDir: false } };
        },
        configResolved(config) {
            publicRoot = config.publicDir;
            if (localOutput && publicRoot &&
                (localOutput === publicRoot || isChild(publicRoot, localOutput) || isChild(localOutput, publicRoot))) {
                throw new Error('预览输出目录与 public 目录重叠。');
            }
        },
        buildStart() {
            if (!localOutput || !publicRoot) return;
            fs.mkdirSync(cache, { recursive: true });
            if (physicalPath(cache) !== cache) throw new Error('公共资源缓存目录不能是链接。');
            pruneUnusedObjects(cache);
            assertFreeSpace(cache);
        },
        writeBundle: {
            order: 'post',
            handler() {
                if (!localOutput || !publicRoot || !fs.existsSync(publicRoot)) return;
                linkPublicTree(publicRoot, localOutput, cache);
                this.info('临时预览已复用公共资源缓存。');
            },
        },
    };
}
