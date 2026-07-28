import type { ActionCardDef, BaseCardDef, CardDef, MinionCardDef, SmashUpActivatableAbility } from '../../domain/types';
import { SMASHUP_ATLAS_IDS, SMASHUP_FACTION_IDS } from '../../domain/ids';

const FACTION = SMASHUP_FACTION_IDS.WRECK_IT_RALPH;
const CARD_ATLAS = SMASHUP_ATLAS_IDS.DISNEY_CARDS;
const BASE_ATLAS = SMASHUP_ATLAS_IDS.DISNEY_BASES;

const TALENT: SmashUpActivatableAbility[] = [{ kind: 'talent', zone: 'board', window: 'playCards' }];

export const WRECK_IT_RALPH_MINIONS: MinionCardDef[] = [
    { id: 'wreck_it_ralph_sugar_rush_racer', type: 'minion', name: '甜蜜冲刺车手', nameEn: 'Sugar Rush Racer', faction: FACTION, power: 2, abilityTags: ['ongoing'], count: 4, previewRef: { type: 'atlas', atlasId: CARD_ATLAS, index: 42 } },
    { id: 'wreck_it_ralph_sergeant_calhoun', type: 'minion', name: '卡尔霍恩军士', nameEn: 'Sergeant Calhoun', faction: FACTION, power: 3, abilityTags: ['talent'], activatableAbilities: TALENT, count: 3, previewRef: { type: 'atlas', atlasId: CARD_ATLAS, index: 43 } },
    { id: 'wreck_it_ralph_vanellope_von_schweetz', type: 'minion', name: '云妮洛普', nameEn: 'Vanellope Von Schweetz', faction: FACTION, power: 3, abilityTags: ['talent'], activatableAbilities: TALENT, count: 1, previewRef: { type: 'atlas', atlasId: CARD_ATLAS, index: 44 } },
    { id: 'wreck_it_ralph_fix_it_felix_jr', type: 'minion', name: '快手阿修', nameEn: 'Fix-It Felix Jr.', faction: FACTION, power: 4, abilityTags: ['onPlay', 'talent'], activatableAbilities: TALENT, count: 1, previewRef: { type: 'atlas', atlasId: CARD_ATLAS, index: 45 } },
    { id: 'wreck_it_ralph_wreck_it_ralph', type: 'minion', name: '破坏王拉尔夫', nameEn: 'Wreck-It Ralph', faction: FACTION, power: 5, abilityTags: ['talent', 'extra'], activatableAbilities: TALENT, count: 1, previewRef: { type: 'atlas', atlasId: CARD_ATLAS, index: 46 } },
];

export const WRECK_IT_RALPH_ACTIONS: ActionCardDef[] = [
    { id: 'wreck_it_ralph_cy_bug_infestation', type: 'action', subtype: 'ongoing', name: 'Cy-Bug 灾变', nameEn: 'Cy-Bug Infestation', faction: FACTION, abilityTags: ['talent'], activatableAbilities: TALENT, ongoingTarget: 'base', playNeedsBase: true, count: 1, previewRef: { type: 'atlas', atlasId: CARD_ATLAS, index: 47 } },
    { id: 'wreck_it_ralph_escape_pod', type: 'action', subtype: 'standard', name: '逃生舱', nameEn: 'Escape Pod', faction: FACTION, abilityTags: ['onPlay', 'special'], responseWindowTiming: 'beforeScoring', responseWindowNeedsBase: true, count: 2, previewRef: { type: 'atlas', atlasId: CARD_ATLAS, index: 48 } },
    { id: 'wreck_it_ralph_i_m_gonna_wreck_it', type: 'action', subtype: 'ongoing', name: '我要破坏它！', nameEn: 'I’m Gonna Wreck It!', faction: FACTION, abilityTags: ['ongoing', 'talent'], activatableAbilities: TALENT, ongoingTarget: 'base', playNeedsBase: true, count: 2, previewRef: { type: 'atlas', atlasId: CARD_ATLAS, index: 49 } },
    { id: 'wreck_it_ralph_kart_bakery', type: 'action', subtype: 'ongoing', name: '卡丁车面包房', nameEn: 'Kart Bakery', faction: FACTION, abilityTags: ['talent'], activatableAbilities: TALENT, ongoingTarget: 'base', playNeedsBase: true, count: 1, previewRef: { type: 'atlas', atlasId: CARD_ATLAS, index: 50 } },
    { id: 'wreck_it_ralph_king_candy', type: 'action', subtype: 'ongoing', name: '糖果国王', nameEn: 'King Candy', faction: FACTION, abilityTags: ['talent'], activatableAbilities: TALENT, ongoingTarget: 'base', playNeedsBase: true, count: 1, previewRef: { type: 'atlas', atlasId: CARD_ATLAS, index: 51 } },
    { id: 'wreck_it_ralph_mints_eruption', type: 'action', subtype: 'standard', name: '薄荷喷发', nameEn: 'Mints Eruption', faction: FACTION, abilityTags: ['onPlay'], playNeedsBase: true, count: 1, previewRef: { type: 'atlas', atlasId: CARD_ATLAS, index: 52 } },
    { id: 'wreck_it_ralph_research_lab_beacon', type: 'action', subtype: 'ongoing', name: '研究实验室信标', nameEn: 'Research Lab Beacon', faction: FACTION, abilityTags: ['ongoing', 'talent'], activatableAbilities: TALENT, ongoingTarget: 'base', playNeedsBase: true, count: 1, previewRef: { type: 'atlas', atlasId: CARD_ATLAS, index: 53 } },
    { id: 'wreck_it_ralph_sugar_rush', type: 'action', subtype: 'ongoing', name: '甜蜜冲刺', nameEn: 'Sugar Rush', faction: FACTION, abilityTags: ['talent'], activatableAbilities: TALENT, ongoingTarget: 'base', playNeedsBase: true, count: 1, previewRef: { type: 'atlas', atlasId: CARD_ATLAS, index: 54 } },
];

export const WRECK_IT_RALPH_CARDS: CardDef[] = [
    ...WRECK_IT_RALPH_MINIONS,
    ...WRECK_IT_RALPH_ACTIONS,
];

export const WRECK_IT_RALPH_BASES: BaseCardDef[] = [
    { id: 'base_the_dump', name: '垃圾场', nameEn: 'The Dump', breakpoint: 20, vpAwards: [4, 2, 2], faction: FACTION, previewRef: { type: 'atlas', atlasId: BASE_ATLAS, index: 0 } },
    { id: 'base_the_power_strip', name: '电源插排', nameEn: 'The Power Strip', breakpoint: 22, vpAwards: [4, 2, 1], faction: FACTION, previewRef: { type: 'atlas', atlasId: BASE_ATLAS, index: 4 } },
];
