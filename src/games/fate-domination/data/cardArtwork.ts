import type {CardPreviewRef} from '../../../core';
export const ATTACK_ATLAS = 'fate-basic-attacks';
export const ATTACK_ATLAS_IMAGE = 'fate-domination/cards/basic-attack-atlas';
// Original TTS CustomDeck: 6000 × 2100, 8 columns × 2 rows, CardID % 100.
// Frame 1 is the original Agility 3 / 高速移动 face; the imported title was corrected.
const FRAMES: Record<string,number> = {
 'fate-domination/cards/swift-low':0,
 'fate-domination/cards/swift-mid':1,
 'fate-domination/cards/swift-high':2,
 'fate-domination/cards/swift-super':3,
 'fate-domination/cards/attack-magic-low':4,
 'fate-domination/cards/attack-magic-mid':5,
 'fate-domination/cards/attack-magic-high':6,
 'fate-domination/cards/attack-magic-super':7,
 'fate-domination/cards/remote-control':12,
 'fate-domination/cards/rush':13,
 'fate-domination/cards/luck':14,
 'fate-domination/cards/attack-strength-super':11,
};
export function fateCardPreview(assetPath:string):CardPreviewRef {
 const index=FRAMES[assetPath];
 return index===undefined ? {type:'image',src:assetPath} : {type:'atlas',atlasId:ATTACK_ATLAS,index};
}
export function fateCardImageAsset(assetPath:string):string {
 return FRAMES[assetPath]===undefined ? assetPath : ATTACK_ATLAS_IMAGE;
}
