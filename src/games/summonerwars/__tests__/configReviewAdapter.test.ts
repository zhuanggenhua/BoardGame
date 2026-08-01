import { describe, expect, it } from 'vitest';
import {
  buildSummonerWarsConfigReviewTable,
  getSummonerWarsConfigReviewCellValue,
  isSummonerWarsConfigReviewFieldApplicable,
  SUMMONER_WARS_CONFIG_REVIEW_COLUMN_KEYS,
  SUMMONER_WARS_CONFIG_REVIEW_FIELD_DEFINITIONS,
  SUMMONER_WARS_CONFIG_REVIEW_TABLE_ID,
  SUMMONER_WARS_CONFIG_REVIEW_VERSION,
} from '../config/configReviewAdapter';

describe('SummonerWars configReviewAdapter', () => {
  it('从现有召唤师战争配置产出可审查表格行', () => {
    const table = buildSummonerWarsConfigReviewTable();

    expect(table.tableId).toBe(SUMMONER_WARS_CONFIG_REVIEW_TABLE_ID);
    expect(table.gameId).toBe('summonerwars');
    expect(table.configVersion).toBe(SUMMONER_WARS_CONFIG_REVIEW_VERSION);
    expect(table.rows.length).toBeGreaterThan(0);
    expect(table.rows.every((row) => row.quantity > 0)).toBe(true);
  });

  it('每行都带真实卡图预览引用，方便玩家对照配置和素材', () => {
    const table = buildSummonerWarsConfigReviewTable();
    const missingRows = table.rows.filter((row) => row.materialStatus !== 'ready' || !row.previewRef);

    expect(missingRows).toEqual([]);
    expect(table.rows[0].previewRef).toMatchObject({ type: 'atlas' });
  });

  it('保留起始配置、牌堆数量和字段级反馈路径', () => {
    const table = buildSummonerWarsConfigReviewTable();
    const summoner = table.rows.find((row) => row.objectId === 'necro-summoner');
    const startingGate = table.rows.find((row) => row.objectId === 'necro-starting-gate');
    const deckGate = table.rows.find((row) => row.objectId === 'necro-portal');

    expect(summoner).toMatchObject({
      name: '瑞特-塔鲁斯',
      objectType: 'summoner',
      quantity: 1,
      materialStatus: 'ready',
    });
    expect(summoner?.sourceContexts).toContain('召唤师');
    expect(summoner?.fieldPaths.attack).toBe('legacy.summonerwars.cardRegistry.necro-summoner.strength');
    expect(summoner?.fieldPaths.deckSymbols).toBe('legacy.summonerwars.cardRegistry.necro-summoner.deckSymbols');
    expect(summoner?.fieldPaths.sprite).toBe('legacy.summonerwars.cardRegistry.necro-summoner.sprite');
    expect(summoner?.fieldPaths.setupPositions).toBe('legacy.summonerwars.deckSources.necro-summoner.setupPositions');
    expect(summoner?.deckSymbols).toEqual(expect.arrayContaining(['double_axe', 'flame', 'moon']));
    expect(summoner?.setupPositions).toEqual(['summoner@0:3']);

    expect(startingGate?.sourceContexts).toContain('起始城门');
    expect(startingGate?.setupPositions).toEqual(['startingGate@2:3']);
    expect(deckGate).toMatchObject({
      objectType: 'gate',
      quantity: 3,
    });
    expect(deckGate?.setupPositions).toEqual([]);
  });

  it('把起始单位坐标作为正式字段暴露，不藏在来源字符串里', () => {
    const table = buildSummonerWarsConfigReviewTable();
    const startingArcher = table.rows.find((row) => row.objectId === 'necro-start-archer');
    const plagueZombie = table.rows.find((row) => row.objectId === 'necro-start-zombie');
    const deckArcher = table.rows.find((row) => row.objectId === 'necro-undead-archer');

    expect(startingArcher?.sourceContexts).toEqual(['起始单位']);
    expect(startingArcher?.setupPositions).toEqual(['startingUnit#1@2:2']);
    expect(plagueZombie?.sourceContexts).toEqual(['起始单位']);
    expect(plagueZombie?.setupPositions).toEqual(['startingUnit#2@3:3']);
    expect(deckArcher?.sourceContexts).toEqual(['抽牌堆']);
    expect(deckArcher?.setupPositions).toEqual([]);
  });

  it('把运行时和组牌消费的关键字段显式暴露为表格字段', () => {
    const table = buildSummonerWarsConfigReviewTable();
    const summoner = table.rows.find((row) => row.objectId === 'necro-summoner');
    const event = table.rows.find((row) => row.cardType === 'event' && row.eventType === 'legendary');
    const gate = table.rows.find((row) => row.objectId === 'necro-starting-gate');

    expect(summoner).toMatchObject({
      cardType: 'unit',
      unitClass: 'summoner',
      attackType: 'ranged',
      attackRange: 3,
    });
    expect(summoner?.fieldPaths).toMatchObject({
      cardType: 'legacy.summonerwars.cardRegistry.necro-summoner.cardType',
      unitClass: 'legacy.summonerwars.cardRegistry.necro-summoner.unitClass',
      faction: 'legacy.summonerwars.cardRegistry.necro-summoner.faction',
      attackType: 'legacy.summonerwars.cardRegistry.necro-summoner.attackType',
      attackRange: 'legacy.summonerwars.cardRegistry.necro-summoner.attackRange',
      abilities: 'legacy.summonerwars.cardRegistry.necro-summoner.abilities',
    });

    expect(event?.fieldPaths).toMatchObject({
      playPhase: `legacy.summonerwars.cardRegistry.${event?.objectId}.playPhase`,
      eventType: `legacy.summonerwars.cardRegistry.${event?.objectId}.eventType`,
      isActive: `legacy.summonerwars.cardRegistry.${event?.objectId}.isActive`,
      charges: `legacy.summonerwars.cardRegistry.${event?.objectId}.charges`,
      targetUnitId: `legacy.summonerwars.cardRegistry.${event?.objectId}.targetUnitId`,
      effect: `legacy.summonerwars.cardRegistry.${event?.objectId}.effect`,
    });

    expect(gate).toMatchObject({
      cardType: 'structure',
      isGate: true,
      isStartingGate: true,
    });
    expect(gate?.fieldPaths).toMatchObject({
      isGate: 'legacy.summonerwars.cardRegistry.necro-starting-gate.isGate',
      isStartingGate: 'legacy.summonerwars.cardRegistry.necro-starting-gate.isStartingGate',
      setupPositions: 'legacy.summonerwars.deckSources.necro-starting-gate.setupPositions',
    });
  });

  it('主表只显示玩家需要录入或修正的字段，不暴露内部定位和素材索引', () => {
    const requiredFields = SUMMONER_WARS_CONFIG_REVIEW_FIELD_DEFINITIONS.filter((definition) => definition.requiredForAudit);
    const requiredKeys = requiredFields.map((definition) => definition.key);
    const visibleColumns = new Set(SUMMONER_WARS_CONFIG_REVIEW_COLUMN_KEYS);

    expect(requiredKeys).toEqual(expect.arrayContaining([
      'faction',
      'deckSymbols',
      'setupPositions',
      'attackType',
      'attackRange',
      'abilities',
    ]));
    expect(requiredFields.filter((definition) => definition.evidence.length === 0)).toEqual([]);

    for (const fieldKey of requiredKeys) {
      expect(visibleColumns.has(fieldKey)).toBe(true);
    }

    expect(SUMMONER_WARS_CONFIG_REVIEW_COLUMN_KEYS).not.toEqual(expect.arrayContaining([
      'id',
      'sourceContexts',
      'spriteAtlas',
      'spriteIndex',
    ]));
  });

  it('字段清单同时驱动值读取、适用对象和字段级反馈路径', () => {
    const table = buildSummonerWarsConfigReviewTable();
    const summoner = table.rows.find((row) => row.objectId === 'necro-summoner');
    const event = table.rows.find((row) => row.cardType === 'event' && row.eventType === 'legendary');

    expect(summoner).toBeDefined();
    expect(event).toBeDefined();
    if (!summoner || !event) return;

    expect(getSummonerWarsConfigReviewCellValue(summoner, 'deckSymbols')).toEqual(['double_axe', 'flame', 'moon']);
    expect(getSummonerWarsConfigReviewCellValue(summoner, 'setupPositions')).toEqual(['summoner@0:3']);
    expect(isSummonerWarsConfigReviewFieldApplicable(summoner, 'deckSymbols')).toBe(true);
    expect(isSummonerWarsConfigReviewFieldApplicable(event, 'attack')).toBe(false);

    for (const columnKey of SUMMONER_WARS_CONFIG_REVIEW_COLUMN_KEYS) {
      if (columnKey === 'image') continue;
      expect(summoner.fieldPaths[columnKey]).toEqual(expect.any(String));
    }
  });
});
