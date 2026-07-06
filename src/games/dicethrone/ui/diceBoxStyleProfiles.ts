import type { DiceBoxStyleProfile } from '../../../lib/dice-box-threejs/engine';

/**
 * DiceThrone 的本地 3D 骰子环境 profile。
 *
 * 这层只描述棋盘材质、灯光、重力等环境默认值。骰面皮肤由
 * diceThroneDiceBoxSkins 从现有 DiceThrone 图集生成，并写进
 * dice-box-threejs 的真实骰子材质；业务组件不要直接散写第三方 option。
 */
export const DICETHRONE_DICE_BOX_STYLE_PROFILE = {
    id: 'dicethrone-board-classic',
    surface: 'green-felt',
    colorset: 'white',
    texture: '',
    material: 'plastic',
    soundMaterial: 'plastic',
    colorSpotlight: 0xefdfd5,
    shadows: true,
    gravityMultiplier: 400,
    lightIntensity: 0.86,
    baseScale: 54,
    strength: 0.92,
    iterationLimit: 1000,
    arrangeSettledDice: true,
    customColorset: {
        name: 'dicethrone-white-plastic-symbol-dice',
        foreground: '#111111',
        background: '#ffffff',
        edge: '#ffffff',
        outline: 'none',
        texture: {
            name: 'none',
            material: 'plastic',
        },
    },
} satisfies DiceBoxStyleProfile;
