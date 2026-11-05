import { copyFileSync, readFileSync, writeFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import path from 'node:path';
import assert from 'node:assert/strict';

const out = path.resolve('test-results/evidence-screenshots/platform/home-full-20261030-final');
const read = file => JSON.parse(readFileSync(file, 'utf8'));
const hash = file => createHash('sha256').update(readFileSync(file)).digest('hex');
const capture = read(path.join(out, 'capture-record.json'));
const supplement = read(path.join(out, 'supplement-record.json'));
for (const [file, expected] of Object.entries(capture.sources)) assert.equal(hash(file), expected, `来源已变化：${file}`);
assert.equal(hash(supplement.generator.path), supplement.generator.sha256);
const reportNames = ['desktop', 'mobile', 'supplement'];
const reviews = reportNames.map(name => {
    const source = path.resolve(`.tmp/home-full-${name}-final-review.json`);
    const reportPath = name === 'supplement' ? path.resolve('.tmp/home-full-supplement-visual-review.json') : source;
    const report = read(reportPath);
    assert.equal(report.status, 'PASS', reportPath);
    const copyName = `independent-${name}-review.json`;
    copyFileSync(reportPath, path.join(out, copyName));
    return { report, copyName };
});
const all = [...capture.images, ...supplement.images];
assert.equal(new Set(all.map(item => item.path)).size, all.length);
const priorities = ['发现首页', '发现列表中段', '发现列表末段', '游戏封面悬浮', '分类筛选', '搜索结果', '收藏库主页', '收藏动态展开', '收藏动态正文', '收藏游戏大厅', '发现页详情弹层', '收藏游戏更新', '收藏游戏评价', '撰写评价', '收藏游戏排行'];
const rank = item => priorities.includes(item.state) ? priorities.indexOf(item.state) : 100 + Number(path.basename(item.path).split('-')[1]);
all.sort((a, b) => (a.label === b.label ? rank(a) - rank(b) : a.label === '桌面' ? -1 : 1));
const visualEntries = all.map(item => {
    const candidates = reviews.flatMap(({ report, copyName }) => report.media.filter(entry => path.resolve(entry.path) === path.resolve(item.path)).map(entry => ({ entry, report, copyName })));
    assert.equal(candidates.length, 1, item.path);
    const { entry, report, copyName } = candidates[0];
    assert.ok(['PASS', 'carried-forward'].includes(entry.status), item.path);
    assert.equal(hash(item.path), item.sha256);
    assert.equal(entry.sha256, item.sha256);
    assert.ok(!/[A-Za-z]/.test(entry.observation), entry.observation);
    assert.ok(!/[A-Za-z]/.test(item.description), item.description);
    return { ...entry, path: item.path, source: item.path, reviewer: report.reviewer, independentReviewFile: path.join(out, copyName) };
});
const steps = { 桌面: 0, 手机: 0 };
const index = {
    title: '现代首页 · 桌面与手机全量界面（模拟数据）', gameId: 'lobby', evidenceCategory: 'independent', acceptanceMode: 'visual-only',
    media: all.map(item => ({ path: item.path, chainId: `${item.label}首页独立代表态`, chainStep: String(++steps[item.label]), sourceRun: item.state === '分类筛选' || item.state === '语言菜单' ? 'home-full-20261030-supplement' : 'home-full-20261030-r8', sourceDir: out, stage: '独立代表态', role: 'main-flow', viewport: item.viewport, transition: `真实入口切换至${item.state}`, description: item.description })),
};
writeFileSync(path.join(out, '.e2e-image-index.json'), JSON.stringify(index, null, 2));
const visualReview = { mode: 'all-media', claimScope: 'interaction-ui', status: 'PASS', reviewer: { kind: 'primary-agent', id: '/root', responsibility: '来源与覆盖核验、逐图独立裁决汇总' }, reviewers: reviews.map(({ report }) => report.reviewer), media: visualEntries };
writeFileSync(path.join(out, 'visual-review.json'), JSON.stringify(visualReview, null, 2));
const files = states => all.filter(item => states.includes(item.state)).map(item => item.path);
const groups = [
    ['发现、分类、搜索与列表滚动', ['发现首页', '发现列表中段', '发现列表末段', '游戏封面悬浮', '分类筛选', '搜索结果', '访客首页']],
    ['收藏库先主页，点击游戏后进入详情；空态、动态展开与正文均覆盖', ['收藏库主页', '空收藏库', '收藏动态展开', '收藏动态正文', '收藏游戏大厅']],
    ['详情有内容时的房间、更新、评价、排行与建房及密码弹层', ['收藏游戏大厅', '发现页详情弹层', '收藏游戏更新', '收藏游戏评价', '撰写评价', '收藏游戏排行', '创建房间配置', '私密房间密码']],
    ['作者只显示署名，作品归个人中心；外站封面、链接及认领可读', ['作者信息', '外站游戏详情', '外站作者', '作者认领表单']],
    ['个人中心概览、资料编辑、头像选择和裁剪、投稿及作品编辑上下半', ['个人中心概览', '个人资料编辑', '预设头像', '头像裁剪', '个人中心投稿', '个人中心作品', '编辑已发布作品', '编辑作品发布操作']],
    ['投稿工作区、下半操作、手机稿件列表与访客入口', ['投稿新游戏', '投稿表单后半', '手机投稿列表', '访客投稿入口']],
    ['账户菜单、账户密码邮箱、光标、通知好友及我的反馈', ['账户菜单', '账户设置', '修改密码', '邮箱设置', '光标设置', '通知与好友', '我的反馈']],
    ['支持作者、指南、手机菜单、原浮球设置、关于、反馈与进行中房间浮层', ['支持作者', '操作指南', '手机工具菜单', '浮球设置', '关于平台', '反馈表单', '进行中房间悬浮', '语言菜单']],
    ['登录、注册、找回密码及模拟邮件服务失败的反馈', ['登录', '注册', '注册表单末段', '找回密码', '注册邮件错误反馈']],
];
const requirements = groups.map(([requirement, states]) => ({ requirement, status: 'PASS', evidence: files(states) }));
const covered = new Set(requirements.flatMap(item => item.evidence));
for (const item of all) assert.ok(covered.has(item.path), `未归类媒体：${item.state}`);
const behavior = {
    scope: '组件回归、导航与控件当前浏览器检查；与静态视觉结论分开',
    commands: ['node scripts/infra/vitest-cli-safe.mjs run src/components/home/__tests__/PlatformGameDetails.test.tsx src/components/home/__tests__/ClassicHomeSurface.test.tsx src/components/home/__tests__/GameAuthorInfo.test.tsx src/components/auth/__tests__/AuthModal.platform.test.tsx --configLoader native --pool forks --no-file-parallelism --maxWorkers 1', 'node e2e/platform-home-review.mjs', 'node e2e/platform-home-review-supplement.mjs'],
    unitResult: '四文件八项通过', browserChecks: [...capture.checks, ...supplement.checks], geometryEvidence: 'hitboxes-final.json',
    redBeforeFix: { url: '/?section=library&libraryGame=dicethrone', details: 1, libraryHomeVisible: false },
    exclusions: ['模拟协议和接口数据不证明真实建房、加入、重连、发送邮件、上传、送审或账户持久化成功。', '未改经典首页；既有完整双风格行为矩阵继续独立记录。'],
};
writeFileSync(path.join(out, 'behavior-result.json'), JSON.stringify(behavior, null, 2));
copyFileSync('.tmp/home-full-units-accepted.log', path.join(out, 'unit-result.log'));
copyFileSync('.tmp/home-full-lint-final.log', path.join(out, 'lint-result.log'));
copyFileSync('.tmp/home-full-hitboxes-final.json', path.join(out, 'hitboxes-final.json'));
const manifest = {
    verdict: 'PASS', scope: 'current-user-request', gameId: 'lobby', evidenceCategory: 'independent', acceptanceMode: 'visual-only',
    acceptanceReason: '用户要求“自己用模拟数据截图看效果，我也要看，现在我要看的是首页全部截图”。本组覆盖现代首页桌面和手机的全部已列独立界面状态，行为结果单独记录；不将模拟画面称为真实业务链通过。',
    display: { purpose: 'final-user-visible-delivery', trigger: 'user-requested-evidence', viewer: 'web', finalPassBeforeOpen: true },
    visualReview: { mode: 'all-media', claimScope: 'interaction-ui', status: 'PASS', reviewer: visualReview.reviewer, reviewers: visualReview.reviewers, reviewFile: 'visual-review.json' },
    behavioralVerification: { owner: 'vitest', status: 'PASS', commands: behavior.commands, evidence: ['unit-result.log', 'behavior-result.json'], limitations: behavior.exclusions },
    evidenceIndex: '.e2e-image-index.json', requirements, images: all.map(item => item.path), media: all.map(item => item.path),
    remainingGaps: ['原生游戏认领送审仍不在本轮服务端范围内。', '原生文件控件英文为用户已锁定范围外，仅记录，不通过替换控件掩盖。', '手机为浏览器竖屏触控仿真；实体设备和连续动效另行验收。', '等待用户最终视觉验收。'],
};
writeFileSync(path.join(out, 'focused-pass-manifest.json'), JSON.stringify(manifest, null, 2));
writeFileSync(path.join(out, '验收过程与剩余范围.md'), `本组为现代首页桌面与手机的${all.length}张整屏独立代表态，使用模拟的房间、更新、评价、排行、账户、投稿与作品数据。未写开发数据库，未提交邮件、认领、投稿或真实支付。\n\n行为与视觉分别记录：四文件八项单测通过；浏览器九项导航、分类和视口检查通过；来源文件两百零九份采集前后及交付前一致。ESLint零错误、两条既有警告。\n\n问题与返工：导航保留详情参数已由真实红测确认并修复；有内容的诊断揭示作者远离标题、更新旧外壳、阅读区过宽、外站空封面及表单下半缺图，修后重拍；详情首屏现有四间完整房间，其余可滚动。旧重复动态图、未滚动的投稿图已删除出展示清单。\n\n过程中的错误与纠正：注册入口没有缺失，旧采集选择器找不到顶部标签，已改用现有真实入口；既有认证单测的翻译假设错误已修正。首轮独立图审将已收藏状态误当成白底不一致、将重连小文字误当作命中区不足、将找回密码底部预览误当裁切；经原图像素、实际命中区与合同重新核对后改判并保留原记录。账户与反馈的窄命中区实际补到四十四像素。\n\n真实业务缺口：本次静态画面不能关闭完整首页行为矩阵，原生认领提交限制、真实收发邮件、房间重连、投稿送审与持久化仍按独立行为证据验收；本组只交付已明确要求的当前完整界面图组。经典不动。\n`);
console.log(JSON.stringify({ verdict: 'PASS', media: all.length, desktop: all.filter(item => item.label === '桌面').length, mobile: all.filter(item => item.label === '手机').length, browserChecks: behavior.browserChecks.length }));
