/* @vitest-environment happy-dom */

import { describe, expect, it } from 'vitest';
import { buildDiceThroneConfigReviewTable } from '../../games/dicethrone/config/configReviewAdapter';
import {
  formatDiceThroneConfigReviewCardType,
  formatDiceThroneConfigReviewDiceFaceName,
} from '../diceThroneConfigReviewDisplay';

const zhTranslations: Record<string, string> = {
  'characters.monk': '僧侣',
  'configReview.values.cardType.responseUpgrade': '响应型升级牌',
  'dice.face.fist': '拳',
};

const translate = (key: string, options?: Record<string, unknown>) => (
  zhTranslations[key] ?? String(options?.defaultValue ?? key)
);

describe('DiceThroneConfigReview display formatting', () => {
  it('骰面名称用中文玩家可读文本，不把内部骰子编号露到名称列', () => {
    const table = buildDiceThroneConfigReviewTable();
    const fistFace = table.rows.find((row) => (
      row.objectType === 'diceFace'
      && row.characterId === 'monk'
      && row.diceValue === 1
    ));

    expect(fistFace).toBeDefined();
    if (!fistFace) return;

    const displayName = formatDiceThroneConfigReviewDiceFaceName(fistFace, translate);

    expect(displayName).toBe('僧侣骰面 1（拳）');
    expect(displayName).not.toContain('monk-dice');
  });

  it('0CP 的工匠电弧盾显示为响应型升级牌，避免误读成免费普通升级', () => {
    const table = buildDiceThroneConfigReviewTable();
    const arcShield = table.rows.find((row) => (
      row.objectType === 'card'
      && row.characterId === 'artificer'
      && row.objectId === 'upgrade-artificer-shock-bot-2'
    ));

    expect(arcShield).toBeDefined();
    if (!arcShield) return;

    const displayType = formatDiceThroneConfigReviewCardType(arcShield, arcShield.cardType, translate);

    expect(displayType).toBe('响应型升级牌');
    expect(displayType).not.toBe('升级牌');
  });
});
