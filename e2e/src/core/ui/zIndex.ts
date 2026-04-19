/**
 * UI 层级常量（全局唯一来源）
 *
 * 说明：
 * - 所有游戏与系统的 overlay/hud/tooltip 等层级必须引用这里的常量
 * - 教程层级必须最高，避免被其他浮层遮挡
 */
export const UI_Z_INDEX = {
    scene: 0,
    hud: 100,
    hint: 150,
    overlay: 300,
    overlayRaised: 600,
    magnify: 800,
    tooltip: 900,
    debugPanel: 1200,
    debugButton: 1210,
    loading: 1500,
    modalRoot: 2000,
    modalOverlay: 2100,
    modalContent: 2200,
    modalTooltip: 2350,
    toast: 2250,
    tutorial: 2300,
} as const;
