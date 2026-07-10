import { existsSync, readFileSync, readdirSync, rmSync } from 'node:fs';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { SERVER_PUBLISH_MANIFEST_FILE } from './publish-primary-assets.mjs';

const args = process.argv.slice(2);
const readArg = (name, fallback) => {
    const index = args.indexOf(`--${name}`);
    return index >= 0 && args[index + 1] ? args[index + 1] : fallback;
};

const assetsRoot = path.resolve(readArg('assets-root', '/home/admin/storage/assets'));
const remote = readArg('remote', 'r2-boardgame:boardgame-assets');
const maxBytes = Number.parseInt(
    process.env.BG_ASSET_R2_MAX_BYTES || String(9 * 1024 * 1024 * 1024),
    10,
);
const queueRoot = path.join(assetsRoot, 'backup-queue');
if (!existsSync(queueRoot)) {
    console.log('r2BackupQueue=empty');
    process.exit(0);
}

const queueNames = readdirSync(queueRoot, { withFileTypes: true })
    .filter((entry) => entry.isDirectory())
    .map((entry) => entry.name)
    .sort();
if (queueNames.length === 0) {
    console.log('r2BackupQueue=empty');
    process.exit(0);
}

const queueDir = path.join(queueRoot, queueNames[0]);
const manifest = JSON.parse(readFileSync(path.join(queueDir, SERVER_PUBLISH_MANIFEST_FILE), 'utf8'));
const batchBytes = manifest.objects.reduce((total, object) => total + Number(object.size || 0), 0);
const sizeResult = spawnSync('rclone', ['size', remote, '--json'], { encoding: 'utf8' });
if (sizeResult.status !== 0) {
    throw new Error(`读取 R2 容量失败: ${sizeResult.stderr || sizeResult.stdout}`);
}
const currentBytes = Number(JSON.parse(sizeResult.stdout).bytes || 0);
if (currentBytes + batchBytes > maxBytes) {
    console.warn(`r2Backup=deferred-capacity current=${currentBytes} batch=${batchBytes} max=${maxBytes}`);
    process.exit(0);
}

const copyResult = spawnSync('rclone', [
    'copy',
    queueDir,
    remote,
    '--exclude', SERVER_PUBLISH_MANIFEST_FILE,
    '--transfers', '2',
    '--checkers', '4',
    '--bwlimit', '4M',
], { encoding: 'utf8' });
if (copyResult.status !== 0) {
    throw new Error(`R2 灾备上传失败: ${copyResult.stderr || copyResult.stdout}`);
}

rmSync(queueDir, { recursive: true, force: true });
console.log(`r2Backup=completed queue=${queueNames[0]} objects=${manifest.objects.length}`);
