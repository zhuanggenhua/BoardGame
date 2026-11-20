import { spawn } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = fileURLToPath(new URL('../../', import.meta.url));
const scratch = path.join(root, 'temp');
const cli = fileURLToPath(new URL('./vite-cli-safe.mjs', import.meta.url));
const args = process.argv.slice(2);
if (args.some(arg => arg === '--outDir' || arg.startsWith('--outDir=') ||
    arg === '--config' || arg.startsWith('--config=') || arg === '-c')) {
    throw new Error('本机预览自己管理构建目录和 Vite 配置。');
}

fs.mkdirSync(scratch, { recursive: true });
if (fs.realpathSync.native(scratch) !== path.join(fs.realpathSync.native(root), 'temp')) {
    throw new Error('临时预览目录不能是链接。');
}
const output = fs.mkdtempSync(path.join(scratch, 'local-preview-'));
let child;
let interrupted = false;
const stop = () => {
    interrupted = true;
    child?.kill();
};
process.once('SIGINT', stop);
process.once('SIGTERM', stop);

function vite(command, extraArgs = []) {
    return new Promise((resolve, reject) => {
        const nodeArgs = command === 'build' ? ['--max-old-space-size=8192'] : [];
        child = spawn(process.execPath, [
            ...nodeArgs, cli, command, '--outDir', output, '--configLoader', 'bundle', ...extraArgs,
        ], { cwd: root, stdio: 'inherit' });
        child.once('error', reject);
        child.once('close', (code, signal) => {
            child = undefined;
            if (code === 0 || interrupted) resolve();
            else reject(new Error(`Vite ${command} 退出：${signal ?? code}`));
        });
    });
}

try {
    await vite('build');
    if (!interrupted) await vite('preview', args);
} finally {
    process.removeListener('SIGINT', stop);
    process.removeListener('SIGTERM', stop);
    if (fs.existsSync(output) && fs.realpathSync.native(output) === output) {
        fs.rmSync(output, { recursive: true, force: true, maxRetries: 3 });
    }
}
