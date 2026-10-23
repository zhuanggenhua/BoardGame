import { chromium } from '@playwright/test';
import { mkdirSync, copyFileSync, writeFileSync, readFileSync } from 'node:fs';
import path from 'node:path';

const projectRoot = process.cwd();
const artifactDir = path.join(projectRoot, 'artifacts', 'fate-domination-open-design');
const manifest = JSON.parse(readFileSync(path.join(artifactDir, 'open-design-artifact.manifest.json'), 'utf8'));
const title = String(manifest.title || '');
const currentArtifact = String(manifest.metadata?.currentArtifact || '');
const userVisibleIdentity = String(manifest.metadata?.userVisibleIdentity || '');
const currentExport = String(manifest.metadata?.currentExport || 'exports/fate-domination-current-desktop.png');
const evidenceRel = 'test-results/evidence-screenshots/fate-domination/open-design-current';
const evidence = path.join(projectRoot, evidenceRel);
const exportsDir = path.join(artifactDir, 'exports');
const chainId = 'fate-domination-open-design-current-layout';

if (userVisibleIdentity !== 'current-working') {
  console.error(`未版本化 manifest 的 userVisibleIdentity 必须是 current-working，实际: ${userVisibleIdentity}`);
  process.exit(1);
}
if (!currentArtifact) {
  console.error('未版本化 manifest 缺少 metadata.currentArtifact');
  process.exit(1);
}
if (/第.+稿/.test(title)) {
  console.error(`用户可见标题不得使用冻结第 N 稿: ${title}`);
  process.exit(1);
}
if (/open-design-v\d+/.test(evidenceRel)) {
  console.error(`不得把当前工作稿写回冻结历史版本目录: ${evidenceRel}`);
  process.exit(1);
}

mkdirSync(evidence, { recursive: true });
mkdirSync(exportsDir, { recursive: true });

const expectedPieces = {
  '卫宫士郎立牌': { xp: 59.99, yp: 14.03 },
  '间桐慎二立牌': { xp: 70.52, yp: 46.14 },
  '言峰绮礼立牌': { xp: 70.47, yp: 78.03 },
  '远坂凛立牌': { xp: 11.05, yp: 81.26 },
};
const expectedPiles = {
  'pile-events': { xp: -6.4, yp: 16.5 },
  'pile-miyama': { xp: -6.4, yp: 49.5 },
  'pile-shinto': { xp: -6.4, yp: 80.8 },
};
const expectedEvents = {
  'event-miyama-1': { xp: 25.5, yp: 50.5 },
  'event-shinto-2': { xp: 44.75, yp: 82.0 },
};

const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1920, height: 1080 } });
await page.goto(`http://127.0.0.1:8765/${currentArtifact}`, { waitUntil: 'networkidle' });
await page.waitForFunction(() => [...document.images].every((img) => img.complete && img.naturalWidth > 0));
const pageTitle = await page.title();
if (pageTitle !== title) {
  console.error(`页面标题必须等于当前工作稿标题。期望 ${title}，实际 ${pageTitle}`);
  await browser.close();
  process.exit(1);
}

const metrics = async (label) => page.evaluate((currentLabel) => {
  const broken = [...document.images].filter((img) => !img.naturalWidth).map((img) => img.alt || img.src);
  const content = document.querySelector('#map-content');
  const cr = content.getBoundingClientRect();
  const pieces = [...document.querySelectorAll('.board-piece')].map((el) => {
    const r = el.getBoundingClientRect();
    return {
      alt: el.alt,
      xp: Number((((r.left + r.width / 2) - cr.left) / cr.width * 100).toFixed(2)),
      yp: Number((((r.top + r.height / 2) - cr.top) / cr.height * 100).toFixed(2)),
    };
  });
  const piles = [...document.querySelectorAll('.pile-events, .pile-miyama, .pile-shinto')].map((el) => {
    const r = el.getBoundingClientRect();
    return {
      name: el.className,
      xp: Number((((r.left + r.width / 2) - cr.left) / cr.width * 100).toFixed(2)),
      yp: Number((((r.top + r.height / 2) - cr.top) / cr.height * 100).toFixed(2)),
      leftOfBoard: r.right <= cr.left + 2,
      usesBack: (el.querySelector('img')?.src || '').includes('event-back'),
    };
  });
  const events = [...document.querySelectorAll('.event-slot')].map((el) => {
    const r = el.getBoundingClientRect();
    const key = [...el.classList].find((name) => name.startsWith('event-miyama') || name.startsWith('event-shinto'));
    return {
      name: key,
      xp: Number((((r.left + r.width / 2) - cr.left) / cr.width * 100).toFixed(2)),
      yp: Number((((r.top + r.height / 2) - cr.top) / cr.height * 100).toFixed(2)),
      onBoard: r.left >= cr.left - 2 && r.right <= cr.right + 2,
    };
  });
  const mapRect = content.getBoundingClientRect();
  const stage = document.querySelector('.map-stage').getBoundingClientRect();
  const scale = mapRect.width / 1927;
  const pileGutter = 214 * scale;
  const groupCenterX = Number((mapRect.left + mapRect.width / 2 - pileGutter / 2).toFixed(1));
  const packOverlap = (selector) => {
    const nodes = [...document.querySelectorAll(selector)].filter((el) => getComputedStyle(el).display !== 'none');
    if (nodes.length < 2) return null;
    const overlaps = [];
    for (let i = 1; i < nodes.length; i += 1) {
      const prev = nodes[i - 1].getBoundingClientRect();
      const next = nodes[i].getBoundingClientRect();
      overlaps.push(Number((prev.right - next.left).toFixed(1)));
    }
    return Math.min(...overlaps);
  };
  return {
    label: currentLabel,
    w: document.documentElement.scrollWidth,
    h: document.documentElement.scrollHeight,
    imgs: document.images.length,
    broken,
    topbar: Boolean(document.querySelector('.topbar')),
    utility: Boolean(document.querySelector('.utility-orb')),
    attack: document.querySelectorAll('.attack-hand .hand-card:not(.is-played)').length,
    skill: document.querySelectorAll('.skill-hand .hand-card').length,
    seals: document.querySelectorAll('.seal:not(.is-spent)').length,
    played: document.querySelectorAll('.played-card').length,
    power: document.querySelector('#total-power')?.textContent,
    opps: document.querySelectorAll('.opp-seat').length,
    pieces,
    piles,
    events,
    oppPlayedInOverlay: Boolean(document.querySelector('#opp-overlay .opp-played, #opp-played, .opp-panel .opp-inspect-card')),
    oppPlayedOnRail: document.querySelectorAll('.opp-played-card, [data-opp-played]').length,
    oppPlayedLeftCount: document.querySelectorAll('#opp-played-left .opp-inspect-card').length,
    oppPlayedLeftOfPanel: (() => {
      const stack = document.querySelector('#opp-played-left');
      const panel = document.querySelector('.opp-panel');
      if (!stack || !panel || !stack.children.length || !stack.classList.contains('is-open')) return false;
      const left = stack.getBoundingClientRect();
      const box = panel.getBoundingClientRect();
      return left.right <= box.left + 2 && left.bottom > box.top && left.top < box.bottom;
    })(),
    oppPanelHasPlayedLabel: /已打出/.test(document.querySelector('.opp-panel')?.textContent || ''),
    handGap: (() => {
      const attack = document.querySelector('.attack-hand')?.getBoundingClientRect();
      const skill = document.querySelector('.skill-hand')?.getBoundingClientRect();
      if (!attack || !skill) return null;
      return Number((skill.left - attack.right).toFixed(1));
    })(),
    attackOnLeft: (() => {
      const attack = document.querySelector('.attack-hand')?.getBoundingClientRect();
      return Boolean(attack && attack.left <= 280);
    })(),
    skillOnRight: (() => {
      const skill = document.querySelector('.skill-hand')?.getBoundingClientRect();
      return Boolean(skill && skill.right >= window.innerWidth - 200);
    })(),
    oppPanelStacked: (() => {
      const grid = document.querySelector('.opp-grid')?.getBoundingClientRect();
      const skills = document.querySelector('.opp-skill-row')?.getBoundingClientRect();
      if (!grid || !skills) return false;
      return skills.top >= grid.bottom - 4;
    })(),
    oppPanelOneRow: (() => {
      const panel = document.querySelector('.opp-panel');
      if (!panel) return true;
      const style = getComputedStyle(panel);
      return style.display === 'flex' && style.flexDirection === 'row';
    })(),
    inspectPlayedOverlap: packOverlap('#opp-played-left .opp-inspect-card'),
    oppCopyOneRow: [...document.querySelectorAll('.opp-copy')].every((el) => getComputedStyle(el).display === 'flex'),
    mapCenterX: Number((mapRect.left + mapRect.width / 2).toFixed(1)),
    stageCenterX: Number((stage.left + stage.width / 2).toFixed(1)),
    groupCenterX,
    pileGutter: Number(pileGutter.toFixed(1)),
    scale: Number(scale.toFixed(4)),
    phaseRight: Number(getComputedStyle(document.querySelector('.phase-control')).right.replace('px', '')),
    phaseBottom: Number(getComputedStyle(document.querySelector('.phase-control')).bottom.replace('px', '')),
    zoom: document.querySelector('#zoom-readout')?.textContent,
    mapFull: (() => {
      const s = getComputedStyle(document.querySelector('.map-stage'));
      return s.top === '0px' && s.right === '0px' && s.bottom === '0px' && s.left === '0px';
    })(),
    oppCircles: [...document.querySelectorAll('.opp-master-token, .opp-servant-token')].length === 6
      && [...document.querySelectorAll('.opp-master-token, .opp-servant-token')].every((el) => getComputedStyle(el).borderRadius === '50%'),
    squareOppCard: Boolean(document.querySelector('.opp-servant')),
    sideInspect: Boolean(document.querySelector('#side-inspect.is-open')),
    oppSkills: document.querySelectorAll('#opp-skills img').length,
    attackOverlap: packOverlap('.attack-hand .hand-card'),
    skillOverlap: packOverlap('.skill-hand .hand-card'),
    playedOverlap: packOverlap('.played-card'),
    pageTitle: document.title,
  };
}, label);

const idlePath = path.join(evidence, '01-行动分栏手牌.png');
await page.screenshot({ path: idlePath, fullPage: false });
copyFileSync(idlePath, path.join(artifactDir, currentExport));
const m1 = await metrics('idle');

await page.locator('.attack-hand [data-card="skill-moment"]').click();
await page.mouse.move(720, 360);
await page.waitForTimeout(180);
const playedPath = path.join(evidence, '02-打出第二张攻击.png');
await page.screenshot({ path: playedPath, fullPage: false });
const m2 = await metrics('played-two');

await page.click('.played-card[data-withdraw="skill-moment"]');
await page.mouse.move(720, 360);
await page.waitForTimeout(180);
const withdrawPath = path.join(evidence, '03-撤回攻击.png');
await page.screenshot({ path: withdrawPath, fullPage: false });
const m3 = await metrics('withdraw');

await page.hover('#you-servant');
await page.waitForTimeout(200);
const hoverPath = path.join(evidence, '04-悬浮从者牌.png');
await page.screenshot({ path: hoverPath, fullPage: false });
const m4 = await metrics('hover-servant');

await page.mouse.move(0, 0);
await page.waitForTimeout(120);
await page.locator('.opp-seat[data-player="kirei"]').dispatchEvent('pointerenter');
await page.waitForSelector('#opp-overlay.is-open');
await page.waitForSelector('#opp-played-left.is-open .opp-inspect-card');
await page.waitForTimeout(200);
const oppPath = path.join(evidence, '05-对手详情.png');
await page.screenshot({ path: oppPath, fullPage: false });
const m5 = await metrics('opp');

await page.click('#close-opp');
await page.waitForTimeout(150);
await page.click('.seal[data-seal="0"]');
await page.waitForTimeout(150);
const sealPath = path.join(evidence, '06-令咒三选一.png');
await page.screenshot({ path: sealPath, fullPage: false });
await page.click('[data-seal-choice="mana"]');
await page.waitForTimeout(200);
const spentPath = path.join(evidence, '07-令咒已用.png');
await page.screenshot({ path: spentPath, fullPage: false });
const m6 = await metrics('seal-spent');

await page.locator('.skill-hand [data-card="skill-magic-resistance"]').hover();
await page.waitForSelector('#side-inspect.is-open');
const inspectPath = path.join(evidence, '08-检视对魔力.png');
await page.screenshot({ path: inspectPath, fullPage: false });
const m7 = await metrics('inspect');

await page.locator('.skill-hand [data-card="skill-magic-resistance"]').click();
await page.waitForSelector('#side-inspect.is-open', { state: 'hidden' });
await page.mouse.move(720, 360);
await page.mouse.wheel(0, -480);
await page.waitForTimeout(200);
const zoomPath = path.join(evidence, '09-地图缩放对齐.png');
await page.screenshot({ path: zoomPath, fullPage: false });
const m8 = await metrics('zoom');

await browser.close();

const pieceErrors = m1.pieces.map((piece) => {
  const expected = expectedPieces[piece.alt];
  const dx = Math.abs(piece.xp - expected.xp);
  const dy = Math.abs(piece.yp - expected.yp);
  return { alt: piece.alt, dx, dy, ok: dx <= 0.8 && dy <= 0.8, got: piece, expected };
});
const pileErrors = m1.piles.map((pile) => {
  const key = pile.name.includes('pile-shinto')
    ? 'pile-shinto'
    : pile.name.includes('pile-events')
      ? 'pile-events'
      : 'pile-miyama';
  const expected = expectedPiles[key];
  const dx = Math.abs(pile.xp - expected.xp);
  const dy = Math.abs(pile.yp - expected.yp);
  return {
    name: pile.name,
    dx,
    dy,
    leftOfBoard: pile.leftOfBoard,
    usesBack: pile.usesBack,
    ok: pile.leftOfBoard && pile.usesBack && dx <= 1.2 && dy <= 1.2,
    got: pile,
    expected,
  };
});
const eventErrors = m1.events.map((event) => {
  const expected = expectedEvents[event.name];
  const dx = Math.abs(event.xp - expected.xp);
  const dy = Math.abs(event.yp - expected.yp);
  return {
    name: event.name,
    dx,
    dy,
    onBoard: event.onBoard,
    ok: event.onBoard && dx <= 1.2 && dy <= 1.2,
    got: event,
    expected,
  };
});
const mapCentered = Math.abs(m1.groupCenterX - m1.stageCenterX) < 24;
const phaseRestored = m1.phaseRight === 0 && Math.abs(m1.phaseBottom + 2) < 0.5;
const identityOk = m1.pageTitle === title && !/第.+稿/.test(m1.pageTitle);
const alignmentOk = pieceErrors.every((row) => row.ok)
  && pileErrors.every((row) => row.ok)
  && eventErrors.every((row) => row.ok)
  && mapCentered
  && phaseRestored
  && identityOk
  && !m1.topbar
  && !m1.utility
  && m1.broken.length === 0
  && m1.skill === 3
  && m1.seals === 3
  && m1.mapFull
  && m1.oppCircles
  && !m1.squareOppCard
  && m1.oppCopyOneRow
  && m1.oppPlayedOnRail === 0
  && m1.handGap !== null
  && m1.handGap > 40
  && m1.handGap < 900
  && m1.attackOnLeft
  && m1.skillOnRight
  && m5.oppPanelStacked
  && !m5.oppPanelOneRow
  && !m5.oppPlayedInOverlay
  && !m5.oppPanelHasPlayedLabel
  && m5.oppPlayedLeftCount >= 2
  && m5.oppPlayedLeftOfPanel
  && (m5.inspectPlayedOverlap === null || m5.inspectPlayedOverlap <= 8)
  && (m1.attackOverlap === null || m1.attackOverlap <= 8)
  && (m1.skillOverlap === null || m1.skillOverlap <= 8)
  && (m2.playedOverlap === null || m2.playedOverlap <= 8)
  && m4.sideInspect
  && m5.oppSkills === 3
  && m7.sideInspect;

const media = [
  {
    path: '01-行动分栏手牌.png',
    chainStep: '1',
    stage: '前态',
    transition: '进入行动阶段桌面，尚未打出第二张攻击',
    description: '玩家看到攻击手牌在左下摊开成完整牌面，技能手牌在右下同样摊开成完整牌面并占住右侧底部，牌面可读、没有收成窄条牌堆，铺满视口的地图、地图左侧三叠牌堆、深山与新都白色格子上的事件卡、印刷圆槽立牌、右侧圆像加一排名字战果魔力手牌、右下角下一阶段按钮',
  },
  {
    path: '02-打出第二张攻击.png',
    chainStep: '2',
    stage: '中态',
    transition: '点击手牌刹那之一击后打入攻击区',
    description: '手牌上方已打出两张攻击牌并排摊开完整牌面，出牌读数为二张，攻击手牌剩余一张同样完整可见',
  },
  {
    path: '03-撤回攻击.png',
    chainStep: '3',
    stage: '后态',
    transition: '点击已打出的刹那之一击撤回回手',
    description: '撤回后攻击区回到一张已打出，刹那之一击回到左手攻击手牌并与另一张并排摊开',
  },
  {
    path: '04-悬浮从者牌.png',
    chainStep: '4',
    stage: '中态',
    transition: '悬浮自己的从者头像，在对手列左侧钉出从者大图',
    description: '阿尔托莉雅从者大图钉在画面右侧、对手列左侧，未盖住手牌和已打出攻击',
  },
  {
    path: '05-对手详情.png',
    chainStep: '5',
    stage: '中态',
    transition: '悬浮右侧言峰绮礼席位打开对手详情',
    description: '对手弹窗仍是上排御主从者令咒、下排三张技能红背，没有把弹窗压成一横排；弹窗左侧并排摊开的是对手自己已打出的两张攻击牌，和玩家底部剩余手牌不是同一套牌面',
  },
  {
    path: '06-令咒三选一.png',
    chainStep: '6',
    stage: '中态',
    transition: '点击层叠令咒卡打开一周一次三选一',
    description: '令咒三选一面板列出移动、获得魔力、合计威力与战果三条选项',
  },
  {
    path: '07-令咒已用.png',
    chainStep: '7',
    stage: '后态',
    transition: '选择获得魔力后消耗一张令咒',
    description: '提示令咒已使用剩余二，左下层叠令咒从三张减到两张',
  },
  {
    path: '08-检视对魔力.png',
    chainStep: '8',
    stage: '中态',
    transition: '悬浮技能区对魔力，在对手列左侧钉出大图',
    description: '对魔力大图钉在画面右侧，可见消耗三点魔力与基本威力三，技能区仍是三张完整牌面并排',
  },
  {
    path: '09-地图缩放对齐.png',
    chainStep: '9',
    stage: '中态',
    transition: '滚轮放大地图后检查立牌、牌堆与事件格是否仍贴底图',
    description: '放大后立牌仍落在印刷圆槽，三叠牌堆仍在地图左侧，事件卡仍落在深山与新都白色格子里',
  },
];

writeFileSync(path.join(evidence, '.e2e-image-index.json'), JSON.stringify({
  version: 1,
  gameId: 'fate-domination',
  evidenceCategory: 'independent',
  title,
  media: media.map((item) => ({
    path: item.path,
    chainId,
    chainStep: item.chainStep,
    sourceRun: 'artifacts/fate-domination-open-design/capture-current.mjs',
    sourceDir: evidenceRel.replace(/\\/g, '/'),
    stage: item.stage,
    role: 'main-flow',
    viewport: 'desktop',
    transition: item.transition,
    description: item.description,
  })),
}, null, 2));

const report = {
  identity: {
    title,
    currentArtifact,
    userVisibleIdentity,
    evidenceDir: evidenceRel.replace(/\\/g, '/'),
    pageTitle: m1.pageTitle,
  },
  m1, m2, m3, m4, m5, m6, m7, m8,
  pieceErrors,
  pileErrors,
  eventErrors,
  mapCentered,
  phaseRestored,
  identityOk,
  alignmentOk,
};
writeFileSync(path.join(evidence, 'alignment-metrics.json'), JSON.stringify(report, null, 2));
console.log(JSON.stringify(report, null, 2));
if (!alignmentOk) {
  console.error('alignment gate failed');
  process.exit(1);
}
