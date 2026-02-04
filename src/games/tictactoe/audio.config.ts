/**
 * 井字棋音频配置
 * 仅定义游戏特有的音效，通用音效（UI、胜负等）由 common.config.ts 提供
 */
import type { AudioEvent, GameAudioConfig } from '../../lib/audio/types';

// 游戏特有音效资源路径
const SFX_BASE = 'tictactoe/audio';

export const TIC_TAC_TOE_AUDIO_CONFIG: GameAudioConfig = {
    basePath: SFX_BASE,

    sounds: {
        // 落子音效（游戏特有）
        place_x: { src: 'compressed/move.ogg', volume: 0.8, category: { group: 'system', sub: 'place_x' } },
        place_o: { src: 'compressed/move.ogg', volume: 0.8, category: { group: 'system', sub: 'place_o' } },
        // 平局音效（游戏特有，覆盖通用 victory）
        draw: { src: 'compressed/draw_line.ogg', volume: 0.9, category: { group: 'stinger', sub: 'draw' } },
        // 胜利音效（覆盖通用 victory，使用游戏特有版本）
        victory: { src: 'compressed/win.ogg', volume: 1.0, category: { group: 'stinger', sub: 'victory' } },
    },
    eventSoundResolver: (event) => {
        if (event.type === 'CELL_OCCUPIED') {
            const payload = (event as AudioEvent & { payload?: { playerId?: string } }).payload;
            return payload?.playerId === '0' ? 'place_x' : 'place_o';
        }

        if (event.type === 'GAME_OVER') {
            const payload = (event as AudioEvent & { payload?: { draw?: boolean } }).payload;
            return payload?.draw ? 'draw' : 'victory';
        }

        return undefined;
    },
};
