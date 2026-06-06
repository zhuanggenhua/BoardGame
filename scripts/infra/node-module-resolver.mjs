import fs from 'node:fs';
import path from 'node:path';

function collectWorkspaceRoots(cwd = process.cwd()) {
    const roots = [];
    let current = path.resolve(cwd);

    while (true) {
        roots.push(current);
        const parent = path.dirname(current);
        if (parent === current) {
            break;
        }
        current = parent;
    }

    return roots;
}

function formatCandidates(candidates) {
    return candidates.map(candidate => `- ${candidate}`).join('\n');
}

function deriveNodeModulesRoot(filePath, moduleRelativePath) {
    const depth = moduleRelativePath.split(/[\\/]+/).filter(Boolean).length;
    let current = path.resolve(filePath);
    for (let index = 0; index < depth; index += 1) {
        current = path.dirname(current);
    }
    return current;
}

export function resolveWorkspaceNodeModuleFile(moduleRelativePath, options = {}) {
    const label = options.label ?? moduleRelativePath;
    const cwd = options.cwd ?? process.cwd();
    const explicitPath = options.explicitPath?.trim();

    if (explicitPath) {
        const resolved = path.isAbsolute(explicitPath)
            ? explicitPath
            : path.resolve(cwd, explicitPath);
        if (fs.existsSync(resolved)) {
            const nodeModulesRoot = deriveNodeModulesRoot(resolved, moduleRelativePath);
            return {
                filePath: resolved,
                nodeModulesRoot,
                sourceRoot: path.dirname(nodeModulesRoot),
                usedFallback: false,
            };
        }
    }

    const candidates = collectWorkspaceRoots(cwd)
        .map(root => ({
            sourceRoot: root,
            nodeModulesRoot: path.join(root, 'node_modules'),
            filePath: path.join(root, 'node_modules', moduleRelativePath),
        }));

    const found = candidates.find(candidate => fs.existsSync(candidate.filePath));
    if (found) {
        return {
            ...found,
            usedFallback: path.resolve(found.sourceRoot) !== path.resolve(cwd),
        };
    }

    const checked = candidates.map(candidate => candidate.filePath);
    throw new Error([
        `找不到 ${label}: ${moduleRelativePath}`,
        explicitPath ? `显式路径不存在: ${explicitPath}` : '',
        '已检查:',
        formatCandidates(checked),
        '请在当前 worktree 安装依赖，或把 worktree 放在带有 node_modules 的仓库目录下。',
    ].filter(Boolean).join('\n'));
}

export function prependNodePath(env, nodeModulesRoot) {
    if (!nodeModulesRoot) {
        return { ...env };
    }

    const existing = String(env.NODE_PATH ?? '').trim();
    const parts = existing
        ? existing.split(path.delimiter).filter(Boolean)
        : [];

    if (!parts.some(item => path.resolve(item) === path.resolve(nodeModulesRoot))) {
        parts.unshift(nodeModulesRoot);
    }

    return {
        ...env,
        NODE_PATH: parts.join(path.delimiter),
    };
}
