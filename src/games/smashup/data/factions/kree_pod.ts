import type { CardDef } from '../../domain/types';
import { SMASHUP_ATLAS_IDS, SMASHUP_FACTION_IDS } from '../../domain/ids';

const FACTION = SMASHUP_FACTION_IDS.KREE_POD;
const ATLAS = SMASHUP_ATLAS_IDS.MARVEL_VILLAINS_POD_CARDS;

export const KREE_POD_CARDS: CardDef[] = [
    { id: 'kree_supreme_intelligence_pod', type: 'minion', name: '至高智慧', nameEn: 'Supreme Intelligence', faction: FACTION, power: 5, abilityTags: ['ongoing'], count: 1, previewRef: { type: 'atlas', atlasId: ATLAS, index: 11 } },
    { id: 'kree_minn_erva_pod', type: 'minion', name: '敏-尔瓦博士', nameEn: 'Minn-Erva', faction: FACTION, power: 4, abilityTags: ['onPlay'], count: 2, previewRef: { type: 'atlas', atlasId: ATLAS, index: 12 } },
    { id: 'kree_ronan_the_accuser_pod', type: 'minion', name: '指控者罗南', nameEn: 'Ronan the Accuser', faction: FACTION, power: 3, abilityTags: ['onPlay'], count: 3, previewRef: { type: 'atlas', atlasId: ATLAS, index: 13 } },
    { id: 'kree_kree_sentry_pod', type: 'minion', name: '克里人哨兵', nameEn: 'Kree Sentry', faction: FACTION, power: 2, abilityTags: ['ongoing'], count: 4, previewRef: { type: 'atlas', atlasId: ATLAS, index: 14 } },
    { id: 'kree_battle_rage_pod', type: 'action', subtype: 'standard', name: '战斗怒吼', nameEn: 'Battle Rage', faction: FACTION, abilityTags: ['onPlay'], playNeedsMinion: true, playTargetMinionController: 'self', count: 2, previewRef: { type: 'atlas', atlasId: ATLAS, index: 15 } },
    { id: 'kree_call_for_backup_pod', type: 'action', subtype: 'standard', name: '呼叫支援', nameEn: 'Call for Backup', faction: FACTION, abilityTags: ['onPlay'], count: 1, previewRef: { type: 'atlas', atlasId: ATLAS, index: 16 } },
    { id: 'kree_it_begins_pod', type: 'action', subtype: 'standard', name: '开始了', nameEn: 'It Begins', faction: FACTION, abilityTags: ['onPlay'], playNeedsMinion: true, playTargetMinionController: 'self', count: 1, previewRef: { type: 'atlas', atlasId: ATLAS, index: 17 } },
    { id: 'kree_prepare_to_engage_pod', type: 'action', subtype: 'standard', name: '准备作战', nameEn: 'Prepare to Engage', faction: FACTION, abilityTags: ['onPlay'], count: 1, previewRef: { type: 'atlas', atlasId: ATLAS, index: 18 } },
    { id: 'kree_proven_methods_pod', type: 'action', subtype: 'standard', name: '成熟的方法', nameEn: 'Proven Methods', faction: FACTION, abilityTags: ['onPlay'], count: 1, previewRef: { type: 'atlas', atlasId: ATLAS, index: 19 } },
    { id: 'kree_relentless_attack_pod', type: 'action', subtype: 'ongoing', name: '无情攻击', nameEn: 'Relentless Attack', faction: FACTION, abilityTags: ['talent'], activatableAbilities: [{ kind: 'talent', zone: 'board' }], ongoingTarget: 'minion', playNeedsMinion: true, playTargetMinionController: 'self', count: 1, previewRef: { type: 'atlas', atlasId: ATLAS, index: 20 } },
    { id: 'kree_righteous_fury_pod', type: 'action', subtype: 'ongoing', name: '正义之怒', nameEn: 'Righteous Fury', faction: FACTION, abilityTags: ['ongoing'], ongoingTarget: 'minion', playNeedsMinion: true, playTargetMinionController: 'self', count: 2, previewRef: { type: 'atlas', atlasId: ATLAS, index: 21 } },
    { id: 'kree_speed_up_pod', type: 'action', subtype: 'standard', name: '加速', nameEn: 'Speed Up', faction: FACTION, abilityTags: ['onPlay'], count: 1, previewRef: { type: 'atlas', atlasId: ATLAS, index: 22 } },
];
