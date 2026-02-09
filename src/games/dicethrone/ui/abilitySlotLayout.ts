/**
 * DiceThrone 技能槽布局（游戏级配置）
 * - 使用百分比坐标，基于玩家面板图片
 * - 所有用户共享一致配置
 */
export interface AbilitySlotLayoutItem {
    id: string;
    x: number;
    y: number;
    w: number;
    h: number;
}

export const DEFAULT_ABILITY_SLOT_LAYOUT: AbilitySlotLayoutItem[] = [
    { id: 'fist', x: 0.1, y: 1.5, w: 20.8, h: 38.5 },
    { id: 'chi', x: 22.2, y: 1.4, w: 21.3, h: 39.4 },
    { id: 'sky', x: 54.7, y: 1.4, w: 21.7, h: 39.6 },
    { id: 'lotus', x: 77.0, y: 1.3, w: 21.5, h: 39.5 },
    { id: 'combo', x: 0.1, y: 42.3, w: 20.9, h: 39.3 },
    { id: 'lightning', x: 22.1, y: 42.4, w: 21.8, h: 38.7 },
    { id: 'calm', x: 54.5, y: 42.0, w: 21.9, h: 40.2 },
    { id: 'meditate', x: 77.3, y: 42.0, w: 21.7, h: 39.9 },
    { id: 'ultimate', x: 0.1, y: 83.5, w: 55.0, h: 15.6 },
];
