/**
 * 技能名称唯一性测试
 * 
 * 防止多个技能使用相同的 i18n key 导致 UI 显示重复名称
 */

import { describe, it, expect } from 'vitest';
import { abilityRegistry } from '../domain/abilities';

describe('技能名称唯一性检查', () => {
  it('所有技能的 name 字段应该唯一（不同 abilityId 不应使用相同的 i18n key）', () => {
    const abilities = abilityRegistry.getAll();
    const nameToAbilities = new Map<string, string[]>();

    // 收集所有使用相同 name 的技能
    for (const abilityDef of abilities) {
      const name = abilityDef.name;
      const abilityId = abilityDef.id;
      if (!nameToAbilities.has(name)) {
        nameToAbilities.set(name, []);
      }
      nameToAbilities.get(name)!.push(abilityId);
    }

    // 找出所有重复的 name
    const duplicates: Array<{ name: string; abilityIds: string[] }> = [];
    for (const [name, abilityIds] of nameToAbilities.entries()) {
      if (abilityIds.length > 1) {
        duplicates.push({ name, abilityIds });
      }
    }

    // 如果有重复，输出详细信息
    if (duplicates.length > 0) {
      const errorMessage = duplicates
        .map(({ name, abilityIds }) => {
          return `  i18n key "${name}" 被以下技能共用：\n    - ${abilityIds.join('\n    - ')}`;
        })
        .join('\n\n');

      expect.fail(
        `发现 ${duplicates.length} 个重复的技能名称 i18n key：\n\n${errorMessage}\n\n` +
        `修复方法：为每个技能使用唯一的 i18n key，例如：\n` +
        `  - telekinesis: abilityText('telekinesis', 'name')\n` +
        `  - telekinesis_instead: abilityText('telekinesis_instead', 'name')`
      );
    }

    // 断言没有重复
    expect(duplicates).toEqual([]);
  });

  it('技能 ID 应该与其 name i18n key 一致（推荐规范）', () => {
    const abilities = abilityRegistry.getAll();
    const inconsistencies: Array<{ abilityId: string; nameKey: string }> = [];

    for (const abilityDef of abilities) {
      const abilityId = abilityDef.id;
      const name = abilityDef.name;
      
      // 提取 i18n key（假设格式为 "abilities.xxx.name" 或 "abilityNames.xxx"）
      const match = name.match(/abilities\.([^.]+)\.name|abilityNames\.([^.]+)/);
      const extractedKey = match?.[1] || match?.[2];

      // 如果能提取到 key，检查是否与 abilityId 一致
      if (extractedKey && extractedKey !== abilityId) {
        inconsistencies.push({ abilityId, nameKey: extractedKey });
      }
    }

    // 这是一个警告性测试，不强制失败，但会输出不一致的情况
    if (inconsistencies.length > 0) {
      console.warn(
        `\n⚠️  发现 ${inconsistencies.length} 个技能的 ID 与 name i18n key 不一致：\n` +
        inconsistencies
          .map(({ abilityId, nameKey }) => `  - ${abilityId} 使用了 "${nameKey}" 的 i18n key`)
          .join('\n') +
        `\n\n这不是错误，但为了一致性，建议技能 ID 与 i18n key 保持一致。`
      );
    }

    // 不强制要求一致，只是警告
    expect(true).toBe(true);
  });

  it('相关技能应该有明确区分的名称（如 xxx 和 xxx_instead）', () => {
    const abilities = abilityRegistry.getAll();
    const relatedPairs: Array<{ base: string; variant: string }> = [];

    // 查找 xxx 和 xxx_instead 这样的配对
    for (const abilityDef of abilities) {
      const abilityId = abilityDef.id;
      if (abilityId.endsWith('_instead')) {
        const baseId = abilityId.replace('_instead', '');
        if (abilities.some(def => def.id === baseId)) {
          relatedPairs.push({ base: baseId, variant: abilityId });
        }
      }
    }

    // 检查这些配对是否使用了不同的 name
    const sameNamePairs: Array<{ base: string; variant: string; name: string }> = [];
    for (const { base, variant } of relatedPairs) {
      const baseDef = abilityRegistry.get(base);
      const variantDef = abilityRegistry.get(variant);
      
      if (baseDef && variantDef && baseDef.name === variantDef.name) {
        sameNamePairs.push({ base, variant, name: baseDef.name });
      }
    }

    if (sameNamePairs.length > 0) {
      const errorMessage = sameNamePairs
        .map(({ base, variant, name }) => {
          return `  - "${base}" 和 "${variant}" 都使用了 "${name}"`;
        })
        .join('\n');

      expect.fail(
        `发现 ${sameNamePairs.length} 对相关技能使用了相同的 name：\n\n${errorMessage}\n\n` +
        `这会导致 UI 显示重复名称。请为变体技能使用独立的 i18n key。`
      );
    }

    expect(sameNamePairs).toEqual([]);
  });
});
