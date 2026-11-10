import { createHash } from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { withWindowsHide } from './windows-hide.js';
import { hashSnapshotContents, isSnapshotCache } from './e2e-immutable-snapshot.mjs';

const fsp = fs.promises;

async function hashFile(filename) {
    const hash = createHash('sha256');
    for await (const chunk of fs.createReadStream(filename)) hash.update(chunk);
    return hash.digest('hex');
}

/** 仅接受当前会话中实际映射到 Windows 卷影设备的盘符。 */
export async function assertWindowsSnapshotRoot(sourceRoot) {
    if (process.platform !== 'win32') throw new Error('当前平台尚无经过验证的不可变快照提供器');
    const drive = path.parse(path.resolve(sourceRoot)).root.match(/^([a-z]):\\$/i)?.[1]?.toUpperCase();
    if (!drive) throw new Error('源码根不是有效的卷影快照盘符');
    const { stdout } = await promisify(execFile)('subst.exe', [], withWindowsHide({ encoding: 'utf8', timeout: 5000 }));
    const mapping = stdout.split(/\r?\n/).map(line => line.trim()).find(line => line.toUpperCase().startsWith(`${drive}:\\:`));
    const target = mapping?.split('=>', 2)[1]?.trim() ?? '';
    const device = target.match(/^(\\\\\?\\GLOBALROOT\\Device\\HarddiskVolumeShadowCopy\d+)(.*)$/i);
    if (!device) {
        throw new Error('源码根不是有效的卷影快照映射');
    }
    const relativeRoot = path.relative(`${drive}:\\`, path.resolve(sourceRoot));
    const components = `${device[2]}\\${relativeRoot}`.split(/[\\/]+/).filter(Boolean);
    let current = device[1];
    for (const component of components) {
        current = path.win32.join(current, component);
        const stat = await fsp.lstat(current);
        if (stat.isSymbolicLink() || !stat.isDirectory()) throw new Error(`快照路径包含重解析点或非目录: ${current}`);
    }
    await fsp.access(sourceRoot, fs.constants.R_OK);
}

/** 内容身份只用于不可变源码根；必须另行验证根目录及其整个生命周期确实不可变。 */
export async function calculateSnapshotRevision(sourceRoot) {
    const root = path.resolve(sourceRoot);
    const directories = [];
    const files = [];
    async function visit(relative) {
        const normalized = relative.split(path.sep).join('/');
        // 预构建缓存是可写产物，不是依赖真相源。
        if (isSnapshotCache(normalized)) return;
        const absolute = path.join(root, relative);
        const stat = await fsp.lstat(absolute);
        if (stat.isSymbolicLink()) throw new Error(`快照包含未经固定的链接: ${normalized}`);
        if (stat.isDirectory()) {
            directories.push(normalized);
            for (const name of (await fsp.readdir(absolute)).sort()) await visit(path.join(relative, name));
        } else if (stat.isFile()) {
            files.push({ path: normalized, hash: await hashFile(absolute) });
        } else throw new Error(`快照包含不支持的文件类型: ${normalized}`);
    }
    for (const dirent of (await fsp.readdir(root, { withFileTypes: true })).sort((a, b) => a.name.localeCompare(b.name))) {
        await visit(dirent.name);
    }
    return hashSnapshotContents(directories, files);
}
