import { writeFile } from 'node:fs/promises';
import type { Locator, Page } from '@playwright/test';

export function fateMapCardHitAreasAreClear(cards: Locator) {
    return cards.evaluateAll(nodes => nodes.length > 0 && nodes.every(card => {
        const rect = card.getBoundingClientRect();
        return [.12, .5, .88].every(x => [.12, .5, .88].every(y => {
            const hit = document.elementFromPoint(rect.left + rect.width * x, rect.top + rect.height * y);
            return card.contains(hit) || hit?.closest('.fd-map-target-shell,.fd-map-exposed-event') === card.parentElement;
        }));
    }));
}

/** Capture Chromium's composited board frames, with original capture timestamps. */
export async function sampleFateMapMotion(page: Page, destination: string, action: () => Promise<void>) {
    const cdp = await page.context().newCDPSession(page);
    const frames: Array<{ timestamp: number; jpeg: string }> = [];
    cdp.on('Page.screencastFrame', ({ data, metadata, sessionId }) => {
        if (metadata.timestamp !== undefined) frames.push({ timestamp: metadata.timestamp, jpeg: data });
        void cdp.send('Page.screencastFrameAck', { sessionId }).catch(() => undefined);
    });
    try {
        await cdp.send('Page.startScreencast', { format: 'jpeg', quality: 78, maxWidth: 900, maxHeight: 550 });
        await action();
    } finally {
        await cdp.send('Page.stopScreencast');
        await cdp.detach();
    }
    if (frames.length < 6) throw new Error(`地图连续记录只有 ${frames.length} 帧: ${destination}`);
    await writeFile(destination, JSON.stringify(frames));
    return frames.length;
}
