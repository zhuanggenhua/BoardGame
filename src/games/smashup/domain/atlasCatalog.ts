import { SMASHUP_ATLAS_IDS } from './ids';

export type SmashUpAtlasKind = 'card' | 'base';

export interface SmashUpAtlasDefinition {
    id: string;
    kind: SmashUpAtlasKind;
    image: string;
    grid: { rows: number; cols: number };
}

/**
 * SmashUp 图集元数据唯一数据源。
 *
 * - UI 注册（cardAtlas.ts）从这里读取 image + grid。
 * - 关键图片预加载（criticalImageResolver.ts）从这里读取 card/base 图集路径。
 */
export const SMASHUP_ATLAS_DEFINITIONS: readonly SmashUpAtlasDefinition[] = [
    { id: SMASHUP_ATLAS_IDS.CARDS1, kind: 'card', image: 'smashup/cards/cards1', grid: { rows: 6, cols: 8 } },
    { id: SMASHUP_ATLAS_IDS.CARDS2, kind: 'card', image: 'smashup/cards/cards2', grid: { rows: 7, cols: 8 } },
    { id: SMASHUP_ATLAS_IDS.CARDS3, kind: 'card', image: 'smashup/cards/cards3', grid: { rows: 6, cols: 8 } },
    { id: SMASHUP_ATLAS_IDS.CARDS4, kind: 'card', image: 'smashup/cards/cards4', grid: { rows: 6, cols: 8 } },
    { id: SMASHUP_ATLAS_IDS.CARDS5, kind: 'card', image: 'smashup/cards/cards5', grid: { rows: 6, cols: 8 } },

    { id: SMASHUP_ATLAS_IDS.BASE1, kind: 'base', image: 'smashup/base/base1', grid: { rows: 4, cols: 4 } },
    { id: SMASHUP_ATLAS_IDS.BASE2, kind: 'base', image: 'smashup/base/base2', grid: { rows: 2, cols: 4 } },
    { id: SMASHUP_ATLAS_IDS.BASE3, kind: 'base', image: 'smashup/base/base3', grid: { rows: 2, cols: 4 } },
    { id: SMASHUP_ATLAS_IDS.BASE4, kind: 'base', image: 'smashup/base/base4', grid: { rows: 3, cols: 4 } },
];

const atlasById = new Map(SMASHUP_ATLAS_DEFINITIONS.map((atlas) => [atlas.id, atlas] as const));

export function getSmashUpAtlasImageById(atlasId: string): string | undefined {
    return atlasById.get(atlasId)?.image;
}

export function getSmashUpAtlasImagesByKind(kind: SmashUpAtlasKind): string[] {
    return [
        ...new Set(
            SMASHUP_ATLAS_DEFINITIONS
                .filter((atlas) => atlas.kind === kind)
                .map((atlas) => atlas.image),
        ),
    ];
}
