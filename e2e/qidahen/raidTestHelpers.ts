import { expect, type Page } from '@playwright/test';
import { getQidahenRuntimeRegionAnchorTargetPoint } from '../../src/games/qidahen/ui/mapGraph';

/** 在当前地图变换下通过真实鼠标点击突袭候选。 */
export async function clickRaidRegion(page: Page, regionId: string): Promise<void> {
    const overlay = page.getByTestId('qidahen-map-region-mask-overlay');
    await expect(overlay).toHaveAttribute('data-qidahen-candidate-region-ids', /.+/);
    const candidates = (await overlay.getAttribute('data-qidahen-candidate-region-ids'))?.split('|') ?? [];
    expect(candidates, `突袭候选应包含 ${regionId}`).toContain(regionId);
    const point = getQidahenRuntimeRegionAnchorTargetPoint(regionId);
    if (!point) throw new Error(`地区 ${regionId} 缺少地图落点`);
    const content = page.getByTestId('qidahen-map-content');
    const bounds = await content.boundingBox();
    const size = await content.evaluate(element => ({ width: element.offsetWidth, height: element.offsetHeight }));
    if (!bounds) throw new Error('地图缺少可点击边界');
    await page.mouse.click(bounds.x + point.x * bounds.width / size.width, bounds.y + point.y * bounds.height / size.height);
}

/** 点击手牌露出且没有被遮挡的区域，再提交支付。 */
export async function payRaidCards(page: Page, count: number): Promise<void> {
    const cards = page.locator('button[data-testid^="qidahen-hand-card-"]:not([data-testid^="qidahen-hand-card-magnify-"])');
    const used = new Set<string>();
    for (let index = 0; index < count; index += 1) {
        await expect(cards.first()).toBeVisible({ timeout: 15000 });
        let selected = false;
        for (let cardIndex = 0; cardIndex < await cards.count(); cardIndex += 1) {
            const card = cards.nth(cardIndex);
            const id = await card.getAttribute('data-testid');
            if (!id || used.has(id) || !(await card.isEnabled())) continue;
            const point = await card.evaluate(element => {
                const rect = element.getBoundingClientRect();
                for (const yRatio of [0.08, 0.15, 0.25, 0.35]) {
                    for (const xRatio of [0.5, 0.25, 0.75]) {
                        const x = rect.left + rect.width * xRatio, y = rect.top + rect.height * yRatio;
                        if (x < 0 || y < 0 || x >= innerWidth || y >= innerHeight) continue;
                        const hit = document.elementFromPoint(x, y);
                        if (hit && (hit === element || element.contains(hit))) return { x: rect.width * xRatio, y: rect.height * yRatio };
                    }
                }
                return null;
            });
            if (!point) continue;
            await card.click({ position: point, timeout: 15000 });
            used.add(id);
            selected = true;
            break;
        }
        expect(selected, '至少一张支付手牌的露出部分应能接收真实鼠标点击').toBe(true);
    }
    const confirm = page.getByTestId('qidahen-action-payment-confirm');
    await expect(confirm).toBeEnabled({ timeout: 15000 });
    await confirm.click();
}
