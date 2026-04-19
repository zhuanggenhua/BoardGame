import { mkdir, rm, writeFile } from 'node:fs/promises';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

type AllPagesItem = {
    pageid: number;
    ns: number;
    title: string;
};

type CategoryItem = {
    title: string;
};

type RevisionSlot = {
    content?: string;
};

type RevisionItem = {
    slots?: {
        main?: RevisionSlot;
    };
};

type PageRecord = {
    pageid: number;
    ns: number;
    title: string;
    categories?: CategoryItem[];
    revisions?: RevisionItem[];
};

type WikiPage = {
    pageId: number;
    title: string;
    url: string;
    namespace: number;
    isRedirect: boolean;
    redirectTarget: string | null;
    categories: string[];
    wikitext: string;
    plainText: string;
};

type WikiDocument = {
    id: string;
    kind: 'wiki-page' | 'wiki-chunk';
    title: string;
    text: string;
    keywords: string[];
    source: string[];
    metadata: Record<string, unknown>;
};

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const repoRoot = resolve(__dirname, '..');
const outputDir = join(repoRoot, 'temp', 'smashup-wiki-kb');
const apiEndpoint = 'https://smashup.fandom.com/api.php';
const wikiBase = 'https://smashup.fandom.com/wiki/';

const headers = {
    'User-Agent': 'Mozilla/5.0 (compatible; BoardGameBot/1.0; +https://smashup.fandom.com/)',
};

const sleep = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

function chunkArray<T>(items: T[], size: number): T[][] {
    const result: T[][] = [];
    for (let index = 0; index < items.length; index += size) {
        result.push(items.slice(index, index + size));
    }
    return result;
}

function normalizeWhitespace(input: string): string {
    return input
        .replace(/\r\n/g, '\n')
        .replace(/[ \t]+\n/g, '\n')
        .replace(/\n{3,}/g, '\n\n')
        .trim();
}

function stripNestedBlocks(input: string, openToken: string, closeToken: string): string {
    let result = '';
    let index = 0;
    let depth = 0;
    while (index < input.length) {
        if (input.startsWith(openToken, index)) {
            depth += 1;
            index += openToken.length;
            continue;
        }
        if (depth > 0 && input.startsWith(closeToken, index)) {
            depth -= 1;
            index += closeToken.length;
            continue;
        }
        if (depth === 0) {
            result += input[index];
        }
        index += 1;
    }
    return result;
}

function decodeEntities(input: string): string {
    return input
        .replace(/&nbsp;/g, ' ')
        .replace(/&amp;/g, '&')
        .replace(/&quot;/g, '"')
        .replace(/&#39;/g, "'")
        .replace(/&lt;/g, '<')
        .replace(/&gt;/g, '>');
}

function wikiToPlainText(wikitext: string): string {
    let text = wikitext;

    text = text.replace(/<!--[\s\S]*?-->/g, ' ');
    text = text.replace(/<ref[^>]*>[\s\S]*?<\/ref>/gi, ' ');
    text = text.replace(/<ref[^/]*\/>/gi, ' ');
    text = text.replace(/<br\s*\/?>/gi, '\n');
    text = text.replace(/<[^>]+>/g, ' ');
    text = text.replace(/\{\|[\s\S]*?\|\}/g, ' ');
    text = stripNestedBlocks(text, '{{', '}}');
    text = text.replace(/\[\[(?:File|Image):[^\]]+\]\]/gi, ' ');
    text = text.replace(/\[\[Category:([^\]]+)\]\]/gi, ' ');
    text = text.replace(/\[\[([^|\]]+)\|([^\]]+)\]\]/g, '$2');
    text = text.replace(/\[\[([^\]]+)\]\]/g, '$1');
    text = text.replace(/\[(https?:\/\/[^\s\]]+)\s+([^\]]+)\]/g, '$2');
    text = text.replace(/\[(https?:\/\/[^\]]+)\]/g, '$1');
    text = text.replace(/'''''/g, '');
    text = text.replace(/'''/g, '');
    text = text.replace(/''/g, '');
    text = text.replace(/^={2,}\s*(.*?)\s*={2,}$/gm, '\n$1\n');
    text = text.replace(/^\*+/gm, '-');
    text = text.replace(/^#+/gm, '-');
    text = text.replace(/^:+/gm, '');
    text = text.replace(/^;+/gm, '');
    text = text.replace(/\{\{!}}/g, '|');
    text = decodeEntities(text);

    return normalizeWhitespace(text);
}

function splitDocument(title: string, text: string, targetSize = 2200): string[] {
    if (text.length <= targetSize) return [text];

    const paragraphs = text.split(/\n\n+/).map(part => part.trim()).filter(Boolean);
    const chunks: string[] = [];
    let current = '';

    for (const paragraph of paragraphs) {
        if ((current + '\n\n' + paragraph).length > targetSize && current.length > 0) {
            chunks.push(current.trim());
            current = paragraph;
            continue;
        }
        current = current.length > 0 ? `${current}\n\n${paragraph}` : paragraph;
    }

    if (current.trim().length > 0) {
        chunks.push(current.trim());
    }

    return chunks.length > 0 ? chunks : [text];
}

function pageUrl(title: string): string {
    return `${wikiBase}${encodeURIComponent(title.replace(/ /g, '_'))}`;
}

function getRedirectTarget(wikitext: string): string | null {
    const match = wikitext.trim().match(/^#redirect\s+\[\[([^\]]+)\]\]/i);
    return match?.[1]?.trim() ?? null;
}

async function fetchJson(params: Record<string, string>, attempts = 3): Promise<unknown> {
    const url = new URL(apiEndpoint);
    for (const [key, value] of Object.entries(params)) {
        url.searchParams.set(key, value);
    }

    let lastError: unknown = null;
    for (let attempt = 1; attempt <= attempts; attempt += 1) {
        try {
            const response = await fetch(url, { headers });
            if (!response.ok) {
                throw new Error(`HTTP ${response.status} ${response.statusText}`);
            }
            return await response.json();
        } catch (error) {
            lastError = error;
            if (attempt < attempts) {
                await sleep(500 * attempt);
            }
        }
    }

    throw lastError;
}

async function fetchAllPages(): Promise<AllPagesItem[]> {
    const pages: AllPagesItem[] = [];
    let apcontinue: string | undefined;

    while (true) {
        const data = await fetchJson({
            action: 'query',
            list: 'allpages',
            aplimit: 'max',
            apnamespace: '0',
            format: 'json',
            ...(apcontinue ? { apcontinue } : {}),
        }) as {
            query?: { allpages?: AllPagesItem[] };
            continue?: { apcontinue?: string };
        };

        pages.push(...(data.query?.allpages ?? []));
        apcontinue = data.continue?.apcontinue;
        if (!apcontinue) break;
        await sleep(150);
    }

    return pages;
}

async function fetchPageDetails(pageIds: number[]): Promise<PageRecord[]> {
    const titles = pageIds.join('|');
    const data = await fetchJson({
        action: 'query',
        prop: 'revisions|categories',
        pageids: titles,
        rvprop: 'content',
        rvslots: 'main',
        cllimit: 'max',
        clshow: '!hidden',
        formatversion: '2',
        format: 'json',
    }) as {
        query?: { pages?: PageRecord[] };
    };

    return data.query?.pages ?? [];
}

async function main() {
    console.log('开始抓取 SmashUp Wiki（MediaWiki API）。');

    await rm(outputDir, { recursive: true, force: true });
    await mkdir(outputDir, { recursive: true });

    const allPages = await fetchAllPages();
    console.log(`已获取页面索引，共 ${allPages.length} 页。`);

    const batches = chunkArray(allPages.map(page => page.pageid), 50);
    const wikiPages: WikiPage[] = [];

    const redirects: Array<{ title: string; target: string; pageId: number }> = [];
    for (let index = 0; index < batches.length; index += 1) {
        const batch = batches[index];
        const details = await fetchPageDetails(batch);

        for (const page of details) {
            const wikitext = page.revisions?.[0]?.slots?.main?.content ?? '';
            const plainText = wikiToPlainText(wikitext);
            const redirectTarget = getRedirectTarget(wikitext);
            wikiPages.push({
                pageId: page.pageid,
                title: page.title,
                url: pageUrl(page.title),
                namespace: page.ns,
                isRedirect: /^#redirect/i.test(wikitext.trim()),
                redirectTarget,
                categories: (page.categories ?? []).map(category => category.title),
                wikitext,
                plainText,
            });
            if (redirectTarget) {
                redirects.push({
                    title: page.title,
                    target: redirectTarget,
                    pageId: page.pageid,
                });
            }
        }

        console.log(`已抓取 ${index + 1}/${batches.length} 批，累计 ${wikiPages.length} 页。`);
        await sleep(150);
    }

    wikiPages.sort((left, right) => left.title.localeCompare(right.title, 'en'));

    const documents: WikiDocument[] = [];
    for (const page of wikiPages) {
        if (page.isRedirect) {
            continue;
        }
        const source = [page.url, `pageid:${page.pageId}`];
        const baseKeywords = [
            page.title,
            ...page.categories.map(category => category.replace(/^Category:/, '')),
        ];

        documents.push({
            id: `wiki-page:${page.pageId}`,
            kind: 'wiki-page',
            title: page.title,
            text: page.plainText,
            keywords: [...new Set(baseKeywords.filter(Boolean))],
            source,
            metadata: {
                pageId: page.pageId,
                categories: page.categories,
                isRedirect: page.isRedirect,
            },
        });

        const chunks = splitDocument(page.title, page.plainText);
        chunks.forEach((chunk, index) => {
            documents.push({
                id: `wiki-chunk:${page.pageId}:${index + 1}`,
                kind: 'wiki-chunk',
                title: `${page.title} / ${index + 1}`,
                text: chunk,
                keywords: [...new Set(baseKeywords.filter(Boolean))],
                source,
                metadata: {
                    pageId: page.pageId,
                    chunkIndex: index + 1,
                    chunkCount: chunks.length,
                    isRedirect: page.isRedirect,
                },
            });
        });
    }

    const stats = {
        generatedAt: new Date().toISOString(),
        pageCount: wikiPages.length,
        redirectCount: redirects.length,
        nonRedirectCount: wikiPages.filter(page => !page.isRedirect).length,
        chunkDocumentCount: documents.filter(document => document.kind === 'wiki-chunk').length,
        pageDocumentCount: documents.filter(document => document.kind === 'wiki-page').length,
        categoryCount: new Set(wikiPages.flatMap(page => page.categories)).size,
        apiEndpoint,
    };

    const note = `# SmashUp Wiki 全量抓取说明

本目录由 \`scripts/crawl-smashup-wiki.ts\` 生成。

## 这次抓取走的链路

- 使用可稳定访问的 MediaWiki \`api.php\`
- 不再走会被 Cloudflare challenge 卡住的 Fandom \`api/v1\` 和直出 HTML 页面
- 页面索引通过 \`list=allpages\`
- 页面正文通过 \`prop=revisions&rvprop=content\`

## 文件说明

- \`pages.json\`：每个 wiki 页的完整原始抓取结果
- \`redirects.json\`：redirect 标题到目标页的别名映射
- \`documents.jsonl\`：适合知识库导入的文档流，包含整页和分块两层
- \`stats.json\`：抓取规模统计
- \`说明.md\`：本说明

## 使用建议

1. 如果是“卡名 / 基地名 / 术语名”这类明确查询，仍然优先命中本地结构化数据。
   - 若先命中的是 redirect 标题，可先查 \`redirects.json\` 归一化到目标页。
2. Wiki 抓取结果更适合补：
   - 规则术语解释
   - FAQ / 勘误 / 相关条目跳转
   - 本地结构化数据里没有的背景页、分类页、专题页
3. 向量化可以建立在这里之上，但不该替代精确检索。
`;

    await Promise.all([
        writeFile(join(outputDir, 'pages.json'), JSON.stringify(wikiPages, null, 2), 'utf-8'),
        writeFile(join(outputDir, 'redirects.json'), JSON.stringify(redirects, null, 2), 'utf-8'),
        writeFile(
            join(outputDir, 'documents.jsonl'),
            documents.map(document => JSON.stringify(document)).join('\n') + '\n',
            'utf-8',
        ),
        writeFile(join(outputDir, 'stats.json'), JSON.stringify(stats, null, 2), 'utf-8'),
        writeFile(join(outputDir, '说明.md'), note, 'utf-8'),
    ]);

    console.log(`已输出到 ${outputDir}`);
    console.log(JSON.stringify(stats, null, 2));
}

main().catch(error => {
    console.error(error);
    process.exitCode = 1;
});
