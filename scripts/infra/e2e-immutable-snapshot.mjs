import { createHash, randomUUID } from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';

const fsp = fs.promises;

export function isSnapshotCache(name) {
    const normalized = process.platform === 'win32' ? name.toLowerCase() : name;
    return normalized === 'node_modules/.vite' || normalized.startsWith('node_modules/.vite/');
}

/** 同一份已复制内容必须以相同算法计算版本，Vite 写缓存不属于源码。 */
export function hashSnapshotContents(directories, files) {
    const stableDirectories = directories.filter(name => !isSnapshotCache(name)).sort();
    const stableFiles = files.filter(file => !isSnapshotCache(file.path)).sort((a, b) => a.path < b.path ? -1 : a.path > b.path ? 1 : 0);
    return createHash('sha256').update(JSON.stringify({ directories: stableDirectories, files: stableFiles })).digest('hex');
}

async function hashFile(filename) {
    const hash = createHash('sha256');
    for await (const chunk of fs.createReadStream(filename)) hash.update(chunk);
    return hash.digest('hex');
}

function relativeEntry(entry) {
    if (typeof entry !== 'string' || !entry || path.isAbsolute(entry)) throw new Error(`快照入口必须是相对路径: ${entry}`);
    const normalized = path.normalize(entry);
    if (normalized === '..' || normalized.startsWith(`..${path.sep}`) || normalized === '.') {
        throw new Error(`快照入口越界: ${entry}`);
    }
    return normalized;
}

async function canonicalEntry(root, entry) {
    const relative = relativeEntry(entry);
    if (process.platform !== 'win32') return relative;
    let directory = root;
    const parts = [];
    for (const part of relative.split(path.sep)) {
        const names = await fsp.readdir(directory);
        const actual = names.find(name => name === part)
            ?? names.find(name => name.toLowerCase() === part.toLowerCase());
        if (!actual) throw Object.assign(new Error(`快照输入不存在: ${entry}`), { code: 'ENOENT' });
        parts.push(actual);
        directory = path.join(directory, actual);
        if ((await fsp.lstat(directory)).isSymbolicLink()) {
            throw new Error(`快照输入包含符号链接，无法保证内容稳定: ${parts.join('/')}`);
        }
    }
    return path.join(...parts);
}

async function resolveMissingPath(filename) {
    let current = filename;
    const suffix = [];
    while (true) {
        try {
            return path.join(await fsp.realpath(current), ...suffix);
        } catch (error) {
            if (error?.code !== 'ENOENT') throw error;
            const parent = path.dirname(current);
            if (parent === current) throw error;
            suffix.unshift(path.basename(current));
            current = parent;
        }
    }
}

async function enumerate(root, entries) {
    const files = [];
    const directories = [];
    const fingerprints = {};
    const seen = new Set();
    async function visit(relative) {
        const key = relative.split(path.sep).join('/');
        if (isSnapshotCache(key)) return;
        if (seen.has(key)) return;
        seen.add(key);
        const absolute = path.join(root, relative);
        const stat = await fsp.lstat(absolute, { bigint: true });
        if (stat.isSymbolicLink()) throw new Error(`快照输入包含符号链接，无法保证内容稳定: ${key}`);
        fingerprints[key] = [stat.dev, stat.ino, stat.mode, stat.size, stat.mtimeNs, stat.ctimeNs].map(String);
        if (stat.isDirectory()) {
            directories.push(key);
            const names = await fsp.readdir(absolute);
            names.sort();
            for (const name of names) await visit(path.join(relative, name));
        } else if (stat.isFile()) {
            files.push(key);
        } else {
            throw new Error(`快照输入不是普通文件或目录: ${key}`);
        }
    }
    for (const entry of entries) {
        const normalized = relativeEntry(entry);
        let parent = path.dirname(normalized);
        while (parent !== '.') {
            const stat = await fsp.lstat(path.join(root, parent), { bigint: true });
            if (stat.isSymbolicLink()) throw new Error(`快照输入包含符号链接，无法保证内容稳定: ${parent}`);
            const key = parent.split(path.sep).join('/');
            directories.push(key);
            fingerprints[key] = [stat.dev, stat.ino, stat.mode, stat.size, stat.mtimeNs, stat.ctimeNs].map(String);
            parent = path.dirname(parent);
        }
        await visit(normalized);
    }
    files.sort();
    return { files, directories: [...new Set(directories)].sort(), fingerprints };
}

/**
 * 复制独立文件，重新校验来源内容及目录成员。逐文件校验不提供文件系统级原子快照；
 * 调用方负责保证输入在准备期间稳定，并选择完整输入闭包及生命周期。
 * 不使用指向工作区的硬链接或目录链接；准备失败时绝不发布半成品。
 */
export async function createImmutableSnapshot({ sourceRoot, destination, entries, onCopied } = {}) {
    const root = await fsp.realpath(path.resolve(sourceRoot));
    const target = path.resolve(destination);
    if (!Array.isArray(entries) || !entries.length) throw new Error('快照至少需要一个入口');
    const canonicalEntries = (await Promise.all(entries.map(entry => canonicalEntry(root, entry))))
        .filter(entry => !isSnapshotCache(entry.split(path.sep).join('/')));
    if (!canonicalEntries.length) throw new Error('快照入口均为可写缓存，没有固定输入');
    const actualParent = await resolveMissingPath(path.dirname(target));
    const relativeTarget = path.relative(root, path.join(actualParent, path.basename(target)));
    for (const entry of canonicalEntries) {
        const compareTarget = process.platform === 'win32' ? relativeTarget.toLowerCase() : relativeTarget;
        const compareEntry = process.platform === 'win32' ? entry.toLowerCase() : entry;
        if (compareTarget === compareEntry || compareTarget.startsWith(`${compareEntry}${path.sep}`)) {
            throw new Error('快照目标不能位于输入目录内');
        }
    }
    await fsp.mkdir(path.dirname(target), { recursive: true });
    const staging = `${target}.preparing-${process.pid}-${randomUUID()}`;
    await fsp.mkdir(staging);
    try {
        const before = await enumerate(root, canonicalEntries);
        const files = [];
        for (const directory of before.directories) await fsp.mkdir(path.join(staging, directory), { recursive: true });
        for (const relative of before.files) {
            const source = path.join(root, relative);
            const copy = path.join(staging, relative);
            await fsp.mkdir(path.dirname(copy), { recursive: true });
            await fsp.copyFile(source, copy, fs.constants.COPYFILE_EXCL);
            const hash = await hashFile(copy);
            files.push({ path: relative, hash });
            await onCopied?.(relative);
        }
        const after = await enumerate(root, canonicalEntries);
        if (JSON.stringify(before.files) !== JSON.stringify(after.files)
            || JSON.stringify(before.directories) !== JSON.stringify(after.directories)) {
            throw new Error('快照准备期间目录成员发生变化');
        }
        for (const key of Object.keys(before.fingerprints)) {
            if (JSON.stringify(before.fingerprints[key]) !== JSON.stringify(after.fingerprints[key])) {
                throw new Error(`快照准备期间文件发生变化: ${key}`);
            }
        }
        for (const file of files) {
            if (await hashFile(path.join(root, file.path)) !== file.hash) {
                throw new Error(`快照准备期间文件发生变化: ${file.path}`);
            }
        }
        const revision = hashSnapshotContents(before.directories, files);
        // 只改变副本权限，不影响工作区；调用方不应修改已发布的快照。
        for (const file of files) {
            const originalMode = Number(before.fingerprints[file.path][2]);
            await fsp.chmod(path.join(staging, file.path), originalMode & 0o555);
        }
        // 先独占预留目录，再原子发布其 root；不能替换已有目录。
        await fsp.mkdir(target);
        try {
            await fsp.rename(staging, path.join(target, 'root'));
        } catch (error) {
            await fsp.rmdir(target).catch(() => {});
            throw error;
        }
        return { root: path.join(target, 'root'), revision, files, directories: before.directories };
    } catch (error) {
        // 仅删除本次调用新建且尚未发布的 staging，绝不清理现有快照。
        try {
            await fsp.rm(staging, { recursive: true, force: true });
        } catch (cleanupError) {
            throw new AggregateError([error, cleanupError], `快照准备失败，且临时目录清理失败: ${staging}`);
        }
        throw error;
    }
}
