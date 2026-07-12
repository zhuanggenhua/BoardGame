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
    // 只放大 PC 棋盘 3D 骰子的相机投影，不改变骰子实体、物理墙或自然落点。
    // 目标是让正式贴图骰面更接近插件截图的可读尺寸，避免用放大实体引入碰撞/瞬移。
    cameraZoom: 1.32,
    // 投掷物理结束后只平滑修正最终朝向，不移动落点，避免骰面停在侧翻角度导致贴图显示不全。
    settledFaceForwardAnimationMs: 180,
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
    cameraZoom: 1.66,
    // 插件默认会让多颗骰子从几乎同一个入口一起飞；移动横屏分成五条
    // 初始通道后仍走完整物理模拟，投掷结束前完成分散，避免落地后瞬移。
    initialThrowSpread: 0.96,
    // 只在自然落点挤叠/越界时做短平滑分散，避免停稳后硬切到新位置。
    settledSpreadAnimationMs: 180,
    strength: 1,
    // 红框就是移动端投骰物理范围：按相机真实可见范围收进舞台内，
    // 不再只靠结束后的投影回收把跑出去的骰子拉回来。
    fitWorldToCameraView: true,
    worldWidthScale: 0.5,
    worldHeightScale: 0.72,
    worldCenterOffsetX: -58,
    worldCenterOffsetY: -42,
} satisfies DiceBoxStyleProfile;
