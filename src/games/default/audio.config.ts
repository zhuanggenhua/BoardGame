/**
 * 井字棋音频配置
 * 定义游戏所需的所有音效及其映射
 */
import type { GameAudioConfig } from '../../lib/audio/types';

export const TIC_TAC_TOE_AUDIO_CONFIG: GameAudioConfig = {
    basePath: '/audio/tictactoe/',
    sounds: {
        // 落子音效
        place_x: { src: 'place_x.mp3', volume: 0.8 },
        place_o: { src: 'place_o.mp3', volume: 0.8 },
        // 游戏结果
        victory: { src: 'victory.mp3', volume: 1.0 },
        draw: { src: 'draw.mp3', volume: 0.9 },
        // UI 音效
        hover: { src: 'hover.mp3', volume: 0.3 },
        click: { src: 'click.mp3', volume: 0.5 },
    },
    moves: {
        clickCell: 'place_x', // 默认，实际根据 playerID 决定
    },
};
