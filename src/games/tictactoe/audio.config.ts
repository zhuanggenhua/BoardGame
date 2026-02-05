/**
 * 井字棋音频配置
 * 仅保留事件解析，音效资源统一来自 registry
 */
import type { AudioEvent, GameAudioConfig } from '../../lib/audio/types';

export const TIC_TAC_TOE_AUDIO_CONFIG: GameAudioConfig = {
    eventSoundResolver: (event) => {
        if (event.type === 'CELL_OCCUPIED') {
            const payload = (event as AudioEvent & { payload?: { playerId?: string } }).payload;
            return payload?.playerId === '0'
                ? 'system.general.casual_mobile_sound_fx_pack_vol.interactions.puzzles.heavy_object_move'
                : 'system.general.casual_mobile_sound_fx_pack_vol.interactions.puzzles.puzzle_heavy_object_move';
        }

        if (event.type === 'GAME_OVER') {
            const payload = (event as AudioEvent & { payload?: { draw?: boolean } }).payload;
            return payload?.draw
                ? 'system.general.casual_mobile_sound_fx_pack_vol.alerts.misc_alerts.intruiging_alert'
                : 'stinger.mini_games_sound_effects_and_music_pack.stinger.stgr_action_win';
        }

        return undefined;
    },
};
