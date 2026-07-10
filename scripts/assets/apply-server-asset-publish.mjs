import { createHash } from 'node:crypto';
import {
    copyFileSync,
    createReadStream,
    existsSync,
    mkdirSync,
    readFileSync,
    readdirSync,
    realpathSync,
    renameSync,
    rmSync,
    rmdirSync,
    statfsSync,
    statSync,
    symlinkSync,
    unlinkSync,
} from 'node:fs';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { SERVER_PUBLISH_MANIFEST_FILE } from './publish-primary-assets.mjs';
import { resolveActiveAssetSet } from './sync-active-r2-assets.mjs';

const MANAGED_PUBLISH_PREFIXES = [
    'official/app-updates/',
    'official/mobile-packages/',
    'official/native-app-updates/',
];

const args = process.argv.slice(2);
const readArg = (name) => {
    const index = args.indexOf(`--${name}`);
    return index >= 0 ? args[index + 1] : '';
};
const stagingArg = readArg('staging');
const assetsRootArg = readArg('assets-root');
if (!stagingArg || !assetsRootArg) {
    throw new Error('缺少 --staging 或 --assets-root');
}
const stagingRoot = path.resolve(stagingArg);
const assetsRoot = path.resolve(assetsRootArg);

const resolveWithin = (root, relativePath) => {
    const resolved = path.resolve(root, relativePath);
    if (!resolved.startsWith(`${root}${path.sep}`)) {
        throw new Error(`路径越界: ${relativePath}`);
    }
    return resolved;
};

const hashFile = async (filePath) => {
    const hash = createHash('sha256');
    for await (const chunk of createReadStream(filePath)) {
        hash.update(chunk);
    }
    return hash.digest('hex');
};

const walkFiles = (root, relativePath = '', output = []) => {
    const directoryPath = relativePath ? path.join(root, relativePath) : root;
    if (!existsSync(directoryPath)) return output;

    for (const entry of readdirSync(directoryPath, { withFileTypes: true })) {
        const childRelativePath = relativePath
            ? path.join(relativePath, entry.name)
            : entry.name;
        if (entry.isDirectory()) {
            walkFiles(root, childRelativePath, output);
        } else if (entry.isFile()) {
            output.push(childRelativePath.replace(/\\/g, '/'));
        }
    }
    return output;
};

const pruneInactiveManagedObjects = async (releaseDir, publishedKeys) => {
    const managedKeys = MANAGED_PUBLISH_PREFIXES.flatMap((prefix) => (
        walkFiles(releaseDir, prefix)
    ));
    const objects = new Map(managedKeys.map((key) => [
        key,
        { size: statSync(resolveWithin(releaseDir, key)).size },
    ]));
    const resolved = await resolveActiveAssetSet({
        objects,
        readJson: async (key) => JSON.parse(readFileSync(resolveWithin(releaseDir, key), 'utf8')),
    });
    if (resolved.unresolved.size > 0) {
        throw new Error(`服务器活动清单引用缺失: ${[...resolved.unresolved].join(', ')}`);
    }

    const retained = new Set([...resolved.active, ...publishedKeys]);
    for (const key of managedKeys) {
        if (!retained.has(key)) {
            unlinkSync(resolveWithin(releaseDir, key));
        }
    }

    for (const prefix of MANAGED_PUBLISH_PREFIXES) {
        const root = resolveWithin(releaseDir, prefix.replace(/\/$/, ''));
        const directories = [];
        const collectDirectories = (directoryPath) => {
            if (!existsSync(directoryPath)) return;
            for (const entry of readdirSync(directoryPath, { withFileTypes: true })) {
                if (entry.isDirectory()) {
                    collectDirectories(path.join(directoryPath, entry.name));
                }
            }
            directories.push(directoryPath);
        };
        collectDirectories(root);
        for (const directoryPath of directories) {
            if (directoryPath !== root && readdirSync(directoryPath).length === 0) {
                rmdirSync(directoryPath);
            }
        }
    }
};

const manifestPath = path.join(stagingRoot, SERVER_PUBLISH_MANIFEST_FILE);
const manifest = JSON.parse(readFileSync(manifestPath, 'utf8'));
if (manifest.schemaVersion !== 1 || !Array.isArray(manifest.objects) || manifest.objects.length === 0) {
    throw new Error('服务器发布清单无效');
}

let publishBytes = 0;
for (const object of manifest.objects) {
    if (!String(object.key || '').startsWith('official/')) {
        throw new Error(`服务器发布对象 key 非法: ${object.key}`);
    }
    const sourcePath = resolveWithin(stagingRoot, object.key);
    const stats = statSync(sourcePath);
    if (stats.size !== object.size) {
        throw new Error(`服务器发布对象大小不一致: ${object.key}`);
    }
    if (await hashFile(sourcePath) !== object.sha256) {
        throw new Error(`服务器发布对象哈希不一致: ${object.key}`);
    }
    publishBytes += stats.size;
}

const fsStats = statfsSync(assetsRoot);
const freeBytes = Number(fsStats.bavail) * Number(fsStats.bsize);
const minimumFreeBytes = 5 * 1024 * 1024 * 1024;
if (freeBytes - publishBytes < minimumFreeBytes) {
    throw new Error(`服务器空间不足: free=${freeBytes} publish=${publishBytes} minimum=${minimumFreeBytes}`);
}

const releaseId = new Date().toISOString().replace(/\D/g, '').slice(0, 17);
const releasesRoot = path.join(assetsRoot, 'releases');
const releaseDir = path.join(releasesRoot, releaseId);
const currentLink = path.join(assetsRoot, 'current');
mkdirSync(releaseDir, { recursive: true });

if (existsSync(currentLink)) {
    const currentRelease = realpathSync(currentLink);
    const clone = spawnSync('cp', ['-al', `${currentRelease}/.`, `${releaseDir}/`], {
        encoding: 'utf8',
    });
    if (clone.status !== 0) {
        throw new Error(`克隆当前服务器 release 失败: ${clone.stderr || clone.stdout}`);
    }
}

for (const object of manifest.objects) {
    const sourcePath = resolveWithin(stagingRoot, object.key);
    const destinationPath = resolveWithin(releaseDir, object.key);
    mkdirSync(path.dirname(destinationPath), { recursive: true });
    if (existsSync(destinationPath)) {
        unlinkSync(destinationPath);
    }
    copyFileSync(sourcePath, destinationPath);
}

await pruneInactiveManagedObjects(
    releaseDir,
    new Set(manifest.objects.map((object) => object.key)),
);
rmSync(path.join(releaseDir, '.active-release.json'), { force: true });

const nextLink = path.join(assetsRoot, `.current-${releaseId}-${process.pid}`);
symlinkSync(releaseDir, nextLink, 'dir');
renameSync(nextLink, currentLink);

const backupQueueRoot = path.join(assetsRoot, 'backup-queue');
const backupQueueDir = path.join(backupQueueRoot, releaseId);
mkdirSync(backupQueueRoot, { recursive: true });
rmSync(backupQueueDir, { recursive: true, force: true });
renameSync(stagingRoot, backupQueueDir);

console.log(`serverPrimaryRelease=${releaseId}`);
console.log(`serverPrimaryObjects=${manifest.objects.length}`);
console.log(`r2BackupQueued=${backupQueueDir}`);
