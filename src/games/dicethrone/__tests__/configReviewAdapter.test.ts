import { describe, expect, it } from 'vitest';
import {
  buildDiceThroneConfigReviewTable,
  DICETHRONE_CONFIG_REVIEW_COLUMN_KEYS,
  DICETHRONE_CONFIG_REVIEW_FIELD_DEFINITIONS,
  DICETHRONE_CONFIG_REVIEW_TABLE_ID,
  DICETHRONE_CONFIG_REVIEW_VERSION,
  getDiceThroneConfigReviewCellValue,
  isDiceThroneConfigReviewFieldApplicable,
} from '../config/configReviewAdapter';
import { IMPLEMENTED_DICETHRONE_CHARACTER_IDS } from '../domain/types';

describe('DiceThrone configReviewAdapter', () => {
  it('从现有 DiceThrone TS 配置产出可审查表格行', () => {
    const table = buildDiceThroneConfigReviewTable();

    expect(table.tableId).toBe(DICETHRONE_CONFIG_REVIEW_TABLE_ID);
    expect(table.gameId).toBe('dicethrone');
    expect(table.configVersion).toBe(DICETHRONE_CONFIG_REVIEW_VERSION);
    expect(table.rows.length).toBeGreaterThan(IMPLEMENTED_DICETHRONE_CHARACTER_IDS.length);
  });

  it('每个已实现英雄都有英雄、卡牌、技能、骰面、标记/状态审查行', () => {
    const table = buildDiceThroneConfigReviewTable();

    for (const characterId of IMPLEMENTED_DICETHRONE_CHARACTER_IDS) {
      const rows = table.rows.filter((row) => row.characterId === characterId);
      expect(rows.some((row) => row.objectType === 'character')).toBe(true);
      expect(rows.some((row) => row.objectType === 'card')).toBe(true);
      expect(rows.some((row) => row.objectType === 'ability')).toBe(true);
      expect(rows.filter((row) => row.objectType === 'diceFace')).toHaveLength(6);
      expect(rows.some((row) => row.objectType === 'token')).toBe(true);
    }
  });

  it('卡牌行都带真实卡图引用，方便玩家对照卡面和字段', () => {
    const table = buildDiceThroneConfigReviewTable();
    const cardRows = table.rows.filter((row) => row.objectType === 'card');
    const missingCardArtRows = cardRows.filter((row) => row.materialStatus !== 'ready' || !row.previewRef);

    expect(cardRows.length).toBeGreaterThan(0);
    expect(missingCardArtRows).toEqual([]);
    expect(cardRows[0].previewRef).toMatchObject({ type: 'atlas' });
  });

  it('保留开局资源、起手牌数、骰面和字段级反馈路径', () => {
    const table = buildDiceThroneConfigReviewTable();
    const monk = table.rows.find((row) => row.objectType === 'character' && row.characterId === 'monk');
    const fistFace = table.rows.find((row) => row.objectType === 'diceFace' && row.characterId === 'monk' && row.diceValue === 1);
    const innerPeace = table.rows.find((row) => row.objectType === 'card' && row.characterId === 'monk' && row.objectId === 'card-inner-peace');

    expect(monk).toMatchObject({
      objectId: 'monk',
      startingCp: 2,
      startingHealth: 50,
      cpMax: 15,
      handLimit: 6,
      startingHandSize: 4,
      diceDefinitionId: 'monk-dice',
    });
    expect(monk?.fieldPaths.startingHandSize).toBe('legacy.dicethrone.characters.monk.startingHandSize');

    expect(fistFace).toMatchObject({
      diceDefinitionId: 'monk-dice',
      diceValue: 1,
      diceSymbols: ['fist'],
    });
    expect(fistFace?.fieldPaths.diceSymbols).toBe('legacy.dicethrone.dice.monk.monk-dice.faces.1.diceSymbols');

    expect(innerPeace).toMatchObject({
      cardType: 'action',
      cpCost: 0,
      timing: 'instant',
      materialStatus: 'ready',
    });
    expect(innerPeace?.fieldPaths.cpCost).toBe('legacy.dicethrone.cards.monk.card-inner-peace.cpCost');
  });

  it('主表只显示玩家需要录入或修正的静态字段，不暴露内部调试和素材索引', () => {
    const requiredFields = DICETHRONE_CONFIG_REVIEW_FIELD_DEFINITIONS.filter((definition) => definition.requiredForAudit);
    const requiredKeys = requiredFields.map((definition) => definition.key);
    const visibleColumns = new Set(DICETHRONE_CONFIG_REVIEW_COLUMN_KEYS);

    expect(requiredKeys).toEqual(expect.arrayContaining([
      'startingCp',
      'startingHealth',
      'cpMax',
      'handLimit',
      'startingHandSize',
      'diceValue',
      'diceSymbols',
      'abilityType',
      'tags',
      'initialAbilityLevel',
      'cardType',
      'cpCost',
      'timing',
      'description',
      'isAttackModifier',
      'tokenCategory',
      'stackLimit',
      'initialTokenAmount',
      'initialStatusAmount',
      'sfxKey',
    ]));
    expect(requiredFields.filter((definition) => definition.evidence.length === 0)).toEqual([]);

    for (const fieldKey of requiredKeys) {
      expect(visibleColumns.has(fieldKey)).toBe(true);
    }

    expect(DICETHRONE_CONFIG_REVIEW_COLUMN_KEYS).not.toEqual(expect.arrayContaining([
      'id',
      'rowType',
      'sourceContexts',
      'diceDefinitionId',
      'diceSprite',
      'trigger',
      'effects',
      'variants',
      'passiveAbilities',
      'playCondition',
      'previewAtlas',
      'previewIndex',
      'sourceAtlasIndex',
      'passiveTrigger',
      'activeUse',
      'frameId',
      'tokenAtlasId',
      'statusAtlasId',
      'statusAtlasPath',
    ]));
  });

  it('字段定义同时驱动值读取、适用对象和稳定修改路径', () => {
    const table = buildDiceThroneConfigReviewTable();
    const monk = table.rows.find((row) => row.objectType === 'character' && row.characterId === 'monk');
    const innerPeace = table.rows.find((row) => row.objectType === 'card' && row.characterId === 'monk' && row.objectId === 'card-inner-peace');
    const taiji = table.rows.find((row) => row.objectType === 'token' && row.characterId === 'monk' && row.objectId === 'taiji');

    expect(monk).toBeDefined();
    expect(innerPeace).toBeDefined();
    expect(taiji).toBeDefined();
    if (!monk || !innerPeace || !taiji) return;

    expect(getDiceThroneConfigReviewCellValue(monk, 'startingHandSize')).toBe(4);
    expect(getDiceThroneConfigReviewCellValue(innerPeace, 'cpCost')).toBe(0);
    expect(getDiceThroneConfigReviewCellValue(taiji, 'stackLimit')).toBeGreaterThan(0);
    expect(isDiceThroneConfigReviewFieldApplicable(innerPeace, 'cpCost')).toBe(true);
    expect(isDiceThroneConfigReviewFieldApplicable(innerPeace, 'stackLimit')).toBe(false);

    for (const columnKey of DICETHRONE_CONFIG_REVIEW_COLUMN_KEYS) {
      if (columnKey === 'image') continue;
      expect(innerPeace.fieldPaths[columnKey]).toEqual(expect.any(String));
    }
  });
});
