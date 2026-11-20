import { expect, it } from 'vitest';
import { loadCommonAudioRegistry } from '../../../lib/audio/commonRegistry';
import { FATE_BATTLE_IMPACT, FATE_DOMINATION_AUDIO_CONFIG as config, FATE_EXCALIBUR_BEAM } from '../audio.config';

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
    expect(config.warmSounds).toContain(FATE_BATTLE_IMPACT);
    expect(config.warmSounds).toContain(FATE_EXCALIBUR_BEAM);
    for (const key of [...config.criticalSounds!, ...config.warmSounds!]) expect(byKey.get(key)?.type, key).toBe('sfx');
    for (const { key, src } of config.bgm!) expect(byKey.get(key)?.src, key).toBe(src);
});

it('已确认的能力各自播放发动音，不从修正器、败北事件或后续演出重复播放', () => {
    const activate = (skillId: string) => config.feedbackResolver({ type: 'FATE_ABILITY_USED', payload: { skillId } }, runtime);
    expect(activate('sc_saber_1:3')).toMatch(/holy_ward$/);
    expect(activate('sc_saber_2:4')).toMatch(/wind_magic_buff_01$/);
    expect(activate('sc_medusa_2:4')).toMatch(/earthen_grasp$/);
    expect(activate('sc_cu_1:3')).toMatch(/whoosh_metal_spear_01_krst$/);
    expect(activate('sc_cu_np:3')).toMatch(/spear_whoosh_b$/);
    expect(activate('sc_saber_np:5')).toBeNull();
    expect(activate('sc_medusa_np:5')).toBeNull();
    expect(activate('sc_cu_2:5')).toBeNull();
    expect(activate('sc_medusa_1:4')).toBeNull();
    expect(config.feedbackResolver({ type: 'FATE_RULE_MODIFIER_ATTACHED', payload: { sourceId: 'sc_saber_2:4' } }, runtime)).toBeNull();
    expect(config.feedbackResolver({ type: 'FATE_DEFEAT_DECLARED', payload: { sourceId: 'sc_medusa_2:4' } }, runtime)).toBeNull();
});

it('骑乘只在实际追加牌时播放，专属移动声取代通用效果移动声', () => {
    const eventSound = (type: string, payload: object) => config.feedbackResolver({ type, payload }, runtime);
    expect(eventSound('FATE_RIDING_CHOICE_REQUESTED', { skillId: 'sc_medusa_1:4' })).toBeNull();
    expect(eventSound('FATE_RIDING_CARDS_PLAYED', { skillId: 'sc_medusa_1:4', cardIds: [] })).toBeNull();
    expect(eventSound('FATE_RIDING_CARDS_PLAYED', { skillId: 'sc_medusa_1:4', cardIds: ['one'] })).toMatch(/sfx_card_play_3$/);
    expect(eventSound('FATE_RIDING_CARDS_PLAYED', { skillId: 'sc_iskandar_1:4', cardIds: ['one'] })).toMatch(/sfx_card_play_1$/);
    expect(eventSound('PLAYER_MOVED', { abilityId: 'sc_medusa_np:5', mode: 'effect' })).toMatch(/echoing_gust_cast$/);
    expect(eventSound('PLAYER_MOVED', { abilityId: 'sc_cu_2:5', mode: 'effect' })).toMatch(/whsh_cloth_whoosh_04$/);
});
