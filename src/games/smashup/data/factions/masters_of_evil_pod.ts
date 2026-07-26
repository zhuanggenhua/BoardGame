import type { CardDef } from '../../domain/types';
import { SMASHUP_ATLAS_IDS, SMASHUP_FACTION_IDS } from '../../domain/ids';

const FACTION = SMASHUP_FACTION_IDS.MASTERS_OF_EVIL_POD;
const ATLAS = SMASHUP_ATLAS_IDS.MARVEL_VILLAINS_POD_CARDS;

export const MASTERS_OF_EVIL_POD_CARDS: CardDef[] = [
    { id: 'masters_of_evil_baron_zemo_pod', type: 'minion', name: '泽莫男爵', nameEn: 'Baron Zemo', faction: FACTION, power: 5, abilityTags: ['ongoing'], count: 1, previewRef: { type: 'atlas', atlasId: ATLAS, index: 23 } },
    { id: 'masters_of_evil_ulysses_klaw_pod', type: 'minion', name: '克劳', nameEn: 'Ulysses Klaw', faction: FACTION, power: 4, abilityTags: ['onPlay'], count: 2, previewRef: { type: 'atlas', atlasId: ATLAS, index: 24 } },
    { id: 'masters_of_evil_black_mamba_pod', type: 'minion', name: '黑曼巴', nameEn: 'Black Mamba', faction: FACTION, power: 3, abilityTags: ['ongoing'], count: 3, previewRef: { type: 'atlas', atlasId: ATLAS, index: 25 } },
    { id: 'masters_of_evil_absorbing_man_pod', type: 'minion', name: '吸收人', nameEn: 'Absorbing Man', faction: FACTION, power: 2, abilityTags: ['talent'], activatableAbilities: [{ kind: 'talent', zone: 'board' }], count: 4, previewRef: { type: 'atlas', atlasId: ATLAS, index: 26 } },
    { id: 'masters_of_evil_a_portent_of_doom_pod', type: 'action', subtype: 'ongoing', name: '厄运之兆', nameEn: 'A Portent of Doom', faction: FACTION, abilityTags: ['ongoing'], ongoingTarget: 'base', playNeedsBase: true, playConstraint: 'requireNoCharacters', count: 1, previewRef: { type: 'atlas', atlasId: ATLAS, index: 27 } },
    { id: 'masters_of_evil_acceptable_losses_pod', type: 'action', subtype: 'standard', name: '可接受的损失', nameEn: 'Acceptable Losses', faction: FACTION, abilityTags: ['onPlay'], playNeedsMinion: true, playTargetMinionController: 'self', count: 2, previewRef: { type: 'atlas', atlasId: ATLAS, index: 28 } },
    { id: 'masters_of_evil_ball_and_chain_pod', type: 'action', subtype: 'ongoing', name: '链球', nameEn: 'Ball and Chain', faction: FACTION, abilityTags: ['ongoing'], ongoingTarget: 'minion', playNeedsMinion: true, playTargetMinionController: 'self', count: 1, previewRef: { type: 'atlas', atlasId: ATLAS, index: 29 } },
    { id: 'masters_of_evil_convergence_pod', type: 'action', subtype: 'standard', name: '汇聚', nameEn: 'Convergence', faction: FACTION, abilityTags: ['onPlay'], playNeedsMinion: true, playTargetMinionController: 'self', count: 1, previewRef: { type: 'atlas', atlasId: ATLAS, index: 30 } },
    { id: 'masters_of_evil_gain_the_upper_hand_pod', type: 'action', subtype: 'standard', name: '取得优势', nameEn: 'Gain the Upper Hand', faction: FACTION, abilityTags: ['onPlay'], playNeedsMinion: true, playTargetMinionController: 'any', count: 2, previewRef: { type: 'atlas', atlasId: ATLAS, index: 31 } },
    { id: 'masters_of_evil_indestructible_form_pod', type: 'action', subtype: 'ongoing', name: '坚不可摧的形态', nameEn: 'Indestructible Form', faction: FACTION, abilityTags: ['ongoing'], ongoingTarget: 'base', playNeedsBase: true, count: 1, previewRef: { type: 'atlas', atlasId: ATLAS, index: 32 } },
    { id: 'masters_of_evil_sonic_shockwave_pod', type: 'action', subtype: 'standard', name: '音速冲击波', nameEn: 'Sonic Shockwave', faction: FACTION, abilityTags: ['onPlay'], playNeedsMinion: true, playTargetMinionController: 'opponent', count: 1, previewRef: { type: 'atlas', atlasId: ATLAS, index: 33 } },
    { id: 'masters_of_evil_world_domination_pod', type: 'action', subtype: 'ongoing', name: '统治世界', nameEn: 'World Domination', faction: FACTION, abilityTags: ['ongoing', 'talent'], activatableAbilities: [{ kind: 'talent', zone: 'board' }], ongoingTarget: 'base', playNeedsBase: true, count: 1, previewRef: { type: 'atlas', atlasId: ATLAS, index: 34 } },
];
