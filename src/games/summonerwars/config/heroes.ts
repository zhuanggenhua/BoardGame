/**
 * 召唤师战争 - 英雄配置
 * 包含精灵图切片信息和起始布局
 */

import type { CellCoord } from '../../../core/ui/board-layout.types';

/** 精灵图切片配置 */
export interface SpriteSlice {
  /** 精灵图路径 */
  spriteSheet: string;
  /** 帧索引（0-based） */
  frameIndex: number;
  /** 单帧宽度（像素） */
  frameWidth: number;
  /** 单帧高度（像素） */
  frameHeight: number;
  /** 总帧数 */
  totalFrames: number;
}

/** 起始单位配置 */
export interface StartingUnit {
  /** 单位 ID */
  id: string;
  /** 单位名称 */
  name: string;
  /** 单位类型 */
  type: 'summoner' | 'champion' | 'common' | 'gate';
  /** 精灵图切片 */
  sprite: SpriteSlice;
  /** 相对起始位置（row, col），玩家0视角 */
  position: CellCoord;
}

/** 英雄（召唤师）配置 */
export interface HeroConfig {
  /** 英雄 ID */
  id: string;
  /** 英雄名称 */
  name: string;
  /** 阵营 */
  faction: string;
  /** 生命值 */
  health: number;
  /** 攻击骰数 */
  attackDice: number;
  /** 精灵图切片 */
  sprite: SpriteSlice;
  /** 起始位置（row, col），玩家0视角 */
  startPosition: CellCoord;
  /** 起始传送门 */
  startingGate: StartingUnit;
  /** 起始单位列表 */
  startingUnits: StartingUnit[];
  /** 提示图路径 */
  tipImage?: string;
}

// ========== 瑞特-塔鲁斯（死灵法师） ==========
// 使用压缩后的 webp/avif 格式（通过 getOptimizedImageUrls 自动转换）
const NECROMANCER_SPRITE_SHEET = 'summonerwars/hero/Necromancer/Necromancer.png';
const NECROMANCER_FRAME_WIDTH = 512;
const NECROMANCER_FRAME_HEIGHT = 376;

export const NECROMANCER: HeroConfig = {
  id: 'necromancer',
  name: '瑞特-塔鲁斯',
  faction: '堕落王国',
  health: 12,
  attackDice: 2,
  sprite: {
    spriteSheet: NECROMANCER_SPRITE_SHEET,
    frameIndex: 0,
    frameWidth: NECROMANCER_FRAME_WIDTH,
    frameHeight: NECROMANCER_FRAME_HEIGHT,
    totalFrames: 2,
  },
  // 玩家0视角：英雄在第1行第4列（从上往下，从左往右，0-indexed）
  startPosition: { row: 1, col: 4 },
  startingGate: {
    id: 'gate-necromancer',
    name: '传送门',
    type: 'gate',
    sprite: {
      spriteSheet: NECROMANCER_SPRITE_SHEET,
      frameIndex: 1,
      frameWidth: NECROMANCER_FRAME_WIDTH,
      frameHeight: NECROMANCER_FRAME_HEIGHT,
      totalFrames: 2,
    },
    position: { row: 1, col: 3 },
  },
  startingUnits: [
    {
      id: 'skeleton-archer-1',
      name: '亡灵弓箭手',
      type: 'common',
      sprite: {
        spriteSheet: NECROMANCER_SPRITE_SHEET,
        frameIndex: 0, // 临时使用英雄图
        frameWidth: NECROMANCER_FRAME_WIDTH,
        frameHeight: NECROMANCER_FRAME_HEIGHT,
        totalFrames: 2,
      },
      position: { row: 0, col: 3 },
    },
    {
      id: 'plague-1',
      name: '亡灵疫病体',
      type: 'common',
      sprite: {
        spriteSheet: NECROMANCER_SPRITE_SHEET,
        frameIndex: 0, // 临时使用英雄图
        frameWidth: NECROMANCER_FRAME_WIDTH,
        frameHeight: NECROMANCER_FRAME_HEIGHT,
        totalFrames: 2,
      },
      position: { row: 0, col: 4 },
    },
  ],
  tipImage: '/assets/summonerwars/hero/Necromancer/tip.png',
};

/** 所有可用英雄 */
export const HEROES: Record<string, HeroConfig> = {
  necromancer: NECROMANCER,
};

/** 获取英雄配置 */
export const getHeroConfig = (heroId: string): HeroConfig | undefined => {
  return HEROES[heroId];
};

/**
 * 根据玩家 ID 镜像坐标
 * 玩家0在上方（row 0-2），玩家1在下方（row 3-5）
 * 镜像时 row' = 5 - row, col' = 7 - col
 */
export const mirrorPosition = (pos: CellCoord, playerId: string): CellCoord => {
  if (playerId === '0') {
    return pos;
  }
  return {
    row: 5 - pos.row,
    col: 7 - pos.col,
  };
};

/**
 * 获取玩家的起始布局
 */
export const getStartingLayout = (heroId: string, playerId: string): Array<{
  unit: StartingUnit | HeroConfig;
  position: CellCoord;
  isHero: boolean;
}> => {
  const hero = getHeroConfig(heroId);
  if (!hero) return [];

  const layout: Array<{
    unit: StartingUnit | HeroConfig;
    position: CellCoord;
    isHero: boolean;
  }> = [];

  // 英雄
  layout.push({
    unit: hero,
    position: mirrorPosition(hero.startPosition, playerId),
    isHero: true,
  });

  // 传送门
  layout.push({
    unit: hero.startingGate,
    position: mirrorPosition(hero.startingGate.position, playerId),
    isHero: false,
  });

  // 起始单位
  for (const unit of hero.startingUnits) {
    layout.push({
      unit,
      position: mirrorPosition(unit.position, playerId),
      isHero: false,
    });
  }

  return layout;
};
