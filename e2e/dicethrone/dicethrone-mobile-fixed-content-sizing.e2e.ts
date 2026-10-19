import { mkdir, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { test, expect } from '../framework';
import { cleanupDTMatch, closeDebugPanelIfOpen, setupDTOnlineMatch } from '../helpers/dicethrone';
import { initContext, setChineseLocale } from '../helpers/common';
import { GameTestContext } from '../framework/GameTestContext';

test('移动触控入口在视口不变时刷新缩放与悬浮球', async ({ browser, baseURL, workerPorts }) => {
    test.setTimeout(90000);
    const context = await browser.newContext({ baseURL, viewport: { width: 812, height: 375 }, isMobile: true, hasTouch: true, deviceScaleFactor: 2.5 });
    await initContext(context, { storageKey:'__dt_scale_entry', skipImageGate:true,
        gameServerBaseURL:`http://127.0.0.1:${workerPorts.gameServer}`, apiServerBaseURL:`http://127.0.0.1:${workerPorts.apiServer}` });
    await context.addInitScript(ports => { (window as Window & { __E2E_WORKER_PORTS__?: typeof ports }).__E2E_WORKER_PORTS__ = ports; }, workerPorts);
    await context.addInitScript(() => { (window as Window & { __BG_HIDE_DEBUG_PANEL__?: boolean }).__BG_HIDE_DEBUG_PANEL__ = true; });
    const page = await context.newPage();
    try {
        await setChineseLocale(page);
        // 使用项目测试入口，不追加setupScene，也不靠resize刷新读数。
        await new GameTestContext(page).openTestGame('dicethrone', { playerID:'0', disableLocalAiAutomation:true }, 45000);
        const icon = page.locator('[data-fab-visual-id] svg').first();
        await expect(icon).toBeVisible({ timeout: 45000 });
        await expect.poll(async () => (await icon.boundingBox())!.width).toBeCloseTo(18.4, 0);
        for (const fit of ['width', 'height', 'contain']) {
            // 合法manifest输入的受控重放，验证同视口切换；不冒充手机设备日志。
            await page.evaluate(fit => {
                for (const target of [document.documentElement, document.body, document.querySelector('[data-game-page="true"]')]) {
                    if (!target) continue;
                    for (const [name, value] of Object.entries({ fit })) {
                        const attr = `data-mobile-board-shell-${name}`;
                        if (value) target.setAttribute(attr, value); else target.removeAttribute(attr);
                    }
                }
            }, fit);
            await expect.poll(() => page.evaluate(() => Number.parseFloat(getComputedStyle(document.documentElement).getPropertyValue('--mobile-board-shell-scale')))).toBeCloseTo(fit === 'width' ? 812 / 1920 : 375 / 1080, 4);
            await expect.poll(async () => (await icon.boundingBox())!.width).toBeCloseTo(18.4, 0);
            console.info(JSON.stringify({ evidence: 'dicethrone-formal-entry-no-resize', fit, width: (await icon.boundingBox())!.width, viewport: page.viewportSize() }));
        }
        await page.setViewportSize({ width: 936, height: 432 });
        for (const [leftPercent, topPercent] of [[0, 0], [1, 0], [0, 1], [1, 1]]) {
            await page.evaluate(position => localStorage.setItem('hud_fab_position', JSON.stringify(position)), { leftPercent, topPercent });
            await page.reload();
            await expect(icon).toBeVisible({ timeout: 30000 });
            await page.waitForTimeout(500);
            const result = await page.locator('[data-fab-visual-id]').first().evaluate(visual => {
                const button = visual.closest('button')!;
                const r = button.getBoundingClientRect();
                const points = [[2, r.height / 2], [r.width - 2, r.height / 2], [r.width / 2, 2], [r.width / 2, r.height - 2], [r.width / 2, r.height / 2]];
                return { box: r.toJSON(), hit: points.map(([x, y]) => button.contains(document.elementFromPoint(r.left + x, r.top + y))), svg: visual.querySelector('svg')!.getBoundingClientRect().width };
            });
            expect(result.box.x).toBeGreaterThanOrEqual(11);
            expect(result.box.y).toBeGreaterThanOrEqual(11);
            expect(result.box.right).toBeLessThanOrEqual(925);
            expect(result.box.bottom).toBeLessThanOrEqual(421);
            expect(result.hit).toEqual([true, true, true, true, true]);
            expect(result.svg).toBeCloseTo(18.4, 0);
            console.info(JSON.stringify({ evidence: 'dicethrone-fab-restored-corner-hit', leftPercent, topPercent, result }));
        }
        await page.evaluate(() => {
            for (const [edge, value] of Object.entries({ left: 30, right: 12, top: 4, bottom: 8 })) document.documentElement.style.setProperty(`--safe-area-${edge}`, `${value}px`);
            window.dispatchEvent(new Event('resize'));
        });
        await expect.poll(() => page.evaluate(() => Number.parseFloat(getComputedStyle(document.documentElement).getPropertyValue('--mobile-board-shell-scale')))).toBeCloseTo((432 - 4 - 8) / 1080, 5);
        // CSS倍率先同步，存储位置随后经rAF按新安全区恢复；等待同一现场稳定后开始手势。
        await page.waitForTimeout(500);
        const main = page.locator('[data-fab-visual-id]').first();
        const start = (await main.boundingBox())!;
        await page.mouse.move(start.x + start.width / 2, start.y + start.height / 2);
        await page.mouse.down();
        await page.mouse.move(500, 210, { steps: 12 });
        await page.mouse.up();
        await expect.poll(async () => {
            const r = (await main.boundingBox())!;
            return Math.abs(r.x + r.width / 2 - 500) + Math.abs(r.y + r.height / 2 - 210);
        }).toBeLessThan(3);
        const dragged = (await main.boundingBox())!;
        expect(dragged.x).toBeLessThan(550);
        expect(dragged.y).toBeGreaterThan(100);
        expect(dragged.y).toBeLessThan(250);
        expect((await icon.boundingBox())!.width).toBeCloseTo(18.4, 0);
        const centerHit = await main.evaluate(visual => {
            const r = visual.getBoundingClientRect(), button = visual.closest('button')!;
            return button.contains(document.elementFromPoint(r.x + r.width / 2, r.y + r.height / 2));
        });
        expect(centerHit).toBe(true);
        console.info(JSON.stringify({ evidence: 'dicethrone-safe-area-real-drag', safeArea: { left: 30, right: 12, top: 4, bottom: 8 }, dragged, centerHit }));
    } finally { await context.close(); }
});
test('悬浮球冷启动与切换视口的实际图标尺寸', async ({ page, game }, testInfo) => {
    test.setTimeout(90000);
    const dir = join(process.cwd(), '.tmp', 'dt-fixed-content-after');
    await mkdir(dir, { recursive: true });
    await page.setViewportSize({ width: 812, height: 375 });
    await game.openTestGame('dicethrone', { playerID: '0', disableLocalAiAutomation: true }, 45000);
    await game.setupScene({ gameId: 'dicethrone', phase: 'main1', currentPlayer: '0',
        extra: { selectedCharacters: { '0': 'tianshi', '1': 'barbarian' }, hostStarted: true },
        sys: { phase: 'main1', currentPlayerIndex: 0 } });
    await expect(page.getByTestId('dicethrone-board-root')).toBeVisible();
    await closeDebugPanelIfOpen(page);
    const records = [];
    for (const [label, width, height] of [
        ['冷启动较窄横屏', 812, 375], ['切换手机横屏', 936, 432],
        ['切换桌面', 1920, 1080], ['返回较窄横屏', 812, 375],
    ] as const) {
        await page.setViewportSize({ width, height });
        await page.waitForTimeout(700);
        await expect(page.locator('[data-fab-visual-id] svg').first()).toBeVisible();
        const metrics = await page.evaluate(() => {
            const visual = document.querySelector<HTMLElement>('[data-fab-visual-id]')!;
            const svg = visual.querySelector('svg')!;
            const ancestors = [];
            for (let el: Element | null = svg; el; el = el.parentElement) {
                const cs = getComputedStyle(el), rect = el.getBoundingClientRect();
                ancestors.push({ tag: el.tagName, class: el.getAttribute('class'), transform: cs.transform,
                    width: rect.width, height: rect.height, cssWidth: cs.width, flexShrink: cs.flexShrink });
            }
            return { viewport: innerWidth, placement: document.querySelector('[data-testid="fab-menu"]')?.getAttribute('data-hud-placement'),
                scale: getComputedStyle(document.documentElement).getPropertyValue('--mobile-board-shell-scale'),
                visualWidth: visual.getBoundingClientRect().width, svgWidth: svg.getBoundingClientRect().width,
                magnifiers: Array.from(document.querySelectorAll<HTMLElement>('[data-testid="player-board-magnify-button"] [data-fixed-control-visual], [data-testid="tip-board-magnify-button"] [data-fixed-control-visual]')).map(v => ({
                    width: v.querySelector('svg')?.getBoundingClientRect().width, visualWidth: v.getBoundingClientRect().width,
                })),
                icons: Array.from(document.querySelectorAll<HTMLElement>('[data-fab-visual-id]')).map(v => {
                    const icon = v.querySelector('svg')!, button = v.closest('button')!;
                    return { id: v.dataset.fabVisualId, width: icon.getBoundingClientRect().width,
                        visualWidth: v.getBoundingClientRect().width, hitWidth: button.getBoundingClientRect().width };
                }), ancestors };
        });
        records.push({ label, ...metrics });
        console.log('fixed-content-diagnostic', JSON.stringify(records.at(-1)));
        await page.screenshot({ path: join(dir, `${label}.png`), fullPage: false });
    }
    await writeFile(join(dir, 'metrics.json'), JSON.stringify(records, null, 2));
    await testInfo.attach('尺寸链路', { body: JSON.stringify(records), contentType: 'application/json' });
    for (const record of records) for (const icon of record.icons) {
        expect(icon.width, `${record.label} ${icon.id}`).toBeCloseTo(record.viewport <= 1023 ? 18.4 : 20, 0);
        expect(icon.visualWidth - icon.width, `${record.label} ${icon.id} 必须保留图标与球边留白`).toBeGreaterThan(18);
        expect(icon.hitWidth, `${record.label} ${icon.id}`).toBeGreaterThan(43);
    }
    for (const record of records.filter(r => r.viewport <= 1023)) {
        expect(record.magnifiers).toHaveLength(2);
        for (const icon of record.magnifiers) expect(icon.width, `${record.label} 放大镜保留上一轮13.824px视觉尺寸`).toBeCloseTo(13.824, 1);
    }
});

test('真实联机悬浮球主图标与展开图标保持已修复尺寸和留白', async ({ browser, baseURL }) => {
    // 真实联机四角覆盖多列、主球、内容面板的命中关系，不靠DOM矩形存在判通过。
    test.setTimeout(180000);
    const setup = await setupDTOnlineMatch(browser, baseURL, 'barbarian', 'monk');
    if (!setup) throw new Error('无法创建真实双人房间');
    const page = setup.hostPage;
    const dir = join(process.cwd(), '.tmp', process.env.DT_FAB_EVIDENCE_DIR ?? 'dt-online-fab-current');
    await mkdir(dir, { recursive: true });
    const records = [];
    try {
        const cases = [[812, 375], [936, 432]].flatMap(([width, height]) => [[0, 0], [1, 0], [0, 1], [1, 1]].map(([left, top]) => [width, height, left, top]));
        // 屏幕中段能区分“按整屏高度”与“按主球展开侧空间”分列。
        cases.push([812, 320, 0.5, 0.5]);
        cases.push([1920, 1080, 1, 1]);
        for (const [width, height, leftPercent, topPercent] of cases) {
            await page.setViewportSize({ width, height });
            await page.evaluate(position => localStorage.setItem('hud_fab_position', JSON.stringify(position)), { leftPercent, topPercent });
            await page.reload();
            await expect(page.getByTestId('dicethrone-board-root')).toBeVisible({ timeout: 45000 });
            await closeDebugPanelIfOpen(page);
            const main = page.locator('[data-fab-id="chat"]');
            const chatPanel = page.locator('[data-testid="fab-panel-chat"]');
            await expect(main).toBeVisible();
            await main.click();
            await page.mouse.move(1, 1);
            await expect(page.locator('[data-fab-id="settings"]')).toBeVisible();
            await expect(chatPanel).toBeVisible();
            await page.waitForTimeout(700);
            const panelRect = await chatPanel.boundingBox();
            expect(panelRect, `${width}x${height} 聊天面板可测量`).not.toBeNull();
            const icons = await page.locator('[data-fab-visual-id]').evaluateAll(visuals => visuals.map(v => {
                const svg = v.querySelector('svg')!, rect = v.getBoundingClientRect();
                const button = v.closest('button')!, buttonRect = button.getBoundingClientRect();
                const target = document.elementFromPoint(rect.x + rect.width / 2, rect.y + rect.height / 2);
                return { id: v.getAttribute('data-fab-visual-id'), width: svg.getBoundingClientRect().width,
                    circleWidth: rect.width, hitWidth: buttonRect.width,
                    left: buttonRect.left, right: buttonRect.right, top: buttonRect.top, bottom: buttonRect.bottom,
                    centerHit: target === button || button.contains(target),
                    hitStack: document.elementsFromPoint(rect.x + rect.width / 2, rect.y + rect.height / 2).slice(0, 5).map(el => ({
                        tag: el.tagName, class: el.getAttribute('class'), fab: el.getAttribute('data-fab-id'),
                        style: el.getAttribute('style'),
                    })) };
            }));
            records.push({ width, height, leftPercent, topPercent, panelRect, icons });
            console.log('online-fab-diagnostic', JSON.stringify({ width, leftPercent, topPercent, icons }));
            if (width === 812 && height === 320) {
                // 主球会默认显示聊天面板；本图只比较菜单排布，移除面板内容节点，不改菜单坐标或测量结果。
                await page.evaluate(() => document.querySelector('[data-testid="fab-panel-chat"]')?.remove());
            }
            const currentScreenshot = await page.screenshot({ path: join(dir, `联机悬浮球展开-${width}-${leftPercent}-${topPercent}.png`), fullPage: false });
            expect(icons.length).toBeGreaterThan(2);
            for (const icon of icons) {
                expect(icon.width, `${width} ${icon.id}`).toBeCloseTo(width <= 1023 ? 18.4 : 20, 1);
                expect(icon.circleWidth - icon.width).toBeGreaterThan(18);
                expect(icon.hitWidth).toBeGreaterThan(43);
            }

            if (width === 812 && height === 320) {
                const columns = new Map<number, number>();
                for (const icon of icons.filter(icon => icon.id !== 'chat')) {
                    const column = Math.round(icon.left);
                    columns.set(column, (columns.get(column) ?? 0) + 1);
                }
                expect(columns.size, '812×320 当前排布为三列').toBe(3);
                expect([...columns.values()].sort((a, b) => b - a), '当前排布为3+3+2').toEqual([3, 3, 2]);

                // 左图重放原提交的整屏分列公式；右图是当前真实联机排布。
                await page.evaluate(() => {
                    const menu = document.querySelector<HTMLElement>('[data-testid="fab-menu"]')!;
                    const main = menu.querySelector<HTMLButtonElement>('button[data-fab-id="chat"]')!;
                    const mainRect = main.getBoundingClientRect();
                    const satellites = Array.from(menu.querySelectorAll<HTMLButtonElement>('button[data-fab-id]')).filter(button => button !== main);
                    const buttonSize = mainRect.width;
                    const step = buttonSize + 8;
                    const vertical = mainRect.top + buttonSize / 2 < window.innerHeight / 2 ? 'top' : 'bottom';
                    const horizontal = mainRect.left + buttonSize / 2 < window.innerWidth / 2 ? 'right' : 'left';
                    const oldAvailableHeight = Math.max(buttonSize, window.innerHeight - step);
                    const oldItemsPerColumn = Math.min(satellites.length, Math.max(1, Math.floor(oldAvailableHeight / step)));
                    const oldVisibleColumnHeight = Math.min(satellites.length, oldItemsPerColumn) * step;
                    const oldColumnGap = step;
                    let oldOffsetY = 0;
                    if (vertical === 'bottom') {
                        const oldListTop = mainRect.top - oldVisibleColumnHeight;
                        if (oldListTop < 0) oldOffsetY = -oldListTop;
                    } else {
                        const oldListBottom = mainRect.top + oldVisibleColumnHeight + step + buttonSize;
                        if (oldListBottom > window.innerHeight) oldOffsetY = window.innerHeight - oldListBottom;
                    }
                    satellites.forEach((button, index) => {
                        const current = button.getBoundingClientRect();
                        const columnIndex = Math.floor(index / oldItemsPerColumn);
                        const distanceFromMain = (index % oldItemsPerColumn) + 1;
                        const targetLeft = mainRect.left + (horizontal === 'right' ? 1 : -1) * columnIndex * oldColumnGap;
                        const targetTop = mainRect.top + oldOffsetY + (vertical === 'bottom' ? -1 : 1) * distanceFromMain * step;
                        button.style.setProperty('transform', `translate(${targetLeft - current.left}px, ${targetTop - current.top}px)`, 'important');
                        button.style.setProperty('transition', 'none', 'important');
                    });
                });
                const legacyScreenshot = await page.screenshot({ path: join(dir, '联机悬浮球展开-旧版公式重放-812x320.png'), fullPage: false });
                const comparisonPage = await setup.hostContext.newPage();
                await comparisonPage.setViewportSize({ width: 1696, height: 388 });
                await comparisonPage.setContent(`<!doctype html><html><head><meta charset="utf-8"><style>
                    *{box-sizing:border-box}body{margin:0;padding:18px;background:#111827;color:#f9fafb;font:14px system-ui,sans-serif}
                    main{display:flex;gap:24px}section{width:812px}h1{font-size:16px;margin:0 0 10px;font-weight:700}
                    img{display:block;width:812px;height:320px;object-fit:cover;border:1px solid #64748b;border-radius:6px}
                    p{margin:10px 0 0;color:#cbd5e1;font-size:12px}
                </style></head><body><main>
                    <section><h1>前：旧版布局公式重放</h1><img src="data:image/png;base64,${legacyScreenshot.toString('base64')}"><p>同一联机房间 · 812 × 320 · 悬浮球在中段</p></section>
                    <section><h1>后：当前真实联机排布</h1><img src="data:image/png;base64,${currentScreenshot.toString('base64')}"><p>同一联机房间 · 当前按展开侧空间重排</p></section>
                </main></body></html>`);
                await comparisonPage.screenshot({ path: join(dir, '悬浮球展开前后排布对比-812x320.png'), fullPage: false });
                await comparisonPage.close();
            }
        }
        for (const record of records) for (const icon of record.icons) {
            expect(icon.left, `${record.width} ${icon.id} 左边界`).toBeGreaterThanOrEqual(-1);
            expect(icon.right, `${record.width} ${icon.id} 右边界`).toBeLessThanOrEqual(record.width + 1);
            expect(icon.top, `${record.width} ${icon.id} 上边界`).toBeGreaterThanOrEqual(-1);
            expect(icon.bottom, `${record.width} ${icon.id} 下边界`).toBeLessThanOrEqual(record.height + 1);
            expect(icon.centerHit, `${record.width} ${icon.id} 真实中心命中`).toBe(true);
            const panel = record.panelRect!;
            const overlapsChatPanel = icon.left < panel.x + panel.width
                && icon.right > panel.x
                && icon.top < panel.y + panel.height
                && icon.bottom > panel.y;
            expect(overlapsChatPanel, `${record.width}x${record.height} 聊天面板不得遮住 ${icon.id}`).toBe(false);
        }
    } finally {
        await writeFile(join(dir, 'metrics.json'), JSON.stringify(records, null, 2));
        await cleanupDTMatch(setup);
    }
});

test('教程初始化文字沿真实壳层保持原设计字号', async ({ page, game }) => {
    test.setTimeout(90000);
    const dir = join(process.cwd(), '.tmp', 'dt-tutorial-loading-comparison');
    await mkdir(dir, { recursive: true });
    await page.setViewportSize({ width: 936, height: 432 });
    await setChineseLocale(page);
    await page.goto('/play/dicethrone/tutorial/dicethrone-basic');
    await expect(page.getByTestId('dicethrone-board-root')).toBeVisible({ timeout: 45000 });
    // 重放教程尚在 setup 的初始化等待态；仍使用正式路由、Board 和 LoadingScreen。
    // 只用于测量这个瞬态，不冒充完整的自然启动过程。
    await game.setupScene({ gameId: 'dicethrone', phase: 'setup',
        sys: { phase: 'setup', tutorial: { active: true, stepIndex: 0, steps: [], step: null } } });
    const text = page.getByText('教程初始化中', { exact: true });
    await expect(text).toBeVisible();
    const records = [];
    for (const [width, height] of [[936, 432], [812, 375], [1920, 1080]] as const) {
        await page.setViewportSize({ width, height });
        await expect.poll(() => page.evaluate(() => Number.parseFloat(getComputedStyle(document.documentElement).getPropertyValue('--mobile-board-shell-scale')) || 1)).toBeCloseTo(width > 1023 ? 1 : Math.min(width / 1920, height / 1080), 4);
        await page.waitForTimeout(700);
        await expect(text).toBeVisible();
        const metrics = await text.evaluate(el => {
            const cs = getComputedStyle(el), rect = el.getBoundingClientRect();
            const scale = rect.height / parseFloat(cs.lineHeight);
            return { width: innerWidth, cssFont: cs.fontSize, finalFont: parseFloat(cs.fontSize) * scale,
                lineHeight: cs.lineHeight, letterSpacing: cs.letterSpacing, scale,
                rect: { width: rect.width, height: rect.height }, class: el.className,
                shellUnit: getComputedStyle(document.documentElement).getPropertyValue('--mobile-board-shell-inline-unit') };
        });
        records.push({ height, ...metrics });
        console.log('tutorial-loading-diagnostic', JSON.stringify({ height, ...metrics }));
        await page.screenshot({ path: join(dir, `教程初始化-${width}-同一参考画布.png`), fullPage: false });
    }
    await writeFile(join(dir, 'metrics.json'), JSON.stringify(records, null, 2));
    for (const record of records) {
        // 正常历史代码的 md:text-sm 实际生效为14px；不把1.5vw的声明冒充最终字号。
        const expectedScale = record.width > 1023 ? 1 : Math.min(record.width / 1920, record.height / 1080);
        expect(record.finalFont).toBeCloseTo(14 * expectedScale, 1);
        expect(record.lineHeight).toBe('22.75px');
    }
});
