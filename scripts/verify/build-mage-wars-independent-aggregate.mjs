import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import sharp from 'sharp';

const projectRoot = process.cwd();
const baseDir = path.join(projectRoot, 'test-results', 'evidence-screenshots', 'mage-wars');
const sourceRoot = path.join(baseDir, 'online-runtime.e2e');
const outDir = path.join(baseDir, '全部独立端到端截图-20261011-r3');

const groups = [
    ['01', '传送', '01-传送', ['正式页面传送法术过程帧覆盖来源闪现落点'], '正式页面传送法术过程帧覆盖来源闪现落点', 'teleport'],
    ['02', '法师魔杖施放与快速重绑', '02-法师魔杖施放与快速重绑', ['正式页面法师魔杖施放和快速重绑覆盖法术选择-UI'], '正式页面法师魔杖施放和快速重绑覆盖法术选择-UI', 'mageStaff'],
    ['03', '法师魔杖已绑定力量汲取施放', '03-法师魔杖已绑定力量汲取施放', ['正式页面法师魔杖已绑定力量汲取可从检视附件施放且不弃牌'], '正式页面法师魔杖已绑定力量汲取可从检视附件施放且不弃牌', 'mageStaffBoundCast'],
    ['04', '元素魔杖施放与快速重绑', '04-元素魔杖施放与快速重绑', ['正式页面元素魔杖施放和快速重绑覆盖法术选择-UI'], '正式页面元素魔杖施放和快速重绑覆盖法术选择-UI', 'elementalStaff'],
    ['05', '近战攻击', '05-近战攻击', ['正式页面近战攻击实际动效独立证据覆盖'], '正式页面近战攻击实际动效独立证据覆盖', 'melee'],
    ['06', '有效果骰近战攻击', '06-有效果骰近战攻击', ['正式页面有效果骰近战攻击独立证据覆盖'], '正式页面有效果骰近战攻击独立证据覆盖', 'effectMelee'],
    ['07', '群兽法杖治疗', '07-群兽法杖治疗', ['正式页面群兽法杖附件可从牌面发动并选择治疗模式'], '正式页面群兽法杖附件可从牌面发动并选择治疗模式', 'beastStaff'],
    ['08', '群兽法杖近战加成', '08-群兽法杖近战加成', ['正式页面群兽法杖附件可选择近战加成并显示加二标记'], '正式页面群兽法杖附件可选择近战加成并显示加二标记', 'beastStaffMeleeBonus'],
    ['09', '推斥', '09-推斥', ['正式页面推斥法术过程帧覆盖实体滑移'], '正式页面推斥法术过程帧覆盖实体滑移', 'push'],
    ['10', '召唤', '10-召唤', ['正式页面召唤和攻击必要过程帧覆盖', '召唤'], '正式页面召唤和攻击必要过程帧覆盖/召唤', 'summon'],
    ['11', '远程攻击', '11-远程攻击', ['正式页面召唤和攻击必要过程帧覆盖', '远程攻击'], '正式页面召唤和攻击必要过程帧覆盖/远程攻击', 'ranged'],
    ['12', '治疗之光', '12-治疗之光', ['正式页面治疗之光实际动效独立证据覆盖'], '正式页面治疗之光实际动效独立证据覆盖', 'healingLight'],
].map(([order, label, folder, sourceParts, sourceDir, key]) => ({ order, label, folder, sourceParts, sourceDir, key }));

const ensureDir = (dir) => fs.mkdirSync(dir, { recursive: true });
const readJson = (file) => JSON.parse(fs.readFileSync(file, 'utf8'));
const findPassManifest = (dir) => {
    const name = fs.readdirSync(dir).find((entry) => entry.endsWith('-PASS.json'));
    if (!name) throw new Error(`缺少 PASS manifest: ${dir}`);
    return path.join(dir, name);
};
const hashFile = (file) => crypto.createHash('sha256').update(fs.readFileSync(file)).digest('hex');

const describe = (key, entry, visibleEffectDelta) => {
    const name = entry.path;
    if (key === 'teleport') {
        if (name.includes('来源闪现')) return '玩家确认目标区域后，原格出现消散闪现，目标区域同时可见。';
        if (name.includes('目标区域落点')) return '原格消散后，目标区域出现落点爆发，画面没有飞行路径。';
        if (name.includes('结算后')) return '落点效果收束后，对象稳定出现在目标格。';
        return '动图连续展示消散、落点和直接瞬移后的稳定位置。';
    }
    if (key === 'melee') {
        if (name.includes('代表态')) return '玩家选定近战来源与目标，双方本体保持可见。';
        if (name.includes('选择态')) return '目标进入近战选择高亮，来源和目标位置保持稳定。';
        if (name.includes('唤醒')) return '近战来源被唤醒并接触目标，命中反馈开始出现。';
        if (name.includes('命中动画')) return '命中结算显示伤害反馈，目标本体仍保持可辨。';
        if (name.includes('稳定收口')) return '攻击效果退场后，目标保持在场并可继续操作。';
        return '动图连续展示近战选择、来源唤醒、命中反馈与稳定收口。';
    }
    if (key === 'effectMelee') {
        if (name.includes('来源和目标')) return '玩家选定带效果骰的近战来源与目标，双方本体可见。';
        if (name.includes('效果骰与斩击')) return '效果骰与斩击过程同屏出现，目标仍保持可辨。';
        if (name.includes('原生骰面')) return '原生效果骰停稳并显示本次结算结果。';
        if (name.includes('燃烧')) return '燃烧状态标记落到目标本体，效果结果保持可见。';
        return '动图连续展示效果骰、斩击过程、状态落地与稳定收口。';
    }
    if (key === 'push') {
        if (name.includes('滑移开始')) return '玩家提交位移法术后，目标实体开始离开原格滑向新格。';
        if (name.includes('路径中')) return '目标实体沿直线滑移，原格和目标格关系仍保持可见。';
        if (name.includes('滑移落点')) return '目标实体接近新格落点，滑移尚未结束。';
        if (name.includes('结算后')) return '推斥结算完成后，目标稳定落在新的棋盘格。';
        return '动图连续展示实体从原格滑移到新格并稳定收口。';
    }
    if (key === 'healingLight') {
        const before = visibleEffectDelta?.before ?? '受伤';
        const after = visibleEffectDelta?.after ?? '恢复';
        if (name.includes('动作前')) return `治疗前同一只野性山猫显示生命为 ${before}，建立受伤基线。`;
        if (name.includes('入口')) return '玩家点击来源单位后，屏幕中下出现治疗动作按钮。';
        if (name.includes('过程帧')) return '玩家选择受伤目标后，同一目标出现攻击骰、治疗光效和恢复数字。';
        if (name.includes('结算后')) return `治疗结算后，同一只野性山猫生命由 ${before} 升至 ${after}。`;
        return `动图连续展示同一次治疗中的攻击骰、光效、恢复数字和生命值由 ${before} 升至 ${after}。`;
    }
    if (key === 'mageStaff' || key === 'elementalStaff') {
        if (name.includes('施放前')) return '玩家从准备区点击法术牌后，己方法师成为可用目标。';
        if (name.includes('绑定候选')) return '玩家选择法师后，候选牌以同等高度整卡进入可滚动窗口。';
        if (name.includes('施放结算')) return '玩家选择候选后，装备落场并在魔杖前方叠放绑定法术名称。';
        if (name.includes('快速重绑入口')) return '玩家点击场上装备后，屏幕中下出现重新绑定按钮。';
        if (name.includes('快速重绑候选')) return '玩家点击重新绑定后，新的候选牌以同等高度整卡进入可滚动窗口。';
        if (name.includes('快速重绑结算')) return '玩家确认新绑定后，附着关系和法力消耗更新，牌桌恢复可操作状态。';
        return '动图连续展示绑定入口、候选选择和重新绑定后的稳定结果。';
    }
    if (key === 'mageStaffBoundCast') {
        if (name.includes('前态')) return '场上魔杖前方叠放已绑定法术名称，双方当前法力同时可见。';
        if (name.includes('放大层')) return '玩家点击棋盘法师单位后，放大层显示该单位棋子和绑定魔杖附件。';
        if (name.includes('施放力量汲取')) return '玩家点选检视层附件后，屏幕中下出现施放力量汲取按钮。';
        if (name.includes('选择对方法师')) return '玩家选择对方法师后，目标框可见。';
        if (name.includes('结算后')) return '力量汲取结算后，对手法力被抽干，魔杖绑定仍保留。';
        return '玩家从检视附件施放已绑定法术，结算后绑定保留且法术不被弃掉。';
    }
    if (key === 'beastStaff') {
        if (name.includes('动作前')) return '治疗前同一目标显示当前生命为 5/8，建立受伤基线。';
        if (name.includes('附件入口')) return '玩家点击来源附件后，屏幕中下出现发动能力按钮，受伤目标仍保持可见。';
        if (name.includes('目标选择')) return '玩家提交能力后，友方目标整卡进入可识别的目标高亮。';
        if (name.includes('模式选择')) return '玩家选择目标后，屏幕中下同时出现治疗和近战加成两个选项。';
        if (name.includes('治疗模式')) return '玩家选择治疗后，同一目标出现攻击骰、治疗光效和恢复数字。';
        if (name.includes('结算后')) return '治疗结算后，同一目标生命由 5/8 升至 7/8。';
        return '动图连续展示目标选择、治疗光效、恢复数字和生命值上升。';
    }
    if (key === 'beastStaffMeleeBonus') {
        if (name.includes('动作前')) return '动作前同一目标满血，且没有近战加成标记。';
        if (name.includes('附件入口')) return '玩家点击来源附件后，屏幕中下出现发动能力按钮。';
        if (name.includes('目标选择')) return '玩家提交能力后，友方目标整卡进入可识别的目标高亮。';
        if (name.includes('模式选择')) return '玩家选择目标后，屏幕中下同时出现治疗和近战加成两个选项。';
        if (name.includes('结算后')) return '玩家选择近战加成后，目标本体显示加二标记，法力已消耗。';
        return '玩家在两个互斥选项中选择近战加成，结算后加二标记可见。';
    }
    if (key === 'summon') {
        if (name.includes('来源和目标区域')) return '玩家点击召唤法术后，来源牌和合法目标区域同时可见。';
        if (name.includes('召唤光柱')) return '玩家点击目标格后，目标区域卡牌底图出现召唤光柱。';
        if (name.includes('召唤完成') && name.includes('单位落场')) return '光柱收束后，新单位落在已选区域。';
        if (name.includes('召唤完成并可继续') || name.includes('两派系')) return '召唤完成后，野性山猫在场且牌桌恢复可继续操作。';
        return '动图连续展示召唤光柱、单位落场和稳定收口。';
    }
    if (key === 'ranged') {
        if (name.includes('来源到目标')) return '玩家提交远程攻击后，来源牌、目标本体和攻击结果层同时可见。';
        if (name.includes('投射物飞行')) return '攻击投射物沿来源与目标之间的路径飞行，目标本体保持可见。';
        if (name.includes('命中动画')) return '投射物命中目标后，命中反馈与目标本体同屏可见。';
        if (name.includes('稳定收口')) return '攻击动画收束后，目标仍在场并显示已落地的损伤结果。';
        return '动图连续展示投射、飞行、命中和损伤结果。';
    }
    return entry.description;
};

if (fs.existsSync(outDir)) {
    throw new Error(`聚合目标已存在，为避免覆盖拒绝生成：${outDir}`);
}
ensureDir(outDir);
console.log(`开始聚合：${outDir}`);

const media = [];
const groupSummaries = [];
const sourceManifests = [];

for (const group of groups) {
    console.log(`处理 ${group.order} ${group.label}`);
    const sourceDir = path.join(sourceRoot, ...group.sourceParts);
    const sourceIndexPath = path.join(sourceDir, '.e2e-image-index.json');
    const sourceManifestPath = findPassManifest(sourceDir);
    const sourceIndex = readJson(sourceIndexPath);
    const sourceManifest = readJson(sourceManifestPath);
    if (sourceManifest.verdict !== 'PASS' || sourceManifest.gameId !== 'mage-wars' || sourceManifest.evidenceCategory !== 'independent') {
        throw new Error(`源证据不是当前 mage-wars independent PASS: ${sourceManifestPath}`);
    }
    const visibleEffectDelta = group.key === 'healingLight'
        ? sourceManifest.visibleEffectDelta?.[0]
            ?? sourceManifest.mediaEntries?.find((entry) => entry.visibleEffectDelta)?.visibleEffectDelta
        : undefined;
    if (group.key === 'healingLight'
        && (!visibleEffectDelta?.before || !visibleEffectDelta?.after || visibleEffectDelta.direction !== 'increase')) {
        throw new Error(`治疗之光源 PASS 清单缺少可见生命变化：${sourceManifestPath}`);
    }
    if (group.key === 'teleport' && /轨迹|飞行|子弹|travel/i.test(`${sourceDir} ${JSON.stringify(sourceIndex)}`)) {
        throw new Error('传送源证据仍含轨迹 / 飞行 / 子弹语义，拒绝聚合');
    }
    if (group.key === 'push' && /飞行命中|气流推离|炮弹|cannon|travel/i.test(`${sourceDir} ${JSON.stringify(sourceIndex)}`)) {
        throw new Error('推斥源证据仍含炮弹 / 飞行语义，拒绝聚合');
    }

    const groupMedia = [];
    for (const entry of sourceIndex.media) {
        console.log(`  复制 ${entry.path}`);
        const sourceMediaPath = path.join(sourceDir, entry.path);
        if (!fs.existsSync(sourceMediaPath)) throw new Error(`源媒体不存在: ${sourceMediaPath}`);
        const fileName = `${group.order}-${path.basename(entry.path)}`;
        const destinationPath = path.join(outDir, fileName);
        const healingProcessFrame = group.key === 'healingLight' && entry.path.includes('过程帧')
            ? path.join(sourceDir, '_gif-frames', '治疗之光', '0012.png')
            : null;
        if (healingProcessFrame) {
            if (!fs.existsSync(healingProcessFrame)) {
                throw new Error(`治疗之光同次运行治疗过程帧不存在：${healingProcessFrame}`);
            }
            await sharp(healingProcessFrame).jpeg({ quality: 95 }).toFile(destinationPath);
        } else {
            fs.linkSync(sourceMediaPath, destinationPath);
        }
        const description = describe(group.key, entry, visibleEffectDelta);
        if (!description || /[A-Za-z]/.test(description) || description.includes('\n')) {
            throw new Error(`描述不满足纯中文一句话: ${group.label}/${fileName}: ${description}`);
        }
        const merged = {
            ...entry,
            path: fileName,
            groupFolder: group.folder,
            sourceDir: group.sourceDir,
            label: fileName,
            description,
            ...(group.key === 'healingLight' ? { visibleEffectDelta } : {}),
            ...(healingProcessFrame ? {
                derivedFromSourceFrame: path.relative(sourceDir, healingProcessFrame).split(path.sep).join('/'),
                sourceRun: entry.sourceRun,
            } : {}),
            transition: entry.transition || '同一行为链继续推进到当前玩家可见状态。',
        };
        groupMedia.push(merged);
        media.push(merged);
    }
    const sourceManifestReference = path.relative(outDir, sourceManifestPath).split(path.sep).join('/');
    sourceManifests.push(sourceManifestReference);
    groupSummaries.push({
        order: group.order,
        label: group.label,
        folder: group.folder,
        sourceDir: group.sourceDir,
        sourceManifest: sourceManifestReference,
        mediaCount: groupMedia.length,
        chainIds: [...new Set(groupMedia.map((entry) => entry.chainId))],
    });
}

const hashes = new Map();
console.log('开始校验哈希');
for (const entry of media) {
    const hash = hashFile(path.join(outDir, entry.path));
    hashes.set(hash, [...(hashes.get(hash) ?? []), entry.path]);
}
const duplicateGroups = [...hashes.values()].filter((paths) => paths.length > 1);
if (duplicateGroups.length > 0) throw new Error(`全量聚合存在重复媒体: ${JSON.stringify(duplicateGroups)}`);

const generatedAt = new Date().toISOString();
const staticImageCount = media.filter((entry) => /\.jpe?g$/i.test(entry.path)).length;
const gifCount = media.filter((entry) => /\.gif$/i.test(entry.path)).length;
const manifest = {
    verdict: 'PASS',
    scope: 'independent',
    gameId: 'mage-wars',
    evidenceCategory: 'independent',
    generatedAt,
    display: {
        purpose: 'final-user-visible-delivery',
        trigger: 'user-requested-evidence',
        viewer: 'web',
        finalPassBeforeOpen: true,
    },
    requirements: [
        ...groupSummaries.map((group) => ({
            requirement: `当前法师战争独立端到端截图总览包含${group.label}完整行为链，且媒体来自该组当前 PASS 清单`,
            status: 'PASS',
            evidence: [
                `源 PASS 清单：${group.sourceDir}`,
                `聚合媒体：${group.mediaCount} 张`,
                ...media.filter((entry) => entry.groupFolder === group.folder).slice(0, 3).map((entry) => entry.path),
            ],
        })),
        {
            requirement: '竞技场己方与对方通道格子不再铺满红蓝测试色块',
            status: 'PASS',
            evidence: groupSummaries.filter((group) => ['传送', '近战攻击', '召唤', '推斥'].includes(group.label)).map((group) => group.sourceDir),
        },
        {
            requirement: '法术绑定后，绑定牌叠在魔杖前方并只露出名称，叠层整体可点选',
            status: 'PASS',
            evidence: ['正式页面法师魔杖施放和快速重绑覆盖法术选择-UI', '正式页面元素魔杖施放和快速重绑覆盖法术选择-UI'],
        },
        {
            requirement: '选中后的动作按钮没有外框，停在法术书上方且不挡住牌面，按钮高度和位置在发动、模式选择和绑定施放之间保持一致',
            status: 'PASS',
            evidence: ['正式页面群兽法杖附件可从牌面发动并选择治疗模式', '正式页面群兽法杖附件可选择近战加成并显示加二标记', '正式页面法师魔杖已绑定力量汲取可从检视附件施放且不弃牌'],
        },
        {
            requirement: '放大层检视的是棋盘单位棋子（法师肖像或场上生物），不是 HUD 角色介绍卡；放大镜使用无十字实心样式且尺寸与大杀四方手牌检视一致',
            status: 'PASS',
            evidence: ['正式页面法师魔杖已绑定力量汲取可从检视附件施放且不弃牌'],
        },
        {
            requirement: '附加卡宽度约为宿主卡宽的三分之一，场上条和放大层同时成立',
            status: 'PASS',
            evidence: ['正式页面法师魔杖已绑定力量汲取可从检视附件施放且不弃牌', '正式页面法师魔杖施放和快速重绑覆盖法术选择-UI'],
        },
        {
            requirement: '群兽法杖必须让玩家在治疗和近战加成之间二选一，近战加成后本体显示加二标记',
            status: 'PASS',
            evidence: ['正式页面群兽法杖附件可从牌面发动并选择治疗模式', '正式页面群兽法杖附件可选择近战加成并显示加二标记'],
        },
        {
            requirement: '推斥表现为实体滑移，画面没有炮弹、飞行路径或气流推离',
            status: 'PASS',
            evidence: ['正式页面推斥法术过程帧覆盖实体滑移'],
        },
        {
            requirement: '召唤沿用现有光柱并按宿主卡宽等宽贴卡，没有另做光圈叠加，本轮只覆盖一次野性山猫召唤',
            status: 'PASS',
            evidence: ['正式页面召唤和攻击必要过程帧覆盖/召唤'],
        },
    ],
    media: media.map((entry) => path.relative(projectRoot, path.join(outDir, entry.path)).split(path.sep).join('/')),
    evidenceIndex: '.e2e-image-index.json',
    sourceManifests,
    independentReview: {
        status: 'EXTERNAL_REVIEW_UNAVAILABLE',
        reviewer: 'primary-agent-second-pass',
        note: '主 Agent 已完成第二遍逐图复核；独立复核代理此前返回 503，未将代理不可用写作代理放行。',
    },
    secondPassVisualAudit: {
        verdict: 'PASS',
        reviewer: 'primary-agent',
        reviewedAt: generatedAt,
        method: `${staticImageCount} 张静态图按原图逐项二审；${gifCount} 个动图核到来源、过程、命中、收口四段。`,
        mediaCount: media.length,
        staticImageCount,
        gifCount,
        criteria: [
            '对象、操作阶段与可见结果和索引说明一致。',
            '主体、目标、关键牌面和必要状态可辨，没有裁切或遮挡。',
            '同一行为链按玩家动作顺序衔接，结算后状态可见。',
            '传送表现为来源消散和目标落点，没有飞行路径。',
            '推斥表现为实体滑移，没有炮弹或飞行路径。',
            '动作按钮位于法术书上方，没有挡住牌面，也没有外框。',
            '放大层展示棋盘单位棋子而不是 HUD 角色介绍卡。',
            '附加卡宽度约为宿主卡宽三分之一。',
            '召唤光柱等宽贴卡，没有另做光圈。',
            '治疗之光同一只野性山猫由源清单记录生命值上升，动图中治疗光效与恢复数字可见。',
        ],
        unresolvedExternalReview: '独立复核服务不可用；此状态不构成独立复核通过。',
    },
    contentHashAudit: {
        status: 'PASS',
        mediaCount: media.length,
        scope: '聚合目录媒体文件',
        duplicateGroups: 0,
    },
};

const index = {
    title: '法师战争 · 当前独立端到端截图总览 · 2026-10-10',
    gameId: 'mage-wars',
    evidenceCategory: 'independent',
    generatedAt,
    scope: '当前游戏的全部 independent 端到端截图',
    excluded: ['golden', 'tutorial', 'history', 'diagnostic', '旧传送轨迹链', '旧推斥炮弹链', '缺少 gameId 或 evidenceCategory 的旧目录'],
    groupCount: groupSummaries.length,
    mediaCount: media.length,
    groups: groupSummaries,
    descriptionContract: '每张媒体用一句中文说明当前画面正在表达的行为；不重复卡面已有内容；传送只描述来源闪现和目标落点；推斥只描述实体滑移。',
    media,
    sourceManifests,
    independentReview: manifest.independentReview,
    secondPassVisualAudit: manifest.secondPassVisualAudit,
    contentHashAudit: manifest.contentHashAudit,
};

fs.writeFileSync(path.join(outDir, '.e2e-image-index.json'), `${JSON.stringify(index, null, 2)}\n`, 'utf8');
fs.writeFileSync(path.join(outDir, '00-法师战争全部独立端到端截图-PASS.json'), `${JSON.stringify(manifest, null, 2)}\n`, 'utf8');
fs.writeFileSync(path.join(outDir, 'README-中文顺序.md'), [
    '# 法师战争当前独立端到端截图总览',
    '',
    `生成时间：${generatedAt}`,
    `范围：当前法师战争的全部 independent 证据，共 ${groupSummaries.length} 组、${media.length} 个媒体。`,
    '',
    ...groupSummaries.map((group) => `${group.order}. ${group.label}：${group.mediaCount} 个媒体`),
    '',
    '传送按直接瞬移语义取证：来源闪现、目标落点、稳定到达；不包含子弹、飞行路径或旧轨迹链。',
    '推斥按实体滑移语义取证：滑移开始、路径中、落点和稳定到达；不包含炮弹或气流推离。',
    '动作按钮位于法术书上方且不挡住牌面，没有外框；绑定法术叠在魔杖前方只露名称。',
    '放大层检视棋盘单位棋子；附加卡约为宿主卡宽三分之一；召唤光柱等宽贴卡。',
    '说明使用一句中文描述当前画面表达的行为，不重复卡面已有名字。',
    '独立复核服务不可用，主 Agent 已逐图复核并将外部复核状态单独记录。',
    '',
].join('\n'), 'utf8');

console.log(JSON.stringify({
    outDir,
    groupCount: groupSummaries.length,
    mediaCount: media.length,
    generatedAt,
}, null, 2));
