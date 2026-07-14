import { describe, expect, it } from 'vitest';

import { createFxPathBox, createFxScaledCellBox, createFxScreenPathBox } from '../layout';

describe('fx layout helpers', () => {
  it('按格子中心放大局部特效容器', () => {
    const box = createFxScaledCellBox({ left: 10, top: 20, width: 5, height: 8 }, 3);

    expect(box).toEqual({
      left: '5%',
      top: '12%',
      width: '15%',
      height: '24%',
      overflow: 'visible',
    });
  });

  it('只为路径特效创建包住起终点的局部区域', () => {
    const path = createFxPathBox(
      { left: 10, top: 20, width: 5, height: 5 },
      { left: 40, top: 35, width: 5, height: 5 },
      { paddingCells: 1, minSizeCells: 2 },
    );

    expect(path.style).toEqual({
      left: '7.5%',
      top: '17.5%',
      width: '40%',
      height: '25%',
      overflow: 'visible',
    });
    expect(path.start).toEqual({ xPct: 12.5, yPct: 20 });
    expect(path.end).toEqual({ xPct: 87.5, yPct: 80 });
  });

  it('为屏幕坐标飞行特效创建局部画布区域', () => {
    const path = createFxScreenPathBox(
      { x: 120, y: 80 },
      { x: 420, y: 230 },
      { paddingPx: 50, minSizePx: 120 },
    );

    expect(path.style).toEqual({
      left: '70px',
      top: '30px',
      width: '400px',
      height: '250px',
      overflow: 'visible',
    });
    expect(path.start).toEqual({ x: 50, y: 50 });
    expect(path.end).toEqual({ x: 350, y: 200 });
  });
});
