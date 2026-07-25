import type { ActionCardDef, BaseCardDef, CardDef, MinionCardDef } from '../../domain/types';
import { SMASHUP_ATLAS_IDS, SMASHUP_FACTION_IDS } from '../../domain/ids';

const FACTION = SMASHUP_FACTION_IDS.LION_KING;
const CARD_ATLAS = SMASHUP_ATLAS_IDS.DISNEY_FOUR_FACTION_CARDS;
const BASE_ATLAS = SMASHUP_ATLAS_IDS.DISNEY_BASES;

export const LION_KING_MINIONS: MinionCardDef[] = [
    { id: 'lion_king_lion_cub', type: 'minion', name: '幼狮', nameEn: 'Lion Cub', faction: FACTION, power: 2, abilityTags: ['special'], count: 4, previewRef: { type: 'atlas', atlasId: CARD_ATLAS, index: 30 } },
    { id: 'lion_king_rafiki', type: 'minion', name: '拉飞奇', nameEn: 'Rafiki', faction: FACTION, power: 3, abilityTags: ['onPlay'], count: 1, previewRef: { type: 'atlas', atlasId: CARD_ATLAS, index: 31 } },
    { id: 'lion_king_timon_and_pumbaa', type: 'minion', name: '丁满和彭彭', nameEn: 'Timon and Pumbaa', faction: FACTION, power: 3, abilityTags: ['onPlay'], count: 1, previewRef: { type: 'atlas', atlasId: CARD_ATLAS, index: 32 } },
    { id: 'lion_king_zazu', type: 'minion', name: '沙祖', nameEn: 'Zazu', faction: FACTION, power: 3, abilityTags: ['onPlay'], count: 1, previewRef: { type: 'atlas', atlasId: CARD_ATLAS, index: 33 } },
    { id: 'lion_king_nala', type: 'minion', name: '娜娜', nameEn: 'Nala', faction: FACTION, power: 4, abilityTags: ['onPlay'], count: 1, previewRef: { type: 'atlas', atlasId: CARD_ATLAS, index: 34 } },
    { id: 'lion_king_simba', type: 'minion', name: '辛巴', nameEn: 'Simba', faction: FACTION, power: 4, abilityTags: ['onPlay'], count: 1, previewRef: { type: 'atlas', atlasId: CARD_ATLAS, index: 35 } },
    { id: 'lion_king_mufasa', type: 'minion', name: '木法沙', nameEn: 'Mufasa', faction: FACTION, power: 6, abilityTags: ['special'], count: 1, previewRef: { type: 'atlas', atlasId: CARD_ATLAS, index: 36 } },
];

export const LION_KING_ACTIONS: ActionCardDef[] = [
    { id: 'lion_king_circle_of_life', type: 'action', subtype: 'ongoing', name: '生命的循环', nameEn: 'Circle of Life', faction: FACTION, abilityTags: ['ongoing', 'extra'], ongoingTarget: 'minion', playNeedsMinion: true, playTargetMinionController: 'self', count: 2, previewRef: { type: 'atlas', atlasId: CARD_ATLAS, index: 37 } },
    { id: 'lion_king_hakuna_matata', type: 'action', subtype: 'standard', name: '哈库拉·马塔塔', nameEn: 'Hakuna Matata', faction: FACTION, abilityTags: ['onPlay'], count: 1, previewRef: { type: 'atlas', atlasId: CARD_ATLAS, index: 38 } },
    { id: 'lion_king_he_lives_in_you', type: 'action', subtype: 'ongoing', name: '他活在你心中', nameEn: 'He Lives In You', faction: FACTION, abilityTags: ['ongoing'], ongoingTarget: 'base', playNeedsBase: true, count: 1, previewRef: { type: 'atlas', atlasId: CARD_ATLAS, index: 39 } },
    { id: 'lion_king_hyenas_den', type: 'action', subtype: 'ongoing', name: '鬣狗巢穴', nameEn: "Hyena's Den", faction: FACTION, abilityTags: ['ongoing', 'special'], ongoingTarget: 'base', playNeedsBase: true, activatableAbilities: [{ kind: 'special', zone: 'board', window: 'afterScoring', sourceScope: 'scoringBase' }], count: 1, previewRef: { type: 'atlas', atlasId: CARD_ATLAS, index: 40 } },
    { id: 'lion_king_just_cant_wait_to_be_king', type: 'action', subtype: 'standard', name: '迫不及待想成为国王', nameEn: "Just Can't Wait to Be King", faction: FACTION, abilityTags: ['onPlay'], count: 1, previewRef: { type: 'atlas', atlasId: CARD_ATLAS, index: 41 } },
    { id: 'lion_king_scar', type: 'action', subtype: 'standard', name: '刀疤', nameEn: 'Scar', faction: FACTION, abilityTags: ['onPlay'], count: 1, previewRef: { type: 'atlas', atlasId: CARD_ATLAS, index: 42 } },
    { id: 'lion_king_the_hyenas', type: 'action', subtype: 'standard', name: '鬣狗', nameEn: 'The Hyenas', faction: FACTION, abilityTags: ['onPlay', 'extra'], count: 1, previewRef: { type: 'atlas', atlasId: CARD_ATLAS, index: 43 } },
    { id: 'lion_king_wildebeest_stampede', type: 'action', subtype: 'standard', name: '牛羚踩踏', nameEn: 'Wildebeest Stampede', faction: FACTION, abilityTags: ['onPlay', 'extra'], count: 2, previewRef: { type: 'atlas', atlasId: CARD_ATLAS, index: 44 } },
];

export const LION_KING_BASES: BaseCardDef[] = [
    { id: 'base_jungle_paradise', name: '丛林乐园', nameEn: 'Jungle Paradise', breakpoint: 22, vpAwards: [4, 3, 1], faction: FACTION, previewRef: { type: 'atlas', atlasId: BASE_ATLAS, index: 6 } },
    { id: 'base_pride_rock', name: '荣耀石', nameEn: 'Pride Rock', breakpoint: 19, vpAwards: [3, 2, 1], faction: FACTION, previewRef: { type: 'atlas', atlasId: BASE_ATLAS, index: 7 } },
];

export const LION_KING_CARDS: CardDef[] = [
    ...LION_KING_MINIONS,
    ...LION_KING_ACTIONS,
];
