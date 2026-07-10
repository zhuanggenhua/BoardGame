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
    settledLayoutScale: 0.3,
    settledLayout: [
        { x: -1.35, y: -0.55, yaw: -0.1 },
        { x: -0.55, y: 0.55, yaw: 0.04 },
        { x: 0, y: -0.5, yaw: -0.02 },
        { x: 0.65, y: 0.45, yaw: 0.08 },
        { x: 1.35, y: -0.45, yaw: -0.06 },
    ],
    // 红框只是视觉范围；这里启用物理安全回收，避免高速重投时骰子穿出
    // 真实可视骰台后长时间跑到悬浮窗下面或直接看起来消失。
    recoverOutOfBounds: true,
    // 投掷结束后保留插件原本的自然物理落点。强制收束会在动画结束后瞬移，
    // 并把移动端五颗骰子压成重叠横排。
    compactSettledDice: false,
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

export const DICETHRONE_MOBILE_DICE_BOX_STYLE_PROFILE = {
    ...DICETHRONE_DICE_BOX_STYLE_PROFILE,
    id: 'dicethrone-board-classic-mobile',
    // 移动横屏舞台本身更窄，若继续使用桌面 0.44 的物理墙体，
    // 五颗 38px 骰子没有足够空间自然散开，只能互相挤叠。
    worldWidthScale: 0.9,
    worldHeightScale: 0.75,
} satisfies DiceBoxStyleProfile;
