#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';

const args = parseArgs(process.argv.slice(2));
const profile = args.profile || '';
const dryRun = Boolean(args['dry-run']);
const rootDir = process.cwd();
const nodeModulesDir = path.join(rootDir, 'node_modules');

const profiles = {
    game: {
        required: [
            '@koa/router',
            'dotenv',
            'fast-json-patch',
            'i18next',
            'i18next-browser-languagedetector',
            'i18next-http-backend',
            'jsonwebtoken',
            'koa',
            'koa-bodyparser',
            'mongoose',
            'nanoid',
            'react',
            'react-dom',
            'react-i18next',
            'socket.io',
            'socket.io-msgpack-parser',
            'winston',
            'winston-daily-rotate-file',
        ],
        optional: [],
    },
    api: {
        required: [
            '@aws-sdk/client-s3',
            '@langchain/langgraph',
            '@nestjs/cache-manager',
            '@nestjs/common',
            '@nestjs/config',
            '@nestjs/core',
            '@nestjs/mongoose',
            '@nestjs/platform-express',
            '@nestjs/platform-socket.io',
            '@nestjs/websockets',
            '@sentry/nestjs',
            'bcryptjs',
            'cache-manager-redis-store',
            'class-transformer',
            'class-validator',
            'dotenv',
            'express',
            'fflate',
            'http-proxy-middleware',
            'jsonwebtoken',
            'mime-types',
            'mongoose',
            'nodemailer',
            'reflect-metadata',
            'socket.io-msgpack-parser',
            'winston',
            'winston-daily-rotate-file',
            'yaml',
            'zod',
        ],
        optional: [
            '@flow-host/core',
            'sharp',
        ],
    },
};

if (!profiles[profile]) {
    throw new Error(`--profile must be one of: ${Object.keys(profiles).join(', ')}`);
}

if (!fs.existsSync(nodeModulesDir)) {
    throw new Error(`node_modules not found: ${nodeModulesDir}`);
}

function parseArgs(argv) {
    const parsed = {};
    for (let index = 0; index < argv.length; index += 1) {
        const token = argv[index];
        if (!token.startsWith('--')) continue;
        const key = token.slice(2);
        const next = argv[index + 1];
        if (!next || next.startsWith('--')) {
            parsed[key] = true;
            continue;
        }
        parsed[key] = next;
        index += 1;
    }
    return parsed;
}

function packageDir(packageName) {
    return path.join(nodeModulesDir, ...packageName.split('/'));
}

function readPackageJsonAt(packagePath) {
    const packageJsonPath = path.join(packagePath, 'package.json');
    if (!fs.existsSync(packageJsonPath)) {
        return null;
    }
    return {
        path: packagePath,
        packageJson: JSON.parse(fs.readFileSync(packageJsonPath, 'utf8')),
    };
}

function readPackageJson(packageName) {
    return readPackageJsonAt(packageDir(packageName));
}

function findPackageDir(packageName, fromDir = nodeModulesDir) {
    let currentDir = fromDir;
    while (true) {
        const candidate = path.join(currentDir, 'node_modules', ...packageName.split('/'));
        if (fs.existsSync(path.join(candidate, 'package.json'))) {
            return candidate;
        }

        const parentDir = path.dirname(currentDir);
        if (parentDir === currentDir) {
            return null;
        }
        currentDir = parentDir;
    }
}

function packageNameFromPath(packagePath) {
    const relativePath = path.relative(nodeModulesDir, packagePath).split(path.sep);
    const nodeModulesIndex = relativePath.lastIndexOf('node_modules');
    const packageParts = relativePath.slice(nodeModulesIndex + 1);
    const firstPart = packageParts[0];
    if (firstPart?.startsWith('@')) {
        return `${firstPart}/${packageParts[1]}`;
    }
    return firstPart;
}

function shouldKeepPeer(packageJson, peerName) {
    return packageJson.peerDependenciesMeta?.[peerName]?.optional !== true;
}

function collectRuntimeClosure(requiredRootPackages, optionalRootPackages = []) {
    const keep = new Set();
    const rootPackages = [...requiredRootPackages, ...optionalRootPackages];
    const optionalRoots = new Set(optionalRootPackages);
    const queue = rootPackages.map((packageName) => ({ packageName, fromDir: nodeModulesDir, isRoot: true }));
    const visitedPaths = new Set();
    const missingRoots = [];
    const missingOptionalRoots = [];

    while (queue.length > 0) {
        const item = queue.shift();
        const packageName = item?.packageName;
        if (!packageName) continue;

        const packagePath = item.isRoot ? packageDir(packageName) : findPackageDir(packageName, item.fromDir);
        const packageInfo = packagePath ? readPackageJsonAt(packagePath) : null;
        if (!packageInfo) {
            if (optionalRoots.has(packageName)) {
                missingOptionalRoots.push(packageName);
            } else if (requiredRootPackages.includes(packageName)) {
                missingRoots.push(packageName);
            }
            continue;
        }

        if (visitedPaths.has(packageInfo.path)) continue;
        visitedPaths.add(packageInfo.path);

        keep.add(packageNameFromPath(packageInfo.path));
        const { packageJson } = packageInfo;
        const dependencyGroups = [
            packageJson.dependencies,
            packageJson.optionalDependencies,
        ];
        for (const group of dependencyGroups) {
            for (const dependencyName of Object.keys(group || {})) {
                const dependencyPath = findPackageDir(dependencyName, packageInfo.path);
                if (dependencyPath) {
                    queue.push({ packageName: dependencyName, fromDir: packageInfo.path, isRoot: false });
                }
            }
        }
        for (const peerName of Object.keys(packageJson.peerDependencies || {})) {
            const peerPath = findPackageDir(peerName, packageInfo.path);
            if (shouldKeepPeer(packageJson, peerName) && peerPath) {
                queue.push({ packageName: peerName, fromDir: packageInfo.path, isRoot: false });
            }
        }
    }

    if (missingRoots.length > 0) {
        throw new Error(`Required runtime package(s) missing from node_modules: ${missingRoots.join(', ')}`);
    }
    if (missingOptionalRoots.length > 0) {
        console.warn(`[prune-prod-node-modules] optionalRootMissing=${missingOptionalRoots.join(',')}`);
    }

    return keep;
}

function dirSize(targetPath) {
    let total = 0;
    if (!fs.existsSync(targetPath)) return total;
    for (const entry of fs.readdirSync(targetPath, { withFileTypes: true })) {
        const entryPath = path.join(targetPath, entry.name);
        if (entry.isDirectory()) {
            total += dirSize(entryPath);
        } else if (entry.isFile()) {
            total += fs.statSync(entryPath).size;
        }
    }
    return total;
}

function removePath(targetPath) {
    if (dryRun) return;
    fs.rmSync(targetPath, { recursive: true, force: true });
}

function pruneTopLevelPackages(keep) {
    let removed = 0;
    for (const entry of fs.readdirSync(nodeModulesDir, { withFileTypes: true })) {
        if (!entry.isDirectory()) continue;
        if (entry.name === '.bin') {
            removePath(path.join(nodeModulesDir, entry.name));
            removed += 1;
            continue;
        }
        if (entry.name.startsWith('@')) {
            const scopeDir = path.join(nodeModulesDir, entry.name);
            for (const scopedEntry of fs.readdirSync(scopeDir, { withFileTypes: true })) {
                if (!scopedEntry.isDirectory()) continue;
                const packageName = `${entry.name}/${scopedEntry.name}`;
                if (!keep.has(packageName)) {
                    removePath(path.join(scopeDir, scopedEntry.name));
                    removed += 1;
                }
            }
            if (!dryRun && fs.existsSync(scopeDir) && fs.readdirSync(scopeDir).length === 0) {
                fs.rmdirSync(scopeDir);
            }
            continue;
        }
        if (!keep.has(entry.name)) {
            removePath(path.join(nodeModulesDir, entry.name));
            removed += 1;
        }
    }
    return removed;
}

const beforeBytes = dirSize(nodeModulesDir);
const keep = collectRuntimeClosure(profiles[profile].required, profiles[profile].optional);
const removedCount = pruneTopLevelPackages(keep);
const afterBytes = dryRun ? beforeBytes : dirSize(nodeModulesDir);

console.log(`[prune-prod-node-modules] profile=${profile}`);
console.log(`[prune-prod-node-modules] keepPackages=${keep.size}`);
console.log(`[prune-prod-node-modules] removedTopLevelEntries=${removedCount}`);
console.log(`[prune-prod-node-modules] nodeModulesMB=${(beforeBytes / 1024 / 1024).toFixed(1)} -> ${(afterBytes / 1024 / 1024).toFixed(1)}`);
if (dryRun) {
    console.log('[prune-prod-node-modules] dry-run only; no files removed');
}
