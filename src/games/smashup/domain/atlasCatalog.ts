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
    { id: SMASHUP_ATLAS_IDS.CARDS8, kind: 'card', image: 'smashup/cards/pretty_pretty', grid: { rows: 7, cols: 8 } },
    { id: SMASHUP_ATLAS_IDS.CARDS9, kind: 'card', image: 'smashup/cards/shayu', grid: { rows: 5, cols: 8 } },
    { id: SMASHUP_ATLAS_IDS.CARDS10, kind: 'card', image: 'smashup/cards/baokemeng', grid: { rows: 7, cols: 9 } },
    { id: SMASHUP_ATLAS_IDS.CARDS11, kind: 'card', image: 'smashup/cards/yuanhou', grid: { rows: 6, cols: 8 } },
    { id: SMASHUP_ATLAS_IDS.CARDS12, kind: 'card', image: 'smashup/cards/longzu', grid: { rows: 5, cols: 8 } },
    { id: SMASHUP_ATLAS_IDS.CARDS13, kind: 'card', image: 'smashup/cards/zhongguo', grid: { rows: 7, cols: 8 } },
    { id: SMASHUP_ATLAS_IDS.MARVEL_VILLAINS_CARDS, kind: 'card', image: 'smashup/cards/marvel_villains', grid: { rows: 6, cols: 9 } },
    { id: SMASHUP_ATLAS_IDS.CULTURE_SHOCK_CARDS, kind: 'card', image: 'smashup/cards/culture_shock/atlas', grid: { rows: 6, cols: 10 } },
    { id: SMASHUP_ATLAS_IDS.ITTY_CRITTERS_POD_CARDS, kind: 'card', image: 'smashup/cards/itty_critters_pod', grid: { rows: 4, cols: 5 } },
    { id: SMASHUP_ATLAS_IDS.TIME_TRAVELERS_POD_CARDS, kind: 'card', image: 'smashup/cards/time_travelers_pod', grid: { rows: 4, cols: 5 } },
    { id: SMASHUP_ATLAS_IDS.MARVEL_WAVE_ONE_CARDS, kind: 'card', image: 'smashup/cards/marvel_wave_one', grid: { rows: 6, cols: 9 } },
    { id: SMASHUP_ATLAS_IDS.KITTY_CATS_POD_CARDS, kind: 'card', image: 'smashup/cards/kitty_cats_pod', grid: { rows: 4, cols: 5 } },
    { id: SMASHUP_ATLAS_IDS.MYTHIC_HORSES_POD_CARDS, kind: 'card', image: 'smashup/cards/mythic_horses_pod', grid: { rows: 4, cols: 5 } },
    { id: SMASHUP_ATLAS_IDS.FAIRIES_POD_CARDS, kind: 'card', image: 'smashup/cards/fairies_pod', grid: { rows: 4, cols: 5 } },
    { id: SMASHUP_ATLAS_IDS.PRINCESSES_POD_CARDS, kind: 'card', image: 'smashup/cards/princesses_pod', grid: { rows: 4, cols: 5 } },
    { id: SMASHUP_ATLAS_IDS.MERMAIDS_POD_CARDS, kind: 'card', image: 'smashup/cards/mermaids_pod', grid: { rows: 4, cols: 5 } },
    { id: SMASHUP_ATLAS_IDS.SKELETONS_POD_CARDS, kind: 'card', image: 'smashup/cards/skeletons_pod', grid: { rows: 4, cols: 5 } },
    { id: SMASHUP_ATLAS_IDS.MYTHIC_GREEKS_POD_CARDS, kind: 'card', image: 'smashup/cards/mythic_greeks_pod', grid: { rows: 4, cols: 5 } },
    { id: SMASHUP_ATLAS_IDS.SHAPESHIFTERS_POD_CARDS, kind: 'card', image: 'smashup/cards/shapeshifters_pod', grid: { rows: 4, cols: 5 } },
    { id: SMASHUP_ATLAS_IDS.DRAGONS_POD, kind: 'card', image: 'smashup/cards/dragons_pod', grid: { rows: 4, cols: 5 } },
    { id: SMASHUP_ATLAS_IDS.SUPERHEROES_POD, kind: 'card', image: 'smashup/cards/superheroes_pod', grid: { rows: 4, cols: 5 } },
    { id: SMASHUP_ATLAS_IDS.MAGICAL_GIRLS_POD, kind: 'card', image: 'smashup/cards/magical_girls_pod', grid: { rows: 4, cols: 5 } },
    { id: SMASHUP_ATLAS_IDS.MEGA_TROOPERS_POD, kind: 'card', image: 'smashup/cards/mega_troopers_pod', grid: { rows: 4, cols: 5 } },
    { id: SMASHUP_ATLAS_IDS.CEASE_AND_DESIST_CARDS, kind: 'card', image: 'smashup/cards/cease_and_desist', grid: { rows: 7, cols: 8 } },
    { id: SMASHUP_ATLAS_IDS.POLYNESIAN_VOYAGERS_CARDS, kind: 'card', image: 'smashup/cards/polynesian_voyagers', grid: { rows: 3, cols: 4 } },
    { id: SMASHUP_ATLAS_IDS.PENGUINS_CARDS, kind: 'card', image: 'smashup/cards/penguins', grid: { rows: 4, cols: 4 } },
    { id: SMASHUP_ATLAS_IDS.INTERNATIONAL_INCIDENT_CARDS, kind: 'card', image: 'smashup/cards/international_incident', grid: { rows: 7, cols: 8 } },
    { id: SMASHUP_ATLAS_IDS.WHAT_WERE_WE_THINKING_CARDS, kind: 'card', image: 'smashup/cards/what_were_we_thinking', grid: { rows: 6, cols: 8 } },
    { id: SMASHUP_ATLAS_IDS.HULUWAWA_CARDS, kind: 'card', image: 'smashup/cards/huluwawa_cards', grid: { rows: 3, cols: 6 } },
    { id: SMASHUP_ATLAS_IDS.PALADIN_CARDS, kind: 'card', image: 'smashup/cards/paladin_cards', grid: { rows: 3, cols: 4 } },
    { id: SMASHUP_ATLAS_IDS.HULUWAWA_TITAN, kind: 'card', image: 'smashup/taitan/huluwawa_titan', grid: { rows: 1, cols: 1 } },
    { id: SMASHUP_ATLAS_IDS.PALADIN_TITAN, kind: 'card', image: 'smashup/taitan/paladin_seraphim', grid: { rows: 1, cols: 1 } },
    { id: SMASHUP_ATLAS_IDS.TITANS, kind: 'card', image: 'smashup/taitan/taitan1', grid: { rows: 7, cols: 3 } },
    { id: SMASHUP_ATLAS_IDS.SHARKS_POD_CARDS, kind: 'card', image: 'smashup/cards/sharks_pod', grid: { rows: 4, cols: 5 } },
    { id: SMASHUP_ATLAS_IDS.ALL_STARS_POD_CARDS, kind: 'card', image: 'smashup/cards/all_stars_pod', grid: { rows: 4, cols: 5 } },
    { id: SMASHUP_ATLAS_IDS.PROMOS_SHEEP_ALL_STARS_CARDS, kind: 'card', image: 'smashup/cards/promos_sheep_all_stars', grid: { rows: 6, cols: 6 } },
    { id: SMASHUP_ATLAS_IDS.TORNADOS_POD_CARDS, kind: 'card', image: 'smashup/cards/tornados_pod', grid: { rows: 4, cols: 5 } },
    { id: SMASHUP_ATLAS_IDS.DISNEY_FOUR_FACTION_CARDS, kind: 'card', image: 'smashup/cards/disney_four_factions', grid: { rows: 6, cols: 10 } },

    { id: SMASHUP_ATLAS_IDS.BASE1, kind: 'base', image: 'smashup/base/base1', grid: { rows: 4, cols: 4 } },
    { id: SMASHUP_ATLAS_IDS.BASE2, kind: 'base', image: 'smashup/base/base2', grid: { rows: 2, cols: 4 } },
    { id: SMASHUP_ATLAS_IDS.BASE3, kind: 'base', image: 'smashup/base/base3', grid: { rows: 2, cols: 4 } },
    { id: SMASHUP_ATLAS_IDS.BASE4, kind: 'base', image: 'smashup/base/base4', grid: { rows: 3, cols: 4 } },
    { id: SMASHUP_ATLAS_IDS.BASE5, kind: 'base', image: 'smashup/base/aiji_base', grid: { rows: 2, cols: 4 } },
    { id: SMASHUP_ATLAS_IDS.BASE6, kind: 'base', image: 'smashup/base/wangling_base', grid: { rows: 3, cols: 2 } },
    { id: SMASHUP_ATLAS_IDS.BASE7, kind: 'base', image: 'smashup/base/shayu', grid: { rows: 4, cols: 3 } },
    { id: SMASHUP_ATLAS_IDS.BASE8, kind: 'base', image: 'smashup/base/baokemeng', grid: { rows: 2, cols: 4 } },
    { id: SMASHUP_ATLAS_IDS.BASE9, kind: 'base', image: 'smashup/base/yuanhou', grid: { rows: 2, cols: 4 } },
    { id: SMASHUP_ATLAS_IDS.BASE10, kind: 'base', image: 'smashup/base/zhongguo', grid: { rows: 4, cols: 4 } },
    { id: SMASHUP_ATLAS_IDS.CEASE_AND_DESIST_BASES, kind: 'base', image: 'smashup/base/cease_and_desist', grid: { rows: 4, cols: 2 } },
    { id: SMASHUP_ATLAS_IDS.PENGUINS_BASES, kind: 'base', image: 'smashup/base/penguins', grid: { rows: 3, cols: 4 } },
    { id: SMASHUP_ATLAS_IDS.INTERNATIONAL_INCIDENT_BASES, kind: 'base', image: 'smashup/base/international_incident_bases', grid: { rows: 4, cols: 4 } },
    { id: SMASHUP_ATLAS_IDS.WHAT_WERE_WE_THINKING_BASES, kind: 'base', image: 'smashup/base/what_were_we_thinking_bases', grid: { rows: 2, cols: 4 } },
    { id: SMASHUP_ATLAS_IDS.PRETTY_PRETTY_POD_BASES, kind: 'base', image: 'smashup/base/pretty_pretty_pod', grid: { rows: 2, cols: 4 } },
    { id: SMASHUP_ATLAS_IDS.POLYNESIAN_VOYAGERS_BASES, kind: 'base', image: 'smashup/base/polynesian_voyagers/atlas', grid: { rows: 3, cols: 4 } },
    { id: SMASHUP_ATLAS_IDS.HULUWAWA_BASES, kind: 'base', image: 'smashup/base/huluwawa_bases', grid: { rows: 1, cols: 2 } },
    { id: SMASHUP_ATLAS_IDS.PALADIN_BASES, kind: 'base', image: 'smashup/base/paladin_bases', grid: { rows: 1, cols: 2 } },
    { id: SMASHUP_ATLAS_IDS.DISNEY_BASES, kind: 'base', image: 'smashup/base/disney_bases', grid: { rows: 4, cols: 4 } },
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
