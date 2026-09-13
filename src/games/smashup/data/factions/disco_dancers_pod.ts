import type { ActionCardDef, CardDef, MinionCardDef } from '../../domain/types';
import { SMASHUP_ATLAS_IDS, SMASHUP_FACTION_IDS } from '../../domain/ids';
import { DISCO_DANCERS_CARDS, TRUCKERS_CARDS } from './zhongguo';

const FACTION = SMASHUP_FACTION_IDS.DISCO_DANCERS_POD;
const ATLAS = SMASHUP_ATLAS_IDS.DISCO_DANCERS_POD_CARDS;

const SLOT_BY_CLASSIC_ID = {
    disco_dancers_its_raining_men: 0,
    disco_dancers_i_will_survive: 1,
    disco_dancers_im_so_excited: 2,
    disco_dancers_we_are_family: 3,
    disco_dancers_get_down_tonight: 4,
    disco_dancers_stayin_alive: 5,
    disco_dancers_disco_inferno: 6,
    disco_dancers_last_dance: 7,
    disco_dancers_celebration: 8,
    disco_dancers_roller: 10,
    disco_dancers_diva: 14,
    disco_dancers_ul_disco_lou: 17,
    disco_dancers_dancing_king: 19,
} as const;

function getSlot(classicId: keyof typeof SLOT_BY_CLASSIC_ID): number {
    return SLOT_BY_CLASSIC_ID[classicId];
}

function getClassicDiscoCard<T extends CardDef>(classicId: keyof typeof SLOT_BY_CLASSIC_ID): T {
    const card = DISCO_DANCERS_CARDS.find((candidate) => candidate.id === classicId);
    if (!card) {
        throw new Error(`[smashup] missing classic Disco Dancers card for POD clone: ${classicId}`);
    }
    return card as T;
}

function cloneDiscoCard<T extends ActionCardDef | MinionCardDef>(classicId: keyof typeof SLOT_BY_CLASSIC_ID): T {
    const card = getClassicDiscoCard<T>(classicId);
    const count = classicId === 'disco_dancers_get_down_tonight' ? 1 : card.count;
    return {
        ...card,
        id: `${classicId}_pod`,
        faction: FACTION,
        count,
        ...(classicId === 'disco_dancers_ul_disco_lou' ? { nameEn: 'Disco Lou' } : {}),
        previewRef: { type: 'atlas', atlasId: ATLAS, index: getSlot(classicId) },
    } as T;
}

function cloneTurnTheBeatAround(): ActionCardDef {
    const source = TRUCKERS_CARDS.find((card) => card.id === 'truckers_turn_the_beat_around');
    if (!source || source.type !== 'action') {
        throw new Error('[smashup] missing Truckers Turn The Beat Around source for Disco Dancers POD clone');
    }
    return {
        ...source,
        id: 'disco_dancers_turn_the_beat_around_pod',
        faction: FACTION,
        count: 1,
        previewRef: { type: 'atlas', atlasId: ATLAS, index: 9 },
    };
}

export const DISCO_DANCERS_POD_ACTIONS: ActionCardDef[] = [
    cloneDiscoCard<ActionCardDef>('disco_dancers_its_raining_men'),
    cloneDiscoCard<ActionCardDef>('disco_dancers_i_will_survive'),
    cloneDiscoCard<ActionCardDef>('disco_dancers_im_so_excited'),
    cloneDiscoCard<ActionCardDef>('disco_dancers_we_are_family'),
    cloneDiscoCard<ActionCardDef>('disco_dancers_get_down_tonight'),
    cloneDiscoCard<ActionCardDef>('disco_dancers_stayin_alive'),
    cloneDiscoCard<ActionCardDef>('disco_dancers_disco_inferno'),
    cloneDiscoCard<ActionCardDef>('disco_dancers_last_dance'),
    cloneDiscoCard<ActionCardDef>('disco_dancers_celebration'),
    cloneTurnTheBeatAround(),
];

export const DISCO_DANCERS_POD_MINIONS: MinionCardDef[] = [
    cloneDiscoCard<MinionCardDef>('disco_dancers_roller'),
    cloneDiscoCard<MinionCardDef>('disco_dancers_diva'),
    cloneDiscoCard<MinionCardDef>('disco_dancers_ul_disco_lou'),
    cloneDiscoCard<MinionCardDef>('disco_dancers_dancing_king'),
];

export const DISCO_DANCERS_POD_CARDS: CardDef[] = [
    ...DISCO_DANCERS_POD_ACTIONS,
    ...DISCO_DANCERS_POD_MINIONS,
];
