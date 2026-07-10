#!/usr/bin/env node

import { spawn } from 'node:child_process';
import { createHash } from 'node:crypto';
import {
    mkdir,
    readFile,
    readdir,
    realpath,
    rename,
    rm,
    stat,
    statfs,
    symlink,
    writeFile,
} from 'node:fs/promises';
import path from 'node:path';
import { pathToFileURL } from 'node:url';

const ROOT_DISCOVERY_RULES = [
    {
        prefix: 'official/app-updates/',
        includes: ['**/latest.json'],
    },
    {
        prefix: 'official/mobile-packages/',
        includes: ['**/games/*.json', '**/shared/*.json'],
    },
    {
        prefix: 'official/native-app-updates/',
        includes: ['**/latest.json'],
    },
];
const DEFAULT_REMOTE = 'r2-boardgame:boardgame-assets';
const DEFAULT_ASSETS_ROOT = '/home/admin/storage/assets';
const DEFAULT_MAX_ACTIVE_BYTES = 2 * 1024 * 1024 * 1024;
const DEFAULT_MIN_FREE_BYTES = 5 * 1024 * 1024 * 1024;

export const isActiveRootKey = (key) => (
    /official\/(?:app-updates|native-app-updates)\/[^/]+\/[^/]+\/latest\.json$/.test(key)
    || /official\/mobile-packages\/[^/]+\/[^/]+\/(?:games|shared)\/[^/]+\.json$/.test(key)
);

export const extractAssetReferences = (value, output = []) => {
    if (typeof value === 'string') {
        let candidate = '';
        if (/^https?:\/\//i.test(value)) {
            try {
                const url = new URL(value);
                const marker = url.pathname.indexOf('/official/');
                if (marker >= 0) {
                    candidate = decodeURIComponent(url.pathname.slice(marker + 1));
                }
            } catch {
                return output;
            }
        } else if (value.startsWith('official/')) {
            candidate = value;
        }

        if (candidate) {
            output.push(candidate.replace(/^\/+/, ''));
        }
        return output;
    }

    if (Array.isArray(value)) {
        for (const item of value) {
            extractAssetReferences(item, output);
        }
        return output;
    }

    if (value && typeof value === 'object') {
        for (const item of Object.values(value)) {
            extractAssetReferences(item, output);
        }
    }
    return output;
};

export const resolveActiveAssetSet = async ({ objects, readJson }) => {
    const roots = [...objects.keys()].filter(isActiveRootKey).sort();
    const active = new Set();
    const unresolved = new Set();
    const queue = [...roots];

    while (queue.length > 0) {
        const key = queue.shift();
        if (!key || active.has(key)) continue;
        if (!objects.has(key)) {
            unresolved.add(key);
            continue;
        }

        active.add(key);
        if (!key.endsWith('.json')) continue;

        const parsed = await readJson(key);
        for (const reference of extractAssetReferences(parsed)) {
            if (!active.has(reference)) {
                queue.push(reference);
            }
        }
    }

    return {
        active,
        roots,
        unresolved,
    };
};

export const createActiveFingerprint = (active, objects) => {
    const hash = createHash('sha256');
    for (const key of [...active].sort()) {
        const metadata = objects.get(key);
        hash.update(`${key}\0${metadata.size}\0${metadata.modTime}\n`);
    }
    return hash.digest('hex');
};

const parseArgs = (args) => {
    const readValue = (name, fallback) => {
        const direct = args.find((arg) => arg.startsWith(`--${name}=`));
        if (direct) return direct.slice(name.length + 3);
        const index = args.indexOf(`--${name}`);
        return index >= 0 && args[index + 1] ? args[index + 1] : fallback;
    };
    const parsePositiveInteger = (name, fallback) => {
        const value = Number.parseInt(readValue(name, String(fallback)), 10);
        if (!Number.isFinite(value) || value <= 0) {
            throw new Error(`参数 --${name} 必须是正整数`);
        }
        return value;
    };

    return {
        remote: readValue('remote', DEFAULT_REMOTE).replace(/\/+$/, ''),
        assetsRoot: path.resolve(readValue('assets-root', DEFAULT_ASSETS_ROOT)),
        bwlimit: readValue('bwlimit', '4M'),
        retainManagedReleases: parsePositiveInteger('retain-managed-releases', 2),
        maxActiveBytes: parsePositiveInteger('max-active-bytes', DEFAULT_MAX_ACTIVE_BYTES),
        minFreeBytes: parsePositiveInteger('min-free-bytes', DEFAULT_MIN_FREE_BYTES),
    };
};

const runCommand = (command, args, options = {}) => new Promise((resolve, reject) => {
    const child = spawn(command, args, {
        cwd: options.cwd,
        env: process.env,
        windowsHide: true,
        shell: false,
    });
    let stdout = '';
    let stderr = '';
    child.stdout.on('data', (chunk) => {
        stdout += chunk.toString('utf8');
    });
    child.stderr.on('data', (chunk) => {
        stderr += chunk.toString('utf8');
    });
    child.on('error', reject);
    child.on('exit', (code) => {
        if (code === 0) {
            resolve(stdout);
            return;
        }
        reject(new Error(`${command} ${args.join(' ')} 失败（${code ?? 'unknown'}）\n${stderr.trim()}`));
    });
});

const discoverRootObjects = async (remote) => {
    const roots = new Map();
    for (const rule of ROOT_DISCOVERY_RULES) {
        const args = [
            'lsf',
            `${remote}/${rule.prefix}`,
            '--recursive',
            '--files-only',
            '--format',
            'pst',
            '--separator',
            '|',
        ];
        for (const pattern of rule.includes) {
            args.push('--include', pattern);
        }
        const raw = await runCommand('rclone', args);
        for (const line of raw.split(/\r?\n/)) {
            if (!line.trim()) continue;
            const [relativePath, size, modTime] = line.split('|');
            roots.set(`${rule.prefix}${relativePath}`, {
                size: Number(size),
                modTime,
                hash: '',
            });
        }
    }
    return roots;
};

const statRemoteObject = async (remote, key) => {
    const raw = await runCommand('rclone', [
        'lsjson',
        '--stat',
        `${remote}/${key}`,
        '--no-mimetype',
    ]);
    const item = JSON.parse(raw);
    return {
        size: Number(item.Size ?? 0),
        modTime: item.ModTime || '',
        hash: '',
    };
};

const readRemoteJson = async (remote, key) => {
    const raw = await runCommand('rclone', ['cat', `${remote}/${key}`]);
    return JSON.parse(raw);
};

const resolveRemoteActiveAssetSet = async ({ remote, rootObjects }) => {
    const objects = new Map(rootObjects);
    const roots = [...rootObjects.keys()].sort();
    const active = new Set();
    const unresolved = new Set();
    const queue = [...roots];

    while (queue.length > 0) {
        const key = queue.shift();
        if (!key || active.has(key)) continue;

        if (!objects.has(key)) {
            try {
                objects.set(key, await statRemoteObject(remote, key));
            } catch {
                unresolved.add(key);
                continue;
            }
        }

        active.add(key);
        if (!key.endsWith('.json')) continue;

        const parsed = await readRemoteJson(remote, key);
        for (const reference of extractAssetReferences(parsed)) {
            if (!active.has(reference)) {
                queue.push(reference);
            }
        }
    }

    return {
        active,
        objects,
        roots,
        unresolved,
    };
};

const readReleaseMetadata = async (releasePath) => {
    if (!releasePath) return null;
    try {
        return JSON.parse(await readFile(path.join(releasePath, '.active-release.json'), 'utf8'));
    } catch {
        return null;
    }
};

const metadataIdentity = (metadata) => (
    metadata
        ? `${metadata.size}\0${metadata.modTime}`
        : ''
);

const ensureDiskBudget = async ({ assetsRoot, activeBytes, maxActiveBytes, minFreeBytes }) => {
    if (activeBytes > maxActiveBytes) {
        throw new Error(`当前引用集合 ${activeBytes} bytes 超过服务器活动包上限 ${maxActiveBytes} bytes`);
    }
    const disk = await statfs(assetsRoot);
    const freeBytes = Number(disk.bavail) * Number(disk.bsize);
    if (freeBytes - activeBytes < minFreeBytes) {
        throw new Error(
            `服务器磁盘余量不足：available=${freeBytes}, active=${activeBytes}, requiredFree=${minFreeBytes}`,
        );
    }
};

const removeChangedHardlinks = async ({ stagingPath, active, objects, previousMetadata }) => {
    const previousObjects = previousMetadata?.objects || {};
    const previousKeys = new Set(previousMetadata?.keys || []);
    const changedKeys = new Set();

    for (const key of previousKeys) {
        if (!active.has(key)) {
            await rm(path.join(stagingPath, key), { force: true });
        }
    }

    for (const key of active) {
        const previous = previousObjects[key];
        const current = objects.get(key);
        if (metadataIdentity(previous) !== metadataIdentity(current)) {
            await rm(path.join(stagingPath, key), { force: true });
            changedKeys.add(key);
        }
    }

    return changedKeys;
};

const validateDownloadedObjects = async ({ stagingPath, active, objects }) => {
    for (const key of active) {
        const fileStats = await stat(path.join(stagingPath, key));
        const expectedSize = objects.get(key).size;
        if (fileStats.size !== expectedSize) {
            throw new Error(`服务器对象大小不一致: ${key}, expected=${expectedSize}, actual=${fileStats.size}`);
        }
    }
};

const switchCurrentRelease = async ({ assetsRoot, finalPath, releaseId }) => {
    const currentLink = path.join(assetsRoot, 'current');
    const temporaryLink = path.join(assetsRoot, `.current-${releaseId}.tmp`);
    await rm(temporaryLink, { force: true });
    await symlink(finalPath, temporaryLink, 'dir');
    await rename(temporaryLink, currentLink);
};

const pruneManagedReleases = async ({ releasesDir, currentPath, retain }) => {
    const candidates = [];
    for (const entry of await readdir(releasesDir, { withFileTypes: true })) {
        if (!entry.isDirectory() || entry.name.endsWith('.staging')) continue;
        const fullPath = path.join(releasesDir, entry.name);
        const metadata = await readReleaseMetadata(fullPath);
        if (!metadata) continue;
        candidates.push({
            fullPath,
            generatedAt: metadata.generatedAt || entry.name,
        });
    }

    candidates.sort((left, right) => right.generatedAt.localeCompare(left.generatedAt));
    const keep = new Set(candidates.slice(0, retain).map((item) => item.fullPath));
    keep.add(currentPath);
    for (const candidate of candidates) {
        if (!keep.has(candidate.fullPath)) {
            await rm(candidate.fullPath, { recursive: true, force: true });
        }
    }
};

const createReleaseId = () => (
    new Date().toISOString().replace(/[-:]/g, '').replace(/\.\d{3}Z$/, 'Z')
);

const main = async () => {
    const options = parseArgs(process.argv.slice(2));
    const releasesDir = path.join(options.assetsRoot, 'releases');
    const controlDir = path.join(options.assetsRoot, 'control');
    const currentLink = path.join(options.assetsRoot, 'current');
    await mkdir(releasesDir, { recursive: true });
    await mkdir(controlDir, { recursive: true });

    let currentPath = null;
    try {
        currentPath = await realpath(currentLink);
    } catch {
        currentPath = null;
    }
    const previousMetadata = await readReleaseMetadata(currentPath);
    const rootObjects = await discoverRootObjects(options.remote);
    const rootKeys = new Set(rootObjects.keys());
    const rootFingerprint = createActiveFingerprint(rootKeys, rootObjects);
    if (previousMetadata?.rootFingerprint === rootFingerprint) {
        console.log(`activeAssetSync=no-change`);
        console.log(`activeObjectCount=${previousMetadata.keys?.length ?? 0}`);
        console.log(`activeBytes=${previousMetadata.activeBytes ?? 0}`);
        return;
    }

    const resolved = await resolveRemoteActiveAssetSet({
        remote: options.remote,
        rootObjects,
    });
    if (resolved.unresolved.size > 0) {
        throw new Error(`当前清单引用了不存在的对象: ${[...resolved.unresolved].join(', ')}`);
    }

    const activeBytes = [...resolved.active]
        .reduce((total, key) => total + resolved.objects.get(key).size, 0);
    const fingerprint = createActiveFingerprint(resolved.active, resolved.objects);
    await ensureDiskBudget({
        assetsRoot: options.assetsRoot,
        activeBytes,
        maxActiveBytes: options.maxActiveBytes,
        minFreeBytes: options.minFreeBytes,
    });

    const releaseId = createReleaseId();
    const stagingPath = path.join(releasesDir, `${releaseId}.staging`);
    const finalPath = path.join(releasesDir, releaseId);
    const listPath = path.join(controlDir, `active-assets-${releaseId}.txt`);
    await rm(stagingPath, { recursive: true, force: true });

    try {
        if (currentPath) {
            await runCommand('cp', ['-al', `${currentPath}/.`, stagingPath]);
        } else {
            await mkdir(stagingPath, { recursive: true });
        }

        const changedKeys = await removeChangedHardlinks({
            stagingPath,
            active: resolved.active,
            objects: resolved.objects,
            previousMetadata,
        });

        const keys = [...resolved.active].sort();
        const copyKeys = [...changedKeys].sort();
        if (copyKeys.length > 0) {
            await writeFile(listPath, `${copyKeys.join('\n')}\n`, 'utf8');
            await runCommand('rclone', [
                'copy',
                options.remote,
                stagingPath,
                '--files-from-raw',
                listPath,
                '--transfers',
                '2',
                '--checkers',
                '4',
                '--bwlimit',
                options.bwlimit,
                '--no-traverse',
                '--retries',
                '3',
                '--low-level-retries',
                '10',
                '--stats',
                '30s',
                '--stats-one-line',
            ]);
        }

        await validateDownloadedObjects({
            stagingPath,
            active: resolved.active,
            objects: resolved.objects,
        });

        const metadata = {
            schemaVersion: 1,
            releaseId,
            generatedAt: new Date().toISOString(),
            fingerprint,
            rootFingerprint,
            roots: resolved.roots,
            keys,
            activeBytes,
            objects: Object.fromEntries(keys.map((key) => [key, resolved.objects.get(key)])),
        };
        await writeFile(
            path.join(stagingPath, '.active-release.json'),
            `${JSON.stringify(metadata, null, 2)}\n`,
            'utf8',
        );

        await rename(stagingPath, finalPath);
        await switchCurrentRelease({
            assetsRoot: options.assetsRoot,
            finalPath,
            releaseId,
        });
        await pruneManagedReleases({
            releasesDir,
            currentPath: finalPath,
            retain: options.retainManagedReleases,
        });

        console.log(`activeAssetSync=updated`);
        console.log(`releaseId=${releaseId}`);
        console.log(`activeObjectCount=${keys.length}`);
        console.log(`changedObjectCount=${copyKeys.length}`);
        console.log(`activeBytes=${activeBytes}`);
        console.log(`fingerprint=${fingerprint}`);
    } finally {
        await rm(stagingPath, { recursive: true, force: true });
        await rm(listPath, { force: true });
    }
};

const isMain = process.argv[1]
    && import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href;

if (isMain) {
    main().catch((error) => {
        console.error(`[active-asset-sync] ${error instanceof Error ? error.message : String(error)}`);
        process.exit(1);
    });
}
