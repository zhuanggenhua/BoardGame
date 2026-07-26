import type { ActionCardDef, BaseCardDef, CardDef, MinionCardDef } from '../../domain/types';
import { SMASHUP_ATLAS_IDS, SMASHUP_FACTION_IDS } from '../../domain/ids';

const FACTION = SMASHUP_FACTION_IDS.BIG_HERO_6;
const CARD_ATLAS = SMASHUP_ATLAS_IDS.DISNEY_FOUR_FACTION_CARDS;
const BASE_ATLAS = SMASHUP_ATLAS_IDS.DISNEY_FOUR_FACTION_BASES;

export const BIG_HERO_6_MINIONS: MinionCardDef[] = [
    { id: 'big_hero_6_microbot_swarm', type: 'minion', name: '微型机器群', nameEn: 'Microbot Swarm', faction: FACTION, power: 2, abilityTags: ['onPlay', 'talent'], activatableAbilities: [{ kind: 'talent', zone: 'board', window: 'playCards' }], count: 4, previewRef: { type: 'atlas', atlasId: CARD_ATLAS, index: 0 } },
    { id: 'big_hero_6_baymax', type: 'minion', name: '大白', nameEn: 'Baymax', faction: FACTION, power: 3, abilityTags: ['ongoing', 'special'], activatableAbilities: [{ kind: 'special', zone: 'board', window: 'afterScoring', sourceScope: 'scoringBase' }], count: 1, previewRef: { type: 'atlas', atlasId: CARD_ATLAS, index: 1 } },
    { id: 'big_hero_6_fred_frederickson_iv', type: 'minion', name: '弗雷德IV世', nameEn: 'Fred Frederickson IV', faction: FACTION, power: 3, abilityTags: ['talent'], activatableAbilities: [{ kind: 'talent', zone: 'board', window: 'playCards' }], count: 1, previewRef: { type: 'atlas', atlasId: CARD_ATLAS, index: 2 } },
    { id: 'big_hero_6_go_go_tomago', type: 'minion', name: '神行御姐', nameEn: 'Go Go Tomago', faction: FACTION, power: 3, abilityTags: ['talent'], activatableAbilities: [{ kind: 'talent', zone: 'board', window: 'playCards' }], count: 1, previewRef: { type: 'atlas', atlasId: CARD_ATLAS, index: 3 } },
    { id: 'big_hero_6_hiro_hamada', type: 'minion', name: '小宏', nameEn: 'Hiro Hamada', faction: FACTION, power: 3, abilityTags: ['talent'], activatableAbilities: [{ kind: 'talent', zone: 'board', window: 'playCards' }], count: 1, previewRef: { type: 'atlas', atlasId: CARD_ATLAS, index: 4 } },
    { id: 'big_hero_6_honey_lemon', type: 'minion', name: '哈妮柠檬', nameEn: 'Honey Lemon', faction: FACTION, power: 3, abilityTags: ['talent', 'extra'], activatableAbilities: [{ kind: 'talent', zone: 'board', window: 'playCards' }], count: 1, previewRef: { type: 'atlas', atlasId: CARD_ATLAS, index: 5 } },
    { id: 'big_hero_6_wasabi', type: 'minion', name: '芥末无疆', nameEn: 'Wasabi', faction: FACTION, power: 3, abilityTags: ['talent'], activatableAbilities: [{ kind: 'talent', zone: 'board', window: 'playCards' }], count: 1, previewRef: { type: 'atlas', atlasId: CARD_ATLAS, index: 6 } },
];

export const BIG_HERO_6_ACTIONS: ActionCardDef[] = [
    { id: 'big_hero_6_control_mask', type: 'action', subtype: 'ongoing', name: '控制面具', nameEn: 'Control Mask', faction: FACTION, abilityTags: ['onPlay', 'ongoing', 'talent', 'extra'], ongoingTarget: 'minion', playNeedsMinion: true, playTargetMinionController: 'any', activatableAbilities: [{ kind: 'talent', zone: 'board', window: 'playCards' }], count: 1, previewRef: { type: 'atlas', atlasId: CARD_ATLAS, index: 7 } },
    { id: 'big_hero_6_control_the_swarm', type: 'action', subtype: 'standard', name: '控制机器群', nameEn: 'Control the Swarm', faction: FACTION, abilityTags: ['onPlay'], count: 1, previewRef: { type: 'atlas', atlasId: CARD_ATLAS, index: 8 } },
    { id: 'big_hero_6_microbot_maker', type: 'action', subtype: 'ongoing', name: '微型机器制造者', nameEn: 'Microbot Maker', faction: FACTION, abilityTags: ['onPlay', 'ongoing', 'talent'], ongoingTarget: 'base', playNeedsBase: true, activatableAbilities: [{ kind: 'talent', zone: 'board', window: 'playCards' }], count: 1, previewRef: { type: 'atlas', atlasId: CARD_ATLAS, index: 9 } },
    { id: 'big_hero_6_new_student', type: 'action', subtype: 'standard', name: '新来的学生', nameEn: 'New Student', faction: FACTION, abilityTags: ['onPlay', 'extra'], count: 1, previewRef: { type: 'atlas', atlasId: CARD_ATLAS, index: 10 } },
    { id: 'big_hero_6_team_effort', type: 'action', subtype: 'standard', name: '团队的努力', nameEn: 'Team Effort', faction: FACTION, abilityTags: ['onPlay'], playNeedsBase: true, count: 1, previewRef: { type: 'atlas', atlasId: CARD_ATLAS, index: 11 } },
    { id: 'big_hero_6_upgrades', type: 'action', subtype: 'standard', name: '升级', nameEn: 'Upgrades', faction: FACTION, abilityTags: ['onPlay', 'extra'], count: 2, previewRef: { type: 'atlas', atlasId: CARD_ATLAS, index: 12 } },
    { id: 'big_hero_6_version_2_0', type: 'action', subtype: 'standard', name: '版本2.0', nameEn: 'Version 2.0', faction: FACTION, abilityTags: ['onPlay'], playNeedsBase: true, count: 2, previewRef: { type: 'atlas', atlasId: CARD_ATLAS, index: 13 } },
    { id: 'big_hero_6_yokai', type: 'action', subtype: 'ongoing', name: '幽灵', nameEn: 'Yokai', faction: FACTION, abilityTags: ['ongoing', 'special'], ongoingTarget: 'base', playNeedsBase: true, activatableAbilities: [{ kind: 'special', zone: 'board', window: 'afterScoring', sourceScope: 'scoringBase' }], count: 1, previewRef: { type: 'atlas', atlasId: CARD_ATLAS, index: 14 } },
];

export const BIG_HERO_6_BASES: BaseCardDef[] = [
    { id: 'base_sfit_robotics_lab', name: '旧京山理工机器人实验室', nameEn: 'SFIT Robotics Lab', breakpoint: 24, vpAwards: [4, 2, 1], faction: FACTION, previewRef: { type: 'atlas', atlasId: BASE_ATLAS, index: 10 } },
    { id: 'base_krei_tech', name: '克雷科技', nameEn: 'Krei Tech', breakpoint: 20, vpAwards: [3, 1, 1], faction: FACTION, previewRef: { type: 'atlas', atlasId: BASE_ATLAS, index: 11 } },
];

export const BIG_HERO_6_CARDS: CardDef[] = [
    ...BIG_HERO_6_MINIONS,
    ...BIG_HERO_6_ACTIONS,
];
