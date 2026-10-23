import { copyFileSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';

/** Export the canonical canvas UI with a static listing transport for public hosting. */
export function exportStaticViewer({ outputDirectory, webDirectory, publicBaseUrl, viewerUrl, listing }) {
    const base = new URL(publicBaseUrl);
    if (!['http:', 'https:'].includes(base.protocol) || base.username || base.password || base.search || base.hash) {
        throw new Error('公开查看器地址必须是不含凭据和查询参数的 HTTP(S) 目录网址');
    }
    if (!base.pathname.endsWith('/')) base.pathname += '/';
    const registeredUrl = new URL(viewerUrl);
    const directoryKey = registeredUrl.searchParams.get('key');
    if (!directoryKey) throw new Error('缺少查看器实际注册的目录身份');
    const output = path.resolve(outputDirectory);
    mkdirSync(path.join(output, 'media'), { recursive: true });

    const items = listing.items.map(item => {
        const filename = path.basename(item.relativePath);
        if (filename !== item.relativePath) throw new Error('公开导出只接受已注册目录内的媒体文件');
        const relativeUrl = `./media/${encodeURIComponent(filename)}`;
        copyFileSync(item.absolutePath, path.join(output, 'media', filename));
        return {
            relativePath: filename,
            displayTitle: item.displayTitle,
            description: item.description,
            kind: item.kind,
            size: item.size,
            modifiedAt: item.modifiedAt,
            url: relativeUrl,
            absolutePath: new URL(relativeUrl, base).href,
        };
    });
    const payload = {
        ok: true,
        directory: directoryKey,
        requestedDirectory: directoryKey,
        directoryTitle: listing.directoryTitle,
        indexMatchedCount: listing.indexMatchedCount ?? items.length,
        autoSelectedDirectory: false,
        selectedBy: 'registered-directory-export',
        focus: listing.focus ?? null,
        selectedFiles: listing.selectedFiles ?? [],
        maxFiles: listing.maxFiles ?? items.length,
        truncated: listing.truncated ?? false,
        items,
    };
    writeFileSync(path.join(output, 'viewer-data.json'), JSON.stringify(payload, null, 2));
    const html = readFileSync(path.join(webDirectory, 'index.html'), 'utf8')
        .replace('<head>', '<head>\n    <meta name="e2e-viewer-list" content="./viewer-data.json" />')
        .replace('href="/styles.css"', 'href="./styles.css"')
        .replace('src="/app.js"', 'src="./app.js"');
    writeFileSync(path.join(output, 'index.html'), html);
    copyFileSync(path.join(webDirectory, 'app.js'), path.join(output, 'app.js'));
    copyFileSync(path.join(webDirectory, 'styles.css'), path.join(output, 'styles.css'));
    const publicUrl = new URL(base);
    publicUrl.search = registeredUrl.search;
    return { outputDirectory: output, viewerUrl: publicUrl.href, directoryKey, mediaCount: items.length };
}
