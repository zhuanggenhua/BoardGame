import { expect, test } from '../framework';
import type { Locator, Page, TestInfo } from '@playwright/test';
import { mkdir, writeFile } from 'node:fs/promises';
import { readFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { resolve } from 'node:path';
import { captureEvidenceSourceIdentity } from '../framework/sourceIdentity';

const captureContractSha = createHash('sha256')
    .update(readFileSync(new URL('./unavailable-action-required-ui-states.json', import.meta.url)))
    .digest('hex');
const locale = JSON.parse(readFileSync(new URL('../../public/locales/zh-CN/game-dicethrone.json', import.meta.url), 'utf8'));

const toastMessage = (page: Page, message: string | RegExp) => page
    .getByRole('button', { name: '关闭', exact: true }).locator('xpath=..')
    .getByText(message, { exact: typeof message === 'string' });

async function dragCardToPlay(page: Page, card: Locator) {
    const box = await card.boundingBox();
    if (!box) throw new Error('手牌不可见');
    const x = box.x + box.width / 2;
    const y = box.y + box.height * 0.78;
    await page.mouse.move(x, y);
    await page.mouse.down();
    await page.mouse.move(x, y - 240, { steps: 12 });
    await page.mouse.up();
}

async function captureToast(
    page: Page, info: TestInfo, name: string, message: string | RegExp,
    action: string, trigger: () => Promise<void>, readState: () => Promise<object>,
) {
    const text = toastMessage(page, message);
    await expect(page.locator('[data-testid="hand-area"] [data-is-flipped="false"]')).toHaveCount(0);
    await expect(page.getByTestId('spotlight-container-root')).toBeHidden();
    await expect(text).toBeHidden();
    const before = await readState();
    await trigger();
    await expect(text).toBeVisible();
    await page.mouse.move(page.viewportSize()!.width / 2, 2);
    await expect.poll(() => text.evaluate((element) => Number(getComputedStyle(element.parentElement!.parentElement!).opacity))).toBe(1);
    const stagingDir = resolve('test-results/evidence-screenshots/dicethrone/unavailable-action/_temporary',
        process.env.PW_E2E_SESSION_ID ?? 'direct', String(info.retry));
    await mkdir(stagingDir, { recursive: true });
    const buffer = await page.screenshot({ path: resolve(stagingDir, name + '.png') });
    const after = await readState();
    expect(after).toEqual(before);
    const toast = await text.textContent();
    const { sourceRevision, runtimeId, sourceIdentity } = await captureEvidenceSourceIdentity(page, 'dicethrone');
    await writeFile(resolve(stagingDir, name + '.json'), JSON.stringify({
        sourceRevision, runtimeId, sourceIdentity, viewport: page.viewportSize(),
        captureContract: { sha256: captureContractSha },
        sha256: createHash('sha256').update(buffer).digest('hex'),
        action,
        before: { visible: { url: page.url(), toast: false }, authoritative: before },
        after: { visible: { url: page.url(), toast }, authoritative: after },
        assertions: [{ name: '操作被拒绝后相关对局状态保持一致', actual: after, expected: before }],
    }, null, 2));
}

test('代表态：非使用时机点击飞行标记显示时机且不消耗', async ({ page, game }, info) => {
    await game.openTestGame('dicethrone');
    await game.setupScene({
        gameId: 'dicethrone', player0: { tokens: { flight: 1 }, resources: { CP: 3, HP: 50 } },
        player1: { hand: [], resources: { HP: 50 } }, currentPlayer: '0', phase: 'main1',
        extra: { selectedCharacters: { '0': 'tianshi', '1': 'monk' }, hostStarted: true },
    });
    await captureToast(page, info, 'flight', locale.error.invalid_token_timing,
        '主要阶段点击飞行标记', () => page.getByTestId('dt-player-0-token-flight').click(),
        async () => ({ flight: (await game.getState()).core.players['0'].tokens.flight }));
    expect((await game.getState()).core.players['0'].tokens.flight).toBe(1);
});

test('代表态：能防御的伤害不能发动隐形', async ({ page, game }, info) => {
    await game.openTestGame('dicethrone');
    await game.setupScene({
        gameId: 'dicethrone',
        player0: { tokens: { invisible: 1 }, resources: { HP: 50 } },
        player1: { hand: [], resources: { HP: 50 } }, currentPlayer: '1', phase: 'defensiveRoll',
        extra: {
            selectedCharacters: { '0': 'zhizhuxia', '1': 'monk' }, hostStarted: true,
            pendingDamage: {
                id: 'defendable-damage', sourcePlayerId: '1', targetPlayerId: '0',
                originalDamage: 4, currentDamage: 4, responseType: 'beforeDamageReceived',
                responderId: '0', isFullyEvaded: false, unblockable: false,
            },
        },
    });
    await captureToast(page, info, 'response', '这个标记只能用于不可防御的伤害',
        '受到可防御伤害时点击隐形标记', () => page.getByTestId('dt-player-0-token-invisible').click(),
        async () => {
            const state = await game.getState();
            return { invisible: state.core.players['0'].tokens.invisible, damage: state.core.pendingDamage?.currentDamage };
        });
});

test('代表态：没有可净化目标时点击净化', async ({ page, game }, info) => {
    await game.openTestGame('dicethrone');
    await game.setupScene({
        gameId: 'dicethrone', player0: { tokens: { purify: 1 }, resources: { CP: 3, HP: 50 } },
        player1: { hand: [], resources: { HP: 50 } }, currentPlayer: '0', phase: 'main1',
        extra: { selectedCharacters: { '0': 'tianshi', '1': 'monk' }, hostStarted: true },
    });
    await captureToast(page, info, 'purify', locale.purify.noDebuffs,
        '没有负面状态时点击净化', () => page.getByTestId('dt-player-0-token-purify').click(),
        async () => ({ purify: (await game.getState()).core.players['0'].tokens.purify }));
});

test('代表态：点击升级牌只看牌，拖出失败才提示', async ({ page, game }, info) => {
    await game.openTestGame('dicethrone');
    await game.setupScene({
        gameId: 'dicethrone',
        player0: {
            hand: ['upgrade-tianshi-supreme-power-2-gospel-arrival'],
            resources: { CP: 3, HP: 50 },
        },
        player1: { hand: [], resources: { HP: 50 } },
        currentPlayer: '0',
        phase: 'offensiveRoll',
        extra: { selectedCharacters: { '0': 'tianshi', '1': 'monk' }, hostStarted: true },
    });

    const card = page.locator('[data-testid="hand-area"] [data-card-id="upgrade-tianshi-supreme-power-2-gospel-arrival"]').first();
    await expect(card).toBeVisible();
    await expect(card).toHaveAttribute('data-is-flipped', 'true');
    await card.click();
    const inspect = page.getByTestId('board-magnify-overlay');
    await expect(inspect).toBeVisible();
    await expect(toastMessage(page, locale.error.wrongPhaseForUpgrade)).toHaveCount(0);
    await inspect.click({ position: { x: 10, y: 80 } });
    await expect(inspect).toBeHidden();
    await captureToast(page, info, 'upgrade', locale.error.wrongPhaseForUpgrade,
        '进攻掷骰阶段尝试拖出升级牌', () => dragCardToPlay(page, card), async () => {
            const player = (await game.getState()).core.players['0'];
            return { cp: player.resources.cp, hand: player.hand.map((item: { id: string }) => item.id) };
        });
    const state = await game.getState();
    expect(state.core.players['0'].resources.cp).toBe(3);
    expect(state.core.players['0'].hand.some((item: { id: string }) => item.id === 'upgrade-tianshi-supreme-power-2-gospel-arrival')).toBe(true);
});

test('代表态：费用不足拖出行动牌时提示且保留手牌', async ({ page, game }, info) => {
    await game.openTestGame('dicethrone');
    await game.setupScene({
        gameId: 'dicethrone', player0: { hand: ['card-tianshi-holy-strike'], resources: { CP: 0, HP: 50 } },
        player1: { hand: [], resources: { HP: 50 } }, currentPlayer: '0', phase: 'offensiveRoll',
        extra: { selectedCharacters: { '0': 'tianshi', '1': 'monk' }, hostStarted: true },
    });
    const card = page.locator('[data-testid="hand-area"] [data-card-id="card-tianshi-holy-strike"]').first();
    await expect(card).toBeVisible();
    await captureToast(page, info, 'card-cost', 'CP不足', '战斗点数不足时拖动打出行动牌', () => dragCardToPlay(page, card), async () => {
        const player = (await game.getState()).core.players['0'];
        return { cp: player.resources.cp, hand: player.hand.map((item: { id: string }) => item.id) };
    });
    const state = await game.getState();
    expect(state.core.players['0'].resources.cp).toBe(0);
    expect(state.core.players['0'].hand.some((item: { id: string }) => item.id === 'card-tianshi-holy-strike')).toBe(true);
});

test('代表态：战斗点数不足时点击击倒会说明解除费用', async ({ page, game }, info) => {
    await game.openTestGame('dicethrone');
    await game.setupScene({
        gameId: 'dicethrone',
        player0: { statusEffects: { knockdown: 1 }, resources: { CP: 1, HP: 50 } },
        player1: { hand: [], resources: { HP: 50 } }, currentPlayer: '0', phase: 'main1',
        extra: { selectedCharacters: { '0': 'tianshi', '1': 'monk' }, hostStarted: true },
    });
    await captureToast(page, info, 'knockdown', '解除击倒需要 2 点战斗点数',
        '战斗点数不足时点击击倒标记', () => page.getByTestId('dt-player-0-status-knockdown').click(),
        async () => {
            const player = (await game.getState()).core.players['0'];
            return { cp: player.resources.cp, knockdown: player.statusEffects.knockdown };
        });
    const state = await game.getState();
    expect(state.core.players['0'].statusEffects.knockdown).toBe(1);
    expect(state.core.players['0'].resources.cp).toBe(1);
});
