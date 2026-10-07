const fs = require('fs');

const [sourcePath, outputPath] = process.argv.slice(2);
if (!sourcePath || !outputPath) {
    throw new Error('usage: node reorder-mage-wars-independent-evidence-r8.cjs <source> <output>');
}

const data = JSON.parse(fs.readFileSync(sourcePath, 'utf8'));
const byPath = new Map(data.items.map((item) => [item.path, item]));

const update = (path, description) => {
    const item = byPath.get(path);
    if (!item) throw new Error(`missing item: ${path}`);
    item.description = description;
};

const moveGroup = (paths) => {
    const indexes = paths.map((path) => data.items.findIndex((item) => item.path === path));
    if (indexes.some((index) => index < 0)) {
        throw new Error(`missing group: ${paths.join(' | ')}`);
    }
    const insertAt = Math.min(...indexes);
    const picked = new Set(paths);
    data.items = data.items.filter((item) => !picked.has(item.path));
    data.items.splice(insertAt, 0, ...paths.map((path) => byPath.get(path)));
};

const annotateGroup = (paths, chainId, sourceRun, sourceDir, role = 'main-flow') => {
    paths.forEach((path, index) => {
        const item = byPath.get(path);
        if (!item) throw new Error(`missing annotation item: ${path}`);
        item.chainId = chainId;
        item.chainStep = index + 1;
        item.sourceRun = sourceRun;
        item.sourceDir = sourceDir;
        item.role = role;
    });
};

update(
    '017-组书-05-法师详情-点击已选法师主控打开.jpg',
    '玩家点击已选法师本体后，详情层在自身右上角提供关闭入口，右侧只显示构筑限制等额外信息而不重复卡牌正文。',
);
update(
    '039-基础牌桌-e2e-touch-long-press-inspect-before.png',
    '玩家长按计划牌前，牌桌保持原状态，计划区数量仍为 0/2。',
);
update(
    '040-基础牌桌-e2e-touch-long-press-inspect-overlay.png',
    '从上一张长按目标牌面后，前景检视层显示完整牌面和可读规则，计划区数量仍为 0/2。',
);
update(
    '072-正式联机-16A-阿希拉牧师治疗之光入口-来源卡牌下方动作按钮可见.jpg',
    '玩家点击受伤野性山猫旁的治疗之光入口后，来源卡、受伤目标和下一步目标选择态同时可见。',
);
update(
    '070-正式联机-16-阿希拉牧师治疗之光-治疗光效和恢复数字过程帧.jpg',
    '从上一张点击治疗之光并选中受伤野性山猫后，治疗光效和 +3 恢复数字同时出现在同一目标本体上。',
);
update(
    '071-正式联机-16-阿希拉牧师治疗之光结算后-治疗能力可见.jpg',
    '从上一张动画收束后，野性山猫的伤害值已恢复到 9/10，界面回到可继续操作状态。',
);
update(
    '042-正式联机-00-法师战争治疗之光实际动效.gif',
    '同一治疗链的 GIF 连续展示入口后的治疗光效、恢复数字和结算收口。',
);

moveGroup([
    '048-正式联机-09A-兽王野性山猫-召唤来源和目标区域.jpg',
    '047-正式联机-09A-兽王野性山猫-召唤光柱过程帧.jpg',
    '049-正式联机-09A-兽王野性山猫-召唤完成单位落场.jpg',
]);
moveGroup([
    '051-正式联机-09B-女祭司阿希拉牧师-召唤来源和目标区域.jpg',
    '050-正式联机-09B-女祭司阿希拉牧师-召唤光柱过程帧.jpg',
    '052-正式联机-09B-女祭司阿希拉牧师-召唤完成单位落场.jpg',
]);
moveGroup([
    '061-正式联机-11A-间歇喷泉攻击法术-来源到目标投射过程帧.jpg',
    '063-正式联机-11A-间歇喷泉攻击法术-投射物飞行中.jpg',
    '062-正式联机-11A-间歇喷泉攻击法术-命中动画和伤害飘字过程帧.jpg',
]);
moveGroup([
    '089-正式联机-12B-传送-来源唤醒过程帧.jpg',
    '088-正式联机-12B-传送-传送轨迹过程帧.jpg',
    '090-正式联机-12B-传送-目标区域落点过程帧.jpg',
]);
moveGroup([
    '053-正式联机-10A-兽王结界公牛耐力施放前-野性山猫为绿色合法目标.jpg',
    '055-正式联机-10C-女祭司装备风龙皮甲施放前-女祭司法师为绿色合法目标.jpg',
    '054-正式联机-10B-兽王结界犀牛兽皮施放前-野性山猫为绿色合法目标.jpg',
    '056-正式联机-10D-女祭司第二张公牛耐力施放前-阿希拉牧师为绿色合法目标.jpg',
]);
moveGroup([
    '058-正式联机-10F-荆棘之墙施放前-A3-B3边界可选.jpg',
    '059-正式联机-10G-荆棘之墙施放后-A3-B3边界墙牌可见.jpg',
    '061-正式联机-11A-间歇喷泉攻击法术-来源到目标投射过程帧.jpg',
    '063-正式联机-11A-间歇喷泉攻击法术-投射物飞行中.jpg',
    '062-正式联机-11A-间歇喷泉攻击法术-命中动画和伤害飘字过程帧.jpg',
    '060-正式联机-11-缠绕藤蔓和攻击法术结算后-魔物与攻击效果可见.jpg',
]);
moveGroup([
    '089-正式联机-12B-传送-来源唤醒过程帧.jpg',
    '088-正式联机-12B-传送-传送轨迹过程帧.jpg',
    '090-正式联机-12B-传送-目标区域落点过程帧.jpg',
    '087-正式联机-00-法师战争传送实际动效.gif',
]);
moveGroup([
    '110-正式联机-12A-原力推斥-来源唤醒过程帧.jpg',
    '112-正式联机-12A-原力推斥-气流推离路径中.jpg',
    '111-正式联机-12A-原力推斥-命中推离过程帧.jpg',
    '109-正式联机-00-法师战争推斥实际动效.gif',
]);
moveGroup([
    '118-正式联机-01-有效果骰近战攻击-来源和目标可见.jpg',
    '119-正式联机-02-有效果骰近战攻击-效果骰与斩击过程.jpg',
    '120-正式联机-03-有效果骰近战攻击-原生骰面停稳.jpg',
    '121-正式联机-04-有效果骰近战攻击-燃烧-token-已落地.jpg',
    '117-正式联机-00-法师战争有效果骰近战攻击实际动效.gif',
]);
moveGroup([
    '132-正式联机-24A-群兽法杖附件入口-来源卡牌下方能力按钮可见.jpg',
    '133-正式联机-24B-群兽法杖目标选择-友方动物整卡高亮.jpg',
    '134-正式联机-24C-群兽法杖模式选择-治疗和近战加成需玩家选择.jpg',
    '135-正式联机-24D-群兽法杖治疗模式-治疗光效和恢复数字过程帧.jpg',
    '136-正式联机-24E-群兽法杖治疗模式结算后-动物伤害降低.jpg',
    '131-正式联机-00-法师战争群兽法杖治疗实际动效.gif',
]);
moveGroup([
    '138-正式联机-01-近战攻击代表态-来源和目标可见.jpg',
    '139-正式联机-02-近战攻击选择态-目标高亮.jpg',
    '140-正式联机-03-野性山猫近战攻击阿希拉牧师-来源唤醒和命中过程帧.jpg',
    '141-正式联机-03-野性山猫近战攻击阿希拉牧师-命中动画和伤害飘字过程帧.jpg',
    '142-正式联机-04-近战攻击稳定收口-目标可继续.jpg',
    '137-正式联机-00-法师战争近战攻击实际动效.gif',
]);
moveGroup([
    '072-正式联机-16A-阿希拉牧师治疗之光入口-来源卡牌下方动作按钮可见.jpg',
    '070-正式联机-16-阿希拉牧师治疗之光-治疗光效和恢复数字过程帧.jpg',
    '071-正式联机-16-阿希拉牧师治疗之光结算后-治疗能力可见.jpg',
    '042-正式联机-00-法师战争治疗之光实际动效.gif',
]);

annotateGroup(
    [
        '017-组书-05-法师详情-点击已选法师主控打开.jpg',
    ],
    'mage-selection-detail-20261006',
    'mage-selection.e2e-20261006',
    'mage-selection.e2e',
);
annotateGroup(
    [
        '039-基础牌桌-e2e-touch-long-press-inspect-before.png',
        '040-基础牌桌-e2e-touch-long-press-inspect-overlay.png',
    ],
    'foundation-touch-inspect-20261006',
    'foundation-board-runtime-20261006',
    'foundation-board-runtime',
);
annotateGroup(
    [
        '072-正式联机-16A-阿希拉牧师治疗之光入口-来源卡牌下方动作按钮可见.jpg',
        '070-正式联机-16-阿希拉牧师治疗之光-治疗光效和恢复数字过程帧.jpg',
        '071-正式联机-16-阿希拉牧师治疗之光结算后-治疗能力可见.jpg',
        '042-正式联机-00-法师战争治疗之光实际动效.gif',
    ],
    'online-healing-light-20261005-run',
    'online-runtime.e2e-20261005-run',
    'online-runtime.e2e/Mage-Wars-入口接入当前范围候选链',
);
annotateGroup(
    [
        '048-正式联机-09A-兽王野性山猫-召唤来源和目标区域.jpg',
        '047-正式联机-09A-兽王野性山猫-召唤光柱过程帧.jpg',
        '049-正式联机-09A-兽王野性山猫-召唤完成单位落场.jpg',
    ],
    'online-summon-beast-legacy-segment',
    'online-runtime.e2e-legacy',
    'online-runtime.e2e',
    'segment',
);
annotateGroup(
    [
        '051-正式联机-09B-女祭司阿希拉牧师-召唤来源和目标区域.jpg',
        '050-正式联机-09B-女祭司阿希拉牧师-召唤光柱过程帧.jpg',
        '052-正式联机-09B-女祭司阿希拉牧师-召唤完成单位落场.jpg',
    ],
    'online-summon-cleric-legacy-segment',
    'online-runtime.e2e-legacy',
    'online-runtime.e2e',
    'segment',
);
annotateGroup(
    [
        '089-正式联机-12B-传送-来源唤醒过程帧.jpg',
        '088-正式联机-12B-传送-传送轨迹过程帧.jpg',
        '090-正式联机-12B-传送-目标区域落点过程帧.jpg',
        '087-正式联机-00-法师战争传送实际动效.gif',
    ],
    'online-teleport-legacy-segment',
    'online-runtime.e2e-legacy',
    'online-runtime.e2e',
    'segment',
);
annotateGroup(
    [
        '110-正式联机-12A-原力推斥-来源唤醒过程帧.jpg',
        '112-正式联机-12A-原力推斥-气流推离路径中.jpg',
        '111-正式联机-12A-原力推斥-命中推离过程帧.jpg',
        '109-正式联机-00-法师战争推斥实际动效.gif',
    ],
    'online-push-legacy-segment',
    'online-runtime.e2e-legacy',
    'online-runtime.e2e',
    'segment',
);
annotateGroup(
    [
        '118-正式联机-01-有效果骰近战攻击-来源和目标可见.jpg',
        '119-正式联机-02-有效果骰近战攻击-效果骰与斩击过程.jpg',
        '120-正式联机-03-有效果骰近战攻击-原生骰面停稳.jpg',
        '121-正式联机-04-有效果骰近战攻击-燃烧-token-已落地.jpg',
        '117-正式联机-00-法师战争有效果骰近战攻击实际动效.gif',
    ],
    'online-effect-dice-melee-legacy-segment',
    'online-runtime.e2e-legacy',
    'online-runtime.e2e',
    'segment',
);
annotateGroup(
    [
        '132-正式联机-24A-群兽法杖附件入口-来源卡牌下方能力按钮可见.jpg',
        '133-正式联机-24B-群兽法杖目标选择-友方动物整卡高亮.jpg',
        '134-正式联机-24C-群兽法杖模式选择-治疗和近战加成需玩家选择.jpg',
        '135-正式联机-24D-群兽法杖治疗模式-治疗光效和恢复数字过程帧.jpg',
        '136-正式联机-24E-群兽法杖治疗模式结算后-动物伤害降低.jpg',
        '131-正式联机-00-法师战争群兽法杖治疗实际动效.gif',
    ],
    'online-beast-staff-heal-legacy-segment',
    'online-runtime.e2e-legacy',
    'online-runtime.e2e',
    'segment',
);
annotateGroup(
    [
        '138-正式联机-01-近战攻击代表态-来源和目标可见.jpg',
        '139-正式联机-02-近战攻击选择态-目标高亮.jpg',
        '140-正式联机-03-野性山猫近战攻击阿希拉牧师-来源唤醒和命中过程帧.jpg',
        '141-正式联机-03-野性山猫近战攻击阿希拉牧师-命中动画和伤害飘字过程帧.jpg',
        '142-正式联机-04-近战攻击稳定收口-目标可继续.jpg',
        '137-正式联机-00-法师战争近战攻击实际动效.gif',
    ],
    'online-melee-legacy-segment',
    'online-runtime.e2e-legacy',
    'online-runtime.e2e',
    'segment',
);

data.items.forEach((item) => {
    if (!item.chainId) {
        item.chainId = `legacy-independent-single-${item.path}`;
        item.chainStep = 1;
        item.sourceRun = 'legacy-r6-unreplayed';
        item.sourceDir = 'independent-final-20261004-r6';
        item.role = 'auxiliary';
    }
    item.transition = item.chainStep === 1
        ? '本链起点：只证明当前截图表达的独立状态，不与相邻链自动拼接。'
        : '承接同一链上一张图的真实动作、规则结算或动画阶段。';
});

data.generatedAt = '2026-10-05T00:00:00+08:00';
data.auditStatus = 'independent-rebuild-r8';
data.rebuildReason = '用户指出图文对应与流程顺序问题后，按同一真实链重排并替换受影响媒体';

fs.writeFileSync(outputPath, `${JSON.stringify(data, null, 2)}\n`, 'utf8');
console.log(JSON.stringify({
    count: data.items.length,
    treatmentStart: data.items.findIndex((item) => item.path.startsWith('072-正式联机-16A')) + 1,
}, null, 2));
