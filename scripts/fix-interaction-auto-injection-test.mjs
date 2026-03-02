import { readFileSync, writeFileSync } from 'fs';

const filePath = 'src/engine/systems/__tests__/InteractionSystem-auto-injection.test.ts';
const content = readFileSync(filePath, 'utf-8');

// 修复 1: 第一个测试 - 添加 autoRefresh: 'hand'
const fix1Old = `    const interaction = createSimpleChoice(
      'test-interaction',
      '0',
      '选择一张卡牌',
      [
        { id: 'opt-1', label: '卡牌 1', value: { cardUid: 'card-1' } },
        { id: 'opt-2', label: '卡牌 2', value: { cardUid: 'card-2' } },
        { id: 'opt-3', label: '卡牌 3', value: { cardUid: 'card-3' } },
      ]
    );`;

const fix1New = `    const interaction = createSimpleChoice(
      'test-interaction',
      '0',
      '选择一张卡牌',
      [
        { id: 'opt-1', label: '卡牌 1', value: { cardUid: 'card-1' } },
        { id: 'opt-2', label: '卡牌 2', value: { cardUid: 'card-2' } },
        { id: 'opt-3', label: '卡牌 3', value: { cardUid: 'card-3' } },
      ],
      { sourceId: 'test', autoRefresh: 'hand' }
    );`;

// 修复 2: 第二个测试 - 添加 autoRefresh: 'hand'
const fix2Old = `    const interaction1 = createSimpleChoice(
      'interaction-1',
      '0',
      '选择第一张卡牌',
      [
        { id: 'opt-1', label: '卡牌 1', value: { cardUid: 'card-1' } },
        { id: 'opt-2', label: '卡牌 2', value: { cardUid: 'card-2' } },
        { id: 'opt-3', label: '卡牌 3', value: { cardUid: 'card-3' } },
      ]
    );

    const interaction2 = createSimpleChoice(
      'interaction-2',
      '0',
      '选择第二张卡牌',
      [
        { id: 'opt-1', label: '卡牌 1', value: { cardUid: 'card-1' } },
        { id: 'opt-2', label: '卡牌 2', value: { cardUid: 'card-2' } },
        { id: 'opt-3', label: '卡牌 3', value: { cardUid: 'card-3' } },
      ]
    );`;

const fix2New = `    const interaction1 = createSimpleChoice(
      'interaction-1',
      '0',
      '选择第一张卡牌',
      [
        { id: 'opt-1', label: '卡牌 1', value: { cardUid: 'card-1' } },
        { id: 'opt-2', label: '卡牌 2', value: { cardUid: 'card-2' } },
        { id: 'opt-3', label: '卡牌 3', value: { cardUid: 'card-3' } },
      ],
      { sourceId: 'test', autoRefresh: 'hand' }
    );

    const interaction2 = createSimpleChoice(
      'interaction-2',
      '0',
      '选择第二张卡牌',
      [
        { id: 'opt-1', label: '卡牌 1', value: { cardUid: 'card-1' } },
        { id: 'opt-2', label: '卡牌 2', value: { cardUid: 'card-2' } },
        { id: 'opt-3', label: '卡牌 3', value: { cardUid: 'card-3' } },
      ],
      { sourceId: 'test', autoRefresh: 'hand' }
    );`;

// 修复 3: 第五个测试 - 添加 autoRefresh: 'hand'
const fix3Old = `    const interaction1 = createSimpleChoice(
      'interaction-1',
      '0',
      '选择卡牌或跳过',
      [
        { id: 'opt-1', label: '卡牌 1', value: { cardUid: 'card-1' } },
        { id: 'skip', label: '跳过', value: { action: 'skip' } },
      ]
    );

    const interaction2 = createSimpleChoice(
      'interaction-2',
      '0',
      '选择第二张卡牌或跳过',
      [
        { id: 'opt-1', label: '卡牌 1', value: { cardUid: 'card-1' } },
        { id: 'opt-2', label: '卡牌 2', value: { cardUid: 'card-2' } },
        { id: 'skip', label: '跳过', value: { action: 'skip' } },
      ]
    );`;

const fix3New = `    const interaction1 = createSimpleChoice(
      'interaction-1',
      '0',
      '选择卡牌或跳过',
      [
        { id: 'opt-1', label: '卡牌 1', value: { cardUid: 'card-1' } },
        { id: 'skip', label: '跳过', value: { action: 'skip' } },
      ],
      { sourceId: 'test', autoRefresh: 'hand' }
    );

    const interaction2 = createSimpleChoice(
      'interaction-2',
      '0',
      '选择第二张卡牌或跳过',
      [
        { id: 'opt-1', label: '卡牌 1', value: { cardUid: 'card-1' } },
        { id: 'opt-2', label: '卡牌 2', value: { cardUid: 'card-2' } },
        { id: 'skip', label: '跳过', value: { action: 'skip' } },
      ],
      { sourceId: 'test', autoRefresh: 'hand' }
    );`;

let newContent = content;
let changeCount = 0;

if (content.includes(fix1Old)) {
  newContent = newContent.replace(fix1Old, fix1New);
  changeCount++;
  console.log('✅ 修复 1: 第一个测试添加 autoRefresh');
}

if (newContent.includes(fix2Old)) {
  newContent = newContent.replace(fix2Old, fix2New);
  changeCount++;
  console.log('✅ 修复 2: 第二个测试添加 autoRefresh');
}

if (newContent.includes(fix3Old)) {
  newContent = newContent.replace(fix3Old, fix3New);
  changeCount++;
  console.log('✅ 修复 3: 第五个测试添加 autoRefresh');
}

if (changeCount > 0) {
  writeFileSync(filePath, newContent, 'utf-8');
  console.log(`\n✅ 成功修复 ${changeCount} 处`);
} else {
  console.log('⚠️  未找到需要修复的代码');
}
