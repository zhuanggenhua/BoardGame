import type { CardDef } from '../../domain/types';
import { SMASHUP_ATLAS_IDS, SMASHUP_FACTION_IDS } from '../../domain/ids';

const FACTION = SMASHUP_FACTION_IDS.HYDRA_POD;
const ATLAS = SMASHUP_ATLAS_IDS.MARVEL_VILLAINS_POD_CARDS;

export const HYDRA_POD_CARDS: CardDef[] = [
    { id: 'hydra_red_skull_pod', type: 'minion', name: '红骷髅', nameEn: 'Red Skull', faction: FACTION, power: 5, abilityTags: ['ongoing', 'talent'], activatableAbilities: [{ kind: 'talent', zone: 'board' }], count: 1, previewRef: { type: 'atlas', atlasId: ATLAS, index: 0 } },
    { id: 'hydra_baron_strucker_pod', type: 'minion', name: '斯特拉克男爵', nameEn: 'Baron Strucker', faction: FACTION, power: 4, abilityTags: ['talent'], activatableAbilities: [{ kind: 'talent', zone: 'board' }], count: 1, previewRef: { type: 'atlas', atlasId: ATLAS, index: 1 } },
    { id: 'hydra_madame_hydra_pod', type: 'minion', name: '蝰蛇', nameEn: 'Madame Hydra', faction: FACTION, power: 4, abilityTags: ['talent'], activatableAbilities: [{ kind: 'talent', zone: 'board' }], count: 1, previewRef: { type: 'atlas', atlasId: ATLAS, index: 2 } },
    { id: 'hydra_arnim_zola_pod', type: 'minion', name: '阿尼姆·佐拉', nameEn: 'Arnim Zola', faction: FACTION, power: 2, abilityTags: ['ongoing'], count: 3, previewRef: { type: 'atlas', atlasId: ATLAS, index: 3 } },
    { id: 'hydra_hydra_agent_pod', type: 'minion', name: '九头蛇特工', nameEn: 'Hydra Agent', faction: FACTION, power: 2, abilityTags: ['onDestroy'], count: 6, previewRef: { type: 'atlas', atlasId: ATLAS, index: 4 } },
    { id: 'hydra_fanatical_devotion_pod', type: 'action', subtype: 'ongoing', name: '狂热的献身', nameEn: 'Fanatical Devotion', faction: FACTION, abilityTags: ['ongoing'], ongoingTarget: 'base', playNeedsBase: true, count: 1, previewRef: { type: 'atlas', atlasId: ATLAS, index: 5 } },
    { id: 'hydra_hail_hydra_pod', type: 'action', subtype: 'standard', name: '九头蛇万岁!', nameEn: 'Hail Hydra!', faction: FACTION, abilityTags: ['onPlay'], playNeedsMinion: true, playTargetMinionController: 'self', count: 1, previewRef: { type: 'atlas', atlasId: ATLAS, index: 6 } },
    { id: 'hydra_hour_of_destiny_pod', type: 'action', subtype: 'standard', name: '命运之时', nameEn: 'Hour of Destiny', faction: FACTION, abilityTags: ['onPlay'], count: 2, previewRef: { type: 'atlas', atlasId: ATLAS, index: 7 } },
    { id: 'hydra_reactivate_agents_pod', type: 'action', subtype: 'standard', name: '再次激活', nameEn: 'Reactivate Agents', faction: FACTION, abilityTags: ['onPlay'], count: 1, previewRef: { type: 'atlas', atlasId: ATLAS, index: 8 } },
    { id: 'hydra_secret_reserves_pod', type: 'action', subtype: 'standard', name: '秘密储备', nameEn: 'Secret Reserves', faction: FACTION, abilityTags: ['onPlay'], count: 1, previewRef: { type: 'atlas', atlasId: ATLAS, index: 9 } },
    { id: 'hydra_two_more_shall_take_its_place_pod', type: 'action', subtype: 'standard', name: '取而代之', nameEn: 'Two More Shall Take Its Place', faction: FACTION, abilityTags: ['onPlay'], playNeedsMinion: true, playTargetMinionController: 'self', count: 2, previewRef: { type: 'atlas', atlasId: ATLAS, index: 10 } },
];
