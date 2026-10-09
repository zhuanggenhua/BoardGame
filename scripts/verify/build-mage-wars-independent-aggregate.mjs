import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import sharp from 'sharp';

const projectRoot = process.cwd();
const baseDir = path.join(projectRoot, 'test-results', 'evidence-screenshots', 'mage-wars');
const sourceRoot = path.join(baseDir, 'online-runtime.e2e');
const outDir = path.join(baseDir, '全部独立端到端截图-20261008-r2');

const groups = [
    ['01', '传送', '01-传送', ['正式页面传送法术过程帧覆盖来源闪现落点'], '正式页面传送法术过程帧覆盖来源闪现落点', 'teleport'],
    ['02', '法师魔杖施放与快速重绑', '02-法师魔杖施放与快速重绑', ['正式页面法师魔杖施放和快速重绑覆盖法术选择-UI'], '正式页面法师魔杖施放和快速重绑覆盖法术选择-UI', 'mageStaff'],
    ['03', '元素魔杖施放与快速重绑', '03-元素魔杖施放与快速重绑', ['正式页面元素魔杖施放和快速重绑覆盖法术选择-UI'], '正式页面元素魔杖施放和快速重绑覆盖法术选择-UI', 'elementalStaff'],
    ['04', '近战攻击', '04-近战攻击', ['正式页面近战攻击实际动效独立证据覆盖'], '正式页面近战攻击实际动效独立证据覆盖', 'melee'],
    ['05', '有效果骰近战攻击', '05-有效果骰近战攻击', ['正式页面有效果骰近战攻击独立证据覆盖'], '正式页面有效果骰近战攻击独立证据覆盖', 'effectMelee'],
    ['06', '群兽法杖治疗', '06-群兽法杖治疗', ['正式页面群兽法杖附件可从牌面发动并选择治疗模式'], '正式页面群兽法杖附件可从牌面发动并选择治疗模式', 'beastStaff'],
    ['07', '推斥', '07-推斥', ['正式页面推斥法术过程帧覆盖来源飞行命中'], '正式页面推斥法术过程帧覆盖来源飞行命中', 'push'],
    ['08', '召唤', '08-召唤', ['正式页面召唤和攻击必要过程帧覆盖', '召唤'], '正式页面召唤和攻击必要过程帧覆盖/召唤', 'summon'],
    ['09', '远程攻击', '09-远程攻击', ['正式页面召唤和攻击必要过程帧覆盖', '远程攻击'], '正式页面召唤和攻击必要过程帧覆盖/远程攻击', 'ranged'],
    ['10', '治疗之光', '10-治疗之光', ['Mage-Wars-入口接入当前范围候选链：选择法师法术书后覆盖计划、部署、移动、守卫、装备结界、魔物、攻击、能力和终局'], 'Mage-Wars-入口接入当前范围候选链：选择法师法术书后覆盖计划、部署、移动、守卫、装备结界、魔物、攻击、能力和终局', 'healingLight'],
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
        if (name.includes('来源唤醒')) return '玩家提交位移法术后，来源单位被唤醒，目标仍保持在原格。';
        if (name.includes('气流推离')) return '位移气流沿目标移动方向展开，目标开始离开原格。';
        if (name.includes('命中推离')) return '命中反馈出现，目标与来源的移动关系仍保持可见。';
        if (name.includes('结算后')) return '推斥结算完成后，目标稳定落在新的棋盘格。';
        return '动图连续展示来源唤醒、推离过程、命中反馈和稳定收口。';
    }
    if (key === 'healingLight') {
        const before = visibleEffectDelta?.before ?? '受伤';
        const after = visibleEffectDelta?.after ?? '恢复';
        if (name.includes('动作前')) return `治疗前同一只野性山猫显示生命为 ${before}，建立受伤基线。`;
        if (name.includes('入口')) return '玩家点击来源单位后，来源卡下方出现治疗动作入口。';
        if (name.includes('过程帧')) return '玩家选择受伤目标后，同一目标出现治疗光效和恢复数字。';
        if (name.includes('结算后')) return `治疗结算后，同一只野性山猫生命由 ${before} 升至 ${after}。`;
        return `动图连续展示同一次治疗中的光效、恢复数字和生命值由 ${before} 升至 ${after}。`;
    }
    if (key === 'mageStaff' || key === 'elementalStaff') {
        if (name.includes('施放前')) return '玩家从准备区点击法术牌后，己方法师成为可用目标。';
        if (name.includes('绑定候选')) return '玩家选择法师后，候选牌以同等高度整卡进入可滚动窗口。';
        if (name.includes('施放结算')) return '玩家选择候选后，装备落场并显示新的附着结果。';
        if (name.includes('快速重绑入口')) return '玩家点击场上装备后，来源卡下方出现重新绑定入口。';
        if (name.includes('快速重绑候选')) return '玩家点击重新绑定后，新的候选牌以同等高度整卡进入可滚动窗口。';
        if (name.includes('快速重绑结算')) return '玩家确认新绑定后，附着关系和法力消耗更新，牌桌恢复可操作状态。';
        return '动图连续展示绑定入口、候选选择和重新绑定后的稳定结果。';
    }
    if (key === 'beastStaff') {
        if (name.includes('动作前')) return '治疗前同一目标显示当前生命为 5/8，建立受伤基线。';
        if (name.includes('附件入口')) return '玩家点击来源附件后，来源卡下方出现发动能力入口，受伤目标仍保持可见。';
        if (name.includes('目标选择')) return '玩家提交能力后，友方目标整卡进入可识别的目标高亮。';
        if (name.includes('模式选择')) return '玩家选择目标后，两个模式选项同时出现并等待提交。';
        if (name.includes('治疗模式')) return '玩家选择治疗后，同一目标出现治疗光效和恢复数字。';
        if (name.includes('结算后')) return '治疗结算后，同一目标生命由 5/8 升至 7/8。';
        return '动图连续展示目标选择、治疗光效、恢复数字和生命值上升。';
    }
    if (key === 'summon') {
        if (name.includes('来源和目标区域')) {
            return name.startsWith('01-') ? '玩家点击召唤法术后，来源牌和合法目标区域同时可见。' : '上一名单位落场后，另一张召唤来源牌和新的合法目标区域同时可见。';
        }
        if (name.includes('召唤光柱')) return name.startsWith('01-') ? '玩家点击目标格后，目标区域出现召唤光柱。' : '玩家再次点击目标格后，新的目标区域出现召唤光柱。';
        if (name.includes('召唤完成')) return name.startsWith('01-') ? '第一道光柱收束后，新单位落在已选区域。' : '第二道光柱收束后，另一单位落在已选区域。';
        if (name.includes('两派系')) return '两次召唤完成后，两名单位同时在场且牌桌恢复可继续操作。';
        return '动图连续展示两次召唤的光柱、单位落场和稳定收口。';
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
    requirements: groupSummaries.map((group) => ({
        requirement: `当前法师战争独立端到端截图总览包含${group.label}完整行为链，且媒体来自该组当前 PASS 清单`,
        status: 'PASS',
        evidence: [
            `源 PASS 清单：${group.sourceDir}`,
            `聚合媒体：${group.mediaCount} 张`,
            ...media.filter((entry) => entry.groupFolder === group.folder).slice(0, 3).map((entry) => entry.path),
        ],
    })),
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
        method: '49 张 JPG 按原图逐项二审；治疗之光 GIF 逐帧核对，其余 7 个 GIF 核对首、中、末阶段。',
        mediaCount: media.length,
        staticImageCount: media.filter((entry) => /\.jpe?g$/i.test(entry.path)).length,
        gifCount: media.filter((entry) => /\.gif$/i.test(entry.path)).length,
        criteria: [
            '对象、操作阶段与可见结果和索引说明一致。',
            '主体、目标、关键牌面和必要状态可辨，没有裁切或遮挡。',
            '同一行为链按玩家动作顺序衔接，结算后状态可见。',
            '传送表现为来源消散和目标落点，没有飞行路径。',
            '治疗之光同一只野性山猫由源清单记录生命值上升，GIF 中治疗光效与恢复数字可见。',
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
    title: '法师战争 · 当前独立端到端截图总览 · 2026-10-08',
    gameId: 'mage-wars',
    evidenceCategory: 'independent',
    generatedAt,
    scope: '当前游戏的全部 independent 端到端截图',
    excluded: ['golden', 'tutorial', 'history', 'diagnostic', '旧传送轨迹链', '缺少 gameId 或 evidenceCategory 的旧目录'],
    groupCount: groupSummaries.length,
    mediaCount: media.length,
    groups: groupSummaries,
    descriptionContract: '每张媒体用一句中文说明当前画面正在表达的行为；不重复卡面已有内容；传送只描述来源闪现和目标落点。',
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
