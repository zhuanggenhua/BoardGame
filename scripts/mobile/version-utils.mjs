import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';

export const rootDir = process.cwd();
export const packageJsonPath = path.join(rootDir, 'package.json');
export const packageLockPath = path.join(rootDir, 'package-lock.json');

export const readJsonFile = (filePath) => JSON.parse(readFileSync(filePath, 'utf8'));

export const writeJsonFile = (filePath, value) => {
    writeFileSync(filePath, `${JSON.stringify(value, null, 2)}\n`, 'utf8');
};

export const readProjectVersion = () => readJsonFile(packageJsonPath).version;

export const parseSemver = (value) => {
    const match = String(value || '').trim().match(/^(\d+)\.(\d+)\.(\d+)$/);
    if (!match) {
        throw new Error(`当前版本不是可 bump 的 x.y.z 形式: ${String(value || '')}`);
    }
    return match.slice(1).map((segment) => Number.parseInt(segment, 10));
};

export const bumpSemver = (value, bumpType) => {
    const [major, minor, patch] = parseSemver(value);
    switch (bumpType) {
        case 'major':
            return `${major + 1}.0.0`;
        case 'minor':
            return `${major}.${minor + 1}.0`;
        case 'patch':
            return `${major}.${minor}.${patch + 1}`;
        default:
            throw new Error(`不支持的 bump 类型: ${bumpType}`);
    }
};

export const updateProjectVersion = (nextVersion) => {
    const packageJson = readJsonFile(packageJsonPath);
    const currentVersion = packageJson.version;
    packageJson.version = nextVersion;
    if (
        currentVersion !== nextVersion
        && typeof packageJson.androidVersionCode === 'number'
        && Number.isFinite(packageJson.androidVersionCode)
        && packageJson.androidVersionCode > 0
    ) {
        packageJson.androidVersionCode = Math.trunc(packageJson.androidVersionCode) + 1;
    }
    writeJsonFile(packageJsonPath, packageJson);

    if (!existsSync(packageLockPath)) {
        return;
    }

    const packageLock = readJsonFile(packageLockPath);
    packageLock.version = nextVersion;
    if (packageLock.packages && typeof packageLock.packages === 'object' && packageLock.packages['']) {
        packageLock.packages[''].version = nextVersion;
    }
    writeJsonFile(packageLockPath, packageLock);
};
