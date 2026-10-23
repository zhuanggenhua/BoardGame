import {registerCardAtlasSource} from '../../../components/common/media/cardAtlasRegistry';
import {generateUniformAtlasConfig} from '../../../engine/primitives/spriteAtlas';
import {SEAL_ATLAS} from '../data/identityArtwork';
export {fateCommandSealPreview, fateTokenAsset} from '../data/identityArtwork';
// TTS CustomDeck original 3750 × 2100, 5 columns and 2 rows.
registerCardAtlasSource(SEAL_ATLAS, {image:'fate-domination/seals/command-seal-shared-atlas',config:generateUniformAtlasConfig(3750,2100,2,5)});

import {ATTACK_ATLAS, ATTACK_ATLAS_IMAGE} from '../data/cardArtwork';
registerCardAtlasSource(ATTACK_ATLAS,{image:ATTACK_ATLAS_IMAGE,config:generateUniformAtlasConfig(6000,2100,2,8)});
