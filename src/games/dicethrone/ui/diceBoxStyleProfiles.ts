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
    baseScale: 40,
    // 只放大 Three.js 相机投影，不改变骰子实体、物理墙体或自然落点。
    // 避免为了看清骰面继续放大实体，重新引入拥挤、碰撞和结束瞬移。
    cameraZoom: 1.45,
    // 插件默认会让多颗骰子从几乎同一个入口一起飞；移动横屏分成五条
    // 初始通道后仍走完整物理模拟，投掷结束不做重排，因此不会瞬移。
    initialThrowSpread: 0.76,
    // 仅当自然落点仍重叠或接近横排时，在 rolling 状态内平滑完成落位；
    // 动画完成后才上报 settled，避免投掷结束后的瞬移和静止态漂移。
    settledSpreadAnimationMs: 220,
    strength: 1,
    // 移动横屏要保留足够纵深，不能只扩大横向边界，否则真实投掷
    // 结束后五颗骰子仍会沿角色面板顶部塌成一排。
    worldWidthScale: 0.72,
    worldHeightScale: 1.05,
} satisfies DiceBoxStyleProfile;
