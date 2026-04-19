import { mkdir, readdir, readFile, rm, writeFile } from 'node:fs/promises';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

import { getAllBaseDefs, getAllCardDefs } from '../src/games/smashup/data/cards.ts';
import { FACTION_DISPLAY_NAMES } from '../src/games/smashup/domain/ids.ts';

type LocaleEntry = {
    name?: string;
    abilityText?: string;
    effectText?: string;
};

type LocaleRoot = {
    cards?: Record<string, LocaleEntry>;
};

type SmashupDocument = {
    id: string;
    kind: 'card' | 'titan' | 'base' | 'rule' | 'faction';
    title: string;
    text: string;
    keywords: string[];
    source: string[];
    metadata: Record<string, unknown>;
};

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const repoRoot = resolve(__dirname, '..');
const outputDir = join(repoRoot, 'temp', 'smashup-kb');
const localePath = join(repoRoot, 'public', 'locales', 'zh-CN', 'game-smashup.json');
const rulesDir = join(repoRoot, 'src', 'games', 'smashup', 'rule');

const FACTION_SOURCE_ALIASES: Record<string, string> = {
    minions_of_cthulhu: 'cthulhu',
    minions_of_cthulhu_pod: 'cthulhu_pod',
    miskatonic_university: 'miskatonic',
    miskatonic_university_pod: 'miskatonic_pod',
    giant_ants: 'giant-ants',
    giant_ants_pod: 'giant-ants_pod',
};

const normalizeFactionSourceId = (factionId: string): string => FACTION_SOURCE_ALIASES[factionId] ?? factionId;
const isPodVariant = (id: string): boolean => id.endsWith('_pod');
const baseVariantId = (id: string): string => id.replace(/_pod$/, '');
const toJson = (value: unknown): string => JSON.stringify(value, null, 2);

const uniq = <T>(items: T[]): T[] => [...new Set(items.filter(Boolean as unknown as (item: T) => boolean))];

function keywordParts(...items: Array<string | number | undefined | null>): string[] {
    return uniq(
        items
            .filter((item): item is string | number => item !== undefined && item !== null && `${item}`.trim().length > 0)
            .map(item => `${item}`.trim()),
    );
}

function getLocaleEntry(locale: LocaleRoot, defId: string): LocaleEntry | undefined {
    return locale.cards?.[defId] ?? locale.cards?.[baseVariantId(defId)];
}

function getTextField(type: string): 'abilityText' | 'effectText' {
    return type === 'action' || type === 'titan' ? 'effectText' : 'abilityText';
}

function getCardSourcePath(factionId: string): string {
    return `src/games/smashup/data/factions/${normalizeFactionSourceId(factionId)}.ts`;
}

function stringifyList(items: Array<string | number>): string {
    return items.length > 0 ? items.join(' / ') : '无';
}

function formatRuleChunks(fileName: string, content: string): Array<{ title: string; text: string }> {
    const normalized = content.replace(/\r\n/g, '\n').trim();
    const sections = normalized.split(/\n(?=## )/g).map(section => section.trim()).filter(Boolean);
    if (sections.length === 0) {
        return [{ title: fileName.replace(/\.md$/i, ''), text: normalized }];
    }

    return sections.map((section, index) => {
        const firstLine = section.split('\n')[0]?.trim() ?? '';
        const title = firstLine.startsWith('## ')
            ? `${fileName.replace(/\.md$/i, '')} / ${firstLine.replace(/^##\s+/, '')}`
            : `${fileName.replace(/\.md$/i, '')} / 片段 ${index + 1}`;
        return { title, text: section };
    });
}

async function main() {
    const locale = JSON.parse(await readFile(localePath, 'utf-8')) as LocaleRoot;
    const allCardDefs = getAllCardDefs();
    const allBaseDefs = getAllBaseDefs();

    await rm(outputDir, { recursive: true, force: true });
    await mkdir(outputDir, { recursive: true });

    const cards = allCardDefs
        .filter(def => def.type !== 'titan')
        .map(def => {
            const localeEntry = getLocaleEntry(locale, def.id);
            const textField = getTextField(def.type);
            const text = localeEntry?.[textField] ?? '';
            const factionName = FACTION_DISPLAY_NAMES[def.faction] ?? def.faction;

            const baseRecord = {
                defId: def.id,
                variant: isPodVariant(def.id) ? 'pod' : 'standard',
                type: def.type,
                faction: def.faction,
                factionName,
                nameZh: localeEntry?.name ?? def.name,
                nameEn: 'nameEn' in def ? def.nameEn ?? '' : '',
                abilityTags: 'abilityTags' in def ? def.abilityTags ?? [] : [],
                textField,
                text,
                source: [
                    getCardSourcePath(def.faction),
                    `public/locales/zh-CN/game-smashup.json#cards.${def.id}`,
                ],
            } as Record<string, unknown>;

            if (def.type === 'minion') {
                baseRecord.power = def.power;
                baseRecord.count = def.count;
                baseRecord.playConstraint = def.playConstraint ?? null;
            } else if (def.type === 'action') {
                baseRecord.subtype = def.subtype;
                baseRecord.count = def.count;
                baseRecord.ongoingTarget = def.ongoingTarget ?? null;
                baseRecord.playConstraint = def.playConstraint ?? null;
            } else if (def.type === 'fusion') {
                baseRecord.count = def.count;
                baseRecord.minionPower = def.minionPower;
                baseRecord.actionSubtype = def.actionSubtype;
                baseRecord.minionAbilityTags = def.minionAbilityTags ?? [];
                baseRecord.actionAbilityTags = def.actionAbilityTags ?? [];
            }

            return baseRecord;
        });

    const titans = allCardDefs
        .filter(def => def.type === 'titan')
        .map(def => {
            const localeEntry = getLocaleEntry(locale, def.id);
            return {
                defId: def.id,
                variant: isPodVariant(def.id) ? 'pod' : 'standard',
                type: def.type,
                faction: def.faction,
                factionName: FACTION_DISPLAY_NAMES[def.faction] ?? def.faction,
                nameZh: localeEntry?.name ?? def.name,
                textField: 'effectText',
                text: localeEntry?.effectText ?? '',
                abilityTags: def.abilityTags ?? [],
                summonMode: def.summonMode,
                playAsKinds: def.playAsKinds ?? [],
                source: [
                    'src/games/smashup/data/titans.ts',
                    `public/locales/zh-CN/game-smashup.json#cards.${def.id}`,
                    'src/games/smashup/rule/泰坦机制与卡牌抄录.md',
                ],
            };
        });

    const bases = allBaseDefs.map(def => {
        const localeEntry = getLocaleEntry(locale, def.id);
        return {
            defId: def.id,
            variant: isPodVariant(def.id) ? 'pod' : 'standard',
            type: 'base',
            faction: def.faction ?? '',
            factionName: def.faction ? (FACTION_DISPLAY_NAMES[def.faction] ?? def.faction) : '',
            nameZh: localeEntry?.name ?? def.name,
            nameEn: def.nameEn ?? '',
            breakpoint: def.breakpoint,
            vpAwards: def.vpAwards,
            abilityText: localeEntry?.abilityText ?? '',
            source: [
                'src/games/smashup/data/cards.ts',
                `public/locales/zh-CN/game-smashup.json#cards.${def.id}`,
            ],
        };
    });

    const factionIds = uniq([
        ...cards.map(card => String(card.faction)),
        ...titans.map(card => card.faction),
        ...bases.map(base => base.faction).filter(Boolean),
    ]).sort();

    const factions = factionIds.map(factionId => {
        const factionCards = cards.filter(card => card.faction === factionId);
        const factionTitans = titans.filter(card => card.faction === factionId);
        const factionBases = bases.filter(base => base.faction === factionId);
        return {
            faction: factionId,
            factionName: FACTION_DISPLAY_NAMES[factionId] ?? factionId,
            cardCount: factionCards.length,
            titanCount: factionTitans.length,
            baseCount: factionBases.length,
            cards: factionCards.map(card => card.defId),
            titans: factionTitans.map(card => card.defId),
            bases: factionBases.map(base => base.defId),
            source: uniq([
                getCardSourcePath(factionId),
                ...factionTitans.map(() => 'src/games/smashup/data/titans.ts'),
                ...factionBases.map(() => 'src/games/smashup/data/cards.ts'),
            ]),
        };
    });

    const ruleFiles = (await readdir(rulesDir))
        .filter(fileName => fileName.endsWith('.md'))
        .sort((a, b) => a.localeCompare(b, 'zh-CN'));
    const rules = await Promise.all(
        ruleFiles.map(async fileName => {
            const sourcePath = join(rulesDir, fileName);
            const content = await readFile(sourcePath, 'utf-8');
            return {
                fileName,
                source: `src/games/smashup/rule/${fileName}`,
                content,
                chunks: formatRuleChunks(fileName, content).map((chunk, index) => ({
                    chunkId: `${fileName.replace(/\.md$/i, '')}#${index + 1}`,
                    title: chunk.title,
                    text: chunk.text,
                })),
            };
        }),
    );

    const documents: SmashupDocument[] = [];

    for (const card of cards) {
        const lines = [
            `类型：${card.type}`,
            `名称：${card.nameZh}`,
            `英文名：${card.nameEn || '无'}`,
            `ID：${card.defId}`,
            `派系：${card.factionName} (${card.faction})`,
            `版本：${card.variant}`,
            `数量：${card.count ?? '无'}`,
            `能力标签：${stringifyList((card.abilityTags as string[]) ?? [])}`,
        ];
        if (card.type === 'minion') lines.push(`力量：${card.power}`);
        if (card.type === 'action') lines.push(`子类型：${card.subtype}`);
        if (card.type === 'fusion') {
            lines.push(`融合随从力量：${card.minionPower}`);
            lines.push(`融合行动子类型：${card.actionSubtype}`);
        }
        lines.push(`效果：${card.text || '无正文'}`);
        lines.push(`来源：${stringifyList(card.source as string[])}`);

        documents.push({
            id: `card:${String(card.defId)}`,
            kind: 'card',
            title: `${String(card.nameZh)} (${String(card.defId)})`,
            text: lines.join('\n'),
            keywords: keywordParts(
                String(card.nameZh),
                String(card.nameEn),
                String(card.defId),
                String(card.factionName),
                String(card.faction),
                ...(((card.abilityTags as string[]) ?? [])),
            ),
            source: card.source as string[],
            metadata: {
                type: card.type,
                faction: card.faction,
                variant: card.variant,
            },
        });
    }

    for (const titan of titans) {
        documents.push({
            id: `titan:${titan.defId}`,
            kind: 'titan',
            title: `${titan.nameZh} (${titan.defId})`,
            text: [
                '类型：titan',
                `名称：${titan.nameZh}`,
                `ID：${titan.defId}`,
                `派系：${titan.factionName} (${titan.faction})`,
                `召唤模式：${titan.summonMode}`,
                `能力标签：${stringifyList(titan.abilityTags)}`,
                `效果：${titan.text || '无正文'}`,
                `来源：${stringifyList(titan.source)}`,
            ].join('\n'),
            keywords: keywordParts(
                titan.nameZh,
                titan.defId,
                titan.factionName,
                titan.faction,
                ...titan.abilityTags,
            ),
            source: titan.source,
            metadata: {
                type: 'titan',
                faction: titan.faction,
                summonMode: titan.summonMode,
            },
        });
    }

    for (const base of bases) {
        documents.push({
            id: `base:${base.defId}`,
            kind: 'base',
            title: `${base.nameZh} (${base.defId})`,
            text: [
                '类型：base',
                `名称：${base.nameZh}`,
                `英文名：${base.nameEn || '无'}`,
                `ID：${base.defId}`,
                `派系：${base.factionName || '无'}${base.faction ? ` (${base.faction})` : ''}`,
                `版本：${base.variant}`,
                `临界点：${base.breakpoint}`,
                `VP：${stringifyList(base.vpAwards)}`,
                `基地效果：${base.abilityText || '无正文'}`,
                `来源：${stringifyList(base.source)}`,
            ].join('\n'),
            keywords: keywordParts(base.nameZh, base.nameEn, base.defId, base.factionName, base.faction),
            source: base.source,
            metadata: {
                type: 'base',
                faction: base.faction,
                variant: base.variant,
            },
        });
    }

    for (const faction of factions) {
        documents.push({
            id: `faction:${faction.faction}`,
            kind: 'faction',
            title: `${faction.factionName} (${faction.faction})`,
            text: [
                `派系：${faction.factionName}`,
                `ID：${faction.faction}`,
                `卡牌数量：${faction.cardCount}`,
                `泰坦数量：${faction.titanCount}`,
                `基地数量：${faction.baseCount}`,
                `卡牌列表：${stringifyList(faction.cards)}`,
                `泰坦列表：${stringifyList(faction.titans)}`,
                `基地列表：${stringifyList(faction.bases)}`,
                `来源：${stringifyList(faction.source)}`,
            ].join('\n'),
            keywords: keywordParts(faction.factionName, faction.faction, ...faction.cards, ...faction.titans, ...faction.bases),
            source: faction.source,
            metadata: {
                faction: faction.faction,
                cardCount: faction.cardCount,
                titanCount: faction.titanCount,
                baseCount: faction.baseCount,
            },
        });
    }

    for (const rule of rules) {
        for (const chunk of rule.chunks) {
            documents.push({
                id: `rule:${chunk.chunkId}`,
                kind: 'rule',
                title: chunk.title,
                text: chunk.text,
                keywords: keywordParts(rule.fileName.replace(/\.md$/i, ''), chunk.title, '大杀四方', '规则'),
                source: [rule.source],
                metadata: {
                    fileName: rule.fileName,
                    chunkId: chunk.chunkId,
                },
            });
        }
    }

    const stats = {
        generatedAt: new Date().toISOString(),
        counts: {
            cards: cards.length,
            titans: titans.length,
            bases: bases.length,
            factions: factions.length,
            ruleFiles: rules.length,
            ruleChunks: rules.reduce((sum, rule) => sum + rule.chunks.length, 0),
            documents: documents.length,
        },
        sources: {
            cards: 'src/games/smashup/data/factions/*.ts',
            bases: 'src/games/smashup/data/cards.ts',
            titans: 'src/games/smashup/data/titans.ts',
            locale: 'public/locales/zh-CN/game-smashup.json',
            rules: 'src/games/smashup/rule/*.md',
        },
    };

    const note = `# SmashUp 知识库导出说明

本目录由 \`scripts/export-smashup-kb.ts\` 生成，目标是把大杀四方现有的本地权威数据整理成一套可直接接入知识库或检索层的中间产物。

## 文件说明

- \`cards.json\`：随从 / 战术 / 融合卡的结构化数据
- \`titans.json\`：泰坦结构化数据
- \`bases.json\`：基地结构化数据
- \`factions.json\`：按派系统计的索引数据
- \`rules.json\`：规则 Markdown 文件及分块结果
- \`documents.jsonl\`：适合知识库导入的扁平文档流
- \`stats.json\`：导出规模和来源统计

## 当前建议

1. 第一层必须先做精确检索：
   - 先按卡名 / 基地名 / 派系名 / defId / 关键词命中结构化数据
   - 再查 \`documents.jsonl\` 或规则分块做全文检索
2. 现阶段不建议把“向量化”当主链路：
   - 像“拜亚基没有效果”“王权圣骑士能不能一直加 cp”这类问题，本质上是明确术语检索，不该先走语义相似度
   - 真相源已经在本地结构化数据里，先上向量检索只会增加误召回和不可控解释
3. 向量化可以作为第二层增强：
   - 用于处理模糊口语、同义转述、规则解释、跨文档摘要
   - 但必须建立在“结构化精确命中优先”的前提上

## 结论

知识库现在应该先接“结构化 + 全文”双层检索；向量化不是不要做，而是不该先做，更不该替代精确检索。
`;

    await Promise.all([
        writeFile(join(outputDir, 'cards.json'), toJson(cards), 'utf-8'),
        writeFile(join(outputDir, 'titans.json'), toJson(titans), 'utf-8'),
        writeFile(join(outputDir, 'bases.json'), toJson(bases), 'utf-8'),
        writeFile(join(outputDir, 'factions.json'), toJson(factions), 'utf-8'),
        writeFile(join(outputDir, 'rules.json'), toJson(rules), 'utf-8'),
        writeFile(join(outputDir, 'stats.json'), toJson(stats), 'utf-8'),
        writeFile(join(outputDir, '说明.md'), note, 'utf-8'),
        writeFile(
            join(outputDir, 'documents.jsonl'),
            documents.map(document => JSON.stringify(document)).join('\n') + '\n',
            'utf-8',
        ),
    ]);

    console.log(`已导出到 ${outputDir}`);
    console.log(JSON.stringify(stats, null, 2));
}

main().catch(error => {
    console.error(error);
    process.exitCode = 1;
});
