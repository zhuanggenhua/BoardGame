import { dragQidahenMap } from './mapPointer';
import { expect, type Page } from '@playwright/test';
const read = (page: Page) => page.evaluate(() => ({ core: (window as any).__BG_TEST_HARNESS__.state.get().core }));

/** 用真实鼠标验证地图候选可恢复，不改对局或选择。 */
export async function verifyQidahenMapCandidateRecovery(page: Page, onRecovered: () => Promise<void>) {
    const recommended = page.locator('[data-qidahen-tutorial-recommended="true"]').first();
    const assertRecommendedReadable = async () => {
        await expect(recommended).toBeInViewport({ ratio: 1 });
        await expect.poll(() => recommended.evaluate(node => {
            const box = node.getBoundingClientRect();
            return node.contains(document.elementFromPoint(box.left + box.width / 2, box.top + box.height / 2));
        }), { message: 'the recommended unit is fully visible and hit-testable' }).toBe(true);
    };
    await assertRecommendedReadable();
                        const plan = await page.evaluate(() => {
                            const rect = (node: Element) => node.getBoundingClientRect();
                            const hud = ['qidahen-hand-zone', 'qidahen-hand-interaction-tray', 'qidahen-player-float',
                                'qidahen-korea-zone', 'qidahen-chronology-zone', 'qidahen-draw-anchor', 'qidahen-discard-anchor',
                                'qidahen-action-slot', 'tutorial-overlay-card'];
                            const blockers = hud.flatMap(id => [...document.querySelectorAll(`[data-testid="${id}"]`)]).map(rect);
                            const intersects = (a: {left:number;top:number;right:number;bottom:number}, b: DOMRect) => a.left < b.right && a.right > b.left && a.top < b.bottom && a.bottom > b.top;
                            const candidates = [...document.querySelectorAll('[data-pending-committed-selectable="true"]')];
                            const cards = [...document.querySelectorAll('[data-testid^="qidahen-hand-card-shell-"]')].map(rect);
                            const buried = candidates.find(node => !node.hasAttribute('data-qidahen-tutorial-recommended')
                                && rect(node).left > 0 && rect(node).right < innerWidth && rect(node).top < innerHeight
                                && cards.some(card => intersects(rect(node), card)));
                            if (!buried) return null;
                            const box = rect(buried);
                            for (const y of [innerHeight * .78, innerHeight * .5, innerHeight * .4]) for (const x of [innerWidth * .8, innerWidth * .25, innerWidth * .7]) {
                                const target = { left: x - box.width / 2 - 8, right: x + box.width / 2 + 8,
                                    top: y - box.height / 2 - 8, bottom: y + box.height / 2 + 8 };
                                const dx = x - box.left - box.width / 2, dy = y - box.top - box.height / 2;
                                const mapAt = (x: number, y: number) => Boolean(document.elementFromPoint(x,y)?.closest('[data-testid="qidahen-map-layer"]'));
                                if (blockers.some(blocker => intersects(target, blocker))
                                    || !mapAt(x,y) || !mapAt(target.left,target.top) || !mapAt(target.right,target.bottom)) continue;
                                return { id: buried.getAttribute('data-testid')!, dx, dy };
                            }
                            throw new Error('No visible map space to recover a candidate');
                        });
                        if (plan) {
                            const coreBeforePan = (await read(page)).core;
                            const layer = page.getByTestId('qidahen-map-layer');
                            const view = () => layer.evaluate(node => ({
                                x: Number(node.getAttribute('data-map-pan-x')),
                                y: Number(node.getAttribute('data-map-pan-y')),
                                zoom: Number(node.getAttribute('data-map-zoom')),
                                selected: [...document.querySelectorAll('[data-pending-committed-selected="true"]')]
                                    .map(unit => unit.getAttribute('data-testid')).sort(),
                            }));
                            const originalView = await view();
                            await dragQidahenMap(page, plan.dx, plan.dy);
                            const unit = page.getByTestId(plan.id);
                            console.info('MAP_RECOVERY', JSON.stringify({ plan, originalView, actualView: await view(), unit: await unit.boundingBox() }));
                            await expect.poll(() => unit.evaluate(node => {
                                const box = node.getBoundingClientRect(); return node.contains(document.elementFromPoint(box.left + box.width / 2, box.top + box.height / 2));
                            }), { message: 'a map candidate behind the hand can be recovered and hit by real panning' }).toBe(true);
                            await onRecovered();
                            expect((await read(page)).core, 'viewing another candidate does not change rules or selections').toEqual(coreBeforePan);
                            expect((await view()).selected, 'viewing another candidate preserves selected units').toEqual(originalView.selected);
                            await dragQidahenMap(page, -plan.dx, -plan.dy);
                            // 浏览器鼠标坐标以整像素投递，两次相反拖动允许不到两像素的取整差。
                            await expect.poll(async () => Math.abs((await view()).x - originalView.x)).toBeLessThan(2);
                            await expect.poll(async () => Math.abs((await view()).y - originalView.y)).toBeLessThan(2);
                            const returnedView = await view();
                            expect(returnedView.zoom).toBe(originalView.zoom);
                            expect(returnedView.selected).toEqual(originalView.selected);
                            await assertRecommendedReadable();
                            expect((await read(page)).core).toEqual(coreBeforePan);
                            return true;
                        }
    return false;
}
