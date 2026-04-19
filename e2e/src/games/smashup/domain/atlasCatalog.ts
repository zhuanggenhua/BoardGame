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
    { id: SMASHUP_ATLAS_IDS.CARDS6, kind: 'card', image: 'smashup/cards/aiji', grid: { rows: 7, cols: 7 } },
    { id: SMASHUP_ATLAS_IDS.CARDS7, kind: 'card', image: 'smashup/cards/wangling', grid: { rows: 5, cols: 9 } },
    { id: SMASHUP_ATLAS_IDS.TITANS, kind: 'card', image: 'smashup/taitan/taitan1', grid: { rows: 7, cols: 3 } },

    { id: SMASHUP_ATLAS_IDS.BASE1, kind: 'base', image: 'smashup/base/base1', grid: { rows: 4, cols: 4 } },
    { id: SMASHUP_ATLAS_IDS.BASE2, kind: 'base', image: 'smashup/base/base2', grid: { rows: 2, cols: 4 } },
    { id: SMASHUP_ATLAS_IDS.BASE3, kind: 'base', image: 'smashup/base/base3', grid: { rows: 2, cols: 4 } },
    { id: SMASHUP_ATLAS_IDS.BASE4, kind: 'base', image: 'smashup/base/base4', grid: { rows: 3, cols: 4 } },
    { id: SMASHUP_ATLAS_IDS.BASE5, kind: 'base', image: 'smashup/base/aiji_base', grid: { rows: 2, cols: 4 } },
    { id: SMASHUP_ATLAS_IDS.BASE6, kind: 'base', image: 'smashup/base/wangling_base', grid: { rows: 3, cols: 2 } },
];

const atlasById = new Map(SMASHUP_ATLAS_DEFINITIONS.map((atlas) => [atlas.id, atlas] as const));

const LOCAL_POD_ATLAS_IMAGE_OVERRIDES: Record<string, string> = {
    tts_atlas_1: 'smashup/cards/tts_atlas_1',
    tts_atlas_0a564692f2: 'smashup/cards/tts_atlas_0a564692f2',
    tts_atlas_0b888d02fd: 'smashup/cards/tts_atlas_0b888d02fd',
    tts_atlas_54: 'smashup/cards/tts_atlas_54',
    tts_atlas_55: 'smashup/cards/tts_atlas_55',
    tts_atlas_56: 'smashup/cards/tts_atlas_56',
    tts_atlas_78: 'smashup/cards/tts_atlas_78',
    tts_atlas_79: 'smashup/cards/tts_atlas_79',
    tts_atlas_9aed5872d2: 'smashup/cards/tts_atlas_9aed5872d2',
    tts_atlas_8789f47742: 'smashup/cards/tts_atlas_8789f47742',
};

export function getSmashUpPodAtlasImagePath(atlasId: string): string {
    return LOCAL_POD_ATLAS_IMAGE_OVERRIDES[atlasId] ?? `smashup/pod-assets/${atlasId}`;
}

export function getSmashUpAtlasImageById(atlasId: string): string | undefined {
    const builtIn = atlasById.get(atlasId)?.image;
    if (builtIn) return builtIn;
    if (atlasId.startsWith('tts_atlas_')) {
        return getSmashUpPodAtlasImagePath(atlasId);
    }
    return undefined;
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
