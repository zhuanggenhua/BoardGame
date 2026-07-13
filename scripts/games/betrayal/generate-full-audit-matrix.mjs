#!/usr/bin/env node

import { readFileSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '../../..');
const inventoryPath = resolve(root, 'evidence/betrayal/full-audit/object-inventory.json');
const outputPath = resolve(root, 'evidence/betrayal/full-audit/object-l0-l4-matrix.md');

const inventory = JSON.parse(readFileSync(inventoryPath, 'utf8'));

const level = {
  L0: 'L0 真相源',
  L1: 'L1 结构证据',
  L2: 'L2 领域行为',
  L3: 'L3 页面代表链',
  L4: 'L4 治理口径',
};

function clean(value) {
  return String(value ?? '')
    .replace(/\r?\n/g, ' ')
    .replace(/\|/g, '\\|')
    .trim();
}

function hasAnyEffect(room) {
  return Boolean(room.discoveryEffect || room.endTurnEffect || room.enterEffect);
}

function isFixedLinkRoom(room) {
  return ['secretStaircase', 'graveyard', 'undergroundCavern', 'gallery'].includes(room.id);
}

function roomFamily(room) {
  if (isFixedLinkRoom(room)) return '固定连接特殊房间';
  if (room.discoveryEffect?.startsWith('gain')) return '发现时属性加点';
  if (room.discoveryEffect === 'drawUntilWeapon') return '房间发现抽牌';
  if (room.discoveryEffect === 'placeObstacleToken') return '障碍移动成本';
  if (room.endTurnEffect === 'physicalDamage1') return '结束回合伤害';
  if (room.endTurnEffect === 'moveToBasementLanding') return '结束回合移动';
  if (room.endTurnEffect === 'speedCheckFallToBasement') return '速度检定坠落';
  if (room.enterEffect === 'mysticElevator') return '神秘电梯';
  return '无显式效果房间';
}

function roomL3(room) {
  if (isFixedLinkRoom(room)) return 'L3 已补固定连接跨层入口真实页面截图：密道楼梯切层提示、移动到门厅';
  if (room.discoveryEffect === 'drawUntilWeapon') return 'L3 已补器械库真实浏览器截图：发现砍刀并进入持有区、关闭发现后持有区砍刀';
  if (roomFamily(room) === '无显式效果房间') return 'L3 抽样结构证据：地图主视区/跨楼层显示代表链';
  if (room.discoveryEffect?.startsWith('gain')) return '已有礼拜堂真实页面属性变化代表链：01-发现前属性栏、02-发现后神志加点';
  if (room.discoveryEffect === 'placeObstacleToken') return '已有杂物间真实页面障碍标记和离开扣 2 点移动截图';
  if (room.endTurnEffect === 'physicalDamage1') return '已有火炉房真实页面结束回合前提示和结算后反馈截图';
  return 'L3 组件提示或领域链已覆盖；新增不同消费者或旧证据失效时再补真实浏览器截图';
}

function eventFamily(event) {
  if (event.effectMode === 'chooseTraitRoll') return '选择属性后投骰';
  if (event.effectMode === 'optionalHauntRoll') return '可选作祟检定';
  if (event.effectMode === 'optionalEventRoll') return '可选事件投骰';
  if (event.effectMode === 'allTraitChecks') return '全属性检定';
  if (event.id === '一条秘密通道') return '特殊移动消费者';
  if (event.branches?.some((branch) => branch.effectMode === 'generalDamageChoice')) return '通用伤害选择';
  if (event.rollDice) return '普通固定投骰事件';
  if (event.rollTrait) return '普通属性检定事件';
  return '事件特殊结算';
}

function eventL3(event) {
  const family = eventFamily(event);
  if (['选择属性后投骰', '可选作祟检定', '可选事件投骰', '全属性检定', '特殊移动消费者', '通用伤害选择'].includes(family)) {
    return '已有事件牌页面承接 E2E 代表链；不补逐张截图';
  }
  return '普通投骰事件已有探索目标、卡牌正面、投掷骰子和结果分支步骤截图；non-p0 representative E2E 已通过';
}

function possessionFamily(card) {
  if (['map', 'notebook', 'manuscript', 'lockpick-tool', 'mask', 'dog'].includes(card.id)) return '移动/位置效果';
  if (['holy-symbol', 'idol'].includes(card.id)) return '发现声明替代';
  if (['hunting-knife', 'dagger', 'ring'].includes(card.id)) return '攻击武器';
  if (card.id === 'rope') return '兔脚重掷';
  if (card.id === 'skull') return '死亡保护';
  if (['medical-kit', 'holy-water'].includes(card.id)) return '治疗/恢复';
  if (['flashlight', 'radio', 'armor', 'omen-book'].includes(card.id)) return '被动修正/减免';
  return '持有物特殊能力';
}

function possessionL3(card) {
  if (['map', 'notebook', 'manuscript'].includes(card.id)) return '已有地图类目标选择真实页面证据；legacy 对象复用同一链';
  if (['holy-symbol', 'idol'].includes(card.id)) return 'L3 探索声明替代已有选择前、已选择和跳过事件步骤截图';
  if (['hunting-knife', 'dagger', 'ring'].includes(card.id)) return 'L3 攻击武器已有选择前、目标高亮、攻击投骰和反馈步骤截图';
  if (card.id === 'rope') return '已有兔脚重掷教程真实入口代表链';
  if (card.id === 'skull') return 'L3 已补头骨死亡保护真实浏览器截图：3 骰、总点数 4、阻止死亡反馈';
  if (card.id === 'dog') return '已有交易代表链；不外推全部主动效果';
  return 'L2 已覆盖；按新增消费者风险补 L3';
}

function scenarioFamily(object) {
  if (object.category === 'monster') return '杰克之灵怪物线';
  if (object.category === 'hero-action') return '英雄行动线';
  if (object.category === 'combat') return '攻防链';
  if (object.category === 'endgame') return '双终局';
  if (object.category === 'haunt-side-rule') return '作祟支线规则';
  return '首剧本状态/阵营';
}

function scenarioL3(object) {
  if (object.id === 'jack-spirit-speed-3-roll') return '已有杰克之灵 Speed 3 怪物移动投骰和移动扣点截图';
  if (object.id === 'corpse-loot') return '已有尸体搜刮二次限制截图';
  if (object.id === 'jack-spirit-revive-traitor') return '已有杰克之灵回尸体房复活叛徒截图';
  if (object.id === 'jack-spirit-attack-hero') return '已有复活叛徒攻击英雄截图';
  if (object.id === 'exorcise-jack') return '已有无阵驱魔失败链；有阵成功链为发布级增强';
  if (object.category === 'endgame') return '已有英雄胜利/叛徒胜利终局截图';
  return '已有领域测试或首剧本核心交互代表链';
}

function row({ category, id, name, family, l0, l1, l2, l3, l4, residual }) {
  return [
    category,
    id,
    name,
    family,
    l0,
    l1,
    l2,
    l3,
    l4,
    residual,
  ].map(clean).join(' | ');
}

const rows = [];

for (const [floor, rooms] of Object.entries(inventory.rooms)) {
  for (const room of rooms) {
    const family = roomFamily(room);
    rows.push(row({
      category: `房间/${floor}`,
      id: room.id,
      name: room.name,
      family,
      l0: `${level.L0}: object-inventory + 运行时发现池`,
      l1: `${level.L1}: 楼层、门位、标签已锁定`,
      l2: hasAnyEffect(room) ? `${level.L2}: ${room.discoveryEffect || room.endTurnEffect || room.enterEffect}` : `${level.L2}: 无显式效果，按结构对象处理`,
      l3: roomL3(room),
      l4: `${level.L4}: family 判等；不逐房间机械截图`,
      residual: family === '固定连接特殊房间'
        ? '已补固定连接跨层入口代表链；新增固定连接消费者再补独立链'
        : family === '无显式效果房间'
        ? '不补停留/进入效果截图'
        : ['发现时属性加点', '房间发现抽牌', '结束回合伤害', '障碍移动成本'].includes(family)
          ? '已补发布级房间效果代表链；新增不同消费者再补独立链'
          : '新增不同消费者或旧证据失效时再补截图',
    }));
  }
}

for (const event of inventory.events) {
  rows.push(row({
    category: '事件牌',
    id: event.id,
    name: event.name,
    family: eventFamily(event),
    l0: `${level.L0}: 事件录入合同 locked`,
    l1: `${level.L1}: 运行时事件池已接入`,
    l2: `${level.L2}: firstScenarioRuntime 事件分支覆盖`,
    l3: eventL3(event),
    l4: `${level.L4}: 页面验证按 family 复用，不逐张 E2E`,
    residual: '新增消费者、旧证据失效或高风险时序才补独立链',
  }));
}

for (const [kind, cards] of Object.entries(inventory.possessions)) {
  for (const card of cards) {
    rows.push(row({
      category: kind === 'item' ? '物品' : '预兆',
      id: card.id,
      name: card.name,
      family: possessionFamily(card),
      l0: `${level.L0}: 发现池持有物合同`,
      l1: `${level.L1}: 运行时持有区对象已接入`,
      l2: `${level.L2}: firstScenarioRuntime 持有物消费者覆盖`,
      l3: possessionL3(card),
      l4: `${level.L4}: legacy/同构对象复用同一合同，新增消费者再补证`,
      residual: card.id === 'skull'
        ? '已补发布级死亡保护代表截图；不能扩大成整游戏完成'
        : '新增消费者或旧证据失效时再补证；不能扩大成整游戏完成',
    }));
  }
}

for (const object of inventory.firstScenarioObjects) {
  rows.push(row({
    category: '首剧本',
    id: object.id,
    name: object.name,
    family: scenarioFamily(object),
    l0: `${level.L0}: 首剧本规则对象清单`,
    l1: `${level.L1}: 作祟/阵营/怪物/终局对象已列入全集`,
    l2: `${level.L2}: firstScenarioRuntime 首剧本闭环覆盖`,
    l3: scenarioL3(object),
    l4: `${level.L4}: 只证明第一剧本最小闭环，不外推更多剧本`,
    residual: '发布级增强按首剧本页面代表链补，不代表山屋整游戏完成',
  }));
}

const md = `# 山屋惊魂对象级 L0-L4 审计矩阵

> 生成时间：${inventory.generatedAt}
> 输入：\`${inventoryPath.replaceAll('\\', '/')}\`
> 生成命令：\`node scripts/games/betrayal/generate-full-audit-matrix.mjs\`

## 口径

- 本矩阵由 \`object-inventory.json\` 生成，用来固定房间、事件牌、物品、预兆和首剧本对象的证据层级。
- L0/L1 锁对象和结构；L2 锁领域行为；L3 锁页面代表链；L4 锁治理口径和结论边界。
- 同一行为 family 复用代表链；只有新交互、不同消费者、高风险时序、旧证据失效或图面裁定分歧，才补独立 L3/L4。
- 本矩阵不能被解读为“山屋整游戏完成”或“每个对象都有独立端到端截图”。

## 统计

| 类别 | 数量 |
| --- | ---: |
| 房间 | ${inventory.counts.rooms.ground + inventory.counts.rooms.upper + inventory.counts.rooms.basement} |
| 事件牌 | ${inventory.counts.events} |
| 物品 | ${inventory.counts.items} |
| 预兆 | ${inventory.counts.omens} |
| 首剧本对象 | ${inventory.firstScenarioObjects.length} |
| 矩阵行 | ${rows.length} |

## 矩阵

| 类别 | ID | 中文名 | 行为 family | L0 | L1 | L2 | L3 | L4 | 残余范围 |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
${rows.map((line) => `| ${line} |`).join('\n')}
`;

writeFileSync(outputPath, md, 'utf8');
console.log(`Generated ${outputPath}`);
console.log(`Rows: ${rows.length}`);
