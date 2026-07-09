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
    baseScale: 38,
    strength: 0.92,
    iterationLimit: 1000,
    // dice-box-threejs 的 setDimensions 会同步重建 Cannon 物理墙体。
    // 棋盘骰台需要把真实反弹边界收进红框内部，而不是只在投影层夹住显示位置。
    worldWidthScale: 0.44,
    worldHeightScale: 0.44,
    settledLayoutScale: 0.24,
    settledLayout: [
        { x: -1.32, y: -0.06, yaw: -0.1 },
        { x: -0.66, y: 0.02, yaw: 0.04 },
        { x: 0, y: -0.04, yaw: -0.02 },
        { x: 0.66, y: 0.02, yaw: 0.08 },
        { x: 1.32, y: -0.06, yaw: -0.06 },
    ],
    // 红框只是视觉范围；这里启用物理安全回收，避免高速重投时骰子穿出
    // 真实可视骰台后长时间跑到悬浮窗下面或直接看起来消失。
    recoverOutOfBounds: true,
    // 正常投掷结束后只做 DiceThrone 棋盘 3D 骰的紧凑收束，避免移动端散到
    // 玩家面板/提示板上；不把这套行为扩散到其它 dice-box 使用方。
    compactSettledDice: true,
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
