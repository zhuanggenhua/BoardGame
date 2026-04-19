/**
 * 召唤师战争 - 卡牌预览映射测试
 */

import { describe, expect, it } from 'vitest';
import { getSummonerWarsCardPreviewMeta, getSummonerWarsCardPreviewRef } from '../ui/cardPreviewHelper';
import { SPRITE_INDEX as NECRO_SPRITE_INDEX } from '../config/factions/necromancer';

describe('SummonerWars cardPreviewHelper', () => {
  it('支持带后缀的卡牌 ID 解析预览', () => {
    const meta = getSummonerWarsCardPreviewMeta('necro-funeral-pyre-0-1');
    expect(meta?.name).toBe('殉葬火堆');
    expect(meta?.previewRef).toMatchObject({
      type: 'atlas',
      atlasId: 'sw:necromancer:cards',
      index: NECRO_SPRITE_INDEX.EVENT_FUNERAL_PYRE,
    });
  });

  it('portal 建筑使用独立图集', () => {
    const previewRef = getSummonerWarsCardPreviewRef('necro-starting-gate-0');
    expect(previewRef).toMatchObject({
      type: 'atlas',
      atlasId: 'sw:portal',
      index: 0,
    });
  });
});
