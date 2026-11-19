import { expect, test, type Locator, type Page } from '@playwright/test';
import { createHash } from 'node:crypto';
import { readFile, writeFile } from 'node:fs/promises';
import { captureEvidenceSourceIdentity, startSourceSession } from '../framework/sourceIdentity';
import { assertNoFatalFrontendErrors, attachPageDiagnostics, initContext, waitForFrontendAssets, waitForTestHarness } from '../helpers/common';
import { expectReadableMageWarsPreview } from './helpers/cardPreview';

const wolf = 'mwobj-0-2819-1';
const secondWolf = 'mwobj-0-2819-2';
const unicorn = 'mwobj-1-2814-1';
const lair = 'mwobj-0-2218-1';
const wand = 'mwobj-0-3725-1';

const field = (page: Page, id: string) => page.locator(`[data-testid="mage-wars-zone-field-card"][data-object-id="${id}"]`);
const attached = (page: Page, id: string) => page.locator(`[data-testid="mage-wars-attached-card"][data-object-id="${id}"]`);
const mage = (page: Page, id: string) => page.locator(`[data-testid="mage-wars-zone-mage-entity"][data-player-id="${id}"]`);
const zone = (page: Page, id: string) => page.getByTestId(`mage-wars-arena-zone-${id}`);
const prepared = (page: Page, id: number) => page.locator(`[data-tutorial-id="mw-prepared-card-${id}"]`);
const option = (page: Page, id: string) => page.locator(`[data-testid="mage-wars-interaction-option"][data-option-id="${id}"]`);
const click = (locator: Locator) => locator.click({ timeout: 15_000 });

async function bookCard(page: Page, cardId: number) {
    await click(page.getByTestId('mage-wars-spellbook-category-all'));
    const card = page.locator(`[data-testid="mage-wars-desktop-spellbook-card"][data-source-card-id="${cardId}"]`);
    const next = page.getByTestId('mage-wars-spellbook-next-page');
    for (let i = 0; i < 14 && !await card.isVisible(); i += 1) {
        if (await next.isDisabled()) break;
        await click(next);
    }
    await click(card);
}

async function readMatch(page: Page) {
    return page.evaluate(() => {
        const state = window as Window & { __BG_TEST_HARNESS__?: { state?: { get?: () => unknown } } };
        return state.__BG_TEST_HARNESS__?.state?.get?.() as {
            core?: { turnNumber: number; gameResult?: { winner: string }; objects: Record<string, { guarding: boolean; damage: number; zoneId: string }> };
            sys?: {
                tutorial?: { step?: { id: string }; active?: boolean };
                eventStream?: { nextId: number; entries: Array<{ id: number; event: { type: string; payload?: { playerId?: string } } }> };
            };
        } | undefined;
    });
}

async function snapshot(page: Page) {
    const state = await readMatch(page);
    return {
        visible: await page.evaluate(() => {
            const readText = (id: string) => document.querySelector(`[data-testid="${id}"]`)?.textContent?.trim() ?? null;
            return {
                url: location.href,
                step: document.querySelector('[data-tutorial-step]')?.getAttribute('data-tutorial-step') ?? null,
                connected: document.querySelector('[data-testid="mage-wars-board"]') != null,
                gameOver: document.querySelector('[data-testid="endgame-overlay"]') != null,
                dice: readText('mage-wars-fx-attack-dice-summary'),
                healing: readText('mage-wars-fx-healing-number'),
                choices: readText('mage-wars-interaction-dock'),
                wallRolls: [...document.querySelectorAll('[data-testid="mage-wars-wall-attack-roll-total"]')].map(element => element.textContent),
            };
        }),
        authoritative: {
            round: state?.core?.turnNumber ?? null,
            step: state?.sys?.tutorial?.step?.id ?? null,
            guard: state?.core?.objects[wolf]?.guarding ?? null,
            wolfDamage: state?.core?.objects[wolf]?.damage ?? null,
            newWolfZone: state?.core?.objects[secondWolf]?.zoneId ?? null,
            winner: state?.core?.gameResult?.winner ?? null,
        },
    };
}

test('单局教程从守卫到同局自由对战的真实点击链', async ({ context, page, baseURL }, testInfo) => {
    const followToEnd = process.env.PW_MW_TUTORIAL_FOLLOW_TO_END === 'true';
    test.setTimeout(followToEnd ? 720_000 : 420_000);
    const compact = process.env.PW_MW_TUTORIAL_COMPACT === 'true';
    const chainId = compact ? 'tutorial-compact' : 'tutorial-desktop';
    const captureContract = await readFile('e2e/mage-wars/tutorial-capture-contract.json');
    const sha256 = (bytes: Buffer) => createHash('sha256').update(bytes).digest('hex');
    await page.setViewportSize(compact ? { width: 1366, height: 768 } : { width: 1920, height: 1080 });
    await initContext(context, { storageKey: 'mage-wars-single-match-tutorial', skipTutorial: false, locale: 'zh-CN', skipImageGate: false, blockCdnAssets: false });
    if (!baseURL) throw new Error('教程验收需要正式页面基址');
    const releaseSource = await startSourceSession(context, baseURL);
    const diagnostics = attachPageDiagnostics(page);
    let before = await snapshot(page);
    await page.goto('/play/mage-wars/tutorial', { waitUntil: 'domcontentloaded' });
    await waitForFrontendAssets(page, 45_000);
    const board = page.getByTestId('mage-wars-board');
    const entry = page.getByTestId('tutorial-catalog-entry-mage-wars-basic');
    await expect(board.or(entry).first()).toBeVisible({ timeout: 60_000 });
    if (await entry.isVisible()) await click(entry);
    await expect(board).toBeVisible({ timeout: 60_000 });
    await waitForTestHarness(page, 20_000);

    let imageNumber = 0;
    const steps: { id: string; action: string; before: typeof before; after: typeof before; assertions: { name: string; actual: unknown; expected: unknown }[] }[] = [];
    const uiStates: { id: string; stepId: string; change: string; viewport: string; sha256: string; filename: string }[] = [];
    const shot = async (name: string, change = 'panel') => {
        expect(uiStates.some((entry) => entry.id === name)).toBe(false);
        imageNumber += 1;
        if (change !== 'animation-phase') {
            await page.evaluate(async () => {
                const panels = document.querySelectorAll('[data-testid="tutorial-overlay-card"],[data-testid="mage-wars-card-magnify-overlay"]');
                const finiteAnimations = [...panels].flatMap((panel) => panel.getAnimations({ subtree: true })).filter((animation) => (
                    Number.isFinite(animation.effect?.getComputedTiming().endTime)
                ));
                await Promise.allSettled(finiteAnimations.map((animation) => animation.finished));
            });
        }
        const filename = `${String(imageNumber).padStart(2, '0')}-${name}.png`;
        const after = await snapshot(page);
        expect(after.visible.connected, name).toBe(true);
        const bytes = await page.screenshot({
            path: testInfo.outputPath('screenshots', filename),
            timeout: 15_000,
        });
        const id = `${after.authoritative.step ?? 'endgame'}-${imageNumber}`;
        steps.push({
            id, action: name, before, after,
            assertions: [
                { name: '棋盘渲染', actual: after.visible.connected, expected: true },
                ...(after.visible.gameOver ? [{ name: '有正式胜负结果', actual: Boolean(after.authoritative.winner), expected: true }] : []),
            ],
        });
        uiStates.push({ id: name, stepId: id, change, viewport: 'desktop', sha256: sha256(bytes), filename });
        before = after;
    };
    const finishEvidence = async (outcome: string) => {
        const identity = await captureEvidenceSourceIdentity(page, 'mage-wars');
        const sourceRun = process.env.PW_E2E_OUTPUT_DIR?.split(/[/\\]/).filter(Boolean).at(-1) ?? testInfo.testId;
        const trace = {
            gameId: 'mage-wars', evidenceCategory: 'tutorial', chainId, status: 'PASS', outcome, sourceRun,
            sourceRevision: identity.sourceRevision, viewport: page.viewportSize(),
            captureContract: { sha256: sha256(captureContract) },
            steps, uiStates,
        };
        await writeFile(testInfo.outputPath('behavior-trace.json'), JSON.stringify(trace, null, 2));
        await writeFile(testInfo.outputPath('source-identity.json'), JSON.stringify(identity, null, 2));
        await releaseSource();
    };
    const step = async (id: string, image?: string) => {
        await expect(page.locator(`[data-tutorial-step="${id}"]`)).toBeVisible({ timeout: 35_000 });
        if (image) await shot(image);
    };
    const plan = async (id: string, cards: number[], image: string) => {
        await step(id);
        for (const card of cards) await bookCard(page, card);
        await shot(image);
        await click(page.getByTestId('mage-wars-plan-spells'));
    };
    const cast = async (id: string, card: number, target: Locator, image: string) => {
        await step(id);
        await click(prepared(page, card));
        await shot(image);
        await click(target);
    };
    const moveMage = async (id: string, destination: string, image: string) => {
        await step(id);
        await click(mage(page, '0'));
        await shot(image);
        await click(zone(page, destination));
    };
    const next = () => click(page.getByTestId('tutorial-next-button'));
    const openHudPanel = async (id: 'settings' | 'action-log') => {
        const hud = page.getByTestId('fab-menu');
        const button = hud.locator(`button[data-fab-id="${id}"]`);
        if (!await button.isVisible()) await click(hud.locator('button[data-fab-id="chat"]'));
        await click(button);
        const panel = page.getByTestId(`fab-panel-${id}`);
        await expect(panel).toBeVisible();
        return { panel, close: async () => {
            await click(button);
            await expect(panel).toBeHidden();
        } };
    };
    const readLegend = async (id: string, alt: RegExp, image: string) => {
        await step(id);
        const diagram = page.getByRole('img', { name: alt });
        await expect(diagram).toBeVisible();
        await expect.poll(() => diagram.evaluate((element: HTMLImageElement) => element.naturalWidth)).toBeGreaterThan(0);
        await shot(image);
        if (id === 'spell-card-reading') {
            const beforeReference = (await readMatch(page))?.core;
            const settings = await openHudPanel('settings');
            const reference = settings.panel.getByTestId('mage-wars-rules-reference');
            await click(reference.locator('summary'));
            const topics = reference.getByRole('combobox', { name: '查阅主题' });
            await expect(topics.locator('option')).toHaveCount(15);
            await topics.selectOption('castingSources');
            await expect(reference.getByTestId('mage-wars-rules-description')).toContainText('魔宠可以另外准备');
            await shot(compact ? '较矮窗口查阅规则释义' : '设置内查阅魔杖魔宠和再生点');
            await settings.close();
            await step(id);
            expect((await readMatch(page))?.core).toEqual(beforeReference);
        }
        await next();
    };
    const checkResponseLayout = async () => {
        const responseButtons = page.getByTestId('mage-wars-interaction-option');
        const card = page.getByTestId('tutorial-overlay-card');
        await expect(responseButtons.first()).toBeVisible();
        await expect(page.getByTestId('mage-wars-interaction-dock')).not.toContainText(/mwobj-/);
        await expect.poll(async () => {
            const box = await card.boundingBox();
            if (!box) return false;
            const buttons = await Promise.all((await responseButtons.all()).map((button) => button.boundingBox()));
            return buttons.every((button) => button != null && (
                box.x + box.width <= button.x || button.x + button.width <= box.x
                || box.y + box.height <= button.y || button.y + button.height <= box.y
            ));
        }).toBe(true);
    };

    await step('guard-wolf', '第五回合单局开场');
    await expect.poll(async () => (await readMatch(page))?.core?.turnNumber).toBe(5);
    await expect.poll(async () => (await readMatch(page))?.core?.objects[wolf]?.damage).toBe(3);
    const phase = page.locator('[data-testid="mage-wars-phase-progress-item"][data-phase-id="creatureAction"]');
    await phase.hover();
    await expect(page.getByTestId('info-tooltip')).toContainText('行动');
    await shot('阶段悬浮提示');
    await click(field(page, wolf));
    await shot('选中灰狼后显示守卫入口');
    await click(page.getByTestId('mage-wars-selected-unit-guard'));
    await step('heal-wolf');
    const healCard = prepared(page, 3402);
    const inspectHeal = healCard.locator('xpath=..').getByTestId('mage-wars-card-inspect-button');
    await page.mouse.move(500, 120);
    await expect(inspectHeal).toHaveCSS('opacity', '0');
    await healCard.hover();
    await expect(inspectHeal).toHaveCSS('opacity', '1');
    await click(inspectHeal);
    const preview = page.getByTestId('mage-wars-card-magnify-content');
    const closePreview = page.getByTestId('mage-wars-card-magnify-overlay-close');
    await expectReadableMageWarsPreview(preview);
    await expect(closePreview).toHaveCSS('opacity', '0');
    await shot('刚放大时叉号隐藏');
    await preview.hover();
    await expect(closePreview).toHaveCSS('opacity', '1');
    await shot('悬浮放大卡上才显示关闭');
    await click(closePreview);
    await click(healCard);
    await shot('治疗选择受伤灰狼');
    await click(field(page, wolf));
    await expect(page.getByTestId('mage-wars-fx-attack-dice-summary')).toHaveText('4');
    await expect(page.getByTestId('mage-wars-fx-healing-number')).toHaveAttribute('data-healing-amount', '3');
    await shot('治疗骰总和四与灰狼飘字加三', 'animation-phase');
    await step('healing-result', '治疗四点实际恢复三点');
    await next();
    await step('check-discard');
    const discard = page.getByTestId('mage-wars-discard-pile');
    await click(discard.getByRole('button'));
    await expect(preview).toHaveAttribute('data-source-card-id', '3402');
    await expectReadableMageWarsPreview(preview);
    await shot('弃牌堆可打开用过的次级治疗');
    await preview.hover();
    await click(closePreview);
    await next();
    await step('opponent-public-view');
    await click(page.getByTestId('mage-wars-observe-player-button'));
    await step('back-to-self-view');
    await expect(discard).toHaveAttribute('data-discard-owner-role', 'opponent');
    await shot('对手公开视角保留准备牌隐私');
    await click(page.getByTestId('mage-wars-back-to-self-view'));
    await step('guard-response');
    await checkResponseLayout();
    await shot('守卫后的反击选择');
    await click(option(page, 'counterstrike'));
    await step('pass-final', '最终快速施法按钮');
    await click(page.getByTestId('mage-wars-turn-end'));
    await readLegend('spell-card-reading', /法术牌图例/, '读牌步骤包含法术牌图例');
    if (compact) {
        await step('plan-summon');
        await bookCard(page, 2819);
        await expect(prepared(page, 2819)).toBeVisible();
        const saved = (await readMatch(page))?.core;
        await page.reload({ waitUntil: 'domcontentloaded' });
        await waitForFrontendAssets(page, 45_000);
        await expect(page.getByText('继续上次教程？')).toBeVisible({ timeout: 30_000 });
        await click(page.getByRole('button', { name: '从上次继续' }));
        await waitForTestHarness(page, 20_000);
        await step('plan-summon');
        await expect(prepared(page, 2819)).toBeVisible();
        expect((await readMatch(page))?.core).toEqual(saved);
        await expect(page.getByTestId('mage-wars-fx-attack-dice')).toHaveCount(0);
        await shot('较矮窗口恢复同一局和未确认计划草稿');
        await bookCard(page, 3403);
        await click(page.getByTestId('mage-wars-plan-spells'));
    } else {
        await plan('plan-summon', [2819, 3403], '准备召唤与觉醒');
    }
    for (const [id, image] of [['pass-deploy', '结束空部署'], ['pass-priority', '保留优先快速施法']]) {
        await step(id, image);
        await click(page.getByTestId('mage-wars-turn-end'));
    }
    await step('pursue-unicorn');
    await click(field(page, wolf));
    await shot('灰狼追向相邻区域');
    await click(zone(page, 'a2'));
    await readLegend('attack-bar-reading', /攻击条图例/, '近战步骤包含攻击条图例');
    await step('bite-unicorn');
    await click(field(page, wolf));
    await shot('玩家主动攻击独角兽');
    await click(field(page, unicorn));
    await step('end-wolf-action');
    await click(page.getByTestId('mage-wars-turn-end'));
    await step('summon-second-wolf');
    const viewportContent = page.getByTestId('mage-wars-arena-viewport-content');
    const cameraTransform = () => viewportContent.evaluate((element) => getComputedStyle(element).transform);
    const originalCamera = await cameraTransform();
    await zone(page, 'a3').hover();
    await page.mouse.wheel(0, -80);
    await expect.poll(cameraTransform).not.toBe(originalCamera);
    await click(prepared(page, 2819));
    const cameraBeforeSummon = await cameraTransform();
    await shot('缩放后仍可点击兽王所在区域召唤');
    await click(zone(page, 'a3'));
    await step('rouse-second-wolf');
    expect(await cameraTransform()).toBe(cameraBeforeSummon);
    await cast('rouse-second-wolf', 3403, field(page, secondWolf), '对新灰狼施放兽性觉醒');
    await step('end-summon-action');
    await click(page.getByTestId('mage-wars-turn-end'));
    await step('move-new-wolf');
    await click(field(page, secondWolf));
    await shot('新灰狼觉醒后移动');
    await click(zone(page, 'b3'));
    await plan('plan-wall-and-push', [25700, 3425], '准备荆棘墙与推斥');
    await moveMage('move-for-wall', 'a2', '兽王移动至墙边施法范围');
    await cast('place-wall', 25700, page.getByTestId('mage-wars-wall-edge-b1-b2'), '荆棘墙选择真实边界');
    await plan('plan-push', [3425], '再准备原力推斥');
    await moveMage('move-for-push', 'a1', '兽王靠近对手');
    await step('push-through-wall');
    await click(prepared(page, 3425));
    await click(mage(page, '1'));
    await expect(page.getByTestId('mage-wars-spell-cast-choice-dock')).not.toBeVisible();
    await shot('推斥选择墙另一侧');
    const zeroRollStarts = page.waitForFunction(() => {
        const first = document.querySelector('[data-testid="mage-wars-wall-attack-roll"]');
        return first?.querySelectorAll('[data-roll-animation="mage-wars-d6-tumble"]').length === 2
            && first.querySelector('[data-testid="mage-wars-wall-attack-roll-total"]')?.textContent === '0';
    }, undefined, { timeout: 10_000, polling: 'raf' });
    await click(zone(page, 'b2'));
    await zeroRollStarts;
    const rolls = page.getByTestId('mage-wars-wall-attack-roll');
    await expect(rolls).toHaveCount(5);
    await expect(page.getByTestId('mage-wars-wall-attack-roll-total')).toHaveText(['0', '4', '2', '2', '2']);
    await expect(rolls.first().locator('[data-roll-animation="settled"]')).toHaveCount(2);
    await shot('荆棘五组独立掷骰含全空和双骰四点', 'animation-phase');
    await step('wall-rolls', '穿过荆棘后的规则说明');
    await click(page.getByTestId('tutorial-next-button'));
    await plan('plan-ward', [1901], '准备法力失效');
    await cast('set-ward', 1901, field(page, wolf), '结界伏在第一只灰狼身上');
    await step('pay-counter');
    await checkResponseLayout();
    await shot(compact ? '紧凑窗口法力失效提示与付费按钮分开' : '法力失效提示与付费按钮分开');
    const beforeReveal = await openHudPanel('action-log');
    await expect(beforeReveal.panel).toContainText('伏下一张结界');
    await expect(beforeReveal.panel).not.toContainText('法力失效');
    await beforeReveal.close();
    await click(option(page, 'reveal'));
    await step('plan-armor');
    const beforeLog = (await readMatch(page))?.core;
    const actionLog = await openHudPanel('action-log');
    const counter = actionLog.panel.getByTestId('hud-action-log-row').filter({ hasText: '被反制' });
    await expect(counter).toHaveCount(1);
    await expect(counter).toContainText('法力失效');
    await expect(actionLog.panel).not.toContainText(/mwobj-/);
    await shot(compact ? '较矮窗口回看真实反制结果' : '行为日志回看法力失效的反制');
    await actionLog.close();
    expect((await readMatch(page))?.core).toEqual(beforeLog);
    await plan('plan-armor', [3711], '准备护甲');
    await cast('equip-armor', 3711, mage(page, '0'), '装备巨熊皮甲');
    await moveMage('approach-cleric', 'a2', '兽王向牧师靠近');
    await plan('plan-fountain', [1710], '准备间歇喷泉');
    await cast('cast-fountain', 1710, field(page, 'mwobj-1-2811-1'), '玩家向牧师施放攻击法术');
    await plan('plan-wand', [3725], '准备法师魔杖');
    await step('bind-wand');
    await click(prepared(page, 3725));
    await click(mage(page, '0'));
    const firstBinding = page.locator('[data-testid="mage-wars-spell-cast-choice-option"][data-bound-spell-card-id="3408"]');
    await expect(firstBinding.locator('img')).toBeVisible();
    await shot('法师魔杖首绑选择');
    await click(firstBinding);
    await step('rebind-wand');
    await click(attached(page, wand));
    await click(page.locator('[data-testid^="mage-wars-selected-object-ability-"]').filter({ hasText: '重新绑定' }));
    const rebind = page.locator('[data-testid="mage-wars-object-ability-choice-option"][data-bound-spell-card-id="3402"]');
    await expect(rebind.locator('img')).toBeVisible();
    await shot('法师魔杖改绑选择');
    await click(rebind);
    await step('first-upkeep', '精华汲取付费保住灰狼');
    await click(option(page, 'pay'));
    await plan('plan-lair', [2218], '准备巢穴');
    await cast('place-lair', 2218, zone(page, 'a2'), '放置巢穴');
    await step('second-upkeep', '精华汲取第二次放弃');
    await click(option(page, 'destroy'));
    await step('plan-lair-fox');
    await click(field(page, lair));
    await bookCard(page, 2812);
    await step('deploy-fox');
    await click(field(page, lair));
    await shot('从巢穴部署苦木林狐');
    await click(zone(page, 'a2'));
    await step('cast-bound-heal');
    await click(attached(page, wand));
    await click(page.getByTestId('mage-wars-selected-bound-spell-cast'));
    await shot('从法师魔杖施放次级治疗');
    await click(field(page, wolf));
    await plan('plan-defense', [1809], '准备灵蛇反射');
    await cast('grant-wolf-defense', 1809, field(page, wolf), '为灰狼施放灵蛇反射');
    await step('bow-defense');
    await checkResponseLayout();
    await shot('远程攻击的防御选择');
    await click(page.locator('[data-testid="mage-wars-interaction-option"][data-option-id^="defend-"]').first());
    await moveMage('approach-priestess', 'b2', '兽王走入同一格');
    await step('duel-17');
    await click(mage(page, '0'));
    await shot('法师亲自近战');
    await click(mage(page, '1'));
    await step('duel-finished', compact ? '较矮窗口在近战后仍可完成引导' : '首次近战后可从原地继续对打');
    const beforeFreePlay = (await readMatch(page))?.core;
    await next();
    await expect(page.getByTestId('tutorial-overlay-card')).toHaveCount(0);
    expect((await readMatch(page))?.core).toEqual(beforeFreePlay);
    await shot(compact ? '较矮窗口退场后仍可操作原棋盘' : '引导退场保留第十七回合原棋盘');
    await page.reload({ waitUntil: 'domcontentloaded' });
    await waitForFrontendAssets(page, 45_000);
    await expect(page.getByText('继续上次的对局？')).toBeVisible({ timeout: 30_000 });
    await click(page.getByRole('button', { name: '从上次继续' }));
    await waitForTestHarness(page, 20_000);
    await expect(board).toBeVisible();
    await expect(page.getByTestId('tutorial-overlay-card')).toHaveCount(0);
    const restored = await readMatch(page);
    expect(restored?.core).toEqual(beforeFreePlay);
    expect(restored?.sys?.tutorial?.active).toBe(false);
    if (process.env.PW_MW_TUTORIAL_SAVE_FREE_PLAY) {
        await context.storageState({ path: process.env.PW_MW_TUTORIAL_SAVE_FREE_PLAY });
    }
    const eventCursor = restored?.sys?.eventStream?.nextId ?? 0;
    await click(page.getByTestId('mage-wars-turn-end'));
    await expect.poll(async () => {
        const state = await readMatch(page);
        return state?.sys?.eventStream?.entries.some(({ id, event }) => (
            id >= eventCursor && event.type === 'MW_PHASE_WINDOW_COMPLETED' && event.payload?.playerId === '1'
        ));
    }, { timeout: 40_000 }).toBe(true);
    await shot(compact ? '较矮窗口续局后女祭司接管行动' : '续局后女祭司实际接管行动');
    if (followToEnd) {
        const endgame = page.getByTestId('endgame-overlay');
        const advance = page.locator('[data-testid="mage-wars-turn-end"]:enabled, [data-testid="mage-wars-plan-spells"]:enabled');
        const readyUnit = page.locator('[data-mage-wars-phase="creatureAction"][data-mage-wars-phase-actor-id="0"]')
            .locator([
                '[data-testid="mage-wars-zone-mage-entity"][data-player-id="0"][data-action-ready="true"][data-primary-action="true"]',
                '[data-testid="mage-wars-zone-field-card"][data-owner-side="seat-left"][data-action-ready="true"][data-primary-action-state="enabled"]:not([data-visual-held="true"])',
            ].join(', '));
        const pass = page.getByTestId('mage-wars-interaction-dock').getByRole('button', {
            name: /放弃|不防御|不反击|不支付|不展示|弃置/,
        });
        for (let action = 0; action < 160 && !await endgame.isVisible(); action += 1) {
            await expect(endgame.or(pass).or(advance).or(readyUnit).first()).toBeVisible({ timeout: 30_000 });
            if (await endgame.isVisible()) break;
            const cursor = (await readMatch(page))?.sys?.eventStream?.nextId ?? 0;
            if (!await pass.first().isVisible() && !await advance.first().isVisible()) {
                await click(readyUnit.first());
                const turnAction = page.getByTestId('mage-wars-turn-end');
                await expect(turnAction, '点选就绪生物后应可提交不行动').toHaveAttribute('data-main-action-mode', 'creature-no-action');
                await expect(turnAction).toBeEnabled();
            }
            await click(await pass.first().isVisible() ? pass.first() : advance.first());
            await expect.poll(async () => (await readMatch(page))?.sys?.eventStream?.nextId ?? 0).toBeGreaterThan(cursor);
        }
        const playerWon = (await readMatch(page))?.core?.gameResult?.winner === '0';
        const result = endgame.getByText(playerWon ? /击败了对手的法师|兽王打出了最后一击/ : /兽王倒下了/);
        await expect(result).toHaveCSS('opacity', '1');
        await expect(page.getByTestId('tutorial-overlay-card')).toHaveCount(0);
        expect((await readMatch(page))?.sys?.eventStream?.entries.some(({ id, event }) => (
            id >= eventCursor && event.type === 'SYS_TUTORIAL_STARTED'
        ))).toBe(false);
        await shot(compact ? '较矮窗口真实自由对战的结局' : '真实自由对战的结局');
        await click(page.getByTestId('rematch-play-again'));
        await expect(endgame).toHaveCount(0);
        await expect(board).toHaveAttribute('data-mage-wars-turn-number', '5');
        await step('guard-wolf', compact ? '较矮窗口再来一局从守卫重新开始' : '再来一局从守卫重新开始');
        await click(field(page, wolf));
        await click(page.getByTestId('mage-wars-selected-unit-guard'));
        await step('heal-wolf');
    }
    await assertNoFatalFrontendErrors([{ label: 'mage-wars-single-match-tutorial', diagnostics }]);
    await finishEvidence('从第五回合守卫到第十七回合法师近战，完成引导后继续原对局，并验证刷新后对手仍会行动。');
});
