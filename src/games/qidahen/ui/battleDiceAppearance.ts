import type { DiceBoxDieSkin, DiceBoxDieType, DiceBoxStyleProfile } from '../../../lib/dice-box-threejs/engine';

// TTS 2228142777内置Die_6/8/10/12原始ColorDiffuse；不是自定义模型或外部骰面贴图。
const COLORS: Record<DiceBoxDieType, string> = { d6: '#ffffff', d8: '#901515', d10: '#136a2c', d12: '#d0821e' };
export const QIDAHEN_BATTLE_DICE_STYLES = Object.fromEntries(Object.entries(COLORS).map(([type, color]) => [type, {
    id: `qidahen-tts-${type}`, surface: 'transparent-virtual', texture: '', material: 'plastic', baseScale: 84, shadows: false, projectedLayoutMargin: 8, projectedLayoutMinGap: 8, optimizeSettledFaceReadability: true,
    customColorset: { name: `qidahen-tts-${type}`, foreground: type === 'd6' ? '#111111' : '#ffffff', background: color, outline: 'none', texture: 'none', material: 'plastic' },
} satisfies DiceBoxStyleProfile])) as Record<DiceBoxDieType, DiceBoxStyleProfile>;

/** 内置白色六面骰用点数面；其余数字多面骰沿用物理引擎正式面值映射。 */
export function createQidahenD6Skin(): DiceBoxDieSkin {
    const faceCanvases: Record<number, HTMLCanvasElement> = {};
    const patterns = [[], [[0, 0]], [[-1, -1], [1, 1]], [[-1, -1], [0, 0], [1, 1]],
        [[-1, -1], [1, -1], [-1, 1], [1, 1]], [[-1, -1], [1, -1], [0, 0], [-1, 1], [1, 1]],
        [[-1, -1], [1, -1], [-1, 0], [1, 0], [-1, 1], [1, 1]]];
    for (let value = 1; value <= 6; value++) {
        const canvas = document.createElement('canvas'); canvas.width = canvas.height = 256;
        const context = canvas.getContext('2d')!;
        context.fillStyle = '#ffffff'; context.fillRect(0, 0, 256, 256); context.fillStyle = '#111111';
        for (const [x, y] of patterns[value]) { context.beginPath(); context.arc(128 + x * 58, 128 + y * 58, 19, 0, Math.PI * 2); context.fill(); }
        faceCanvases[value] = canvas;
    }
    return { id: 'qidahen-tts-native-white-d6-pips', faceCanvases };
}
