import {
    bumpSemver,
    packageJsonPath,
    readJsonFile,
    readProjectVersion,
    updateProjectVersion,
} from './version-utils.mjs';

const args = process.argv.slice(2);

const readArgValue = (name, fallback = '') => {
    const prefix = `--${name}=`;
    const direct = args.find((arg) => arg.startsWith(prefix));
    if (direct) {
        return direct.slice(prefix.length);
    }
    const index = args.findIndex((arg) => arg === `--${name}`);
    if (index >= 0 && args[index + 1]) {
        return args[index + 1];
    }
    return fallback;
};

const hasFlag = (name) => args.includes(`--${name}`);

const helpText = `
项目版本号 bump 工具

用法:
  node scripts/mobile/bump-project-version.mjs --bump patch
  node scripts/mobile/bump-project-version.mjs --set 0.5.3
  node scripts/mobile/bump-project-version.mjs --bump patch --dry-run
`.trim();

if (hasFlag('help') || args.includes('-h')) {
    console.log(helpText);
    process.exit(0);
}

const bumpType = readArgValue('bump', '');
const explicitVersion = readArgValue('set', '');
const dryRun = hasFlag('dry-run');

if (Boolean(bumpType) === Boolean(explicitVersion)) {
    throw new Error('必须且只能提供一种版本变更方式：--bump <patch|minor|major> 或 --set <x.y.z>。');
}

const currentVersion = readProjectVersion();
const currentPackageJson = readJsonFile(packageJsonPath);
const currentAndroidVersionCode = currentPackageJson.androidVersionCode;
const nextVersion = explicitVersion || bumpSemver(currentVersion, bumpType);

if (!dryRun) {
    updateProjectVersion(nextVersion);
}

const nextAndroidVersionCode = dryRun
    ? (
        typeof currentAndroidVersionCode === 'number'
        && Number.isFinite(currentAndroidVersionCode)
        && currentAndroidVersionCode > 0
        && currentVersion !== nextVersion
            ? Math.trunc(currentAndroidVersionCode) + 1
            : currentAndroidVersionCode
    )
    : readJsonFile(packageJsonPath).androidVersionCode;

console.log(dryRun ? '项目版本号预演完成（未写回文件）' : '项目版本号已更新');
console.log(`currentVersion=${currentVersion}`);
console.log(`nextVersion=${nextVersion}`);
if (typeof currentAndroidVersionCode === 'number' && typeof nextAndroidVersionCode === 'number') {
    console.log(`currentAndroidVersionCode=${currentAndroidVersionCode}`);
    console.log(`nextAndroidVersionCode=${nextAndroidVersionCode}`);
}
console.log(`mode=${dryRun ? 'dry-run' : 'write'}`);
