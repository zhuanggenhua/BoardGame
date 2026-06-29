import { defineEvents } from '../../../lib/audio/defineEvents';

const CARD_DRAW_KEY = 'card.fx.decks_and_cards_sound_fx_pack.fx_magic_deck_003';
const TAKE_FROM_DISCARD_KEY = 'card.fx.decks_and_cards_sound_fx_pack.fx_flying_cards_001';
const CARD_DISCARD_KEY = 'card.fx.decks_and_cards_sound_fx_pack.fx_discard_003';

export const FANTASY_REALMS_AUDIO_EVENTS = defineEvents({
    FOCUS_CARD_SET: 'silent',
    CARDS_DRAWN: {
        audio: 'immediate',
        sound: CARD_DRAW_KEY,
    },
    DISCARD_CARD_TAKEN: {
        audio: 'immediate',
        sound: TAKE_FROM_DISCARD_KEY,
    },
    CARD_DISCARDED: {
        audio: 'immediate',
        sound: CARD_DISCARD_KEY,
    },
});

export const FANTASY_REALMS_AUDIO_EVENT_KEYS = {
    CARD_DRAW_KEY,
    TAKE_FROM_DISCARD_KEY,
    CARD_DISCARD_KEY,
} as const;
