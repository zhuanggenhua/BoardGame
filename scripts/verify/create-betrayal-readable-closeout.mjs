#!/usr/bin/env node

import { existsSync, mkdirSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import sharp from 'sharp';

const ROOT = process.cwd();
const OUTPUT_DIR = path.join(ROOT, 'evidence', 'betrayal', 'final-closeout-readable');
const WIDTH = 3200;
const HEIGHT = 2200;
const FONT = 'Microsoft YaHei, Noto Sans CJK SC, Arial, sans-serif';

const escapeXml = (value) => String(value)
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;');

const charWidth = (char) => /[\x00-\x7F]/.test(char) ? 0.56 : 1.05;

const wrapText = (text, maxUnits) => {
    const words = String(text).split(/(\s+)/).filter((part) => part.length > 0);
    const lines = [];
    let current = '';
    let currentUnits = 0;

    const pushCurrent = () => {
        if (current.trim()) {
            lines.push(current.trim());
        }
        current = '';
        currentUnits = 0;
    };

    for (const word of words) {
        const units = [...word].reduce((sum, char) => sum + charWidth(char), 0);
        if (!/\s+/.test(word) && units > maxUnits) {
            for (const char of word) {
                const nextUnits = currentUnits + charWidth(char);
                if (nextUnits > maxUnits && current) {
                    pushCurrent();
                }
                current += char;
                currentUnits += charWidth(char);
            }
            continue;
        }
        if (currentUnits + units > maxUnits && current.trim()) {
            pushCurrent();
        }
        current += word;
        currentUnits += units;
    }
    pushCurrent();
    return lines;
};

const textBlock = ({
    x,
    y,
    width,
    title,
    lines,
    fontSize = 39,
    lineHeight = 1.42,
    titleSize = 50,
    color = '#1b2733',
}) => {
    const maxUnits = Math.floor(width / fontSize);
    let cursorY = y;
    const fragments = [];
    if (title) {
        fragments.push(`<text x="${x}" y="${cursorY}" font-family="${FONT}" font-size="${titleSize}" font-weight="800" fill="${color}">${escapeXml(title)}</text>`);
        cursorY += titleSize * 1.28;
    }
    for (const line of lines) {
        if (line === '') {
            cursorY += fontSize * 0.72;
            continue;
        }
        const bullet = line.startsWith('- ');
        const source = bullet ? line.slice(2) : line;
        const wrapped = wrapText(source, bullet ? maxUnits - 1.6 : maxUnits);
        wrapped.forEach((wrappedLine, index) => {
            const prefix = bullet && index === 0 ? '• ' : bullet ? '  ' : '';
            fragments.push(`<text x="${x}" y="${cursorY}" font-family="${FONT}" font-size="${fontSize}" font-weight="${bullet ? 650 : 500}" fill="${color}">${escapeXml(prefix + wrappedLine)}</text>`);
            cursorY += fontSize * lineHeight;
        });
    }
    return fragments.join('\n');
};

const panel = (x, y, width, height, fill = '#fbf6ea', stroke = '#b78e58') => (
    `<rect x="${x}" y="${y}" width="${width}" height="${height}" rx="28" fill="${fill}" stroke="${stroke}" stroke-width="4"/>`
);

const titleBar = (title, subtitle) => `
<rect x="0" y="0" width="${WIDTH}" height="210" fill="#22170f"/>
<text x="110" y="88" font-family="${FONT}" font-size="62" font-weight="900" fill="#fff4dc">${escapeXml(title)}</text>
<text x="110" y="154" font-family="${FONT}" font-size="38" font-weight="600" fill="#e8c78f">${escapeXml(subtitle)}</text>
`;

const screenshotBox = ({ x, y, width, height, label }) => `
<rect x="${x - 10}" y="${y - 10}" width="${width + 20}" height="${height + 68}" rx="24" fill="#2d241b"/>
<rect x="${x}" y="${y}" width="${width}" height="${height}" rx="14" fill="#111"/>
<text x="${x + 18}" y="${y + height + 44}" font-family="${FONT}" font-size="34" font-weight="700" fill="#fff4dc">${escapeXml(label)}</text>
`;

const makeSvg = ({ title, subtitle, body }) => Buffer.from(`
<svg width="${WIDTH}" height="${HEIGHT}" viewBox="0 0 ${WIDTH} ${HEIGHT}" xmlns="http://www.w3.org/2000/svg">
<rect width="${WIDTH}" height="${HEIGHT}" fill="#efe2c8"/>
<path d="M0 210 H${WIDTH} V${HEIGHT} H0 Z" fill="#efe2c8"/>
${titleBar(title, subtitle)}
${body}
</svg>
`);

const source = (relativePath) => {
    const resolved = path.join(ROOT, relativePath);
    if (!existsSync(resolved)) {
        throw new Error(`缺少源截图: ${resolved}`);
    }
    return resolved;
};

const shots = {
    dustTrigger: source('evidence/山屋惊魂-灰尘作祟完整链路/一瓶微尘-灰尘成功链路-03-作祟成功进入灰尘.jpg'),
    dustSearch: source('evidence/山屋惊魂-灰尘作祟完整链路/一瓶微尘-灰尘成功链路-04-灰尘牌桌显示寻找解药入口.jpg'),
    dustResearch: source('evidence/山屋惊魂-灰尘作祟完整链路/一瓶微尘-灰尘成功链路-05-寻找解药放置ResearchToken.jpg'),
    dustExchange: source('evidence/山屋惊魂-灰尘作祟完整链路/一瓶微尘-灰尘成功链路-08-疾病交换同意后回到牌桌.jpg'),
    hungryTrigger: source('evidence/山屋惊魂-大宅饿了作祟完整链路/大宅饿了-作祟完整链路-03-作祟成功进入剧本12.jpg'),
    hungryAttack: source('evidence/山屋惊魂-大宅饿了作祟完整链路/大宅饿了-作祟完整链路-04-邪教徒可被攻击.jpg'),
    hungryCorpse: source('evidence/山屋惊魂-大宅饿了作祟完整链路/大宅饿了-作祟完整链路-06-搬起邪教徒尸体.jpg'),
    hungryFeed: source('evidence/山屋惊魂-大宅饿了作祟完整链路/大宅饿了-作祟完整链路-07-献祭推进饥饿刻度.jpg'),
    cameraTrigger: source('evidence/山屋惊魂-魔法相机作祟归属完整链路/魔法相机作祟归属-04-选择作祟检定后触发作祟.jpg'),
    cameraTraitor: source('evidence/山屋惊魂-魔法相机作祟归属完整链路/魔法相机作祟归属-05-魔法相机持有者成为叛徒结果可见.jpg'),
    cameraBoard: source('evidence/山屋惊魂-魔法相机作祟归属完整链路/魔法相机作祟归属-06-关闭后进入作祟牌桌.jpg'),
};

const buildPage = async ({ file, title, subtitle, body, images }) => {
    const input = makeSvg({ title, subtitle, body });
    const base = sharp(input);
    const composites = [];
    for (const image of images) {
        const resized = await sharp(image.src)
            .resize(image.width, image.height, { fit: 'cover', position: 'top' })
            .jpeg({ quality: 95 })
            .toBuffer();
        composites.push({ input: resized, left: image.x, top: image.y });
    }
    await base
        .composite(composites)
        .png({ compressionLevel: 6 })
        .toFile(path.join(OUTPUT_DIR, file));
};

const pageOverview = {
    file: '00-山屋惊魂-作祟3-12-33-高清总览.png',
    title: '山屋惊魂：作祟剧本 3 / 12 / 33 收口总览',
    subtitle: '这是一组玩家可读产物图：每页保留大截图、剧本说明、验证命令和边界',
    images: [
        { src: shots.dustTrigger, x: 110, y: 330, width: 930, height: 523 },
        { src: shots.hungryTrigger, x: 1135, y: 330, width: 930, height: 523 },
        { src: shots.cameraTraitor, x: 2160, y: 330, width: 930, height: 523 },
    ],
    body: `
${screenshotBox({ x: 110, y: 330, width: 930, height: 523, label: '剧本 3：一瓶微尘进入灰尘' })}
${screenshotBox({ x: 1135, y: 330, width: 930, height: 523, label: '剧本 12：大宅饿了进入自由混战' })}
${screenshotBox({ x: 2160, y: 330, width: 930, height: 523, label: '剧本 33：魔法相机持有者成为叛徒' })}
${panel(110, 1000, 2980, 910)}
${textBlock({
        x: 160,
        y: 1080,
        width: 1380,
        title: '当前实现结论',
        lines: [
            '- 23 张官方事件合同已锁定并进入当前正式运行事件牌堆；index 23 仍是事件背面，不录入。',
            '- 一抹鲜红触发剧本 1；一瓶微尘触发剧本 3；大宅饿了触发剧本 12；说“茄子”！触发剧本 33。',
            '- 3 / 12 / 33 已各自补代表 E2E：成功作祟、进入对应剧本，并执行至少一个关键可见动作。',
            '- 边界：这证明 1/3/12/33 的代表链，不代表山屋整游戏或所有剧本全部完成。',
        ],
        fontSize: 42,
    })}
${textBlock({
        x: 1660,
        y: 1080,
        width: 1360,
        title: '本组图如何读',
        lines: [
            '- 每个剧本至少一页大截图 + 规则书/剧本合同摘要，不再用缩略拼图替代说明。',
            '- 图中的英文术语是规则书动作名；中文句子说明它在游戏里的现实含义。',
            '- 验证命令：event-choice-coverage.e2e.ts 三条代表用例均已通过，领域单测和审计自检在证据文档中留档。',
        ],
        fontSize: 42,
    })}
`,
};

const pages = [
    pageOverview,
    {
        file: '03A-灰尘-触发与疾病规则.png',
        title: '作祟 3：灰尘 - 触发、隐藏叛徒、疾病 token',
        subtitle: '触发事件：一瓶微尘；核心是 Sickness token 的隐藏身份和交换',
        images: [
            { src: shots.dustTrigger, x: 105, y: 315, width: 1420, height: 799 },
            { src: shots.dustSearch, x: 105, y: 1260, width: 1420, height: 799 },
        ],
        body: `
${screenshotBox({ x: 105, y: 315, width: 1420, height: 799, label: '作祟检定成功：进入剧本 3「灰尘」' })}
${screenshotBox({ x: 105, y: 1260, width: 1420, height: 799, label: '灰尘牌桌：出现寻找解药入口' })}
${panel(1625, 315, 1470, 1745)}
${textBlock({
            x: 1685,
            y: 400,
            width: 1340,
            title: '剧本书摘要',
            lines: [
                '- 阵营：隐藏叛徒。',
                '- 任何当前或曾经拿到 1 号 Sickness token 的玩家，永久成为叛徒。',
                '- 玩家只能查看自己的 Sickness token，不能公开给别人看。',
                '- 所有人都可以攻击其他探险者；离开有人的房间需要 2 点移动。',
                '- 英雄目标：通过 Cure the Dust 达到 13+。',
                '- 叛徒目标：让所有探险者变成叛徒或死亡。',
                '',
                '实现边界：本图证明灰尘代表链和关键交互可见，不外推所有隐藏信息边界都已逐分支截图。',
            ],
            fontSize: 43,
        })}
`,
    },
    {
        file: '03B-灰尘-寻找解药与交换.png',
        title: '作祟 3：灰尘 - Search / Cure / Control Impulses',
        subtitle: '玩家动作要能在牌桌上读懂：研究标记、交换请求、同意后回到牌桌',
        images: [
            { src: shots.dustResearch, x: 105, y: 315, width: 1420, height: 799 },
            { src: shots.dustExchange, x: 105, y: 1260, width: 1420, height: 799 },
        ],
        body: `
${screenshotBox({ x: 105, y: 315, width: 1420, height: 799, label: 'Search for a Cure：放置 Research token' })}
${screenshotBox({ x: 105, y: 1260, width: 1420, height: 799, label: '疾病交换同意后：回到牌桌继续行动' })}
${panel(1625, 315, 1470, 1745)}
${textBlock({
            x: 1685,
            y: 400,
            width: 1340,
            title: '关键规则动作',
            lines: [
                '- Search for a Cure：在有恶兆符号且没有 Research 的房间检定；成功放置 Research，失败随机交换疾病。',
                '- Cure the Dust：在可研究房间检定，屋内每个 Research 给 +2；13+ 英雄胜利。',
                '- Control Impulses：同房间玩家可以请求互换疾病 token，对方同意后随机交换。',
                '- 回合末如果没有交换，玩家会受到 2 骰通用伤害。',
                '',
                'E2E 已覆盖：寻找解药入口、Research token、疾病交换请求、目标玩家同意、同意后回到牌桌。',
            ],
            fontSize: 43,
        })}
`,
    },
    {
        file: '12A-大宅饿了-触发与自由混战.png',
        title: '作祟 12：大宅饿了 - 触发与自由混战',
        subtitle: '触发事件：大宅饿了；剧本 12 不是英雄/叛徒二分，而是自由混战',
        images: [
            { src: shots.hungryTrigger, x: 105, y: 315, width: 1420, height: 799 },
            { src: shots.hungryAttack, x: 105, y: 1260, width: 1420, height: 799 },
        ],
        body: `
${screenshotBox({ x: 105, y: 315, width: 1420, height: 799, label: '作祟检定成功：进入剧本 12「大宅饿了」' })}
${screenshotBox({ x: 105, y: 1260, width: 1420, height: 799, label: '邪教徒可被攻击：怪物链路已进入牌桌' })}
${panel(1625, 315, 1470, 1745)}
${textBlock({
            x: 1685,
            y: 400,
            width: 1340,
            title: '剧本书摘要',
            lines: [
                '- 阵营：自由混战；每个探险者都可能单独获胜。',
                '- Number Track 从 3 开始，代表 Ritual Progress。',
                '- 若 Ritual Room / Chasm 未发现，要找出并放到地下室。',
                '- 在 Ritual Room 放置邪教徒；数量随玩家数变化。',
                '- 当前行动者治疗全部属性，并获得力量 +1、速度 +1。',
                '',
                '本图证明剧本 12 已能从事件成功进入正式牌桌，不再是未实现门禁。',
            ],
            fontSize: 43,
        })}
`,
    },
    {
        file: '12B-大宅饿了-尸体与献祭.png',
        title: '作祟 12：大宅饿了 - 尸体、Feed Her、饥饿刻度',
        subtitle: '核心动作：击败邪教徒变尸体，搬起尸体，在裂隙 Feed Her 推进 Number Track',
        images: [
            { src: shots.hungryCorpse, x: 105, y: 315, width: 1420, height: 799 },
            { src: shots.hungryFeed, x: 105, y: 1260, width: 1420, height: 799 },
        ],
        body: `
${screenshotBox({ x: 105, y: 315, width: 1420, height: 799, label: '搬起邪教徒尸体：Heavy Burden 链路' })}
${screenshotBox({ x: 105, y: 1260, width: 1420, height: 799, label: 'Feed Her：献祭推进饥饿刻度' })}
${panel(1625, 315, 1470, 1745)}
${textBlock({
            x: 1685,
            y: 400,
            width: 1340,
            title: '关键规则动作',
            lines: [
                '- Heavy Burden：玩家可以携带一具邪教徒或探险者尸体；同一时间只能携带一具。',
                '- Feed Her：在 Chasm 且携带尸体时执行，移除尸体并进行 Sanity 检定。',
                '- 7+：Number Track -1；降到 0 时当前玩家胜利。',
                '- 0-6：当前玩家 Sanity +2。',
                '- 邪教徒被击败时不是眩晕，而是变成可献祭尸体。',
                '',
                'E2E 已覆盖：攻击邪教徒、尸体生成、搬起尸体、献祭后饥饿刻度推进。',
            ],
            fontSize: 43,
        })}
`,
    },
    {
        file: '33A-魔法相机-触发与叛徒归属.png',
        title: '作祟 33：魔法相机 - 触发与叛徒归属',
        subtitle: '触发事件：说“茄子”！；若英雄持有魔法相机，该英雄成为叛徒',
        images: [
            { src: shots.cameraTrigger, x: 105, y: 315, width: 1420, height: 799 },
            { src: shots.cameraTraitor, x: 105, y: 1260, width: 1420, height: 799 },
        ],
        body: `
${screenshotBox({ x: 105, y: 315, width: 1420, height: 799, label: '选择作祟检定后触发作祟' })}
${screenshotBox({ x: 105, y: 1260, width: 1420, height: 799, label: '魔法相机持有者成为叛徒结果可见' })}
${panel(1625, 315, 1470, 1745)}
${textBlock({
            x: 1685,
            y: 400,
            width: 1340,
            title: '剧本书摘要',
            lines: [
                '- 叛徒来源由事件牌决定。',
                '- 若有英雄持有 Magic Camera，该英雄当即成为叛徒。',
                '- 否则，触发事件的探险者成为叛徒。',
                '- 非 Landing 房间放置 Phantom Photographers，尽量按区域均匀分布。',
                '- 若 Magic Camera 尚未发现，从物品牌堆找出并正面放到叛徒面前。',
                '- 每名英雄获得 Hero token，代表 Essence。',
                '',
                '本图证明叛徒归属不再落入首剧本占位或未实现门禁。',
            ],
            fontSize: 43,
        })}
`,
    },
    {
        file: '33B-魔法相机-精魄与胜负条件.png',
        title: '作祟 33：魔法相机 - Essence、摄影师、摧毁相机',
        subtitle: '当前牌桌进入剧本 33；图内补足规则链路，避免只给短标签',
        images: [
            { src: shots.cameraBoard, x: 105, y: 315, width: 1420, height: 799 },
            { src: shots.cameraTraitor, x: 105, y: 1260, width: 1420, height: 799 },
        ],
        body: `
${screenshotBox({ x: 105, y: 315, width: 1420, height: 799, label: '关闭作祟结果后：进入魔法相机牌桌' })}
${screenshotBox({ x: 105, y: 1260, width: 1420, height: 799, label: '叛徒归属回查：由魔法相机持有者决定' })}
${panel(1625, 315, 1470, 1745)}
${textBlock({
            x: 1685,
            y: 400,
            width: 1340,
            title: '关键规则动作',
            lines: [
                '- Take a Photo：叛徒与目标英雄同房间；若持有 Magic Camera，可拍视线内英雄。',
                '- 6+：拿走目标英雄 Essence，并任选一个自身属性 +1。',
                '- Smash the Magic Camera：英雄与叛徒同房间，Sanity 6+ 且叛徒持有相机时摧毁相机。',
                '- Phantom Photographer 以 Sanity 攻击；Might 攻击造成伤害时才被杀死。',
                '- 英雄胜利：所有摄影师被杀死，且 Magic Camera 被摧毁。',
                '- 叛徒胜利：所有英雄死亡。',
                '',
                'E2E 本次覆盖触发、归属、进入剧本牌桌；更深动作按后续代表链继续扩展。',
            ],
            fontSize: 43,
        })}
`,
    },
];

mkdirSync(OUTPUT_DIR, { recursive: true });

for (const page of pages) {
    await buildPage(page);
}

const readme = [
    '# 山屋惊魂作祟 3 / 12 / 33 高清可读产物图',
    '',
    '本目录的 PNG 是用户验收用高清产物图，不是 AI 核图压缩预览。',
    '',
    '## 图片清单',
    '',
    ...pages.map((page) => `- ${page.file}`),
    '',
    '## 口径',
    '',
    '- 3 / 12 / 33 已接入正式代表链：成功作祟、进入对应剧本，并执行至少一个关键可见动作。',
    '- 23 张官方事件合同已锁定并进入当前正式运行事件牌堆；index 23 为背面，不录入。',
    '- 本组图不外推山屋惊魂整游戏完成，也不外推所有剧本、所有分支全部完成。',
    '',
].join('\n');

writeFileSync(path.join(OUTPUT_DIR, 'README.md'), readme, 'utf8');

for (const page of pages) {
    console.log(`CREATED_IMAGE=${path.join(OUTPUT_DIR, page.file)}`);
}
console.log(`CREATED_README=${path.join(OUTPUT_DIR, 'README.md')}`);
