import fs from 'node:fs';
import path from 'node:path';

/** 在独立可写目录提供静态快照和初始上传数据，避免向只读源码根写入。 */
export function prepareSnapshotRuntimeData(sourceRoot, runtimeRoot) {
    const source = path.resolve(sourceRoot);
    const output = path.resolve(runtimeRoot);
    fs.mkdirSync(path.dirname(output), { recursive: true });
    // 目录属于单次 runtime 实例；存在即拒绝，避免覆盖其他消费者的数据。
    fs.mkdirSync(output);
    const links = [];
    try {
        for (const directory of ['public', 'dist']) {
            const target = path.join(source, directory);
            if (fs.existsSync(target)) {
                const link = path.join(output, directory);
                fs.symlinkSync(target, link, process.platform === 'win32' ? 'junction' : 'dir');
                links.push(link);
            }
        }
        const uploads = path.join(source, 'uploads');
        if (fs.existsSync(uploads)) fs.cpSync(uploads, path.join(output, 'uploads'), { recursive: true, errorOnExist: true, force: false });
        else fs.mkdirSync(path.join(output, 'uploads'));
        for (const relative of ['public/game-data', 'src/games/dicethrone/ui/abilitySlotLayout.ts', 'src/ui-scenes']) {
            const input = path.join(source, relative);
            const destination = path.join(output, relative === 'public/game-data' ? 'layout-data' : relative);
            if (!fs.existsSync(input)) continue;
            fs.mkdirSync(path.dirname(destination), { recursive: true });
            fs.cpSync(input, destination, { recursive: true, errorOnExist: true, force: false });
        }
        return output;
    } catch (error) {
        try {
            // 只清理本次独占创建的目录，并先移除自身创建的链接。
            for (const link of links) {
                if (process.platform === 'win32') fs.rmdirSync(link);
                else fs.unlinkSync(link);
            }
            fs.rmSync(output, { recursive: true, force: true });
        } catch (cleanupError) {
            throw new AggregateError([error, cleanupError], `运行目录准备及清理均失败: ${output}`);
        }
        throw error;
    }
}
