import type { CardDef } from '../../domain/types';
import { SMASHUP_ATLAS_IDS, SMASHUP_FACTION_IDS } from '../../domain/ids';

const FACTION = SMASHUP_FACTION_IDS.SHIELD_POD;
const ATLAS = SMASHUP_ATLAS_IDS.MARVEL_WAVE_ONE_POD_CARDS;

export const SHIELD_POD_CARDS: CardDef[] = [
    { id: 'shield_nick_fury_pod', type: 'minion', name: '尼克-弗瑞', nameEn: 'Nick Fury', faction: FACTION, power: 5, abilityTags: ['onPlay', 'extra'], count: 1, previewRef: { type: 'atlas', atlasId: ATLAS, index: 18 } },
    { id: 'shield_maria_hill_pod', type: 'minion', name: '玛丽亚·希尔', nameEn: 'Maria Hill', faction: FACTION, power: 4, abilityTags: ['ongoing'], count: 2, previewRef: { type: 'atlas', atlasId: ATLAS, index: 19 } },
    { id: 'shield_phil_coulson_pod', type: 'minion', name: '菲尔·科尔森', nameEn: 'Phil Coulson', faction: FACTION, power: 3, abilityTags: ['onPlay', 'extra'], count: 3, previewRef: { type: 'atlas', atlasId: ATLAS, index: 20 } },
    { id: 'shield_agent_pod', type: 'minion', name: '神盾局探员', nameEn: 'S.H.I.E.L.D. Agent', faction: FACTION, power: 2, abilityTags: ['ongoing'], count: 4, previewRef: { type: 'atlas', atlasId: ATLAS, index: 21 } },
    { id: 'shield_entry_point_pod', type: 'action', subtype: 'standard', name: '进入点', nameEn: 'Entry Point', faction: FACTION, abilityTags: ['onPlay', 'extra'], count: 2, previewRef: { type: 'atlas', atlasId: ATLAS, index: 22 } },
    { id: 'shield_mission_debriefing_pod', type: 'action', subtype: 'standard', name: '任务汇报', nameEn: 'Mission Debriefing', faction: FACTION, abilityTags: ['onPlay'], playNeedsBase: true, count: 1, previewRef: { type: 'atlas', atlasId: ATLAS, index: 23 } },
    { id: 'shield_proving_ground_pod', type: 'action', subtype: 'ongoing', name: '试验场', nameEn: 'Proving Ground', faction: FACTION, abilityTags: ['ongoing', 'talent', 'extra'], ongoingTarget: 'base', playNeedsBase: true, activatableAbilities: [{ kind: 'talent', zone: 'board', window: 'playCards' }], count: 1, previewRef: { type: 'atlas', atlasId: ATLAS, index: 24 } },
    { id: 'shield_reassignment_pod', type: 'action', subtype: 'standard', name: '调任', nameEn: 'Reassignment', faction: FACTION, abilityTags: ['onPlay'], playNeedsBase: true, count: 1, previewRef: { type: 'atlas', atlasId: ATLAS, index: 25 } },
    { id: 'shield_rescue_mission_pod', type: 'action', subtype: 'special', name: '救援任务', nameEn: 'Rescue Mission', faction: FACTION, abilityTags: ['special'], specialTiming: 'afterScoring', specialNeedsBase: true, count: 1, previewRef: { type: 'atlas', atlasId: ATLAS, index: 26 } },
    { id: 'shield_superior_firepower_pod', type: 'action', subtype: 'standard', name: '强大的火力', nameEn: 'Superior Firepower', faction: FACTION, abilityTags: ['onPlay'], count: 1, previewRef: { type: 'atlas', atlasId: ATLAS, index: 27 } },
    { id: 'shield_troop_drop_pod', type: 'action', subtype: 'standard', name: '空投部队', nameEn: 'Troop Drop', faction: FACTION, abilityTags: ['onPlay', 'extra'], count: 2, previewRef: { type: 'atlas', atlasId: ATLAS, index: 28 } },
    { id: 'shield_together_pod', type: 'action', subtype: 'standard', name: '并肩作战', nameEn: 'Together', faction: FACTION, abilityTags: ['onPlay'], count: 1, previewRef: { type: 'atlas', atlasId: ATLAS, index: 29 } },
];
