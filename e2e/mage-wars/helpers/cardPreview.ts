import { expect, type Locator } from '@playwright/test';

export async function expectReadableMageWarsPreview(preview: Locator) {
    const image = preview.locator('img[data-card-atlas-img="true"]').first();
    await expect(image).toBeVisible();
    await expect.poll(() => image.evaluate((element: HTMLImageElement) => element.complete && element.naturalWidth > 0)).toBe(true);
    await expect.poll(() => preview.evaluate((element) => {
        const bounds = element.getBoundingClientRect();
        return [0.2, 0.5, 0.8].every((fraction) => element.contains(document.elementFromPoint(
            bounds.left + bounds.width * fraction,
            bounds.top + bounds.height * 0.08,
        )));
    })).toBe(true);
}
