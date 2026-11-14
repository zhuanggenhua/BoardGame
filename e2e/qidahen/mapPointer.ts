import type { Page } from '@playwright/test';

/** 真实鼠标平移并缓慢收尾，避免把甩动惯性当作精确返程。 */
export async function dragQidahenMap(page: Page, dx: number, dy: number) {
    if (Math.hypot(dx, dy) < 1) return;

    const start = await page.evaluate(({ dx, dy }) => {
        const points: Array<{ x: number; y: number }> = [];
        for (let y = 90; y < innerHeight - 120; y += 32) for (let x = 10; x < innerWidth - 10; x += 32) points.push({ x, y });
        points.sort((a, b) => Math.hypot(a.x - innerWidth / 2, a.y - innerHeight / 2)
            - Math.hypot(b.x - innerWidth / 2, b.y - innerHeight / 2));
        for (const { x, y } of points) {
            if (x + dx < 10 || x + dx > innerWidth - 10 || y + dy < 90 || y + dy > innerHeight - 120) continue;
            const hit = document.elementFromPoint(x, y);
            if (hit?.closest('[data-testid="qidahen-map-layer"]') && !hit.closest('button,[role="button"],[data-qidahen-map-token-region]')) return { x,y };
        }
        throw new Error('No unobstructed map drag origin');
    }, { dx,dy });
    await page.mouse.move(start.x, start.y); await page.mouse.down();
    const distance = Math.hypot(dx, dy);
    const tail = Math.min(8, distance);
    const unit = { x: dx / distance, y: dy / distance };
    await page.mouse.move(start.x + dx - unit.x * tail, start.y + dy - unit.y * tail, { steps: 12 });
    // 用真实小步减速结束拖拽，避免把带惯性的甩动当成精确返程。
    for (let remaining = tail - 1; remaining >= 0; remaining--) {
        await page.waitForTimeout(80);
        await page.mouse.move(start.x + dx - unit.x * remaining, start.y + dy - unit.y * remaining);
    }
    await page.mouse.up();

}
