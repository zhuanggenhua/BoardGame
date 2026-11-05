import { registerLazyCardAtlasSource } from '../../components/common/media/cardAtlasRegistry';
import {
    spellAtlasConfig,
    mageAtlasConfig,
    stripImageExtension,
    toAtlasId,
    MAGE_WARS_MAGES_ATLAS_ID,
    MAGE_WARS_MAGES_ATLAS_IMAGE_PATH,
} from './cardPreviewModel';
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
// Client registration is loaded by Board; game.ts remains server-safe.
import { registerCriticalImageResolver } from '../../core';
import { mageWarsCriticalImageResolver } from './criticalImageResolver';
import { registerCardPreviewGetter } from '../../components/game/registry/cardPreviewRegistry';
import { getMageWarsCardPreviewRef } from './cardPreviewModel';

registerCriticalImageResolver('mage-wars', mageWarsCriticalImageResolver);
registerCardPreviewGetter('mage-wars', getMageWarsCardPreviewRef, { maxDim: 220 });
