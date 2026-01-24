/**
 * 井字棋音频配置
 * 定义游戏所需的所有音效及其映射
 */
import type { GameAudioConfig } from '../../lib/audio/types';

export const TIC_TAC_TOE_AUDIO_CONFIG: GameAudioConfig = {
    sounds: {
        // 落子音效
        place_x: { src: 'tictactoe/audio/compressed/move.ogg', volume: 0.8 },
        place_o: { src: 'tictactoe/audio/compressed/move.ogg', volume: 0.8 },
        // 游戏结果
        victory: { src: 'tictactoe/audio/compressed/win.ogg', volume: 1.0 },
        draw: { src: 'tictactoe/audio/compressed/draw_line.ogg', volume: 0.9 },
        // UI 音效
        hover: { src: 'common/audio/compressed/hover.ogg', volume: 0.3 },
        click: { src: 'common/audio/compressed/click.ogg', volume: 0.5 },
    },
};
