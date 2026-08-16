import type { CardPreviewRef } from '../../../core';
import { registerLazyCardAtlasSource } from '../../../components/common/media/cardAtlasRegistry';
import apprenticeSpellAtlases from '../../../../public/assets/atlas-configs/mage-wars/apprentice-spell-atlases.json';
import magesCoreAtlas from '../../../../public/assets/atlas-configs/mage-wars/mages-core-atlas.json';
import { materializeMageWarsConfigPackage } from '../data/configPackage';
import { MAGE_IDS, type MageId } from '../domain/ids';

type GridAtlasDefinition = {
    source: string;
    width: number;
    height: number;
    cols: number;
    rows: number;
};

type ApprenticeSpellAtlasConfig = {
    atlases: Record<string, GridAtlasDefinition>;
};

type MageFrameKey =
    | 'beastmaster_apprentice_card'
    | 'beastmaster_apprentice_portrait'
    | 'priestess_apprentice_card'
    | 'priestess_apprentice_portrait'
    | 'warlock_apprentice_card'
    | 'warlock_apprentice_portrait'
    | 'wizard_apprentice_card'
    | 'wizard_apprentice_portrait';

type MagesCoreAtlasConfig = {
    atlas: GridAtlasDefinition & { id: string };
    frames: Record<MageFrameKey, {
        slot: number;
        name: string;
    }>;
};

export type MageWarsMagePreviewKind = 'card' | 'portrait';

const spellAtlasConfig = apprenticeSpellAtlases as ApprenticeSpellAtlasConfig;
const mageAtlasConfig = magesCoreAtlas as MagesCoreAtlasConfig;

const MAGE_WARS_ATLAS_PREFIX = 'mage-wars:';

const stripImageExtension = (source: string): string =>
    source.replace(/\.(avif|webp|png|jpe?g|gif)$/i, '');

const toAtlasId = (atlasId: string): string => `${MAGE_WARS_ATLAS_PREFIX}${atlasId}`;

export const MAGE_WARS_MAGES_ATLAS_ID = toAtlasId(mageAtlasConfig.atlas.id);

export const MAGE_WARS_SPELL_ATLAS_IDS = Object.keys(spellAtlasConfig.atlases)
    .sort()
    .map(toAtlasId);

export const MAGE_WARS_SPELL_ATLAS_IMAGE_PATHS = Object.values(spellAtlasConfig.atlases)
    .map((atlas) => stripImageExtension(atlas.source));

export const MAGE_WARS_MAGES_ATLAS_IMAGE_PATH = stripImageExtension(mageAtlasConfig.atlas.source);

const MAGE_FRAME_KEYS: Record<MageId, Record<MageWarsMagePreviewKind, MageFrameKey>> = {
    [MAGE_IDS.BEASTMASTER_APPRENTICE]: {
        card: 'beastmaster_apprentice_card',
        portrait: 'beastmaster_apprentice_portrait',
    },
    [MAGE_IDS.PRIESTESS_APPRENTICE]: {
        card: 'priestess_apprentice_card',
        portrait: 'priestess_apprentice_portrait',
    },
    [MAGE_IDS.WARLOCK_APPRENTICE]: {
        card: 'warlock_apprentice_card',
        portrait: 'warlock_apprentice_portrait',
    },
    [MAGE_IDS.WIZARD_APPRENTICE]: {
        card: 'wizard_apprentice_card',
        portrait: 'wizard_apprentice_portrait',
    },
};

type ConfigSpellCardRef = {
    cardId: number;
    name: string;
    atlasId: string;
    slot: number;
};

let cachedSpellCardRefs: Map<string, ConfigSpellCardRef> | undefined;

function getSpellCardRefs(): Map<string, ConfigSpellCardRef> {
    if (cachedSpellCardRefs) {
        return cachedSpellCardRefs;
    }

    const refs = new Map<string, ConfigSpellCardRef>();
    for (const object of materializeMageWarsConfigPackage().package.objects) {
        const isPreviewableSpell = object.tags?.includes('apprentice-spell')
            || object.tags?.includes('source-card');
        if (!isPreviewableSpell) continue;
        const data = object.data ?? {};
        const cardId = typeof data.cardId === 'number' ? data.cardId : undefined;
        const atlasId = typeof data.atlasId === 'string' ? data.atlasId : undefined;
        const slot = typeof data.slot === 'number' ? data.slot : undefined;
        if (cardId == null || atlasId == null || slot == null) continue;
        refs.set(String(cardId), {
            cardId,
            name: object.name,
            atlasId,
            slot,
        });
    }

    cachedSpellCardRefs = refs;
    return refs;
}

function registerMageWarsCardAtlases(): void {
    registerLazyCardAtlasSource(MAGE_WARS_MAGES_ATLAS_ID, {
        image: MAGE_WARS_MAGES_ATLAS_IMAGE_PATH,
        grid: {
            rows: mageAtlasConfig.atlas.rows,
            cols: mageAtlasConfig.atlas.cols,
        },
    });

    Object.entries(spellAtlasConfig.atlases).forEach(([atlasId, atlas]) => {
        registerLazyCardAtlasSource(toAtlasId(atlasId), {
            image: stripImageExtension(atlas.source),
            grid: {
                rows: atlas.rows,
                cols: atlas.cols,
            },
        });
    });
}

registerMageWarsCardAtlases();

export function getMageWarsSpellCardPreviewRef(cardId: string | number): CardPreviewRef | null {
    const card = getSpellCardRefs().get(String(cardId));
    if (!card) return null;
    return {
        type: 'atlas',
        atlasId: toAtlasId(card.atlasId),
        index: card.slot,
    };
}

export function getMageWarsSpellCardAspectRatio(cardId: string | number): number | null {
    const card = getSpellCardRefs().get(String(cardId));
    if (!card) return null;
    const atlas = spellAtlasConfig.atlases[card.atlasId];
    if (!atlas || atlas.cols <= 0 || atlas.rows <= 0 || atlas.height <= 0) return null;
    return (atlas.width / atlas.cols) / (atlas.height / atlas.rows);
}

export function getMageWarsCardPreviewRef(cardId: string): CardPreviewRef | null {
    return getMageWarsSpellCardPreviewRef(cardId);
}

export function getMageWarsSpellCardName(cardId: string | number): string | null {
    return getSpellCardRefs().get(String(cardId))?.name ?? null;
}

export function getMageWarsMagePreviewRef(
    mageId: MageId,
    kind: MageWarsMagePreviewKind = 'portrait',
): CardPreviewRef {
    const frameKey = MAGE_FRAME_KEYS[mageId][kind];
    return {
        type: 'atlas',
        atlasId: MAGE_WARS_MAGES_ATLAS_ID,
        index: mageAtlasConfig.frames[frameKey].slot,
    };
}

export function getMageWarsRegisteredSpellCardIds(): string[] {
    return [...getSpellCardRefs().keys()].sort((left, right) => Number(left) - Number(right));
}
