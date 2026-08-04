/**
 * 卡牌 i18n 完整性校验
 *
 * 确保 Smash Up 的卡牌、基地与关键文案在 zh-CN / en 中都能正确解析。
 */

import { describe, it, expect } from 'vitest';
import { readFileSync } from 'fs';
import { resolve } from 'path';
import { getAllCardDefs, getAllBaseDefs, getCardDef, getFactionCards, resolveCardName, resolveCardText } from '../data/cards';
import { resolveI18nKeys, resolveI18nParams, resolvePromptText } from '../ui/PromptOverlay';
import { SMASHUP_ATLAS_IDS, SMASHUP_FACTION_IDS } from '../domain/ids';

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

  it('所有卡牌在 zh-CN 中都有 name', () => {
    const missing: string[] = [];
    for (const def of allCards) {
      const value = zhCN.cards?.[def.id]?.name;
      if (typeof value !== 'string' || value.length === 0) {
        missing.push(def.id);
      }
    }
    expect(missing, `zh-CN 缺少卡牌 name: ${missing.join(', ')}`).toEqual([]);
  });

  it('所有卡牌在 en 中都有 name', () => {
    const missing: string[] = [];
    for (const def of allCards) {
      const value = en.cards?.[def.id]?.name;
      if (typeof value !== 'string' || value.length === 0) {
        missing.push(def.id);
      }
    }
    expect(missing, `en 缺少卡牌 name: ${missing.join(', ')}`).toEqual([]);
  });

  it('所有带能力标签的随从在 zh-CN 中都有 abilityText', () => {
    const missing: string[] = [];
    for (const def of allCards) {
      if (def.type !== 'minion') continue;
      if (!def.abilityTags || def.abilityTags.length === 0) continue;

      const value = zhCN.cards?.[def.id]?.abilityText;
      if (typeof value !== 'string' || value.length === 0) {
        missing.push(def.id);
      }
    }
    expect(missing, `zh-CN 缺少随从 abilityText: ${missing.join(', ')}`).toEqual([]);
  });

  it('所有行动牌在 zh-CN 中都有 effectText', () => {
    const missing: string[] = [];
    for (const def of allCards) {
      if (def.type !== 'action') continue;

      const value = zhCN.cards?.[def.id]?.effectText;
      if (typeof value !== 'string' || value.length === 0) {
        missing.push(def.id);
      }
    }
    expect(missing, `zh-CN 缺少行动牌 effectText: ${missing.join(', ')}`).toEqual([]);
  });

  it('英文含 "Special: Play before a base scores." 的行动牌在 zh-CN 中必须保留可选打出语义', () => {
    const violations: string[] = [];

    for (const def of allCards) {
      if (def.type !== 'action') continue;

      const enText = en.cards?.[def.id]?.effectText;
      const zhText = zhCN.cards?.[def.id]?.effectText;
      if (typeof enText !== 'string' || !enText.includes('Special: Play before a base scores.')) continue;

      if (typeof zhText !== 'string') {
        violations.push(`[${def.id}] zh-CN effectText 缺失`);
        continue;
      }

      const preservesOptionalPlay = /特殊：你可以在.*基地计分前打出(?:此牌|该卡牌)/.test(zhText);
      if (!preservesOptionalPlay) {
        violations.push(`[${def.id}] 中文未保留“你可以在基地计分前打出此牌”的可选语义: ${zhText}`);
      }
    }

    expect(
      violations,
      '以下行动牌把 "Special: Play before a base scores." 译丢了可选打出语义',
    ).toEqual([]);
  });

  it('所有泰坦牌在 zh-CN 中都有 effectText', () => {
    const missing: string[] = [];
    for (const def of allCards) {
      if (def.type !== 'titan') continue;

      const value = zhCN.cards?.[def.id]?.effectText;
      if (typeof value !== 'string' || value.length === 0) {
        missing.push(def.id);
      }
    }
    expect(missing, `zh-CN 缺少泰坦 effectText: ${missing.join(', ')}`).toEqual([]);
  });

  it('所有基地在 zh-CN 中都有 name', () => {
    const missing: string[] = [];
    for (const def of allBases) {
      const value = zhCN.cards?.[def.id]?.name;
      if (typeof value !== 'string' || value.length === 0) {
        missing.push(def.id);
      }
    }
    expect(missing, `zh-CN 缺少基地 name: ${missing.join(', ')}`).toEqual([]);
  });

  it('有能力文本的基地在 zh-CN 中都有 abilityText', () => {
    const missing: string[] = [];
    for (const def of allBases) {
      const value = zhCN.cards?.[def.id]?.abilityText;
      if (value === undefined) continue;
      if (typeof value !== 'string' || value.length === 0) {
        missing.push(def.id);
      }
    }
    expect(missing, `zh-CN 缺少基地 abilityText: ${missing.join(', ')}`).toEqual([]);
  });

  it('actionLog 的非随从力量修正文案在 zh-CN 和 en 中都存在', () => {
    expect(zhCN.actionLog?.powerModifier?.nonMinion).toBe('非随从力量修正');
    expect(en.actionLog?.powerModifier?.nonMinion).toBe('Non-minion Power Modifier');
  });

  it('resolveCardText 优先命中 POD 的精确 locale key', () => {
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

  it('resolveCardText 对泰坦读取 effectText', () => {
    const zhTranslator = makeTranslator(zhCN);

    expect(resolveCardText(getCardDef('pirates_the_kraken'), zhTranslator)).toBe(
      zhCN.cards.pirates_the_kraken.effectText,
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

  it('已确认独立文案的 POD 卡不会回退成基础版文案', () => {
    expect(en.cards.dino_laser_triceratops_pod.abilityText).not.toBe(en.cards.dino_laser_triceratops.abilityText);
    expect(en.cards.dino_armor_stego_pod.abilityText).not.toBe(en.cards.dino_armor_stego.abilityText);
    expect(en.cards.dino_tooth_and_claw_pod.effectText).not.toBe(en.cards.dino_tooth_and_claw.effectText);
    expect(en.cards.ninja_infiltrate_pod.effectText).not.toBe(en.cards.ninja_infiltrate.effectText);
  });

  it('Pretty Pretty 的猫咪与小马卡组按实际卡图索引注册', () => {
    const kittyCards = getFactionCards(SMASHUP_FACTION_IDS.KITTY_CATS);
    const horseCards = getFactionCards(SMASHUP_FACTION_IDS.MYTHIC_HORSES);

    expect(kittyCards.reduce((total, card) => total + card.count, 0)).toBe(20);
    expect(horseCards.reduce((total, card) => total + card.count, 0)).toBe(20);

    expect(getCardDef('kitty_cats_can_has_cheeseburger')?.previewRef).toEqual({
      type: 'atlas',
      atlasId: SMASHUP_ATLAS_IDS.CARDS8,
      index: 11,
    });
    expect(getCardDef('mythic_horses_teaching_power')?.previewRef).toEqual({
      type: 'atlas',
      atlasId: SMASHUP_ATLAS_IDS.CARDS8,
      index: 12,
    });
    expect(getCardDef('mythic_horses_rainbow')?.previewRef).toEqual({
      type: 'atlas',
      atlasId: SMASHUP_ATLAS_IDS.CARDS8,
      index: 23,
    });
  });

  it('resolveI18nKeys 能解析反应队列中的卡名和时机 key', () => {
    const zhTranslator = (key: string, opts?: { defaultValue?: string }) => {
      const resolved = key.split('.').reduce<any>((value, segment) => value?.[segment], zhCN);
      return typeof resolved === 'string' ? resolved : (opts?.defaultValue ?? key);
    };

    expect(resolveI18nKeys('cards.base_tortuga.name 路 ui.reaction_timing.afterScoring', zhTranslator)).toBe('托尔图加 路 计分后');
    expect(resolveI18nKeys('cards.ninja_infiltrate_pod.name 路 ui.reaction_timing.onActionPlayed', zhTranslator)).toContain('路 行动打出后');
  });

  it('resolveI18nParams 会把 labelKey 参数中的 cards key 解析成中文', () => {
    const zhTranslator = (key: string, opts?: { defaultValue?: string }) => {
      const resolved = key.split('.').reduce<any>((value, segment) => value?.[segment], zhCN);
      return typeof resolved === 'string' ? resolved : (opts?.defaultValue ?? key);
    };

    expect(resolveI18nParams({
      name: 'cards.base_tortuga.name',
      baseNumber: 2,
    }, zhTranslator)).toEqual({
      name: '托尔图加',
      baseNumber: 2,
    });
  });

  it('resolvePromptText 会把 titleKey 参数中的 cards key 解析成中文', () => {
    const zhTranslator = (key: string, opts?: { defaultValue?: string; [k: string]: unknown }) => {
      const resolved = key.split('.').reduce<any>((value, segment) => value?.[segment], zhCN);
      if (typeof resolved !== 'string') return opts?.defaultValue ?? key;
      return resolved.replace(/\{\{\s*(\w+)\s*\}\}/g, (_match, name) => {
        const value = opts?.[name];
        return value === undefined ? '' : String(value);
      });
    };

    expect(resolvePromptText(
      'fallback title',
      'ui.titan_megabot_move_title',
      {
        name: 'cards.mega_troopers_megabot.name',
        baseName: 'cards.base_tortuga.name',
      },
      zhTranslator,
    )).toBe('超级佐德：要在该基地计分前移动到托尔图加吗？');
  });

  it('resolvePromptText 能兼容大小写不一致的标题占位符', () => {
    const translator = (key: string, opts?: { defaultValue?: string; [k: string]: unknown }) => {
      if (key === 'ui.pirate_first_mate_choose_base_title') {
        return '{{MATENAME}}：你可以移动此随从到其他基地（而不是弃牌堆）';
      }
      return opts?.defaultValue ?? key;
    };

    expect(resolvePromptText(
      'fallback title',
      'ui.pirate_first_mate_choose_base_title',
      { mateName: '大副' },
      translator,
    )).toBe('大副：你可以移动此随从到其他基地（而不是弃牌堆）');
  });

  it('Oops 四派系 POD 卡牌的关键中文效果文本已修正', () => {
    expect(zhCN.cards?.ancient_egyptians_mummy_pod?.abilityText).toBe(
      '特殊：本基地计分后，你可以将此随从埋葬到另一个基地。',
    );
    expect(zhCN.cards?.ancient_egyptians_mummy_strength_pod?.effectText).toBe(
      '选择你的一个随从。若其所在基地有埋葬的牌，则其直到回合结束 +4 战力；否则其直到回合结束 +2 战力。',
    );
    expect(zhCN.cards?.cowboys_gunfighter_pod?.abilityText).toBe(
      '此随从可以与此处另一位玩家的一个随从决斗。消灭失败的随从。',
    );
    expect(zhCN.cards?.cowboys_dynamite_surprise_pod?.effectText).toBe(
      '特殊：在一个你有随从且你并非领先的基地计分前，消灭该处一个战力 4 或以下的随从。特殊：若另一位玩家的卡牌展示或查看了你手牌或牌库中的牌，消灭其一个战力 4 或以下的随从。',
    );
    expect(zhCN.cards?.samurai_ronin_pod?.abilityText).toBe(
      '若此随从是本基地中你唯一的随从，你可以在其上放置 2 枚 +1 战力指示物。',
    );
    expect(zhCN.cards?.samurai_final_haiku_pod?.effectText).toBe(
      '对你的一个随从打出。持续：当此随从从场上进入弃牌堆后，你的每个随从直到回合结束各 +2 战力。',
    );
    expect(zhCN.cards?.vikings_berserk_pod?.effectText).toBe(
      '将一张手牌置于你的牌库顶，使你的一个随从直到回合结束 +4 战力。',
    );
    expect(zhCN.cards?.vikings_raiding_party_pod?.effectText).toBe(
      '展示另一位玩家牌库顶的 3 张牌。你可以将其中展示出的一张战术，或一张战力 4 或以下的随从，作为额外牌打出。其余牌以任意顺序放回。',
    );
  });

  it('Samurai POD 的 faction、cards 与 bases 在中英文 locale 中都有键', () => {
    expect(zhCN.factions?.samurai_pod?.name).toBe('武士');
    expect(en.factions?.samurai_pod?.name).toBe('Samurai');

    const samuraiPodCardIds = [
      'samurai_samurai_chan_pod',
      'samurai_ronin_pod',
      'samurai_bushi_pod',
      'samurai_shogun_pod',
      'samurai_yokai_attack_pod',
      'samurai_way_of_the_warrior_pod',
      'samurai_honorable_combat_pod',
      'samurai_honor_the_fallen_pod',
      'samurai_honor_the_ancestors_pod',
      'samurai_heart_of_the_battle_pod',
      'samurai_final_haiku_pod',
      'samurai_code_of_bushido_pod',
      'base_sakura_garden_pod',
      'base_shoguns_palace_pod',
    ];

    for (const id of samuraiPodCardIds) {
      expect(typeof zhCN.cards?.[id]?.name).toBe('string');
      expect(zhCN.cards[id].name.length).toBeGreaterThan(0);
      expect(typeof en.cards?.[id]?.name).toBe('string');
      expect(en.cards[id].name.length).toBeGreaterThan(0);
    }

    expect(en.cards.base_sakura_garden_pod.abilityText).toBe(
      'Each turn, the first time one of your minions here goes to the discard pile, draw a card.',
    );
    expect(en.cards.base_shoguns_palace_pod.abilityText).toBe(
      "Once per turn, after you play a minion here, it may duel another player's minion here. The controller of the winning minion draws two cards.",
    );
  });

  it('Cowboys POD 的 faction、cards、bases 与 pecos_bill 在中英文 locale 中都有键', () => {
    expect(zhCN.factions?.cowboys_pod?.name).toBe('牛仔');
    expect(en.factions?.cowboys_pod?.name).toBe('Cowboys');

    const cowboysPodCardIds = [
      'cowboys_deputy_pod',
      'cowboys_gunfighter_pod',
      'cowboys_pinkerton_pod',
      'cowboys_sheriff_pod',
      'cowboys_form_a_posse_pod',
      'cowboys_quick_draw_pod',
      'cowboys_gold_in_them_thar_hills_pod',
      'cowboys_stagecoach_pod',
      'cowboys_run_em_off_pod',
      'cowboys_high_noon_pod',
      'cowboys_dynamite_surprise_pod',
      'cowboys_gold_strike_pod',
      'base_saloon_pod',
      'base_so_so_corral_pod',
      'pecos_bill',
    ];

    for (const id of cowboysPodCardIds) {
      expect(typeof zhCN.cards?.[id]?.name).toBe('string');
      expect(zhCN.cards[id].name.length).toBeGreaterThan(0);
      expect(typeof en.cards?.[id]?.name).toBe('string');
      expect(en.cards[id].name.length).toBeGreaterThan(0);
    }

    expect(en.cards.base_saloon_pod.abilityText).toBe(
      'After a minion here is destroyed, each player with a minion here may draw a card.',
    );
    expect(en.cards.base_so_so_corral_pod.abilityText).toBe(
      "After you play a minion here, it may duel another player's minion here. Destroy the losing minion.",
    );
    expect(en.cards.pecos_bill.effectText).toContain('When you become the challenger in a duel');
  });

  it('Vikings POD 的 faction、cards 与 bases 在中英文 locale 中都有键', () => {
    expect(zhCN.factions?.vikings_pod?.name).toBe('维京人');
    expect(en.factions?.vikings_pod?.name).toBe('Vikings');

    const vikingsPodCardIds = [
      'vikings_huscarl_pod',
      'vikings_shield_maiden_pod',
      'vikings_raider_pod',
      'vikings_valkyrie_pod',
      'vikings_ransack_pod',
      'vikings_pillage_pod',
      'vikings_viking_funeral_pod',
      'vikings_cast_the_runes_pod',
      'vikings_raiding_party_pod',
      'vikings_berserk_pod',
      'vikings_tribute_pod',
      'vikings_combat_training_pod',
      'base_drakkar_pod',
      'base_longhouse_pod',
    ];

    for (const id of vikingsPodCardIds) {
      expect(typeof zhCN.cards?.[id]?.name).toBe('string');
      expect(zhCN.cards[id].name.length).toBeGreaterThan(0);
      expect(typeof en.cards?.[id]?.name).toBe('string');
      expect(en.cards[id].name.length).toBeGreaterThan(0);
    }

    expect(en.cards.base_drakkar_pod.abilityText).toBe(
      "After the first time you play a minion here each turn, you may reveal the top card of another player's deck. If it is an action or a minion of power 3 or less, you may draw it. Otherwise, return it.",
    );
    expect(en.cards.base_longhouse_pod.abilityText).toBe(
      'On your turn, you may place a card from your hand on top of your deck to give one of your minions here +2 power until the end of the turn.',
    );
  });

  it('10th Anniversary 三派系已接入卡牌与基地 locale', () => {
    const newFactions = [
      SMASHUP_FACTION_IDS.MERMAIDS,
      SMASHUP_FACTION_IDS.SKELETONS,
      SMASHUP_FACTION_IDS.WORLD_CHAMPS,
    ];

    for (const factionId of newFactions) {
      const defs = getFactionCards(factionId);
      const totalCopies = defs.reduce((sum, def) => sum + (def.count ?? 1), 0);
      expect(defs.length).toBeGreaterThanOrEqual(12);
      expect(totalCopies).toBe(20);
      expect(typeof zhCN.factions?.[factionId]?.name).toBe('string');
      expect(typeof en.factions?.[factionId]?.name).toBe('string');
      expect(typeof zhCN.factions?.[factionId]?.description).toBe('string');
      expect(typeof en.factions?.[factionId]?.description).toBe('string');
    }

    const newBaseIds = [
      'base_mermaid_pool',
      'base_mermaid_reef',
      'base_boneyard',
      'base_ossuary',
      'base_arena',
      'base_hall_of_fame',
    ];
    for (const baseId of newBaseIds) {
      expect(typeof zhCN.cards?.[baseId]?.name).toBe('string');
      expect(typeof zhCN.cards?.[baseId]?.abilityText).toBe('string');
      expect(typeof en.cards?.[baseId]?.name).toBe('string');
      expect(typeof en.cards?.[baseId]?.abilityText).toBe('string');
    }
  });
});
