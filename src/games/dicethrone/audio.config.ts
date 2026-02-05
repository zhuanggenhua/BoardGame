/**
 * DiceThrone 音频配置
 * 仅保留事件解析/规则，音效资源统一来自 registry
 */
import type { AudioEvent, AudioRuntimeContext, GameAudioConfig } from '../../lib/audio/types';
import { pickRandomSoundKey } from '../../lib/audio/audioUtils';
import { findPlayerAbility } from './domain/abilityLookup';
import type { DiceThroneCore, TurnPhase } from './domain/types';
import { MONK_CARDS } from './monk/cards';

export const DICETHRONE_AUDIO_CONFIG: GameAudioConfig = {
    bgm: [
        {
            key: 'bgm.fantasy.fantasy_music_pack_vol.dragon_dance_rt_2.fantasy_vol5_dragon_dance_main',
            name: 'Dragon Dance',
            src: '',
            volume: 0.5,
            category: { group: 'bgm', sub: 'battle' },
        },
        {
            key: 'bgm.fantasy.fantasy_music_pack_vol.shields_and_spears_rt_2.fantasy_vol5_shields_and_spears_main',
            name: 'Shields and Spears',
            src: '',
            volume: 0.5,
            category: { group: 'bgm', sub: 'battle_intense' },
        },
    ],
    // 事件映射由 resolver 统一按类别处理
    eventSoundMap: {},
    eventSoundResolver: (event, context) => {
        const runtime = context as AudioRuntimeContext<
            DiceThroneCore,
            { currentPhase: TurnPhase; isGameOver: boolean; isWinner?: boolean },
            { currentPlayerId: string }
        >;
        const { G, meta } = runtime;

        if (event.type === 'DICE_ROLLED') {
            const diceKeys = [
                'dice.decks_and_cards_sound_fx_pack.dice_roll_velvet_001',
                'dice.decks_and_cards_sound_fx_pack.few_dice_roll_001',
            ];
            return pickRandomSoundKey('dicethrone.dice_roll', diceKeys, { minGap: 1 });
        }

        if (event.type === 'CP_CHANGED') {
            const delta = (event as AudioEvent & { payload?: { delta?: number } }).payload?.delta ?? 0;
            return delta >= 0
                ? 'status.general.player_status_sound_fx_pack_vol.positive_buffs_and_cures.charged_a'
                : 'status.general.player_status_sound_fx_pack_vol.positive_buffs_and_cures.purged_a';
        }

        if (event.type === 'CARD_PLAYED') {
            const cardId = (event as AudioEvent & { payload?: { cardId?: string } }).payload?.cardId;
            const card = findCardById(G, cardId);
            const hasEffectSfx = card?.effects?.some(effect => effect.sfxKey);
            if (hasEffectSfx) return null;
            return card?.sfxKey ?? 'card.handling.decks_and_cards_sound_fx_pack.card_placing_001';
        }

        if (event.type === 'ABILITY_ACTIVATED') {
            const payload = (event as AudioEvent & { payload?: { playerId?: string; abilityId?: string; isDefense?: boolean } }).payload;
            if (!payload?.playerId || !payload?.abilityId) return undefined;
            const match = findPlayerAbility(G, payload.playerId, payload.abilityId);
            const explicitKey = match?.variant?.sfxKey ?? match?.ability?.sfxKey;
            if (payload.isDefense) return null;
            return explicitKey ?? null;
        }

        if (event.type === 'DAMAGE_DEALT') {
            const payload = (event as AudioEvent & { payload?: { actualDamage?: number; targetId?: string } }).payload;
            const damage = payload?.actualDamage ?? 0;
            if (damage <= 0) return null;
            if (payload?.targetId && meta?.currentPlayerId && payload.targetId !== meta.currentPlayerId) {
                return damage >= 8
                    ? 'combat.general.fight_fury_vol_2.special_hit.fghtimpt_special_hit_01_krst'
                    : 'combat.general.fight_fury_vol_2.versatile_punch_hit.fghtimpt_versatile_punch_hit_01_krst';
            }
            return 'combat.general.mini_games_sound_effects_and_music_pack.body_hit.sfx_body_hit_generic_small_1';
        }

        const type = event.type;

        if (type === 'CHARACTER_SELECTED') {
            return 'ui.general.khron_studio_rpg_interface_essentials_inventory_dialog_ucs_system_192khz.dialog.dialog_choice.uiclick_dialog_choice_01_krst_none';
        }

        if (type === 'PLAYER_READY') {
            return 'ui.general.ui_menu_sound_fx_pack_vol.signals.positive.signal_positive_bells_a';
        }

        if (type === 'HOST_STARTED') {
            return 'ui.general.ui_menu_sound_fx_pack_vol.signals.update.update_chime_a';
        }

        if (type === 'SYS_PHASE_CHANGED') {
            return 'ui.general.ui_menu_sound_fx_pack_vol.signals.update.update_chime_a';
        }

        if (type === 'TURN_CHANGED') {
            return 'ui.general.ui_menu_sound_fx_pack_vol.signals.update.update_chime_a';
        }

        if (type.startsWith('BONUS_')) {
            if (type.includes('REROLL')) {
                return 'dice.decks_and_cards_sound_fx_pack.dice_roll_velvet_002';
            }
            return 'dice.decks_and_cards_sound_fx_pack.single_die_roll_001';
        }

        if (type.startsWith('DIE_')) {
            if (type.includes('LOCK')) {
                return 'dice.decks_and_cards_sound_fx_pack.dice_handling_001';
            }
            if (type.includes('MODIFIED')) {
                return 'dice.decks_and_cards_sound_fx_pack.dice_handling_002';
            }
            if (type.includes('REROLL')) {
                return 'dice.decks_and_cards_sound_fx_pack.dice_roll_velvet_002';
            }
        }

        if (type.startsWith('ROLL_')) {
            if (type.includes('CONFIRM') || type.includes('LIMIT')) {
                return 'ui.general.khron_studio_rpg_interface_essentials_inventory_dialog_ucs_system_192khz.buttons.tab_switching_button.uiclick_tab_switching_button_01_krst_none';
            }
        }

        if (type === 'HEAL_APPLIED') {
            return 'status.general.player_status_sound_fx_pack_vol.positive_buffs_and_cures.healed_a';
        }

        if (type.startsWith('STATUS_')) {
            if (type.includes('REMOVED')) {
                return 'status.general.player_status_sound_fx_pack_vol.positive_buffs_and_cures.purged_a';
            }
            return 'status.general.player_status_sound_fx_pack_vol.positive_buffs_and_cures.charged_a';
        }

        if (type.startsWith('TOKEN_')) {
            if (type.includes('GRANTED')) {
                return 'status.general.player_status_sound_fx_pack_vol.action_and_interaction.ready_a';
            }
            if (type.includes('USED') || type.includes('CONSUMED')) {
                return 'status.general.player_status_sound_fx_pack_vol.positive_buffs_and_cures.purged_a';
            }
            if (type.includes('RESPONSE_CLOSED')) {
                return 'ui.general.ui_menu_sound_fx_pack_vol.signals.negative.signal_negative_spring_a';
            }
            if (type.includes('RESPONSE_REQUESTED')) {
                return 'status.general.player_status_sound_fx_pack_vol.action_and_interaction.ready_a';
            }
        }

        if (type.startsWith('CHOICE_')) {
            if (type.includes('RESOLVED')) {
                return 'ui.general.ui_menu_sound_fx_pack_vol.signals.positive.signal_positive_bells_a';
            }
            return 'status.general.player_status_sound_fx_pack_vol.action_and_interaction.ready_a';
        }

        if (type.startsWith('RESPONSE_WINDOW_')) {
            if (type.includes('OPEN')) {
                return 'ui.general.ui_menu_sound_fx_pack_vol.signals.positive.signal_positive_spring_a';
            }
            if (type.includes('CLOSED')) {
                return 'ui.general.ui_menu_sound_fx_pack_vol.signals.negative.signal_negative_spring_a';
            }
            return null;
        }

        if (type === 'DAMAGE_SHIELD_GRANTED') {
            return 'magic.water.10.water_shield';
        }

        if (type === 'DAMAGE_PREVENTED') {
            return 'fantasy.medieval_fantasy_sound_fx_pack_vol.armor.shield_impact_a';
        }

        if (type.startsWith('ATTACK_')) {
            if (type.includes('INITIATED')) {
                const payload = (event as AudioEvent & { payload?: { attackerId?: string; sourceAbilityId?: string } }).payload;
                if (payload?.attackerId && payload?.sourceAbilityId) {
                    const match = findPlayerAbility(G, payload.attackerId, payload.sourceAbilityId);
                    const explicitKey = match?.variant?.sfxKey ?? match?.ability?.sfxKey;
                    if (explicitKey) return null;
                }
                return 'combat.general.mini_games_sound_effects_and_music_pack.weapon_swoosh.sfx_weapon_melee_swoosh_sword_1';
            }
            if (type.includes('RESOLVED')) {
                return 'combat.general.fight_fury_vol_2.special_hit.fghtimpt_special_hit_02_krst';
            }
            if (type.includes('PRE_DEFENSE')) {
                return 'combat.general.mini_games_sound_effects_and_music_pack.weapon_swoosh.sfx_weapon_melee_swoosh_small_1';
            }
        }

        if (type === 'DECK_SHUFFLED' || type === 'CARD_REORDERED' || type.startsWith('CARD_') || type === 'SELL_UNDONE') {
            const cardSoundMap: Record<string, string> = {
                CARD_DRAWN: 'card.handling.decks_and_cards_sound_fx_pack.card_take_001',
                CARD_DISCARDED: 'card.fx.decks_and_cards_sound_fx_pack.fx_discard_001',
                CARD_SOLD: 'card.fx.decks_and_cards_sound_fx_pack.fx_discard_for_gold_001',
                SELL_UNDONE: 'card.fx.decks_and_cards_sound_fx_pack.fx_boost_001',
                CARD_REORDERED: 'card.handling.decks_and_cards_sound_fx_pack.cards_scrolling_001',
                DECK_SHUFFLED: 'card.handling.decks_and_cards_sound_fx_pack.cards_shuffle_fast_001',
            };
            const mapped = cardSoundMap[type];
            if (mapped) return mapped;
        }

        return undefined;
    },
    bgmRules: [
        {
            when: (context) => {
                const { currentPhase } = context.ctx as { currentPhase?: TurnPhase };
                return currentPhase === 'offensiveRoll' || currentPhase === 'defensiveRoll';
            },
            key: 'bgm.fantasy.fantasy_music_pack_vol.shields_and_spears_rt_2.fantasy_vol5_shields_and_spears_main',
        },
        {
            when: () => true,
            key: 'bgm.fantasy.fantasy_music_pack_vol.dragon_dance_rt_2.fantasy_vol5_dragon_dance_main',
        },
    ],
    stateTriggers: [
        {
            condition: (prev, next) => {
                const prevOver = (prev.ctx as { isGameOver?: boolean }).isGameOver;
                const nextOver = (next.ctx as { isGameOver?: boolean }).isGameOver;
                return !prevOver && !!nextOver;
            },
            resolveSound: (_prev, next) => {
                const isWinner = (next.ctx as { isWinner?: boolean }).isWinner;
                return isWinner
                    ? 'stinger.mini_games_sound_effects_and_music_pack.stinger.stgr_action_win'
                    : 'stinger.mini_games_sound_effects_and_music_pack.stinger.stgr_action_lose';
            },
        },
    ],
};

const findCardById = (state: DiceThroneCore, cardId?: string) => {
    if (!cardId) return undefined;
    for (const player of Object.values(state.players)) {
        const card = player.hand.find(c => c.id === cardId)
            ?? player.deck.find(c => c.id === cardId)
            ?? player.discard.find(c => c.id === cardId);
        if (card) return card;
    }
    return MONK_CARDS.find(card => card.id === cardId);
};
