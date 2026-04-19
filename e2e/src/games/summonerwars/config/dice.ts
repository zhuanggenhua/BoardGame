/**
 * 召唤师战争 - 骰子配置
 * 
 * 骰子图集：3x3 布局（9个格子，6个面有内容）
 * 
 * 重要：一个面可能有多个标记，每个标记独立计算
 * 例如：剑⚔️ + 弓🏹 的面，近战攻击算1个命中，远程攻击也算1个命中
 * 
 * 标记类型：
 * - 剑⚔️ = 近战标记 (melee)
 * - 弓🏹 = 远程标记 (ranged)
 * - 斧🪓 = 特殊标记 (special)
 */

/** 骰子标记类型 */
export type DiceMark = 'melee' | 'ranged' | 'special';

/** 骰子面结果（包含该面的所有标记） */
export interface DiceFaceResult {
  /** 精灵图帧索引（0-8，3x3图集） */
  faceIndex: number;
  /** 该面的所有标记（每个标记独立计算） */
  marks: DiceMark[];
}

const isDiceMark = (value: unknown): value is DiceMark =>
  value === 'melee' || value === 'ranged' || value === 'special';

const isDiceFaceResult = (value: unknown): value is DiceFaceResult => {
  if (!value || typeof value !== 'object') return false;
  const data = value as Record<string, unknown>;
  if (typeof data.faceIndex !== 'number') return false;
  if (!Array.isArray(data.marks) || data.marks.length === 0) return false;
  return data.marks.every(isDiceMark);
};

const FALLBACK_DICE_FACE_BY_MARK: Record<DiceMark, DiceFaceResult> = {
  melee: { faceIndex: 8, marks: ['melee'] },
  ranged: { faceIndex: 0, marks: ['ranged'] },
  special: { faceIndex: 7, marks: ['special'] },
};

/**
 * 规范化骰子结果（兼容旧的 string[] 形式）
 * - DiceFaceResult[]：原样返回
 * - ('melee'|'ranged'|'special')[]：转换为最接近的骰面
 * - 其余输入：返回 null
 */
export function normalizeDiceResults(value: unknown): DiceFaceResult[] | null {
  if (!Array.isArray(value)) return null;
  const normalized: DiceFaceResult[] = [];

  for (const item of value) {
    if (isDiceFaceResult(item)) {
      normalized.push({ faceIndex: item.faceIndex, marks: [...item.marks] });
      continue;
    }
    if (isDiceMark(item)) {
      const fallback = FALLBACK_DICE_FACE_BY_MARK[item];
      normalized.push({ faceIndex: fallback.faceIndex, marks: [...fallback.marks] });
      continue;
    }
  }

  return normalized.length > 0 ? normalized : null;
}

/**
 * 标准骰子的6个面
 * 
 * 基于精灵图实际内容（3x3图集，索引1/2/5为空格）：
 * - 面0 (左上): 剑 + 弓 → melee + ranged
 * - 面3 (左中): 斧 + 弓 → special + ranged
 * - 面4 (中中): 剑 + 弓 → melee + ranged
 * - 面6 (左下): 剑 + 弓 → melee + ranged
 * - 面7 (中下): 剑 + 斧 → melee + special
 * - 面8 (右下): 剑（单） → melee + special
 */
export const STANDARD_DICE_FACES: DiceFaceResult[] = [
  { faceIndex: 0, marks: ['melee', 'ranged'] },    // 剑 + 弓
  { faceIndex: 3, marks: ['special', 'ranged'] },  // 斧 + 弓
  { faceIndex: 4, marks: ['melee', 'ranged'] },    // 剑 + 弓
  { faceIndex: 6, marks: ['melee', 'ranged'] },    // 剑 + 弓
  { faceIndex: 7, marks: ['melee', 'special'] },   // 剑 + 斧
  { faceIndex: 8, marks: ['melee'] },               // 剑（单）
];

/** 骰子精灵图配置 */
export const DICE_ATLAS_CONFIG = {
  atlasId: 'summonerwars/common/dice',
  cols: 3,
  rows: 3,
  frameWidth: 100,
  frameHeight: 100,
};

/**
 * 掷骰子
 * @param count 骰子数量
 * @param random 随机函数（可选，用于测试）
 * @returns 骰子结果数组（每个结果包含该面的所有标记）
 */
export function rollDice(count: number, random?: () => number): DiceFaceResult[] {
  const results: DiceFaceResult[] = [];
  const rng = random ?? Math.random;
  
  for (let i = 0; i < count; i++) {
    const raw = rng();
    // 防御性保护：clamp 到 [0, 1) 范围，避免越界（如教程注入的随机值超出范围）
    const normalized = ((raw % 1) + 1) % 1;
    const index = Math.floor(normalized * STANDARD_DICE_FACES.length);
    results.push(STANDARD_DICE_FACES[index]);
  }
  
  return results;
}

/**
 * 计算命中数（所有匹配标记的总数）
 * @param results 骰子结果
 * @param attackType 攻击类型（近战/远程）
 * @returns 命中数（所有标记的总数）
 */
export function countHits(results: DiceFaceResult[], attackType: 'melee' | 'ranged'): number {
  return results
    .flatMap(r => r.marks)  // 展开所有标记
    .filter(mark => mark === attackType)
    .length;
}

/**
 * 计算特殊标记数量（所有特殊标记的总数）
 */
export function countSpecials(results: DiceFaceResult[]): number {
  return results
    .flatMap(r => r.marks)
    .filter(mark => mark === 'special')
    .length;
}
