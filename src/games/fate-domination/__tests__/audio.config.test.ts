import { expect, it } from 'vitest';
import { loadCommonAudioRegistry } from '../../../lib/audio/commonRegistry';
import { FATE_BATTLE_IMPACT, FATE_DOMINATION_AUDIO_CONFIG as config } from '../audio.config';

const runtime = { G: { phase: 'action' }, ctx: { playerId: '0' } };

it('正式出牌及移动有即时音，战斗冲击帧和纯准备状态不会重复从事件流播放', () => {
    const play = config.feedbackResolver({ type: 'ATTACKS_CONFIRMED' }, runtime);
    expect(play).toMatch(/card_play/);
    expect(config.feedbackResolver({ type: 'FATE_RIDING_CARDS_PLAYED', payload: { cardIds: ['one'] } }, runtime)).toBe(play);
    expect(config.feedbackResolver({ type: 'FATE_RIDING_CARDS_PLAYED', payload: { cardIds: [] } }, runtime)).toBeNull();
    expect(config.feedbackResolver({ type: 'PLAYER_MOVED', payload: { mode: 'normal' } }, runtime)).toMatch(/footstep/);
    const spell = config.feedbackResolver({ type: 'PLAYER_MOVED', payload: { mode: 'effect' } }, runtime);
    expect(spell).toMatch(/cast/);
    expect(config.feedbackResolver({ type: 'COMMAND_SPELL_USED', payload: { effect: 'mana' } }, runtime)).toBe(spell);
    expect(config.feedbackResolver({ type: 'COMMAND_SPELL_USED', payload: { effect: 'move' } }, runtime)).toBeNull();
    expect(config.feedbackResolver({ type: 'LOCATION_RESOLVED' }, runtime)).toBeNull();
    expect(config.feedbackResolver({ type: 'ATTACK_CARD_SELECTED' }, runtime)).toBeNull();
});

it('私人抽牌只在自己席位播放，BGM 按阶段切换，所有音频已进运行时注册表', async () => {
    expect(config.feedbackResolver({ type: 'FATE_CARDS_DRAWN', payload: { playerId: '0', drawn: [{}] } }, runtime)).toMatch(/card_draw/);
    expect(config.feedbackResolver({ type: 'FATE_CARDS_DRAWN', payload: { playerId: '1', drawn: [{}] } }, runtime)).toBeNull();
    const group = (phase: string) => config.bgmRules?.find(rule => rule.when({ ...runtime, G: { phase } }))?.group;
    expect(group('preparation')).toBe('normal');
    expect(group('battle')).toBe('battle');
    expect(group('complete')).toBeUndefined();
    const byKey = new Map((await loadCommonAudioRegistry()).entries.map(entry => [entry.key, entry]));
    for (const key of [...config.criticalSounds!, FATE_BATTLE_IMPACT]) expect(byKey.get(key)?.type, key).toBe('sfx');
    for (const { key, src } of config.bgm!) expect(byKey.get(key)?.src, key).toBe(src);
});
