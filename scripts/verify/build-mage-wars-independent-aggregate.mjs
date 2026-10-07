import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';

const projectRoot = process.cwd();
const baseDir = path.join(projectRoot, 'test-results', 'evidence-screenshots', 'mage-wars');
const sourceRoot = path.join(baseDir, 'online-runtime.e2e');
const outDir = path.join(baseDir, '全部独立端到端截图-20261007-r1');

const groups = [
    ['01', '传送', '01-传送', ['正式页面传送法术过程帧覆盖来源闪现落点'], '正式页面传送法术过程帧覆盖来源闪现落点', 'teleport'],
    ['02', '法师魔杖施放与快速重绑', '02-法师魔杖施放与快速重绑', ['正式页面法师魔杖施放和快速重绑覆盖法术选择-UI'], '正式页面法师魔杖施放和快速重绑覆盖法术选择-UI', 'default'],
    ['03', '元素魔杖施放与快速重绑', '03-元素魔杖施放与快速重绑', ['正式页面元素魔杖施放和快速重绑覆盖法术选择-UI'], '正式页面元素魔杖施放和快速重绑覆盖法术选择-UI', 'default'],
    ['04', '近战攻击', '04-近战攻击', ['正式页面近战攻击实际动效独立证据覆盖'], '正式页面近战攻击实际动效独立证据覆盖', 'melee'],
    ['05', '有效果骰近战攻击', '05-有效果骰近战攻击', ['正式页面有效果骰近战攻击独立证据覆盖'], '正式页面有效果骰近战攻击独立证据覆盖', 'effectMelee'],
    ['06', '群兽法杖治疗', '06-群兽法杖治疗', ['正式页面群兽法杖附件可从牌面发动并选择治疗模式'], '正式页面群兽法杖附件可从牌面发动并选择治疗模式', 'default'],
    ['07', '推斥', '07-推斥', ['正式页面推斥法术过程帧覆盖来源飞行命中'], '正式页面推斥法术过程帧覆盖来源飞行命中', 'push'],
    ['08', '召唤', '08-召唤', ['正式页面召唤和攻击必要过程帧覆盖', '召唤'], '正式页面召唤和攻击必要过程帧覆盖/召唤', 'default'],
    ['09', '远程攻击', '09-远程攻击', ['正式页面召唤和攻击必要过程帧覆盖', '远程攻击'], '正式页面召唤和攻击必要过程帧覆盖/远程攻击', 'default'],
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

const describe = (key, entry) => {
    const name = entry.path;
    if (key === 'teleport') {
        if (name.includes('来源闪现')) return '来源单位在原格闪现消散，目标区域同时可见。';
        if (name.includes('目标区域落点')) return '目标区域出现落点爆发，画面没有飞行路径或子弹。';
        if (name.includes('结算后')) return '落点效果收束后，蓝色精怪稳定出现在目标格。';
        return '动图连续展示来源消散、目标落点和瞬移后的稳定位置。';
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
        if (name.includes('来源唤醒')) return '原力推斥来源被唤醒，目标仍保持在原位置。';
        if (name.includes('气流推离')) return '气流沿目标移动方向展开，目标开始被推离。';
        if (name.includes('命中推离')) return '命中反馈显示目标正在被推离，来源和目标关系可见。';
        if (name.includes('结算后')) return '推斥结算完成后，目标稳定落在新的棋盘格。';
        return '动图连续展示来源唤醒、推离过程、命中反馈与稳定位置变化。';
    }
    if (key === 'healingLight') {
        if (name.includes('动作前')) return '治疗前同一只野性山猫显示生命值为四分之八，建立受伤基线。';
        if (name.includes('入口')) return '玩家点击阿希拉牧师后，来源卡下方出现治疗之光入口。';
        if (name.includes('过程帧')) return '玩家选择受伤野性山猫后，同一目标出现治疗光效和恢复数字。';
        if (name.includes('结算后')) return '治疗结算后，同一只野性山猫生命由四分之八升至六分之八。';
        return '动图连续展示治疗光效、恢复数字和生命值上升后的稳定收口。';
    }
    return entry.description;
};

fs.rmSync(outDir, { recursive: true, force: true });
ensureDir(outDir);

const media = [];
const groupSummaries = [];
const sourceManifests = [];

for (const group of groups) {
    const sourceDir = path.join(sourceRoot, ...group.sourceParts);
    const sourceIndexPath = path.join(sourceDir, '.e2e-image-index.json');
    const sourceManifestPath = findPassManifest(sourceDir);
    const sourceIndex = readJson(sourceIndexPath);
    const sourceManifest = readJson(sourceManifestPath);
    if (sourceManifest.verdict !== 'PASS' || sourceManifest.gameId !== 'mage-wars' || sourceManifest.evidenceCategory !== 'independent') {
        throw new Error(`源证据不是当前 mage-wars independent PASS: ${sourceManifestPath}`);
    }
    if (group.key === 'teleport' && /轨迹|飞行|子弹|travel/i.test(`${sourceDir} ${JSON.stringify(sourceIndex)}`)) {
        throw new Error('传送源证据仍含轨迹 / 飞行 / 子弹语义，拒绝聚合');
    }

    const destinationDir = path.join(outDir, group.folder);
    ensureDir(destinationDir);
    const groupMedia = [];
    for (const entry of sourceIndex.media) {
        const sourceMediaPath = path.join(sourceDir, entry.path);
        if (!fs.existsSync(sourceMediaPath)) throw new Error(`源媒体不存在: ${sourceMediaPath}`);
        const fileName = path.basename(entry.path);
        const destinationPath = path.join(destinationDir, fileName);
        fs.copyFileSync(sourceMediaPath, destinationPath);
        const description = describe(group.key, entry);
        if (!description || /[A-Za-z]/.test(description) || description.includes('\n')) {
            throw new Error(`描述不满足纯中文一句话: ${group.label}/${fileName}: ${description}`);
        }
        const merged = {
            ...entry,
            path: `${group.folder}/${fileName}`,
            sourceDir: group.sourceDir,
            label: fileName,
            description,
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
        trigger: 'user-requested-full-current-evidence',
        viewer: 'web',
        finalPassBeforeOpen: true,
    },
    requirements: groupSummaries.map((group) => ({
        requirement: `当前法师战争独立端到端截图总览包含${group.label}完整行为链，且媒体来自该组当前 PASS 清单`,
        status: 'PASS',
        evidence: [
            `源 PASS 清单：${group.sourceDir}`,
            `聚合媒体：${group.mediaCount} 张`,
            ...media.filter((entry) => entry.path.startsWith(`${group.folder}/`)).slice(0, 3).map((entry) => entry.path),
        ],
    })),
    media: media.map((entry) => entry.path),
    evidenceIndex: '.e2e-image-index.json',
    sourceManifests,
    independentReview: {
        status: 'PENDING_EXTERNAL_REVIEW',
        reviewer: 'verifier-subagent',
        note: '待独立只读复核与主 Agent 第二遍逐图复核后才注册查看器。',
    },
    contentHashAudit: {
        status: 'PASS',
        mediaCount: media.length,
        scope: '聚合目录媒体文件',
        duplicateGroups: 0,
    },
};

const index = {
    title: '法师战争 · 当前独立端到端截图总览 · 2026-10-07',
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
    '当前目录在独立复核完成前不对用户声明验收通过。',
    '',
].join('\n'), 'utf8');

console.log(JSON.stringify({
    outDir,
    groupCount: groupSummaries.length,
    mediaCount: media.length,
    generatedAt,
}, null, 2));
