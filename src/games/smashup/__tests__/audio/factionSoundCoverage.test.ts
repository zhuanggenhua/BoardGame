import { describe, expect, it } from 'vitest';

import { SMASHUP_AUDIO_CONFIG } from '../../audio.config';
import { getAllCardDefs } from '../../data/cards';
import { SU_EVENT_TYPES } from '../../domain/events';
import { normalizeFactionSelectionId, SMASHUP_FACTION_IDS } from '../../domain/ids';

const GENERIC_MINION_KEY = 'card.handling.decks_and_cards_sound_fx_pack.card_placing_001';
const GENERIC_ACTION_KEY = 'card.fx.decks_and_cards_sound_fx_pack.fx_magic_deck_001';
const HULUWAWA_WU_WA_KEY = 'magic.general.simple_magic_sound_fx_pack_vol.water.aqua_jet_cast_b';

const NEW_FACTION_IDS = [
    SMASHUP_FACTION_IDS.ANCIENT_EGYPTIANS,
    SMASHUP_FACTION_IDS.CYBORG_APES,
    SMASHUP_FACTION_IDS.DRAGONS,
    SMASHUP_FACTION_IDS.FAIRIES,
    SMASHUP_FACTION_IDS.GEEKS,
    SMASHUP_FACTION_IDS.HULUWAWA,
    SMASHUP_FACTION_IDS.ITTY_CRITTERS,
    SMASHUP_FACTION_IDS.KAIJU,
    SMASHUP_FACTION_IDS.MAGICAL_GIRLS,
    SMASHUP_FACTION_IDS.MEGA_TROOPERS,
    SMASHUP_FACTION_IDS.MYTHIC_GREEKS,
    SMASHUP_FACTION_IDS.PRINCESSES,
    SMASHUP_FACTION_IDS.SAMURAI,
    SMASHUP_FACTION_IDS.SHAPESHIFTERS,
    SMASHUP_FACTION_IDS.SHARKS,
    SMASHUP_FACTION_IDS.SKELETONS,
    SMASHUP_FACTION_IDS.SUPERHEROES,
    SMASHUP_FACTION_IDS.SUPER_SPIES,
    SMASHUP_FACTION_IDS.TIME_TRAVELERS,
    SMASHUP_FACTION_IDS.TORNADOS,
    SMASHUP_FACTION_IDS.VIKINGS,
    SMASHUP_FACTION_IDS.WORLD_CHAMPS,
] as const;

const POD_VARIANT_IDS = [
    SMASHUP_FACTION_IDS.ANCIENT_EGYPTIANS_POD,
    SMASHUP_FACTION_IDS.SAMURAI_POD,
    SMASHUP_FACTION_IDS.VIKINGS_POD,
    SMASHUP_FACTION_IDS.ROBOTS_POD,
] as const;

function buildFactionContext(factionId: string) {
    return {
        G: {
            players: {
                playerA: {
                    factions: [factionId],
                },
            },
        },
    } as Parameters<NonNullable<typeof SMASHUP_AUDIO_CONFIG.contextualPreloadKeys>>[0];
}

describe('大杀四方派系音效覆盖', () => {
    it('新派系和 POD 变体都能命中派系预热音效', () => {
        const preload = SMASHUP_AUDIO_CONFIG.contextualPreloadKeys;
        expect(preload).toBeTypeOf('function');

        for (const factionId of [...NEW_FACTION_IDS, ...POD_VARIANT_IDS]) {
            const keys = preload!(buildFactionContext(factionId));
            expect(keys.length, `${factionId} 应该至少预热 1 个派系音效`).toBeGreaterThan(0);
        }
    });

    it('新派系的随从和行动事件应返回派系音效而不是通用默认音', () => {
        const cards = getAllCardDefs();
        const feedbackResolver = SMASHUP_AUDIO_CONFIG.feedbackResolver;

        for (const factionId of NEW_FACTION_IDS) {
            const normalizedFactionId = normalizeFactionSelectionId(factionId);
            const minion = cards.find(card =>
                card.type === 'minion'
                && normalizeFactionSelectionId(card.faction ?? '') === normalizedFactionId,
            );
            const action = cards.find(card =>
                card.type === 'action'
                && normalizeFactionSelectionId(card.faction ?? '') === normalizedFactionId,
            );

            expect(minion, `${factionId} 应该存在至少 1 张随从卡`).toBeTruthy();
            expect(action, `${factionId} 应该存在至少 1 张行动卡`).toBeTruthy();

            const minionKey = feedbackResolver({
                type: SU_EVENT_TYPES.MINION_PLAYED,
                payload: { defId: minion!.id },
            } as never);
            expect(minionKey, `${factionId} 的随从音效不应为空`).toBeTruthy();
            expect(minionKey, `${factionId} 的随从音效不应回退到通用默认音`).not.toBe(GENERIC_MINION_KEY);

            const actionKey = feedbackResolver({
                type: SU_EVENT_TYPES.ONGOING_ATTACHED,
                payload: { defId: action!.id },
            } as never);
            expect(actionKey, `${factionId} 的行动音效不应为空`).toBeTruthy();
            expect(actionKey, `${factionId} 的行动音效不应回退到通用默认音`).not.toBe(GENERIC_ACTION_KEY);
        }
    });

    it('葫芦娃五娃应优先命中喷水语义的专属音效', () => {
        const feedbackResolver = SMASHUP_AUDIO_CONFIG.feedbackResolver;

        const minionKey = feedbackResolver({
            type: SU_EVENT_TYPES.MINION_PLAYED,
            payload: { defId: 'huluwawa_wu_wa' },
        } as never);

        expect(minionKey).toBe(HULUWAWA_WU_WA_KEY);
    });
});
