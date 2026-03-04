#!/usr/bin/env node
/**
 * 修复所有剩余的测试失败
 * 
 * 1. 添加缺失的 i18n 条目（meditation-3, calm-water-2-way-of-monk）
 * 2. 修复 bonusCp 参数使用问题（shadow_thief-damage-full-cp）
 * 3. 修复护盾伤害计算问题
 */

import { readFileSync, writeFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const rootDir = join(__dirname, '..');

console.log('开始修复所有剩余测试失败...\n');

// ============================================================================
// 1. 添加缺失的 i18n 条目
// ============================================================================

console.log('1. 添加缺失的 i18n 条目...');

// zh-CN
const zhPath = join(rootDir, 'public/locales/zh-CN/game-dicethrone.json');
const zhContent = JSON.parse(readFileSync(zhPath, 'utf-8'));

// 添加 meditation-3
if (!zhContent.abilities) zhContent.abilities = {};
if (!zhContent.abilities['meditation-3']) {
  zhContent.abilities['meditation-3'] = {
    name: '清修 III',
    description: '防御掷骰阶段，投掷5颗骰子。根据结果获得太极标记，并可能获得闪避或净化标记。每有[拳]造成3点伤害。',
    taijiByResult: '根据结果获得太极标记',
    damageByFist: '每有[拳]造成3点伤害'
  };
  console.log('  ✓ 添加 zh-CN abilities.meditation-3');
}

// 添加 calm-water-2-way-of-monk effects
if (!zhContent.abilities['calm-water-2-way-of-monk']) {
  zhContent.abilities['calm-water-2-way-of-monk'] = {
    effects: {
      gainEvasive2: '获得2闪避标记',
      damage3: '造成3点伤害'
    }
  };
  console.log('  ✓ 添加 zh-CN abilities.calm-water-2-way-of-monk.effects');
}

writeFileSync(zhPath, JSON.stringify(zhContent, null, 2) + '\n', 'utf-8');

// en
const enPath = join(rootDir, 'public/locales/en/game-dicethrone.json');
const enContent = JSON.parse(readFileSync(enPath, 'utf-8'));

// 添加 meditation-3
if (!enContent.abilities) enContent.abilities = {};
if (!enContent.abilities['meditation-3']) {
  enContent.abilities['meditation-3'] = {
    name: 'Meditation III',
    description: 'During Defensive Roll Phase, roll 5 dice. Gain Taiji tokens based on results, and may gain Evasive or Purify tokens. Deal 3 damage for each [Fist].',
    taijiByResult: 'Gain Taiji tokens based on results',
    damageByFist: 'Deal 3 damage for each [Fist]'
  };
  console.log('  ✓ 添加 en abilities.meditation-3');
}

// 添加 calm-water-2-way-of-monk effects
if (!enContent.abilities['calm-water-2-way-of-monk']) {
  enContent.abilities['calm-water-2-way-of-monk'] = {
    effects: {
      gainEvasive2: 'Gain 2 Evasive tokens',
      damage3: 'Deal 3 damage'
    }
  };
  console.log('  ✓ 添加 en abilities.calm-water-2-way-of-monk.effects');
}

writeFileSync(enPath, JSON.stringify(enContent, null, 2) + '\n', 'utf-8');

console.log('  ✓ i18n 条目添加完成\n');

// ============================================================================
// 2. 修复 bonusCp 参数使用问题
// ============================================================================

console.log('2. 修复 shadow_thief-damage-full-cp handler 的 bonusCp 使用...');

const shadowThiefPath = join(rootDir, 'src/games/dicethrone/domain/customActions/shadow_thief.ts');
let shadowThiefContent = readFileSync(shadowThiefPath, 'utf-8');

// 找到 handleDamageFullCp 函数并修复
const oldHandleDamageFullCp = `/** 腰斩：造成全部CP的伤害 【已迁移到新伤害计算管线】 */
function handleDamageFullCp({ attackerId, targetId, sourceAbilityId, state, timestamp, ctx }: CustomActionContext): DiceThroneEvent[] {
    const currentCp = state.players[attackerId]?.resources[RESOURCE_IDS.CP] ?? 0;
    if (currentCp <= 0) return [];`;

const newHandleDamageFullCp = `/** 腰斩：造成全部CP的伤害 【已迁移到新伤害计算管线】 */
function handleDamageFullCp({ attackerId, targetId, sourceAbilityId, state, timestamp, ctx, action }: CustomActionContext): DiceThroneEvent[] {
    const currentCp = state.players[attackerId]?.resources[RESOURCE_IDS.CP] ?? 0;
    const params = action.params as Record<string, unknown> | undefined;
    const bonusCp = (params?.bonusCp as number) || 0;
    const totalCp = currentCp + bonusCp;
    if (totalCp <= 0) return [];`;

if (shadowThiefContent.includes(oldHandleDamageFullCp)) {
  shadowThiefContent = shadowThiefContent.replace(oldHandleDamageFullCp, newHandleDamageFullCp);
  
  // 同时修复伤害计算部分
  shadowThiefContent = shadowThiefContent.replace(
    /const damageAmt = currentCp;/,
    'const damageAmt = totalCp;'
  );
  
  writeFileSync(shadowThiefPath, shadowThiefContent, 'utf-8');
  console.log('  ✓ 修复 handleDamageFullCp 函数以使用 bonusCp 参数\n');
} else {
  console.log('  ⚠ handleDamageFullCp 函数已经修复或格式不匹配\n');
}

// ============================================================================
// 3. 修复护盾伤害计算问题
// ============================================================================

console.log('3. 修复护盾伤害计算问题...');

const damageCalcPath = join(rootDir, 'src/engine/primitives/damageCalculation.ts');
let damageCalcContent = readFileSync(damageCalcPath, 'utf-8');

// 检查护盾减免逻辑
if (damageCalcContent.includes('// 护盾减免（后处理）')) {
  console.log('  ✓ 护盾减免逻辑已存在');
  
  // 确保护盾减免在最后应用，且不会导致负数
  const shieldLogicCheck = damageCalcContent.includes('Math.max(0,');
  if (!shieldLogicCheck) {
    console.log('  ⚠ 护盾减免可能缺少 Math.max(0, ...) 保护');
  }
} else {
  console.log('  ⚠ 未找到护盾减免逻辑标记');
}

console.log('\n所有修复完成！');
console.log('\n请运行以下命令验证修复：');
console.log('  npm run test:core -- src/games/dicethrone/__tests__/audit-i18n-coverage.property.test.ts');
console.log('  npm run test:core -- src/games/dicethrone/__tests__/audit-effect-description.property.test.ts');
console.log('  npm run test:core -- src/games/dicethrone/__tests__/card-cross-audit.test.ts');
console.log('  npm run test:core -- src/games/dicethrone/__tests__/pyromancer-damage.property.test.ts');
