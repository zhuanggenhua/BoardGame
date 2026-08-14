import { createHash } from 'node:crypto';
import {
    appendFileSync,
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
    writeFileSync,
} from 'node:fs';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import {
    SERVER_PUBLISH_INDEX_FILE,
    SERVER_PUBLISH_MANIFEST_FILE,
} from './publish-primary-assets.mjs';
import { resolveActiveAssetSet } from './active-server-assets.mjs';
import { selectRetainedReleaseIds } from './release-retention.mjs';
import { refreshAndroidPackageIndexesForPublishedAssets } from './server-android-package-refresh.mjs';

const MANAGED_PUBLISH_PREFIXES = [
    'official/app-updates/',
    'official/mobile-packages/',
    'official/native-app-updates/',
];
const RELEASE_RETENTION_COUNT = 5;

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
const preserveExistingAssets = args.includes('--preserve-existing-assets');
const publishSource = {
    ip: process.env.ASSET_PUBLISH_SOURCE_IP || 'unknown',
    id: process.env.ASSET_PUBLISH_SOURCE_ID || '',
    requestId: process.env.ASSET_PUBLISH_REQUEST_ID || '',
    anonymous: process.env.ASSET_PUBLISH_ANONYMOUS === '1',
};

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

const buildAssetIndex = async (releaseDir) => {
    const index = {};
    for (const key of walkFiles(releaseDir, 'official')) {
        const filePath = resolveWithin(releaseDir, key);
        index[key] = {
            size: statSync(filePath).size,
            sha256: await hashFile(filePath),
        };
    }
    return index;
};

const readAssetIndex = (releaseDir) => {
    const indexPath = path.join(releaseDir, SERVER_PUBLISH_INDEX_FILE);
    if (!existsSync(indexPath)) return null;
    try {
        const index = JSON.parse(readFileSync(indexPath, 'utf8'));
        if (!index || index.schemaVersion !== 1 || !index.objects || typeof index.objects !== 'object') {
            return null;
        }
        return index.objects;
    } catch {
        return null;
    }
};

const writeAssetIndex = (releaseDir, objects) => {
    const indexPath = path.join(releaseDir, SERVER_PUBLISH_INDEX_FILE);
    const tempPath = `${indexPath}.tmp-${process.pid}`;
    writeFileSync(tempPath, `${JSON.stringify({
        schemaVersion: 1,
        generatedAt: new Date().toISOString(),
        objects,
    })}\n`, { encoding: 'utf8', mode: 0o644 });
    renameSync(tempPath, indexPath);
};

const pruneInactiveManagedObjects = async (releaseDir, publishedKeys) => {
    const releaseKeys = walkFiles(releaseDir, 'official');
    const managedKeys = releaseKeys.filter((key) => (
        MANAGED_PUBLISH_PREFIXES.some((prefix) => key.startsWith(prefix))
    ));
    const objects = new Map(releaseKeys.map((key) => [
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
        rmSync(releaseDir, { recursive: true, force: true });
        mkdirSync(releaseDir, { recursive: true });
        const fallbackClone = spawnSync('cp', ['-a', `${currentRelease}/.`, `${releaseDir}/`], {
            encoding: 'utf8',
        });
        if (fallbackClone.status !== 0) {
            throw new Error(
                `克隆当前服务器 release 失败: hardlink=${clone.stderr || clone.stdout}; `
                + `copy=${fallbackClone.stderr || fallbackClone.stdout}`,
            );
        }
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

const androidPackageRefresh = await refreshAndroidPackageIndexesForPublishedAssets({
    releaseDir,
    publishedKeys: manifest.objects.map((object) => object.key),
});
const publishedAndGeneratedKeys = new Set([
    ...manifest.objects.map((object) => object.key),
    ...androidPackageRefresh.objects.map((object) => object.key),
]);

if (!preserveExistingAssets) {
    await pruneInactiveManagedObjects(
        releaseDir,
        publishedAndGeneratedKeys,
    );
}

let assetIndex = readAssetIndex(releaseDir);
if (!assetIndex) {
    assetIndex = await buildAssetIndex(releaseDir);
}
for (const object of manifest.objects) {
    assetIndex[object.key] = {
        size: object.size,
        sha256: object.sha256,
    };
}
for (const object of androidPackageRefresh.objects) {
    assetIndex[object.key] = {
        size: object.size,
        sha256: object.sha256,
    };
}
for (const key of Object.keys(assetIndex)) {
    if (!existsSync(resolveWithin(releaseDir, key))) {
        delete assetIndex[key];
    }
}
writeAssetIndex(releaseDir, assetIndex);
rmSync(path.join(releaseDir, '.active-release.json'), { force: true });

const nextLink = path.join(assetsRoot, `.current-${releaseId}-${process.pid}`);
symlinkSync(releaseDir, nextLink, 'dir');
renameSync(nextLink, currentLink);

const auditRoot = path.join(assetsRoot, 'control', 'publish-audit');
mkdirSync(auditRoot, { recursive: true });
const auditEntry = {
    schemaVersion: 1,
    event: 'asset-publish',
    status: 'published',
    publishedAt: new Date().toISOString(),
    releaseId,
    source: publishSource,
    preserveExistingAssets,
    bytes: publishBytes,
    androidPackageRefresh: {
        gameIds: androidPackageRefresh.gameIds,
        channels: androidPackageRefresh.channels,
        objects: androidPackageRefresh.objects.map((object) => ({
            key: object.key,
            size: object.size,
            sha256: object.sha256,
        })),
    },
    objects: manifest.objects.map((object) => ({
        key: object.key,
        size: object.size,
        sha256: object.sha256,
    })),
};
appendFileSync(
    path.join(auditRoot, 'publish.jsonl'),
    `${JSON.stringify(auditEntry)}\n`,
    { encoding: 'utf8', mode: 0o600 },
);

const releaseIds = readdirSync(releasesRoot, { withFileTypes: true })
    .filter((entry) => entry.isDirectory() && /^\d{17}$/.test(entry.name))
    .map((entry) => entry.name);
const currentReleaseId = path.basename(realpathSync(currentLink));
const retainedReleaseIds = selectRetainedReleaseIds(
    releaseIds,
    currentReleaseId,
    RELEASE_RETENTION_COUNT,
);
const deletedReleaseIds = [];
if (!preserveExistingAssets) {
    for (const oldReleaseId of releaseIds) {
        if (retainedReleaseIds.has(oldReleaseId)) continue;
        const oldReleaseDir = resolveWithin(releasesRoot, oldReleaseId);
        rmSync(oldReleaseDir, { recursive: true, force: true });
        deletedReleaseIds.push(oldReleaseId);
    }
}

console.log(`serverPrimaryRelease=${releaseId}`);
console.log(`serverPrimaryObjects=${manifest.objects.length}`);
console.log(`androidPackageRefreshGames=${androidPackageRefresh.gameIds.join(',') || 'none'}`);
console.log(`androidPackageRefreshChannels=${androidPackageRefresh.channels.join(',') || 'none'}`);
console.log(`androidPackageRefreshObjects=${androidPackageRefresh.objects.length}`);
console.log(`serverPrimaryIndexObjects=${Object.keys(assetIndex).length}`);
console.log(`serverPrimaryReleaseRetention=retained=${retainedReleaseIds.size} deleted=${deletedReleaseIds.length}`);
console.log('assetBackupQueue=disabled');
