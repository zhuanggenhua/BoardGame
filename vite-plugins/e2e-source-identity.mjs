import fs from 'node:fs';
import path from 'node:path';
import { isFileServingAllowed } from 'vite';
import postcss from 'postcss';
import { captureSourceIdentity, createSourceSessionTracker, hashSourceIdentity, sourceIdentityMatches } from '../scripts/infra/e2e-source-identity.mjs';

const STYLE_FILE_PATTERN = /\.(?:css|scss|sass|less|styl|stylus)$/;

/** Tailwind @source and plugin watch files are scanner inputs, not CSS runtime imports. */
export function getActualModuleImports(filename, graphModule, inlineStyleDependencies) {
    if (STYLE_FILE_PATTERN.test(filename)) {
        return inlineStyleDependencies?.files.map(file => file.path) ?? [];
    }
    return graphModule
        ? [...graphModule.importedModules].map(imported => imported.file).filter(Boolean).map(file => path.resolve(file))
        : [];
}

/** 记录每个浏览器上下文实际收到的源文件，不把其他上下文的依赖并入当前证据。 */
export function e2eSourceIdentityPlugin(enabled = true) {
    let root;
    let publicDir;
    let bootstrap;
    let entry;
    const transformed = new Map();
    const inlineStyles = new Map();
    const sessions = createSourceSessionTracker();
    const startedSessions = new Set();
    return {
        name: 'e2e-source-identity',
        apply: 'serve',
        enforce: 'pre',
        configResolved(config) {
            root = config.root;
            publicDir = config.publicDir;
            // 启动配置及真实导入同样决定响应；不能按所属游戏目录排除配置依赖。
            const inputs = [...config.configFileDependencies, config.configFile,
                path.join(root, 'index.html'), path.join(root, 'package-lock.json')]
                .filter(Boolean)
                .filter(file => fs.existsSync(file));
            bootstrap = captureSourceIdentity(inputs, root);
            const html = fs.readFileSync(path.join(root, 'index.html'), 'utf8');
            const moduleScript = [...html.matchAll(/<script\b([^>]*)>/gi)]
                .map(match => match[1])
                .find(attributes => /\btype\s*=\s*(['"])module\1/i.test(attributes) && /\bsrc\s*=\s*(['"])[^'"]+\1/i.test(attributes));
            const moduleSource = moduleScript?.match(/\bsrc\s*=\s*(['"])([^'"]+)\1/i)?.[2];
            entry = moduleSource
                ? path.resolve(root, decodeURIComponent(moduleSource.split(/[?#]/, 1)[0].replace(/^\//, '')))
                : path.resolve(root, 'index.html');
        },
        async transform(_code, id) {
            if (!enabled) return;
            const file = id.split('?')[0];
            if (!file.includes('node_modules') && fs.existsSync(file) && fs.statSync(file).isFile()) {
                transformed.set(path.resolve(file), captureSourceIdentity([file], root).files[0]);
                if (STYLE_FILE_PATTERN.test(file)) {
                    const dependencies = new Set();
                    const visited = new Set([path.resolve(file)]);
                    const visit = async (filename, code) => {
                        const imports = [];
                        postcss.parse(code, { from: filename }).walkAtRules(/^(import|use|forward)$/, rule => {
                            const match = rule.params.match(/^(?:url\(\s*)?(['"])(.*?)\1/)
                                ?? rule.params.match(/^url\(\s*([^'"\s)]+)/);
                            const specifier = match?.[2] ?? match?.[1];
                            if (specifier && !/^(?:https?:|data:|\/\/)/.test(specifier)) imports.push(specifier);
                        });
                        for (const specifier of imports) {
                            const resolved = await this.resolve(specifier, filename);
                            const dependency = resolved?.id.split('?')[0];
                            if (!dependency || dependency.includes('node_modules') || !fs.existsSync(dependency)) continue;
                            const absolute = path.resolve(dependency);
                            if (visited.has(absolute)) continue;
                            visited.add(absolute);
                            dependencies.add(absolute);
                            await visit(absolute, fs.readFileSync(absolute, 'utf8'));
                        }
                    };
                    await visit(file, _code);
                    // 只记录真实样式导入；Tailwind @source 的扫描观察文件不是 CSS 导入。
                    inlineStyles.set(path.resolve(file), captureSourceIdentity([...dependencies], root));
                }
            }
        },
        configureServer(server) {
            if (!enabled) return;
            server.middlewares.use((request, response, next) => {
                const handle = async () => {
                    const url = new URL(request.url ?? '/', 'http://localhost');
                    const session = request.headers['x-e2e-source-session']
                        ?? request.headers.cookie?.split(';').map(part => part.trim()).find(part => part.startsWith('bg_e2e_source_session='))?.slice('bg_e2e_source_session='.length);
                    if (url.pathname === '/__e2e/source-identity') {
                        if (typeof session !== 'string') { response.statusCode = 400; response.end('Missing source session'); return; }
                        if (request.method === 'DELETE') { sessions.release(session); startedSessions.delete(session); response.end('{}'); return; }
                        const identity = sessions.read(session);
                        const graph = {
                            root,
                            entry,
                            configuration: bootstrap.files.map(file => file.path),
                            imports: identity.imports,
                        };
                        response.setHeader('Content-Type', 'application/json');
                        response.end(JSON.stringify({ ...identity, graphs: [graph], revision: hashSourceIdentity(identity) }));
                        return;
                    }
                    if (typeof session !== 'string') { next(); return; }
                    if (!startedSessions.has(session)) {
                        startedSessions.add(session);
                        let sourceChanged = false;
                        // watcher 关闭时，新会话先刷新已实际转换过的模块，避免先拿旧 CSS 再拿新 TSX。
                        // 这里只失效服务缓存，不把其他会话的模块加入当前证据依赖。
                        for (const [filename, snapshot] of transformed) {
                            if (sourceIdentityMatches({ files: [snapshot] })) continue;
                            sourceChanged = true;
                            for (const node of server.moduleGraph.getModulesByFile(filename.replaceAll('\\', '/')) ?? []) {
                                server.moduleGraph.invalidateModule(node);
                            }
                        }
                        if (sourceChanged) {
                            // Tailwind 等样式插件会从模块内容生成 CSS，导入图不一定存在反向边。
                            for (const filename of transformed.keys()) {
                                if (!/\.(css|scss|sass|less|styl|stylus)$/.test(filename)) continue;
                                for (const node of server.moduleGraph.getModulesByFile(filename.replaceAll('\\', '/')) ?? []) {
                                    server.moduleGraph.invalidateModule(node);
                                }
                            }
                        }
                    }
                    // 与 Vite transformMiddleware 一致区分 JS 注入样式和 <link> 直接样式节点。
                    const directStyle = /\.(css|scss|sass|less|styl|stylus)$/.test(url.pathname)
                        && request.headers.accept?.includes('text/css');
                    const moduleUrl = directStyle && !url.searchParams.has('direct')
                        ? `${request.url}${url.search ? '&' : '?'}direct` : request.url ?? '/';
                    const module = await server.moduleGraph.getModuleByUrl(moduleUrl);
                    const pathname = decodeURIComponent(url.pathname);
                    const candidates = [module?.file,
                        pathname.startsWith('/@fs/') ? pathname.slice(5) : path.resolve(root, `.${pathname}`),
                        publicDir ? path.resolve(publicDir, `.${pathname}`) : null];
                    const file = candidates.find(candidate => candidate && isFileServingAllowed(candidate, server)
                        && !candidate.includes('node_modules')
                        && fs.existsSync(candidate) && fs.statSync(candidate).isFile());
                    if (!file) { next(); return; }
                    const before = captureSourceIdentity([file], root).files[0];
                    const cached = transformed.get(before.path);
                    // 稳定测试关闭 watcher；新上下文请求变更模块时按模块失效缓存，不重启整个服务。
                    const cachedStyles = inlineStyles.get(before.path);
                    if (module && ((cached && cached.hash !== before.hash)
                        || (cachedStyles?.files.length && !sourceIdentityMatches(cachedStyles)))) server.moduleGraph.invalidateModule(module);
                    const writeHead = response.writeHead.bind(response);
                    // 在响应到达浏览器前登记；finish 事件可能晚于浏览器紧接着发起的身份查询。
                    let recorded = false;
                    response.writeHead = (status, ...args) => {
                        if (!recorded && status < 400) {
                            recorded = true;
                            const served = transformed.get(before.path) ?? before;
                            sessions.record(session, bootstrap);
                            sessions.record(session, { files: [served] });
                            if (served.hash !== before.hash) sessions.record(session, { files: [before] });
                            const dependencies = inlineStyles.get(before.path);
                            if (dependencies) sessions.record(session, dependencies);
                            const graphModule = module ?? server.moduleGraph.getModulesByFile(before.path.replaceAll('\\', '/'))?.values().next().value;
                    const moduleImports = getActualModuleImports(before.path, graphModule, dependencies);
                            sessions.recordImports(session, before.path, [
                                ...moduleImports,
                                ...(dependencies?.files.map(file => file.path) ?? []),
                            ]);
                        }
                        return writeHead(status, ...args);
                    };
                    next();
                };
                handle().catch(next);
            });
        },
    };
}
