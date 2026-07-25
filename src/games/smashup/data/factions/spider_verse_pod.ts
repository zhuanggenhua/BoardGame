import type { CardDef } from '../../domain/types';
import { SMASHUP_ATLAS_IDS, SMASHUP_FACTION_IDS } from '../../domain/ids';

const FACTION = SMASHUP_FACTION_IDS.SPIDER_VERSE_POD;
const ATLAS = SMASHUP_ATLAS_IDS.MARVEL_WAVE_ONE_POD_CARDS;

export const SPIDER_VERSE_POD_CARDS: CardDef[] = [
    { id: 'spider_verse_spider_man_pod', type: 'minion', name: '蜘蛛侠', nameEn: 'Spider-Man', faction: FACTION, power: 5, abilityTags: ['ongoing'], count: 1, previewRef: { type: 'atlas', atlasId: ATLAS, index: 30 } },
    { id: 'spider_verse_ghost_spider_pod', type: 'minion', name: '幽灵蜘蛛侠', nameEn: 'Ghost-Spider', faction: FACTION, power: 4, abilityTags: ['onPlay'], count: 2, previewRef: { type: 'atlas', atlasId: ATLAS, index: 31 } },
    { id: 'spider_verse_miles_morales_pod', type: 'minion', name: '迈尔斯·莫拉莱斯', nameEn: 'Miles Morales', faction: FACTION, power: 3, abilityTags: ['special'], beforeScoringPlayable: true, count: 3, previewRef: { type: 'atlas', atlasId: ATLAS, index: 32 } },
    { id: 'spider_verse_spider_man_2099_pod', type: 'minion', name: '蜘蛛侠2099', nameEn: 'Spider-Man 2099', faction: FACTION, power: 2, abilityTags: ['ongoing'], count: 4, previewRef: { type: 'atlas', atlasId: ATLAS, index: 33 } },
    { id: 'spider_verse_great_responsibility_pod', type: 'action', subtype: 'standard', name: '…责任越大', nameEn: '...Comes Great Responsibility', faction: FACTION, abilityTags: ['onPlay', 'special', 'extra'], responseWindowTiming: 'beforeScoring', responseWindowNeedsBase: true, count: 1, previewRef: { type: 'atlas', atlasId: ATLAS, index: 34 } },
    { id: 'spider_verse_spider_reflexes_pod', type: 'action', subtype: 'standard', name: '蜘蛛反应', nameEn: 'Spider Reflexes', faction: FACTION, abilityTags: ['onPlay', 'extra'], count: 1, previewRef: { type: 'atlas', atlasId: ATLAS, index: 35 } },
    { id: 'spider_verse_spider_sense_pod', type: 'action', subtype: 'standard', name: '蜘蛛感应', nameEn: 'Spider-Sense', faction: FACTION, abilityTags: ['onPlay', 'special'], responseWindowTiming: 'afterScoring', responseWindowNeedsBase: true, count: 1, previewRef: { type: 'atlas', atlasId: ATLAS, index: 36 } },
    { id: 'spider_verse_bond_pod', type: 'action', subtype: 'ongoing', name: '蜘蛛侠-平行宇宙', nameEn: 'Spider-Verse Bond', faction: FACTION, abilityTags: ['ongoing'], ongoingTarget: 'minion', playNeedsMinion: true, count: 1, previewRef: { type: 'atlas', atlasId: ATLAS, index: 37 } },
    { id: 'spider_verse_view_from_above_pod', type: 'action', subtype: 'standard', name: '高处不胜寒', nameEn: 'The View From Above', faction: FACTION, abilityTags: ['onPlay'], count: 2, previewRef: { type: 'atlas', atlasId: ATLAS, index: 38 } },
    { id: 'spider_verse_webbed_up_pod', type: 'action', subtype: 'ongoing', name: '束缚', nameEn: 'Webbed Up', faction: FACTION, abilityTags: ['ongoing'], ongoingTarget: 'minion', playNeedsMinion: true, count: 1, previewRef: { type: 'atlas', atlasId: ATLAS, index: 39 } },
    { id: 'spider_verse_with_great_power_pod', type: 'action', subtype: 'standard', name: '能力越大…', nameEn: 'With Great Power...', faction: FACTION, abilityTags: ['onPlay', 'special'], responseWindowTiming: 'beforeScoring', responseWindowNeedsBase: true, count: 2, previewRef: { type: 'atlas', atlasId: ATLAS, index: 40 } },
    { id: 'spider_verse_friendly_neighborhood_hero_pod', type: 'action', subtype: 'special', name: '你的好邻居英雄', nameEn: 'Your Friendly Neighborhood Hero', faction: FACTION, abilityTags: ['special'], specialTiming: 'afterScoring', specialNeedsBase: true, count: 1, previewRef: { type: 'atlas', atlasId: ATLAS, index: 41 } },
];
