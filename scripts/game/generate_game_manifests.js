import { promises as fs } from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const gamesRoot = path.resolve(__dirname, '../../src/games');
const toolsRoot = path.resolve(__dirname, '../../src/tools');

const outputFiles = {
    data: path.join(gamesRoot, 'manifest.generated.ts'),
    client: path.join(gamesRoot, 'manifest.client.generated.tsx'),
    server: path.join(gamesRoot, 'manifest.server.generated.ts'),
    androidOrientationMap: path.resolve(__dirname, '../../android/app/src/main/assets/game-orientation-map.json'),
};

const normalizeLineEndings = (content) => content.replace(/\r\n/g, '\n');

const writeFileIfChanged = async (outputPath, content) => {
    try {
        const existing = await fs.readFile(outputPath, 'utf8');
        if (normalizeLineEndings(existing) === normalizeLineEndings(content)) {
            return false;
        }
    } catch {
        // 文件不存在时直接写入
    }

    await fs.writeFile(outputPath, content, 'utf8');
    return true;
};

const fileExists = async (filePath) => {
    try {
        await fs.access(filePath);
        return true;
    } catch {
        return false;
    }
};

const toImportPath = (relativePath) => {
    const normalized = relativePath.split(path.sep).join('/');
    const withoutExt = normalized.replace(/\.(ts|tsx)$/, '');
    return withoutExt.startsWith('.') ? withoutExt : `./${withoutExt}`;
};

const readManifestMeta = async (manifestPath) => {
    const content = await fs.readFile(manifestPath, 'utf8');
    const idMatch = content.match(/id\s*:\s*['"`]([^'"`]+)['"`]/);
    const typeMatch = content.match(/type\s*:\s*['"`](game|tool)['"`]/);
    const enabledMatch = content.match(/enabled\s*:\s*(true|false)/);
    const aiCaptureMatch = content.match(/capture\s*:\s*(true|false)/);
    const aiLocalMatch = content.match(/localAi\s*:\s*(true|false)/);
    const aiRemoteMatch = content.match(/remoteAi\s*:\s*(true|false)/);
    const mobileProfileMatch = content.match(/mobileProfile\s*:\s*['"`](none|landscape-adapted|portrait-adapted|tablet-only)['"`]/);
    const preferredOrientationMatch = content.match(/preferredOrientation\s*:\s*['"`](landscape|portrait)['"`]/);
    const mobileLayoutPresetMatch = content.match(/mobileLayoutPreset\s*:\s*['"`](board-shell|portrait-simple|map-shell)['"`]/);
    const shellTargetsMatch = content.match(/shellTargets\s*:\s*\[[\s\S]*?\]/);
    if (!idMatch || !typeMatch || !enabledMatch) {
        throw new Error(`[Manifest] 无法解析 manifest: ${manifestPath}`);
    }
    const enabled = enabledMatch[1] === 'true';
    if (enabled && (!aiCaptureMatch || !aiLocalMatch || !aiRemoteMatch)) {
        throw new Error(`[Manifest] enabled manifest 缂哄皯 ai.capture/localAi/remoteAi: ${manifestPath}`);
    }
    if (enabled && !mobileProfileMatch) {
        throw new Error(`[Manifest] enabled manifest 缺少 mobileProfile: ${manifestPath}`);
    }
    if (enabled && !shellTargetsMatch) {
        throw new Error(`[Manifest] enabled manifest 缺少 shellTargets: ${manifestPath}`);
    }
    if (
        enabled
        && mobileProfileMatch
        && mobileProfileMatch[1] !== 'none'
        && !preferredOrientationMatch
    ) {
        throw new Error(`[Manifest] 非 none 的 mobileProfile 必须显式声明 preferredOrientation: ${manifestPath}`);
    }
    if (
        enabled
        && mobileProfileMatch
        && ['landscape-adapted', 'portrait-adapted'].includes(mobileProfileMatch[1])
        && !mobileLayoutPresetMatch
    ) {
        throw new Error(`[Manifest] 自适配 mobileProfile 必须显式声明 mobileLayoutPreset: ${manifestPath}`);
    }
    return {
        id: idMatch[1],
        type: typeMatch[1],
        enabled,
        preferredOrientation: preferredOrientationMatch ? preferredOrientationMatch[1] : null,
    };
};

const collectManifestEntriesFromRoot = async ({ rootPath, rootLabel }) => {
    let dirents = [];
    try {
        dirents = await fs.readdir(rootPath, { withFileTypes: true });
    } catch (error) {
        if (error?.code === 'ENOENT') {
            return [];
        }
        throw error;
    }

    const entries = [];

    for (const dirent of dirents) {
        if (!dirent.isDirectory()) continue;
        const dirName = dirent.name;
        if (dirName.startsWith('.')) continue;

        const dirPath = path.join(rootPath, dirName);
        const manifestPath = path.join(dirPath, 'manifest.ts');
        if (!(await fileExists(manifestPath))) {
            continue;
        }

        const meta = await readManifestMeta(manifestPath);
        if (meta.id !== dirName) {
            throw new Error(`[Manifest] manifest.id 与目录名不一致: ${dirName} (${meta.id})`);
        }
        if (rootLabel === 'games' && meta.type !== 'game') {
            throw new Error(`[Manifest] 工具 manifest 应放在 src/tools: ${dirName}`);
        }
        if (rootLabel === 'tools' && meta.type !== 'tool') {
            throw new Error(`[Manifest] 游戏 manifest 应放在 src/games: ${dirName}`);
        }

        const gamePath = path.join(dirPath, 'game.ts');
        const boardPath = path.join(dirPath, 'Board.tsx');
        const tutorialPath = path.join(dirPath, 'tutorial.ts');
        const criticalImageResolverPath = path.join(dirPath, 'criticalImageResolver.ts');
        const thumbnailPath = path.join(dirPath, 'thumbnail.tsx');
        const latencyConfigPath = path.join(dirPath, 'latencyConfig.ts');
        const runtimeAdapterPath = path.join(dirPath, 'runtimeAdapter.tsx');

        const hasGame = await fileExists(gamePath);
        const hasBoard = await fileExists(boardPath);
        const hasTutorial = await fileExists(tutorialPath);
        const hasCriticalImageResolver = await fileExists(criticalImageResolverPath);
        const hasThumbnail = await fileExists(thumbnailPath);
        const hasLatencyConfig = await fileExists(latencyConfigPath);
        const hasRuntimeAdapter = await fileExists(runtimeAdapterPath);

        let latencyConfigExportName = null;
        let criticalImageResolverExportName = null;
        let runtimeAdapterExportName = null;
        if (hasLatencyConfig) {
            const content = await fs.readFile(latencyConfigPath, 'utf8');
            const match = content.match(/export\s+const\s+(\w+LatencyConfig)\b/);
            latencyConfigExportName = match ? match[1] : null;
        }
        if (hasCriticalImageResolver) {
            const content = await fs.readFile(criticalImageResolverPath, 'utf8');
            const match = content.match(/export\s+(?:const|function)\s+(\w+CriticalImageResolver)\b/);
            criticalImageResolverExportName = match ? match[1] : null;
        }
        if (hasRuntimeAdapter) {
            const content = await fs.readFile(runtimeAdapterPath, 'utf8');
            const match = content.match(/export\s+const\s+(\w+GameRuntimeAdapter)\b/);
            runtimeAdapterExportName = match ? match[1] : null;
        }

        if (meta.type === 'game' && (!hasGame || !hasBoard)) {
            throw new Error(`[Manifest] 游戏缺少实现: ${dirName} (game.ts/Board.tsx)`);
        }

        entries.push({
            id: meta.id,
            type: meta.type,
            enabled: meta.enabled,
            preferredOrientation: meta.preferredOrientation,
            dirName,
            manifestImport: toImportPath(path.relative(gamesRoot, manifestPath)),
            gameImport: hasGame ? toImportPath(path.relative(gamesRoot, gamePath)) : null,
            boardImport: hasBoard ? toImportPath(path.relative(gamesRoot, boardPath)) : null,
            tutorialImport: hasTutorial ? toImportPath(path.relative(gamesRoot, tutorialPath)) : null,
            criticalImageResolverImport: hasCriticalImageResolver
                ? toImportPath(path.relative(gamesRoot, criticalImageResolverPath))
                : null,
            criticalImageResolverExportName,
            thumbnailImport: hasThumbnail ? toImportPath(path.relative(gamesRoot, thumbnailPath)) : null,
            latencyConfigImport: hasLatencyConfig && latencyConfigExportName ? toImportPath(path.relative(gamesRoot, latencyConfigPath)) : null,
            latencyConfigExportName,
            runtimeAdapterImport: hasRuntimeAdapter && runtimeAdapterExportName ? toImportPath(path.relative(gamesRoot, runtimeAdapterPath)) : null,
            runtimeAdapterExportName,
        });
    }

    return entries;
};

const collectGameEntries = async () => {
    const entries = [
        ...await collectManifestEntriesFromRoot({ rootPath: gamesRoot, rootLabel: 'games' }),
        ...await collectManifestEntriesFromRoot({ rootPath: toolsRoot, rootLabel: 'tools' }),
    ].sort((a, b) => a.id.localeCompare(b.id));

    const seenIds = new Set();
    for (const entry of entries) {
        if (seenIds.has(entry.id)) {
            throw new Error(`[Manifest] 重复 manifest.id: ${entry.id}`);
        }
        seenIds.add(entry.id);
    }

    return entries;
};

const buildDataManifestFile = ({ entries, outputPath }) => {
    const lines = [];
    lines.push(`// AUTO-GENERATED by scripts/game/generate_game_manifests.js. DO NOT EDIT.`);
    lines.push(`import type { GameManifestEntry } from './manifest.types';`);
    lines.push('');
    entries.forEach((entry, index) => {
        lines.push(`import entry${index} from '${entry.manifestImport}';`);
    });
    lines.push('');
    lines.push('export const GAME_MANIFEST: GameManifestEntry[] = [');
    entries.forEach((_, index) => {
        lines.push(`    entry${index},`);
    });
    lines.push('];');
    lines.push('');
    lines.push('export const GAME_MANIFEST_BY_ID: Record<string, GameManifestEntry> = Object.fromEntries(');
    lines.push('    GAME_MANIFEST.map((entry) => [entry.id, entry])');
    lines.push(');');
    lines.push('');

    return writeFileIfChanged(outputPath, lines.join('\n'));
};

const buildClientManifestFile = ({ entries, outputPath }) => {
    const needsFallbackThumbnail = entries.some((entry) => !entry.thumbnailImport);
    const lines = [];
    lines.push('/* eslint-disable react-refresh/only-export-components */');
    lines.push(`// AUTO-GENERATED by scripts/game/generate_game_manifests.js. DO NOT EDIT.`);
    lines.push(`import type { GameClientManifestEntry, GameClientRuntimeModule } from './manifest.client.types';`);
    lines.push(`import { requireLazyModuleExport } from '../lib/lazyModuleExport';`);
    if (needsFallbackThumbnail) {
        lines.push(`import { ManifestGameThumbnail } from '../components/lobby/thumbnails';`);
    }
    lines.push('');

    entries.forEach((entry, index) => {
        lines.push(`import manifest${index} from '${entry.manifestImport}';`);
        if (entry.thumbnailImport) {
            lines.push(`import Thumbnail${index} from '${entry.thumbnailImport}';`);
        }
        lines.push('');
    });

    entries.forEach((entry, index) => {
        if (entry.gameImport && entry.boardImport) {
            lines.push(`const loadRuntime${index} = async (): Promise<GameClientRuntimeModule> => {`);
            lines.push(`    const [gameModule, boardModule${entry.latencyConfigImport ? ', latencyModule' : ''}${entry.runtimeAdapterImport ? ', runtimeAdapterModule' : ''}] = await Promise.all([`);
            lines.push(`        import('${entry.gameImport}'),`);
            lines.push(`        import('${entry.boardImport}'),`);
            if (entry.latencyConfigImport) {
                lines.push(`        import('${entry.latencyConfigImport}'),`);
            }
            if (entry.runtimeAdapterImport) {
                lines.push(`        import('${entry.runtimeAdapterImport}'),`);
            }
            lines.push(`    ]);`);
            lines.push(`    return {`);
            lines.push(`        engineConfig: gameModule.engineConfig,`);
            lines.push(`        board: requireLazyModuleExport(boardModule, 'default', '${entry.boardImport}'),`);
            lines.push(`        audioConfig: gameModule.audioConfig,`);
            if (entry.latencyConfigImport) {
                lines.push(`        latencyConfig: latencyModule.${entry.latencyConfigExportName},`);
            }
            if (entry.runtimeAdapterImport) {
                lines.push(`        runtimeAdapter: runtimeAdapterModule.${entry.runtimeAdapterExportName},`);
            }
            lines.push(`    };`);
            lines.push(`};`);
            lines.push('');
        }
        if (entry.tutorialImport) {
            lines.push(`const loadTutorial${index} = async () => {`);
            lines.push(`    const tutorialModule = await import('${entry.tutorialImport}');`);
            lines.push(`    return tutorialModule.default;`);
            lines.push(`};`);
            lines.push('');
        }
        if (entry.criticalImageResolverImport) {
            lines.push(`const loadCriticalImageResolver${index} = async () => {`);
            lines.push(`    const resolverModule = await import('${entry.criticalImageResolverImport}');`);
            if (entry.criticalImageResolverExportName) {
                lines.push(`    return resolverModule.default ?? resolverModule.${entry.criticalImageResolverExportName};`);
            } else {
                lines.push(`    return resolverModule.default;`);
            }
            lines.push(`};`);
            lines.push('');
        }
    });

    entries.forEach((entry, index) => {
        lines.push(`const entry${index}: GameClientManifestEntry = {`);
        lines.push(`    manifest: manifest${index},`);
        if (entry.thumbnailImport) {
            lines.push(`    thumbnail: <Thumbnail${index} />,`);
        } else {
            lines.push(`    thumbnail: <ManifestGameThumbnail manifest={manifest${index}} />,`);
        }
        if (entry.gameImport && entry.boardImport) {
            lines.push(`    loadRuntime: loadRuntime${index},`);
        }
        if (entry.tutorialImport) {
            lines.push(`    loadTutorial: loadTutorial${index},`);
        }
        if (entry.criticalImageResolverImport) {
            lines.push(`    loadCriticalImageResolver: loadCriticalImageResolver${index},`);
        }
        lines.push('};');
        lines.push('');
    });

    lines.push('export const GAME_CLIENT_MANIFEST: GameClientManifestEntry[] = [');
    entries.forEach((_, index) => {
        lines.push(`    entry${index},`);
    });
    lines.push('];');
    lines.push('');
    lines.push('export const GAME_CLIENT_MANIFEST_BY_ID: Record<string, GameClientManifestEntry> = Object.fromEntries(');
    lines.push('    GAME_CLIENT_MANIFEST.map((entry) => [entry.manifest.id, entry])');
    lines.push(');');
    lines.push('');

    return writeFileIfChanged(outputPath, lines.join('\n'));
};

const buildServerManifestFile = ({ entries, outputPath }) => {
    const lines = [];
    lines.push(`// AUTO-GENERATED by scripts/game/generate_game_manifests.js. DO NOT EDIT.`);
    lines.push(`import type { GameServerManifestEntry } from './manifest.server.types';`);
    lines.push('');

    entries.forEach((entry, index) => {
        lines.push(`import manifest${index} from '${entry.manifestImport}';`);
        lines.push(`import { engineConfig as engineConfig${index} } from '${entry.gameImport}';`);
    });
    lines.push('');

    entries.forEach((_, index) => {
        lines.push(`const entry${index}: GameServerManifestEntry = {`);
        lines.push(`    manifest: manifest${index},`);
        lines.push(`    engineConfig: engineConfig${index},`);
        lines.push('};');
        lines.push('');
    });

    lines.push('export const GAME_SERVER_MANIFEST: GameServerManifestEntry[] = [');
    entries.forEach((_, index) => {
        lines.push(`    entry${index},`);
    });
    lines.push('];');
    lines.push('');
    lines.push('export const GAME_SERVER_MANIFEST_BY_ID: Record<string, GameServerManifestEntry> = Object.fromEntries(');
    lines.push('    GAME_SERVER_MANIFEST.map((entry) => [entry.manifest.id, entry])');
    lines.push(');');
    lines.push('');

    return writeFileIfChanged(outputPath, lines.join('\n'));
};

const buildAndroidOrientationMapFile = ({ entries, outputPath }) => {
    const map = Object.fromEntries(
        entries
            .filter((entry) => entry.enabled)
            .map((entry) => [entry.id, entry.preferredOrientation ?? 'landscape']),
    );
    return writeFileIfChanged(outputPath, `${JSON.stringify(map, null, 2)}\n`);
};

const run = async () => {
    const entries = await collectGameEntries();
    const clientEntries = entries;
    const serverEntries = entries.filter((entry) => entry.type === 'game' && entry.gameImport);
    const androidEntries = entries.filter((entry) => entry.type === 'game');

    const dataUpdated = await buildDataManifestFile({ entries: clientEntries, outputPath: outputFiles.data });
    const clientUpdated = await buildClientManifestFile({ entries: clientEntries, outputPath: outputFiles.client });
    const serverUpdated = await buildServerManifestFile({ entries: serverEntries, outputPath: outputFiles.server });
    const androidOrientationMapUpdated = await buildAndroidOrientationMapFile({ entries: androidEntries, outputPath: outputFiles.androidOrientationMap });

    console.log('[Manifest] Generated manifests:');
    console.log(`- ${path.relative(process.cwd(), outputFiles.data)} ${dataUpdated ? '(updated)' : '(unchanged)'}`);
    console.log(`- ${path.relative(process.cwd(), outputFiles.client)} ${clientUpdated ? '(updated)' : '(unchanged)'}`);
    console.log(`- ${path.relative(process.cwd(), outputFiles.server)} ${serverUpdated ? '(updated)' : '(unchanged)'}`);
    console.log(`- ${path.relative(process.cwd(), outputFiles.androidOrientationMap)} ${androidOrientationMapUpdated ? '(updated)' : '(unchanged)'}`);
};

run().catch((error) => {
    console.error('[Manifest] Generation failed:', error);
    process.exit(1);
});
