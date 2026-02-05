/**
 * 召唤师战争 - 骰子配置
 * 
 * 骰子图集：3x3 布局（9个面）
 * - 近战命中 (Melee): 3个面
 * - 远程命中 (Ranged): 2个面  
 * - 特殊 (Special): 1个面
 * 
 * 标准骰子概率：
 * - 近战: 3/6 = 50%
 * - 远程: 2/6 = 33%
 * - 特殊: 1/6 = 17%
 */

/** 骰子面类型 */
export type DiceFace = 'melee' | 'ranged' | 'special';

/** 骰子面配置 */
export interface DiceFaceConfig {
  face: DiceFace;
  /** 精灵图帧索引（0-8，3x3图集） */
  frameIndex: number;
  /** 显示名称 */
  label: string;
  /** 图标 */
  icon: string;
}

/** 标准骰子的6个面（按概率分布） */
export const STANDARD_DICE_FACES: DiceFace[] = [
  'melee',   // 面1
  'melee',   // 面2
  'melee',   // 面3
  'ranged',  // 面4
  'ranged',  // 面5
  'special', // 面6
];

/** 骰子面配置映射 */
export const DICE_FACE_CONFIG: Record<DiceFace, DiceFaceConfig> = {
  melee: {
    face: 'melee',
    frameIndex: 0, // 图集第一帧
    label: '近战',
    icon: '⚔️',
  },
  ranged: {
    face: 'ranged',
    frameIndex: 1, // 图集第二帧
    label: '远程',
    icon: '🏹',
  },
  special: {
    face: 'special',
    frameIndex: 2, // 图集第三帧
    label: '特殊',
    icon: '✦',
  },
};

/** 骰子精灵图配置 */
export const DICE_ATLAS_CONFIG = {
  atlasId: 'summonerwars/common/dice',
  cols: 3,
  rows: 3,
  frameWidth: 100, // 假设每帧100px
  frameHeight: 100,
};

/**
 * 掷骰子
 * @param count 骰子数量
 * @param random 随机函数（可选，用于测试）
 * @returns 骰子结果数组
 */
export function rollDice(count: number, random?: () => number): DiceFace[] {
  const results: DiceFace[] = [];
  const rng = random ?? Math.random;
  
  for (let i = 0; i < count; i++) {
    const index = Math.floor(rng() * STANDARD_DICE_FACES.length);
    results.push(STANDARD_DICE_FACES[index]);
  }
  
  return results;
}

/**
 * 计算命中数
 * @param results 骰子结果
 * @param attackType 攻击类型（近战/远程）
 * @returns 命中数
 */
export function countHits(results: DiceFace[], attackType: 'melee' | 'ranged'): number {
  return results.filter(face => face === attackType).length;
}

/**
 * 计算特殊面数量
 */
export function countSpecials(results: DiceFace[]): number {
  return results.filter(face => face === 'special').length;
}
