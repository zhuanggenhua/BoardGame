import { expect, type Page } from '@playwright/test';

export async function clickVisibleButton(page: Page, testId: string) {
    const button = page.getByTestId(testId);
    await expect(button).toBeVisible(); await expect(button).toBeEnabled();
    const rect = (await button.boundingBox())!;
    const point = { x: rect.x + rect.width / 2, y: rect.y + rect.height / 2 };
    expect(point.x).toBeGreaterThan(0); expect(point.x).toBeLessThan(page.viewportSize()!.width);
    expect(point.y).toBeGreaterThan(0); expect(point.y).toBeLessThan(page.viewportSize()!.height);
    await expect.poll(() => button.evaluate((element, p) => element.contains(document.elementFromPoint(p.x, p.y)), point)).toBe(true);
    await page.mouse.click(point.x, point.y);
}
