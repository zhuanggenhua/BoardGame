import type { ActionCardDef, CardDef, MinionCardDef } from '../../domain/types';
import { SMASHUP_ATLAS_IDS, SMASHUP_FACTION_IDS } from '../../domain/ids';
import { TEDDY_BEARS_ACTIONS, TEDDY_BEARS_MINIONS } from './what_were_we_thinking';

const FACTION = SMASHUP_FACTION_IDS.TEDDY_BEARS_POD;
const ATLAS = SMASHUP_ATLAS_IDS.TEDDY_BEARS_POD_CARDS;

const SLOT_BY_CLASSIC_ID = {
    teddy_bears_tea_party: 0,
    teddy_bears_cuddle: 1,
    teddy_bears_care_package: 3,
    teddy_bears_group_hug: 5,
    teddy_bears_bear_picnic: 6,
    teddy_bears_too_cute: 7,
    teddy_bears_love_overload: 8,
    teddy_bears_square_deal: 9,
    teddy_bears_snuggly_bear: 10,
    teddy_bears_lovey_bear: 14,
    teddy_bears_fun_bear: 17,
    teddy_bears_sir_squeezes: 19,
} as const;

type TeddyClassicId = keyof typeof SLOT_BY_CLASSIC_ID;

function getClassicTeddyCard<T extends ActionCardDef | MinionCardDef>(
    classicId: TeddyClassicId,
    cards: readonly T[],
): T {
    const card = cards.find((candidate) => candidate.id === classicId);
    if (!card) {
        throw new Error(`[smashup] missing classic Teddy Bears card for POD clone: ${classicId}`);
    }
    return card;
}

function cloneTeddyCard<T extends ActionCardDef | MinionCardDef>(card: T): T {
    return {
        ...card,
        id: `${card.id}_pod`,
        faction: FACTION,
        previewRef: { type: 'atlas', atlasId: ATLAS, index: SLOT_BY_CLASSIC_ID[card.id as TeddyClassicId] },
    } as T;
}

function teddyAction(classicId: Extract<TeddyClassicId, `teddy_bears_${string}`>): ActionCardDef {
    return cloneTeddyCard(getClassicTeddyCard(classicId, TEDDY_BEARS_ACTIONS));
}

function teddyMinion(classicId: Extract<TeddyClassicId, `teddy_bears_${string}`>): MinionCardDef {
    return cloneTeddyCard(getClassicTeddyCard(classicId, TEDDY_BEARS_MINIONS));
}

export const TEDDY_BEARS_POD_ACTIONS: ActionCardDef[] = [
    teddyAction('teddy_bears_tea_party'),
    teddyAction('teddy_bears_cuddle'),
    teddyAction('teddy_bears_care_package'),
    teddyAction('teddy_bears_group_hug'),
    teddyAction('teddy_bears_bear_picnic'),
    teddyAction('teddy_bears_too_cute'),
    teddyAction('teddy_bears_love_overload'),
    teddyAction('teddy_bears_square_deal'),
];

export const TEDDY_BEARS_POD_MINIONS: MinionCardDef[] = [
    teddyMinion('teddy_bears_snuggly_bear'),
    teddyMinion('teddy_bears_lovey_bear'),
    teddyMinion('teddy_bears_fun_bear'),
    teddyMinion('teddy_bears_sir_squeezes'),
];

export const TEDDY_BEARS_POD_CARDS: CardDef[] = [
    ...TEDDY_BEARS_POD_ACTIONS,
    ...TEDDY_BEARS_POD_MINIONS,
];
