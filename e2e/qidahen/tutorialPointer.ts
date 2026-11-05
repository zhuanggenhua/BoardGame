import { expect, type Page } from '@playwright/test';

export async function clickVisibleButton(page: Page, testId: string) {
    const button = page.getByTestId(testId);
    await expect(button).toBeVisible(); await expect(button).toBeEnabled();
    // 使用原生可操作性等待与鼠标输入，避免位置测量与点击之间浮层重新布局。
    // 不允许 force / dispatchEvent；遮挡、越界或持续运动仍由 Playwright 拒绝。
    await button.click();
}
