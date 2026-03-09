/**
 * 卡牌 i18n 完整性验证
 *
 * 确保所有 SmashUp 卡牌和基地的 i18n key 在 zh-CN 和 en 中均存在。
 * 文本字段已从数据定义中移除，i18n 是唯一数据源。
 */

import { describe, it, expect } from 'vitest';
import { readFileSync } from 'fs';
import { resolve } from 'path';
import { getAllCardDefs, getAllBaseDefs, getCardDef, resolveCardName, resolveCardText } from '../data/cards';

describe('SmashUp 卡牌 i18n 完整性', () => {
  const zhCN = JSON.parse(
    readFileSync(resolve(__dirname, '../../../../public/locales/zh-CN/game-smashup.json'), 'utf-8'),
  );
  const en = JSON.parse(
    readFileSync(resolve(__dirname, '../../../../public/locales/en/game-smashup.json'), 'utf-8'),
  );

  const allCards = getAllCardDefs();
  const allBases = getAllBaseDefs();
  const makeTranslator = (locale: any) => (key: string) => {
    const resolved = key.split('.').reduce<any>((value, segment) => value?.[segment], locale);
    return typeof resolved === 'string' ? resolved : key;
  };

  it('卡牌注册表非空', () => {
    expect(allCards.length).toBeGreaterThan(0);
  });

  it('基地注册表非空', () => {
    expect(allBases.length).toBeGreaterThan(0);
  });

  it('所有卡牌的 name 在 zh-CN 中存在', () => {
    const missing: string[] = [];
    for (const def of allCards) {
      const val = zhCN.cards?.[def.id]?.name;
      if (typeof val !== 'string' || val.length === 0) missing.push(def.id);
    }
    expect(missing, `zh-CN 缺少卡牌 name: ${missing.join(', ')}`).toEqual([]);
  });

  it('所有卡牌的 name 在 en 中存在', () => {
    const missing: string[] = [];
    for (const def of allCards) {
      const val = en.cards?.[def.id]?.name;
      if (typeof val !== 'string' || val.length === 0) missing.push(def.id);
    }
    expect(missing, `en 缺少卡牌 name: ${missing.join(', ')}`).toEqual([]);
  });

  it('所有有技能标签的随从卡在 zh-CN 中有 abilityText', () => {
    const missing: string[] = [];
    for (const def of allCards) {
      if (def.type !== 'minion') continue;
      // 有 abilityTags 说明有技能，应该有 abilityText
      if (!def.abilityTags || def.abilityTags.length === 0) continue;
      const val = zhCN.cards?.[def.id]?.abilityText;
      if (typeof val !== 'string' || val.length === 0) missing.push(def.id);
    }
    expect(missing, `zh-CN 缺少随从 abilityText: ${missing.join(', ')}`).toEqual([]);
  });

  it('所有行动卡的 effectText 在 zh-CN 中存在', () => {
    const missing: string[] = [];
    for (const def of allCards) {
      if (def.type !== 'action') continue;
      const val = zhCN.cards?.[def.id]?.effectText;
      if (typeof val !== 'string' || val.length === 0) missing.push(def.id);
    }
    expect(missing, `zh-CN 缺少行动卡 effectText: ${missing.join(', ')}`).toEqual([]);
  });

  it('所有基地的 name 在 zh-CN 中存在', () => {
    const missing: string[] = [];
    for (const def of allBases) {
      const val = zhCN.cards?.[def.id]?.name;
      if (typeof val !== 'string' || val.length === 0) missing.push(def.id);
    }
    expect(missing, `zh-CN 缺少基地 name: ${missing.join(', ')}`).toEqual([]);
  });

  it('有技能文本的基地在 zh-CN 中有 abilityText', () => {
    const missing: string[] = [];
    for (const def of allBases) {
      // 基地没有 abilityTags，用 i18n 中是否有 abilityText key 来判断
      // 如果 i18n 中有这个 key 但为空，才算缺失
      const val = zhCN.cards?.[def.id]?.abilityText;
      // 跳过 i18n 中没有 abilityText key 的基地（无技能白板基地）
      if (val === undefined) continue;
      if (typeof val !== 'string' || val.length === 0) missing.push(def.id);
    }
    expect(missing, `zh-CN 缺少基地 abilityText: ${missing.join(', ')}`).toEqual([]);
  });
  it('resolveCardText 优先命中 POD 精确 locale key', () => {
    const enTranslator = makeTranslator(en);

    expect(resolveCardText(getCardDef('dino_laser_triceratops_pod'), enTranslator)).toBe(
      en.cards.dino_laser_triceratops_pod.abilityText,
    );
    expect(resolveCardText(getCardDef('dino_armor_stego_pod'), enTranslator)).toBe(
      en.cards.dino_armor_stego_pod.abilityText,
    );
    expect(resolveCardText(getCardDef('dino_tooth_and_claw_pod'), enTranslator)).toBe(
      en.cards.dino_tooth_and_claw_pod.effectText,
    );
    expect(resolveCardText(getCardDef('ninja_infiltrate_pod'), enTranslator)).toBe(
      en.cards.ninja_infiltrate_pod.effectText,
    );
  });

  it('resolveCardName 在有 POD 精确 key 时优先使用 POD key', () => {
    const def = getCardDef('ninja_infiltrate_pod');
    const translator = (key: string) => {
      if (key === 'cards.ninja_infiltrate_pod.name') return 'POD Infiltrate';
      if (key === 'cards.ninja_infiltrate.name') return 'Base Infiltrate';
      return key;
    };

    expect(resolveCardName(def, translator)).toBe('POD Infiltrate');
  });

  it('resolveCardName 在缺少 POD key 时回退到基础版 key', () => {
    const def = getCardDef('ninja_infiltrate_pod');
    const translator = (key: string) => {
      if (key === 'cards.ninja_infiltrate.name') return 'Base Infiltrate';
      return key;
    };

    expect(resolveCardName(def, translator)).toBe('Base Infiltrate');
  });
  it('已确认独立文案的 POD 卡不应回退成基础版文案', () => {
    expect(en.cards.dino_laser_triceratops_pod.abilityText).not.toBe(en.cards.dino_laser_triceratops.abilityText);
    expect(en.cards.dino_armor_stego_pod.abilityText).not.toBe(en.cards.dino_armor_stego.abilityText);
    expect(en.cards.dino_tooth_and_claw_pod.effectText).not.toBe(en.cards.dino_tooth_and_claw.effectText);
    expect(en.cards.ninja_infiltrate_pod.effectText).not.toBe(en.cards.ninja_infiltrate.effectText);
  });
});
