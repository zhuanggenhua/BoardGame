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
    // dice-box-threejs 的 setDimensions 会同步重建 Cannon 物理墙体。
    // 棋盘骰台需要把真实反弹边界收进红框内部，而不是只在投影层夹住显示位置。
    worldWidthScale: 0.64,
    worldHeightScale: 0.64,
    // 红框只是视觉范围；这里启用物理安全回收，避免高速重投时骰子穿出
    // 真实可视骰台后长时间跑到悬浮窗下面或直接看起来消失。
    recoverOutOfBounds: true,
    // 保留 dice-box-threejs 的真实物理落点。强制重排会在投掷结束后把骰子
    // 从物理落点瞬间吸到固定队列位置，手机端尤其明显。
    arrangeSettledDice: false,
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
