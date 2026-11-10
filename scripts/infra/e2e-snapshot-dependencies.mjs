import fs from 'node:fs';
import path from 'node:path';

function comparable(filename) {
    const normalized = path.resolve(filename);
    return process.platform === 'win32' ? normalized.toLowerCase() : normalized;
}

/** 将 bundle 的裸包解析固定到同一源码快照；不修改已存在的其他版本目录。 */
export function prepareSnapshotDependencies(sourceRoot, bundleRoot) {
    const source = path.resolve(sourceRoot);
    const output = path.resolve(bundleRoot);
    const dependencyRoot = path.join(source, 'node_modules');
    if (!fs.statSync(dependencyRoot).isDirectory()) throw new Error(`快照缺少依赖目录: ${dependencyRoot}`);
    fs.mkdirSync(output, { recursive: true });
    const marker = path.join(output, '.snapshot-source.json');
    if (!fs.existsSync(marker)) {
        if (fs.readdirSync(output).length) throw new Error(`未登记的服务输出目录非空，拒绝覆盖: ${output}`);
        try { fs.writeFileSync(marker, JSON.stringify({ sourceRoot: source }), { flag: 'wx' }); }
        catch (error) { if (error?.code !== 'EEXIST') throw error; }
    }
    const recorded = JSON.parse(fs.readFileSync(marker, 'utf8'));
    if (!recorded?.sourceRoot || comparable(recorded.sourceRoot) !== comparable(source)) {
        throw new Error(`服务输出目录绑定了其他源码快照: ${output}`);
    }
    const link = path.join(output, 'node_modules');
    try { fs.symlinkSync(dependencyRoot, link, process.platform === 'win32' ? 'junction' : 'dir'); }
    catch (error) { if (error?.code !== 'EEXIST') throw error; }
    const stat = fs.lstatSync(link);
    if (!stat.isSymbolicLink() || comparable(fs.readlinkSync(link)) !== comparable(dependencyRoot)) {
        throw new Error(`服务依赖链接不属于当前快照: ${link}`);
    }
    return link;
}
