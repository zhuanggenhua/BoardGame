import type { CardDef } from '../../domain/types';
import { SMASHUP_ATLAS_IDS, SMASHUP_FACTION_IDS } from '../../domain/ids';

const FACTION = SMASHUP_FACTION_IDS.ULTIMATES_POD;
const ATLAS = SMASHUP_ATLAS_IDS.MARVEL_WAVE_ONE_POD_CARDS;

export const ULTIMATES_POD_CARDS: CardDef[] = [
    { id: 'ultimates_captain_marvel_pod', type: 'minion', name: '惊奇队长', nameEn: 'Captain Marvel', faction: FACTION, power: 5, abilityTags: ['talent'], activatableAbilities: [{ kind: 'talent', zone: 'board', window: 'playCards' }], count: 1, previewRef: { type: 'atlas', atlasId: ATLAS, index: 42 } },
    { id: 'ultimates_spectrum_pod', type: 'minion', name: '光谱', nameEn: 'Spectrum', faction: FACTION, power: 4, abilityTags: ['talent'], activatableAbilities: [{ kind: 'talent', zone: 'board', window: 'playCards' }], count: 2, previewRef: { type: 'atlas', atlasId: ATLAS, index: 43 } },
    { id: 'ultimates_america_chavez_pod', type: 'minion', name: '美国小姐', nameEn: 'America Chavez', faction: FACTION, power: 3, abilityTags: ['ongoing'], count: 3, previewRef: { type: 'atlas', atlasId: ATLAS, index: 44 } },
    { id: 'ultimates_blue_marvel_pod', type: 'minion', name: '蓝奇', nameEn: 'Blue Marvel', faction: FACTION, power: 2, abilityTags: ['ongoing'], count: 4, previewRef: { type: 'atlas', atlasId: ATLAS, index: 45 } },
    { id: 'ultimates_aid_from_allies_pod', type: 'action', subtype: 'ongoing', name: '盟国的援助', nameEn: 'Aid from Allies', faction: FACTION, abilityTags: ['onPlay', 'ongoing'], ongoingTarget: 'base', playNeedsBase: true, count: 1, previewRef: { type: 'atlas', atlasId: ATLAS, index: 46 } },
    { id: 'ultimates_coordinated_attack_pod', type: 'action', subtype: 'standard', name: '协同攻击', nameEn: 'Coordinated Attack', faction: FACTION, abilityTags: ['onPlay'], playNeedsBase: true, count: 1, previewRef: { type: 'atlas', atlasId: ATLAS, index: 47 } },
    { id: 'ultimates_cosmic_knowledge_pod', type: 'action', subtype: 'standard', name: '宇宙知识', nameEn: 'Cosmic Knowledge', faction: FACTION, abilityTags: ['onPlay'], count: 1, previewRef: { type: 'atlas', atlasId: ATLAS, index: 48 } },
    { id: 'ultimates_first_to_arrive_pod', type: 'action', subtype: 'standard', name: '最先到达', nameEn: 'First to Arrive', faction: FACTION, abilityTags: ['onPlay', 'extra'], count: 2, previewRef: { type: 'atlas', atlasId: ATLAS, index: 49 } },
    { id: 'ultimates_heroic_landing_pod', type: 'action', subtype: 'standard', name: '英雄登场', nameEn: 'Heroic Landing', faction: FACTION, abilityTags: ['onPlay'], count: 1, previewRef: { type: 'atlas', atlasId: ATLAS, index: 50 } },
    { id: 'ultimates_lift_and_carry_pod', type: 'action', subtype: 'standard', name: '搬运', nameEn: 'Lift and Carry', faction: FACTION, abilityTags: ['onPlay'], count: 1, previewRef: { type: 'atlas', atlasId: ATLAS, index: 51 } },
    { id: 'ultimates_power_and_speed_pod', type: 'action', subtype: 'standard', name: '力量与速度', nameEn: 'Power and Speed', faction: FACTION, abilityTags: ['onPlay'], playNeedsMinion: true, playTargetMinionController: 'self', count: 2, previewRef: { type: 'atlas', atlasId: ATLAS, index: 52 } },
    { id: 'ultimates_scramble_pod', type: 'action', subtype: 'standard', name: '争夺', nameEn: 'Scramble', faction: FACTION, abilityTags: ['onPlay', 'special'], responseWindowTiming: 'beforeScoring', count: 1, previewRef: { type: 'atlas', atlasId: ATLAS, index: 53 } },
];
