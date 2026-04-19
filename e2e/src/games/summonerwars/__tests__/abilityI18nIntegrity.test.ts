/**
 * 技能 i18n 完整性验证
 *
 * 确保所有 AbilityDef 的 i18n key 在 zh-CN 和 en 中均存在。
 */

import { describe, it, expect } from 'vitest';
import { readFileSync } from 'fs';
import { resolve } from 'path';
import { abilityRegistry } from '../domain/abilities';

// 确保所有技能已注册（import abilities.ts 会触发 registerAll）
import '../domain/abilities';

describe('SummonerWars 技能 i18n 完整性', () => {
  const zhCN = JSON.parse(
    readFileSync(resolve(__dirname, '../../../../public/locales/zh-CN/game-summonerwars.json'), 'utf-8'),
  );
  const en = JSON.parse(
    readFileSync(resolve(__dirname, '../../../../public/locales/en/game-summonerwars.json'), 'utf-8'),
  );

  const allAbilities = abilityRegistry.getAll();

  it('注册表非空', () => {
    expect(allAbilities.length).toBeGreaterThan(0);
  });

  it('所有技能的 name key 在 zh-CN 中存在', () => {
    const missing: string[] = [];
    for (const def of allAbilities) {
      // name 格式为 "abilities.<id>.name"（由 abilityText helper 生成）
      const key = `abilities.${def.id}.name`;
      const parts = key.split('.');
      let val: unknown = zhCN;
      for (const p of parts) {
        val = (val as Record<string, unknown>)?.[p];
      }
      if (typeof val !== 'string' || val.length === 0) {
        missing.push(def.id);
      }
    }
    expect(missing, `zh-CN 缺少 name: ${missing.join(', ')}`).toEqual([]);
  });

  it('所有技能的 name key 在 en 中存在', () => {
    const missing: string[] = [];
    for (const def of allAbilities) {
      const key = `abilities.${def.id}.name`;
      const parts = key.split('.');
      let val: unknown = en;
      for (const p of parts) {
        val = (val as Record<string, unknown>)?.[p];
      }
      if (typeof val !== 'string' || val.length === 0) {
        missing.push(def.id);
      }
    }
    expect(missing, `en 缺少 name: ${missing.join(', ')}`).toEqual([]);
  });

  it('所有技能的 description key 在 zh-CN 中存在', () => {
    const missing: string[] = [];
    for (const def of allAbilities) {
      const key = `abilities.${def.id}.description`;
      const parts = key.split('.');
      let val: unknown = zhCN;
      for (const p of parts) {
        val = (val as Record<string, unknown>)?.[p];
      }
      if (typeof val !== 'string' || val.length === 0) {
        missing.push(def.id);
      }
    }
    expect(missing, `zh-CN 缺少 description: ${missing.join(', ')}`).toEqual([]);
  });

  it('所有技能的 description key 在 en 中存在', () => {
    const missing: string[] = [];
    for (const def of allAbilities) {
      const key = `abilities.${def.id}.description`;
      const parts = key.split('.');
      let val: unknown = en;
      for (const p of parts) {
        val = (val as Record<string, unknown>)?.[p];
      }
      if (typeof val !== 'string' || val.length === 0) {
        missing.push(def.id);
      }
    }
    expect(missing, `en 缺少 description: ${missing.join(', ')}`).toEqual([]);
  });
});
