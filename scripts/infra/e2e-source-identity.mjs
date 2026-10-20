import fs from 'node:fs';
import path from 'node:path';
import { createHash } from 'node:crypto';

/** Vite 的稳定测试模式关闭监听，模块缓存也必须与当前前端源码一致。 */
export function getFrontendSourceHash(cwd = process.cwd()) {
    const hash = createHash('sha256');
    const visit = directory => {
        if (!fs.existsSync(directory)) return;
        for (const entry of fs.readdirSync(directory, { withFileTypes: true }).sort((a, b) => a.name.localeCompare(b.name))) {
            const filename = path.join(directory, entry.name);
            if (entry.isDirectory()) { if (!['__tests__', 'node_modules'].includes(entry.name)) visit(filename); }
            else if (entry.isFile() && !/\.(?:test|spec)\.[^.]+$/.test(entry.name)) {
                hash.update(path.relative(cwd, filename)).update('\0').update(fs.readFileSync(filename)).update('\0');
            }
        }
    };
    for (const directory of ['src', 'public/locales', 'plugins', 'vite-plugins', 'scripts/infra']) visit(path.join(cwd, directory));
    const backendUrlConfig = path.join(cwd, 'scripts/mobile/public-backend-url.js');
    if (fs.existsSync(backendUrlConfig)) hash.update(fs.readFileSync(backendUrlConfig));
    for (const name of fs.readdirSync(cwd).filter(name => /^vite\.config\.|^index\.html$/.test(name)).sort()) {
        hash.update(name).update(fs.readFileSync(path.join(cwd, name))).update('\0');
    }
    return hash.digest('hex');
}

/** 后端复用核对实际打包输入；前端缓存身份由独立的源码摘要核对。 */
export function captureSourceIdentity(inputs, cwd = process.cwd()) {
    const files = [...new Set(inputs)].sort().map(input => {
        const filename = path.resolve(cwd, input);
        return { path: filename, hash: createHash('sha256').update(fs.readFileSync(filename)).digest('hex') };
    });
    return { files };
}

export function sourceIdentityMatches(identity) {
    if (!identity?.files?.length) return false;
    try { return identity.files.every(file => createHash('sha256').update(fs.readFileSync(file.path)).digest('hex') === file.hash); }
    catch (error) { if (error.code === 'ENOENT') return false; throw error; }
}

export function readRuntimeSourceIdentity(scope, cwd = process.cwd(), runtime = process.env.PW_SERVER_RUNTIME || 'bundle') {
    const root = path.join(cwd, 'temp/dev-bundles/e2e-single', scope);
    if (runtime !== 'bundle') {
        const inputs = [];
        const visit = directory => {
            if (!fs.existsSync(directory)) return;
            for (const entry of fs.readdirSync(directory, { withFileTypes: true })) {
                const filename = path.join(directory, entry.name);
                if (entry.isDirectory()) visit(filename);
                else if (/\.(?:[cm]?[jt]sx?|json)$/.test(entry.name)) inputs.push(filename);
            }
        };
        for (const directory of ['src', 'apps/api', 'server']) visit(path.join(cwd, directory));
        for (const filename of fs.readdirSync(cwd).filter(name => /^(?:server\.[jt]s|package.*\.json|tsconfig.*\.json|\.env(?:\..*)?)$/.test(name))) inputs.push(path.join(cwd, filename));
        if (runtime === 'prebuilt') visit(path.resolve(cwd, process.env.PW_PREBUILT_BUNDLE_ROOT || 'temp/dev-bundles/e2e-single'));
        return captureSourceIdentity(inputs, cwd);
    }
    const records = ['game/server.mjs', 'api/main.mjs'].map(file => JSON.parse(fs.readFileSync(path.join(root, `${file}.sources.json`), 'utf8')));
    return { files: records.flatMap(record => record.files) };
}
