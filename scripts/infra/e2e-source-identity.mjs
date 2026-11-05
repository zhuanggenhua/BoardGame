import fs from 'node:fs';
import path from 'node:path';
import { createHash } from 'node:crypto';
import { buildSync } from 'esbuild';
import postcss from 'postcss';

const STYLE_FILE_PATTERN = /\.(?:css|scss|sass|less|styl|stylus)$/i;
const STYLE_FILE_EXTENSIONS = ['.css', '.scss', '.sass', '.less', '.styl', '.stylus'];
const FRONTEND_RUNTIME_ENV_KEYS = new Set([
    'ANDROID_FORCE_BUILTIN_BUNDLE',
    'API_SERVER_PORT',
    'API_SERVER_PROXY_TARGET',
    'APP_BUILD_TIME',
    'APP_COMMIT_SHA',
    'APP_RELEASE_CHANNEL',
    'APP_VERSION',
    'BG_DEV_DISABLE_HMR',
    'BG_DEV_DISABLE_HOT_RELOAD',
    'BG_DEV_HOT_RELOAD',
    'BG_DEV_STRICT_PORTS',
    'BG_ENFORCE_PUBLIC_BACKEND_SINGLE_SOURCE',
    'BG_VITE_FORCE_CONFIG_INLINE',
    'CAPACITOR_APP_ID',
    'CAPACITOR_APP_NAME',
    'COMMIT_SHA',
    'E2E_PROXY_QUIET',
    'GAME_SERVER_PORT',
    'GAME_SERVER_PROXY_TARGET',
    'GITHUB_SHA',
    'GIT_COMMIT_SHA',
    'NODE_ENV',
    'PW_SERVER_WATCH',
]);

/** 仅标识 Vite 的实际启动配置导入图；不是整个工作区身份。 */
export function getFrontendSourceHash(cwd = process.cwd(), env = process.env) {
    const configs = fs.readdirSync(cwd).filter(name => /^vite\.config\.[cm]?[jt]s$/.test(name));
    const inputs = configs.length ? Object.keys(buildSync({ absWorkingDir: cwd, entryPoints: configs,
        bundle: true, write: false, metafile: true, platform: 'node', format: 'esm', packages: 'external',
        outdir: 'temp/e2e-config-identity', logLevel: 'silent' }).metafile.inputs) : [];
    for (const name of ['index.html', 'package.json', 'package-lock.json']) {
        if (fs.existsSync(path.join(cwd, name))) inputs.push(name);
    }
    for (const name of fs.readdirSync(cwd).filter(name => /^\.env(?:\..*)?$/.test(name))) {
        inputs.push(name);
    }
    const runtimeEnvironment = Object.entries(env)
        .filter(([name]) => name.startsWith('VITE_') || FRONTEND_RUNTIME_ENV_KEYS.has(name))
        .sort(([left], [right]) => left.localeCompare(right));
    const environmentHash = createHash('sha256');
    for (const [name, value] of runtimeEnvironment) {
        environmentHash.update(name).update('\0').update(String(value ?? '')).update('\0');
    }
    environmentHash.update('e2e-source-identity-plugin\0').update(String(Boolean(env.PW_RUNTIME_SCOPE || env.PW_E2E_SESSION_ID)));

    const identity = captureSourceIdentity(inputs, cwd);
    identity.files.push({ path: '<frontend-runtime-environment>', hash: environmentHash.digest('hex') });
    return hashSourceIdentity(identity);
}

/**
 * 只保留从真实应用入口到目标游戏注册分支的浏览器源码依赖，并保留该会话实际请求的 public 资源。
 * 共享组件沿导入图继续遍历；仅在正式游戏注册表处裁掉未选择的游戏分支。
 */
export function selectFrontendEvidenceIdentity(identity, gameId) {
    return selectGraphEvidenceIdentity(identity, gameId, { includePublicResources: true });
}

export function hashSourceIdentity(identity) {
    const hash = createHash('sha256');
    for (const file of [...identity.files].sort((a, b) => a.path.localeCompare(b.path))) {
        hash.update(file.path).update('\0').update(file.hash).update('\0');
    }
    return hash.digest('hex');
}

/** 按浏览器上下文保存首次实际响应；同一上下文加载了不同版本时明确冲突。 */
export function createSourceSessionTracker() {
    const sessions = new Map();
    return {
        record(session, identity) {
            const state = sessions.get(session) ?? { files: new Map(), conflicts: new Set(), imports: new Map() };
            for (const file of identity.files) {
                const first = state.files.get(file.path);
                if (first && first.hash !== file.hash) state.conflicts.add(file.path);
                if (!first) state.files.set(file.path, file);
            }
            sessions.set(session, state);
        },
        recordImports(session, file, imports) {
            const state = sessions.get(session) ?? { files: new Map(), conflicts: new Set(), imports: new Map() };
            const normalizedImports = [...new Set(imports)].sort();
            const previous = state.imports.get(file);
            state.imports.set(file, [...new Set([...(previous ?? []), ...normalizedImports])].sort());
            sessions.set(session, state);
        },
        read(session) {
            const state = sessions.get(session);
            return {
                files: [...(state?.files.values() ?? [])],
                conflicts: [...(state?.conflicts ?? [])],
                imports: Object.fromEntries(state?.imports ?? []),
            };
        },
        release(session) { sessions.delete(session); },
    };
}

/** 从导入图经过正式游戏注册边界，选择当前游戏实际消费的输入。 */
function selectGraphEvidenceIdentity(identity, gameId, { includePublicResources = false } = {}) {
    if (!gameId || !identity?.graphs?.length) return null;
    const used = new Set();
    const registrationBranches = [];
    const importPathByFile = new Map();
    for (const graph of identity.graphs) {
        const queue = [graph.entry];
        const graphPaths = new Map([[graph.entry, [graph.entry]]]);
        while (queue.length) {
            const file = queue.shift();
            if (used.has(file)) continue;
            used.add(file);
            importPathByFile.set(file, graphPaths.get(file));
            const graphImports = getRuntimeGraphImports(file, graph.imports[file] ?? [], graph.root);
            const selection = selectRegisteredGameImports(file, graphImports, gameId);
            if (selection.boundary) {
                registrationBranches.push({
                    file,
                    boundary: selection.boundary,
                    availableImports: selection.availableImports,
                    selectedImports: selection.imports,
                });
            }
            for (const input of selection.imports) {
                if (graphPaths.has(input)) continue;
                graphPaths.set(input, [...graphPaths.get(file), input]);
                queue.push(input);
            }
        }
        graph.configuration.forEach(file => used.add(file));
    }
    const graphRoots = identity.graphs.map(graph => graph.root).filter(Boolean);
    const isPublicResource = file => includePublicResources && graphRoots.some(root => {
        const publicRoot = path.resolve(root, 'public');
        const relative = path.relative(publicRoot, file);
        return relative !== '' && !relative.startsWith('..') && !path.isAbsolute(relative);
    });
    const files = identity.files.filter(file => used.has(file.path) || isPublicResource(file.path));
    const selectedPaths = new Set(files.map(file => file.path));
    const registeredGameIds = new Set([gameId]);
    for (const branch of registrationBranches) {
        if (branch.boundary !== 'generated-game-manifest') continue;
        for (const input of branch.availableImports) {
            const gameDirectory = path.relative(path.dirname(branch.file), input).split(path.sep)[0];
            if (gameDirectory && gameDirectory !== '..' && gameDirectory !== '.') registeredGameIds.add(gameDirectory);
        }
    }
    const foreignGameFiles = files.flatMap(file => {
        const relativeToGames = graphRoots.map(root => path.relative(path.resolve(root, 'src/games'), file.path))
            .find(relative => relative && !relative.startsWith('..') && !path.isAbsolute(relative));
        if (!relativeToGames) return [];
        const candidateGameId = relativeToGames.split(path.sep)[0];
        if (!registeredGameIds.has(candidateGameId) || candidateGameId === gameId) return [];
        return [{ gameId: candidateGameId, file: file.path, importPath: importPathByFile.get(file.path) ?? [] }];
    });
    return {
        files,
        conflicts: (identity.conflicts ?? []).filter(file => selectedPaths.has(file)),
        scope: {
            gameId,
            graphEntries: identity.graphs.map(graph => graph.entry),
            graphFiles: [...used],
            registrationBranches,
            foreignGameFiles,
        },
    };
}

/** Remove CSS scanner/watch edges while preserving declared stylesheet and url() imports. */
function getRuntimeGraphImports(file, imports, root) {
    if (!STYLE_FILE_PATTERN.test(file)) return imports;
    let source;
    try { source = fs.readFileSync(file, 'utf8'); }
    catch (error) { if (error.code === 'ENOENT') return imports; throw error; }
    const references = new Set();
    const addReference = specifier => {
        const normalized = String(specifier ?? '').trim().replace(/^['"]|['"]$/g, '').split(/[?#]/, 1)[0];
        if (!normalized || /^(?:[a-z][a-z\d+.-]*:|\/\/|#)/i.test(normalized)) return;
        if (!normalized.startsWith('.') && !normalized.startsWith('/')) return;
        const roots = normalized.startsWith('/')
            ? [path.resolve(root, `.${normalized}`), path.resolve(root, 'public', `.${normalized}`)]
            : [path.resolve(path.dirname(file), normalized)];
        for (const candidate of roots) {
            references.add(candidate);
            if (!path.extname(candidate)) {
                for (const extension of STYLE_FILE_EXTENSIONS) references.add(`${candidate}${extension}`);
                for (const extension of STYLE_FILE_EXTENSIONS) references.add(path.join(candidate, `index${extension}`));
            }
        }
    };
    const stylesheet = postcss.parse(source, { from: file });
    stylesheet.walkAtRules(/^(?:import|use|forward)$/i, rule => {
        const value = rule.params.match(/^url\(\s*(['"]?)(.*?)\1\s*\)/i)?.[2]
            ?? rule.params.match(/^\s*(['"])(.*?)\1/)?.[2]
            ?? rule.params.match(/^\s*([^\s;]+)/)?.[1];
        addReference(value);
    });
    stylesheet.walk(node => {
        const value = node.type === 'decl' ? node.value : node.type === 'atrule' ? node.params : '';
        for (const match of value.matchAll(/url\(\s*(['"]?)(.*?)\1\s*\)/gi)) addReference(match[2]);
    });
    return imports.filter(input => references.has(path.resolve(input.split(/[?#]/, 1)[0])));
}

/**
 * These are the project's real game registration points. Shared imports remain in the graph;
 * only sibling game registrations at these points are excluded from a game's identity.
 */
function selectRegisteredGameImports(file, imports, gameId) {
    const normalized = file.replaceAll('\\', '/');
    const isGameManifest = /\/src\/games\/manifest(?:\.(?:server|client))?\.generated\.[cm]?[jt]sx?$/.test(normalized);
    const isPublicSetupRegistry = normalized.endsWith('/src/games/roomSetupRegistry.ts');
    const isCursorRegistry = normalized.endsWith('/src/games/cursorRegistry.ts');
    if (!isGameManifest && !isPublicSetupRegistry && !isCursorRegistry) {
        return { imports, boundary: null, availableImports: [], selectedImports: [] };
    }

    const selectedImports = imports.filter(input => path.relative(path.dirname(file), input).split(path.sep)[0] === gameId);
    return {
        imports: selectedImports,
        boundary: isGameManifest ? 'generated-game-manifest' : isPublicSetupRegistry ? 'public-room-setup-registry' : 'game-cursor-registry',
        availableImports: imports,
        selectedImports,
    };
}

/** From the backend build graph, keep the game branch and shared inputs that it imports. */
export function selectRuntimeSourceIdentity(identity, gameId) {
    if (!gameId || !identity?.graphs?.length) return identity;
    return selectGraphEvidenceIdentity(identity, gameId);
}

/** 前端按当前浏览器实际入口图核对；后端按服务实际打包图核对。 */
export function captureSourceIdentity(inputs, cwd = process.cwd()) {
    const files = [...new Set(inputs)].sort().map(input => {
        const filename = path.resolve(cwd, input);
        return { path: filename, hash: createHash('sha256').update(fs.readFileSync(filename)).digest('hex') };
    });
    return { files };
}

export function sourceIdentityMatches(identity) {
    if (!identity?.files?.length) return false;
    try { return identity.files.every(file => !file.unstable && createHash('sha256').update(fs.readFileSync(file.path)).digest('hex') === file.hash); }
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
    return { files: records.flatMap(record => record.files), graphs: records.map(record => record.graph).filter(Boolean) };
}
