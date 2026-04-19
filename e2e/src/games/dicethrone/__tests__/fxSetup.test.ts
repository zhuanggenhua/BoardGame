import { describe, expect, it } from 'vitest';
import {
  DT_FX,
  diceThroneFxRegistry,
  resolveStatusImpactKey,
  resolveTokenImpactKey,
} from '../ui/fxSetup';

const STATUS_GAIN_KEY = 'status.general.player_status_sound_fx_pack_vol.positive_buffs_and_cures.charged_a';
const STATUS_REMOVE_KEY = 'status.general.player_status_sound_fx_pack_vol.positive_buffs_and_cures.purged_a';
const TOKEN_GAIN_KEY = 'status.general.player_status_sound_fx_pack_vol.positive_buffs_and_cures.strengthened_a';
const TOKEN_REMOVE_KEY = 'status.general.player_status_sound_fx_pack_vol.positive_buffs_and_cures.purged_a';

describe('DiceThrone FX Setup', () => {
  it('状态与 Token cue 使用 params 音效来源（支持动态移除音效）', () => {
    const statusSound = diceThroneFxRegistry.resolve(DT_FX.STATUS)?.feedback?.sound;
    expect(statusSound).toMatchObject({
      source: 'params',
      key: STATUS_GAIN_KEY,
      timing: 'on-impact',
    });

    const tokenSound = diceThroneFxRegistry.resolve(DT_FX.TOKEN)?.feedback?.sound;
    expect(tokenSound).toMatchObject({
      source: 'params',
      key: TOKEN_GAIN_KEY,
      timing: 'on-impact',
    });
  });

  it('状态/Token 冲击音效解析器可正确区分获得与移除', () => {
    expect(resolveStatusImpactKey(false)).toBe(STATUS_GAIN_KEY);
    expect(resolveStatusImpactKey(true)).toBe(STATUS_REMOVE_KEY);

    expect(resolveTokenImpactKey(false)).toBe(TOKEN_GAIN_KEY);
    expect(resolveTokenImpactKey(true)).toBe(TOKEN_REMOVE_KEY);
  });

  it('状态/Token 获得时若提供 customKey，应优先使用自定义音效', () => {
    expect(resolveStatusImpactKey(false, 'custom-status')).toBe('custom-status');
    expect(resolveStatusImpactKey(true, 'custom-status')).toBe(STATUS_REMOVE_KEY);

    expect(resolveTokenImpactKey(false, 'custom-token')).toBe('custom-token');
    expect(resolveTokenImpactKey(true, 'custom-token')).toBe(TOKEN_REMOVE_KEY);
  });
});
