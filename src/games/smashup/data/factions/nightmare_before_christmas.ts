import type { ActionCardDef, BaseCardDef, CardDef, MinionCardDef, SmashUpActivatableAbility } from '../../domain/types';
import { SMASHUP_ATLAS_IDS, SMASHUP_FACTION_IDS } from '../../domain/ids';

const FACTION = SMASHUP_FACTION_IDS.NIGHTMARE_BEFORE_CHRISTMAS;
const CARD_ATLAS = SMASHUP_ATLAS_IDS.DISNEY_CARDS;
const BASE_ATLAS = SMASHUP_ATLAS_IDS.DISNEY_BASES;

const TALENT: SmashUpActivatableAbility[] = [{ kind: 'talent', zone: 'board', window: 'playCards' }];

export const NIGHTMARE_BEFORE_CHRISTMAS_MINIONS: MinionCardDef[] = [
    { id: 'nightmare_before_christmas_jack_skellington', type: 'minion', name: '杰克骷髅王', nameEn: 'Jack Skellington', faction: FACTION, power: 5, abilityTags: ['onPlay', 'ongoing'], count: 1, previewRef: { type: 'atlas', atlasId: CARD_ATLAS, index: 27 } },
    { id: 'nightmare_before_christmas_halloween_town_folks', type: 'minion', name: '万圣节镇的人们', nameEn: 'Halloween Town Folks', faction: FACTION, power: 2, abilityTags: ['onPlay'], count: 4, previewRef: { type: 'atlas', atlasId: CARD_ATLAS, index: 28 } },
    {
        id: 'nightmare_before_christmas_lock_shock_and_barrel',
        type: 'minion',
        name: '锁、震与桶',
        nameEn: 'Lock, Shock & Barrel',
        faction: FACTION,
        power: 3,
        abilityTags: ['special', 'extra'],
        activatableAbilities: [{ kind: 'special', zone: 'board', window: 'beforeScoring', sourceScope: 'scoringBase' }],
        count: 1,
        previewRef: { type: 'atlas', atlasId: CARD_ATLAS, index: 29 },
    },
    { id: 'nightmare_before_christmas_the_mayor_of_halloween_town', type: 'minion', name: '万圣节镇的市长', nameEn: 'The Mayor of Halloween Town', faction: FACTION, power: 3, abilityTags: ['ongoing'], count: 1, previewRef: { type: 'atlas', atlasId: CARD_ATLAS, index: 30 } },
    { id: 'nightmare_before_christmas_dr_finkelstein', type: 'minion', name: '芬克尔斯坦博士', nameEn: 'Dr. Finkelstein', faction: FACTION, power: 4, abilityTags: ['talent'], activatableAbilities: TALENT, count: 1, previewRef: { type: 'atlas', atlasId: CARD_ATLAS, index: 31 } },
    { id: 'nightmare_before_christmas_sally', type: 'minion', name: '莎莉', nameEn: 'Sally', faction: FACTION, power: 4, abilityTags: ['talent', 'extra'], activatableAbilities: TALENT, count: 1, previewRef: { type: 'atlas', atlasId: CARD_ATLAS, index: 32 } },
    { id: 'nightmare_before_christmas_zero', type: 'minion', name: '幽灵犬', nameEn: 'Zero', faction: FACTION, power: 0, abilityTags: ['ongoing', 'special', 'extra'], count: 1, previewRef: { type: 'atlas', atlasId: CARD_ATLAS, index: 33 } },
];

export const NIGHTMARE_BEFORE_CHRISTMAS_ACTIONS: ActionCardDef[] = [
    { id: 'nightmare_before_christmas_christmas_will_be_ours', type: 'action', subtype: 'standard', name: '圣诞节将属于我们！', nameEn: 'Christmas Will Be Ours!', faction: FACTION, abilityTags: ['onPlay', 'extra'], count: 1, previewRef: { type: 'atlas', atlasId: CARD_ATLAS, index: 34 } },
    { id: 'nightmare_before_christmas_ghostly_presents', type: 'action', subtype: 'ongoing', name: '幽灵礼物', nameEn: 'Ghostly Presents', faction: FACTION, abilityTags: ['onPlay', 'ongoing', 'extra'], ongoingTarget: 'minion', playNeedsMinion: true, playTargetMinionController: 'any', count: 2, previewRef: { type: 'atlas', atlasId: CARD_ATLAS, index: 35 } },
    { id: 'nightmare_before_christmas_jack_o_lantern_in_the_box', type: 'action', subtype: 'ongoing', name: '盒子里的杰克南瓜灯', nameEn: 'Jack-O’lantern-in-the-Box', faction: FACTION, abilityTags: ['ongoing'], ongoingTarget: 'minion', playNeedsMinion: true, playTargetMinionController: 'any', count: 1, previewRef: { type: 'atlas', atlasId: CARD_ATLAS, index: 36 } },
    { id: 'nightmare_before_christmas_monster_garland', type: 'action', subtype: 'ongoing', name: '怪物花环', nameEn: 'Monster Garland', faction: FACTION, abilityTags: ['ongoing'], ongoingTarget: 'minion', playNeedsMinion: true, playTargetMinionController: 'any', count: 2, previewRef: { type: 'atlas', atlasId: CARD_ATLAS, index: 37 } },
    { id: 'nightmare_before_christmas_oogie_boogie', type: 'action', subtype: 'ongoing', name: '乌基布基', nameEn: 'Oogie Boogie', faction: FACTION, abilityTags: ['onPlay', 'ongoing'], ongoingTarget: 'minion', playNeedsMinion: true, playTargetMinionController: 'any', count: 1, previewRef: { type: 'atlas', atlasId: CARD_ATLAS, index: 38 } },
    { id: 'nightmare_before_christmas_sandy_claws_costume', type: 'action', subtype: 'ongoing', name: '圣诞老人服装', nameEn: 'Sandy Claws Costume', faction: FACTION, abilityTags: ['ongoing', 'special'], ongoingTarget: 'minion', playNeedsMinion: true, playTargetMinionController: 'any', count: 1, previewRef: { type: 'atlas', atlasId: CARD_ATLAS, index: 39 } },
    { id: 'nightmare_before_christmas_winter_surprise', type: 'action', subtype: 'standard', name: '冬季惊喜', nameEn: 'Winter Surprise', faction: FACTION, abilityTags: ['onPlay', 'extra'], count: 1, previewRef: { type: 'atlas', atlasId: CARD_ATLAS, index: 40 } },
    { id: 'nightmare_before_christmas_zombie_duck_toy', type: 'action', subtype: 'ongoing', name: '玩具僵尸鸭', nameEn: 'Zombie Duck Toy', faction: FACTION, abilityTags: ['ongoing', 'special'], ongoingTarget: 'minion', playNeedsMinion: true, playTargetMinionController: 'any', count: 1, previewRef: { type: 'atlas', atlasId: CARD_ATLAS, index: 41 } },
];

export const NIGHTMARE_BEFORE_CHRISTMAS_CARDS: CardDef[] = [
    ...NIGHTMARE_BEFORE_CHRISTMAS_MINIONS,
    ...NIGHTMARE_BEFORE_CHRISTMAS_ACTIONS,
];

export const NIGHTMARE_BEFORE_CHRISTMAS_BASES: BaseCardDef[] = [
    { id: 'base_halloween_town', name: '万圣节镇', nameEn: 'Halloween Town', breakpoint: 25, vpAwards: [5, 3, 2], faction: FACTION, previewRef: { type: 'atlas', atlasId: BASE_ATLAS, index: 10 } },
    { id: 'base_spiral_hill', name: '螺旋山丘', nameEn: 'Spiral Hill', breakpoint: 23, vpAwards: [4, 2, 1], faction: FACTION, previewRef: { type: 'atlas', atlasId: BASE_ATLAS, index: 14 } },
];
