import type { GameAudioConfig } from '../../lib/audio/types';
import { collectPreloadKeys, createFeedbackResolver, defineEvents } from '../../lib/audio/defineEvents';
import { COMMON_AUDIO_BASE_PATH } from '../../lib/audio/commonRegistry';
import type { FateDominationCore } from './domain/types';

const CARD_PLAY = 'card.handling.mini_games_sound_effects_and_music_pack.card.sfx_card_play_1';
const CARD_DRAW = 'card.handling.mini_games_sound_effects_and_music_pack.card.sfx_card_draw_1';
const FOOTSTEP = 'footsteps.kenney_impact_sounds.footstep_concrete_000';
const SPELL = 'magic.general.simple_magic_sound_fx_pack_vol.shock.lightning_bolt_cast_a';
const ABILITY_ACTIVATION_SOUNDS: ReadonlyMap<string, string> = new Map([
    ['sc_saber_1', 'magic.general.simple_magic_sound_fx_pack_vol.light.holy_ward'],
    ['sc_saber_2', 'magic.wind.44.wind_magic_buff_01'],
    ['sc_medusa_2', 'magic.general.simple_magic_sound_fx_pack_vol.earth.earthen_grasp'],
    ['sc_cu_1', 'ambient.khron_studio_sound_of_survival_vol_1_assets.weapons.spear.metal_spear.whoosh_metal_spear.weappole_whoosh_metal_spear_01_krst'],
]);
export const FATE_BATTLE_IMPACT = 'combat.general.khron_studio_fight_fury_vol_1_assets.sword_hit.weapswrd_sword_hit_01';
const MOONVEIL = 'bgm.fantasy.fantasy_music_pack_vol.moonveil_rt_5.fantasy_vol8_moonveil_main';
const SORCERER = 'bgm.fantasy.fantasy_music_pack_vol.sorcerer_rt_3.sorcerer_main';

const events = defineEvents({
    ATTACKS_CONFIRMED: { audio: 'immediate', sound: CARD_PLAY },
    FATE_RIDING_CARDS_PLAYED: { audio: 'immediate', sound: CARD_PLAY },
    FATE_CARDS_DRAWN: { audio: 'immediate', sound: CARD_DRAW },
    MASTER_DEPLOYED: { audio: 'immediate', sound: FOOTSTEP },
    PLAYER_MOVED: { audio: 'immediate', sound: FOOTSTEP },
    COMMAND_SPELL_USED: { audio: 'immediate', sound: SPELL },
    LOCATION_RESOLVED: 'fx',
    FATE_ABILITY_USED: 'silent',
    ATTACK_CARD_SELECTED: 'ui',
});
const resolveSound = createFeedbackResolver(events);

export const FATE_DOMINATION_AUDIO_CONFIG: GameAudioConfig = {
    basePath: COMMON_AUDIO_BASE_PATH,
    criticalSounds: collectPreloadKeys(events),
    warmSounds: [FATE_BATTLE_IMPACT, ...ABILITY_ACTIVATION_SOUNDS.values()],
    bgm: [
        { key: MOONVEIL, name: 'Moonveil', src: 'bgm/fantasy/Fantasy Music Pack Vol. 8/Moonveil (RT 5.625)/Fantasy Vol8 Moonveil Main.ogg', volume: .38 },
        { key: SORCERER, name: 'Sorcerer', src: 'bgm/fantasy/Fantasy Music Pack Vol. 3/Sorcerer (RT 3.75)/Sorcerer Main.ogg', volume: .4 },
    ],
    bgmGroups: { normal: [MOONVEIL], battle: [SORCERER] },
    bgmRules: [
        { when: context => (context.G as FateDominationCore).phase === 'battle', key: SORCERER, group: 'battle' },
        { when: context => (context.G as FateDominationCore).phase !== 'complete', key: MOONVEIL, group: 'normal' },
    ],
    feedbackResolver: (event, context) => {
        const payload = event.payload as { playerId?: string; drawn?: unknown[]; cardIds?: unknown[]; mode?: string; effect?: string; skillId?: string } | undefined;
        if (event.type === 'FATE_CARDS_DRAWN' && (!payload?.drawn?.length || payload.playerId !== (context.ctx as { playerId?: string } | undefined)?.playerId)) return null;
        if (event.type === 'FATE_RIDING_CARDS_PLAYED' && !payload?.cardIds?.length) return null;
        if (event.type === 'COMMAND_SPELL_USED' && payload?.effect === 'move') return null;
        if (event.type === 'PLAYER_MOVED' && payload?.mode === 'effect') return SPELL;
        if (event.type === 'FATE_ABILITY_USED' && payload?.skillId) return ABILITY_ACTIVATION_SOUNDS.get(payload.skillId.split(':')[0]) ?? null;
        return resolveSound(event);
    },
};
