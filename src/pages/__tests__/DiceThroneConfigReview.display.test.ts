/* @vitest-environment happy-dom */

import { describe, expect, it } from 'vitest';
import { buildDiceThroneConfigReviewTable } from '../../games/dicethrone/config/configReviewAdapter';
import { formatDiceThroneConfigReviewDiceFaceName } from '../diceThroneConfigReviewDisplay';

const zhTranslations: Record<string, string> = {
  'characters.monk': '僧侣',
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
});
