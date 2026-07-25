import type { CardDef } from '../../domain/types';
import { SMASHUP_ATLAS_IDS, SMASHUP_FACTION_IDS } from '../../domain/ids';

const FACTION = SMASHUP_FACTION_IDS.AVENGERS_POD;
const ATLAS = SMASHUP_ATLAS_IDS.MARVEL_WAVE_ONE_POD_CARDS;

export const AVENGERS_POD_CARDS: CardDef[] = [
    { id: 'avengers_black_widow_pod', type: 'minion', name: '黑寡妇', nameEn: 'Black Widow', faction: FACTION, power: 5, abilityTags: ['onPlay'], count: 1, previewRef: { type: 'atlas', atlasId: ATLAS, index: 0 } },
    { id: 'avengers_captain_america_pod', type: 'minion', name: '美国队长', nameEn: 'Captain America', faction: FACTION, power: 5, abilityTags: ['talent'], activatableAbilities: [{ kind: 'talent', zone: 'board', window: 'playCards' }], count: 1, previewRef: { type: 'atlas', atlasId: ATLAS, index: 1 } },
    { id: 'avengers_hawkeye_pod', type: 'minion', name: '鹰眼', nameEn: 'Hawkeye', faction: FACTION, power: 5, abilityTags: ['onPlay'], count: 1, previewRef: { type: 'atlas', atlasId: ATLAS, index: 2 } },
    { id: 'avengers_hulk_pod', type: 'minion', name: '浩克', nameEn: 'Hulk', faction: FACTION, power: 5, abilityTags: ['talent'], activatableAbilities: [{ kind: 'talent', zone: 'board', window: 'playCards' }], count: 1, previewRef: { type: 'atlas', atlasId: ATLAS, index: 3 } },
    { id: 'avengers_iron_man_pod', type: 'minion', name: '钢铁侠', nameEn: 'Iron Man', faction: FACTION, power: 5, abilityTags: ['talent'], activatableAbilities: [{ kind: 'talent', zone: 'board', window: 'playCards' }], count: 1, previewRef: { type: 'atlas', atlasId: ATLAS, index: 4 } },
    { id: 'avengers_thor_pod', type: 'minion', name: '索尔', nameEn: 'Thor', faction: FACTION, power: 5, abilityTags: ['onPlay', 'talent'], activatableAbilities: [{ kind: 'talent', zone: 'board', window: 'playCards' }], count: 1, previewRef: { type: 'atlas', atlasId: ATLAS, index: 5 } },
    { id: 'avengers_assemble_pod', type: 'action', subtype: 'standard', name: '复仇者集结', nameEn: 'Avengers Assemble', faction: FACTION, abilityTags: ['onPlay'], count: 2, previewRef: { type: 'atlas', atlasId: ATLAS, index: 6 } },
    { id: 'avengers_caps_shield_pod', type: 'action', subtype: 'ongoing', name: '美队的盾牌', nameEn: 'Cap\'s Shield', faction: FACTION, abilityTags: ['ongoing'], ongoingTarget: 'minion', playNeedsMinion: true, count: 1, previewRef: { type: 'atlas', atlasId: ATLAS, index: 7 } },
    { id: 'avengers_hawkeyes_arrows_pod', type: 'action', subtype: 'standard', name: '鹰眼箭', nameEn: 'Hawkeye\'s Arrows', faction: FACTION, abilityTags: ['onPlay', 'extra'], count: 1, previewRef: { type: 'atlas', atlasId: ATLAS, index: 8 } },
    { id: 'avengers_hulk_smash_pod', type: 'action', subtype: 'standard', name: '浩克冲击', nameEn: 'Hulk Smash', faction: FACTION, abilityTags: ['onPlay'], playNeedsBase: true, count: 1, previewRef: { type: 'atlas', atlasId: ATLAS, index: 9 } },
    { id: 'avengers_jarvis_pod', type: 'action', subtype: 'ongoing', name: 'J.A.R.V.I.S.', nameEn: 'J.A.R.V.I.S.', faction: FACTION, abilityTags: ['ongoing', 'talent'], ongoingTarget: 'base', playNeedsBase: true, activatableAbilities: [{ kind: 'talent', zone: 'board', window: 'playCards' }], count: 1, previewRef: { type: 'atlas', atlasId: ATLAS, index: 10 } },
    { id: 'avengers_mjolnir_pod', type: 'action', subtype: 'ongoing', name: '雷神锤', nameEn: 'Mjolnir', faction: FACTION, abilityTags: ['ongoing'], ongoingTarget: 'minion', playNeedsMinion: true, count: 1, previewRef: { type: 'atlas', atlasId: ATLAS, index: 11 } },
    { id: 'avengers_modular_tech_pod', type: 'action', subtype: 'standard', name: '模块化技术', nameEn: 'Modular Tech', faction: FACTION, abilityTags: ['onPlay', 'extra'], count: 1, previewRef: { type: 'atlas', atlasId: ATLAS, index: 12 } },
    { id: 'avengers_repulsor_boots_pod', type: 'action', subtype: 'standard', name: '斥力靴', nameEn: 'Repulsor Boots', faction: FACTION, abilityTags: ['onPlay', 'special'], responseWindowTiming: 'beforeScoring', count: 1, previewRef: { type: 'atlas', atlasId: ATLAS, index: 13 } },
    { id: 'avengers_strategize_pod', type: 'action', subtype: 'standard', name: '战略部署', nameEn: 'Strategize', faction: FACTION, abilityTags: ['onPlay'], count: 2, previewRef: { type: 'atlas', atlasId: ATLAS, index: 14 } },
    { id: 'avengers_tactical_advantage_pod', type: 'action', subtype: 'standard', name: '战术优势', nameEn: 'Tactical Advantage', faction: FACTION, abilityTags: ['onPlay'], playNeedsMinion: true, count: 1, previewRef: { type: 'atlas', atlasId: ATLAS, index: 15 } },
    { id: 'avengers_thunder_and_lightning_pod', type: 'action', subtype: 'standard', name: '雷霆闪电', nameEn: 'Thunder and Lightning', faction: FACTION, abilityTags: ['onPlay'], playNeedsMinion: true, count: 1, previewRef: { type: 'atlas', atlasId: ATLAS, index: 16 } },
    { id: 'avengers_widows_bite_pod', type: 'action', subtype: 'special', name: '蜘蛛之吻', nameEn: 'Widow\'s Bite', faction: FACTION, abilityTags: ['special'], specialTiming: 'beforeScoring', specialNeedsBase: true, count: 1, previewRef: { type: 'atlas', atlasId: ATLAS, index: 17 } },
];
