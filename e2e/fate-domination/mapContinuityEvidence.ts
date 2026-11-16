import { writeFile } from 'node:fs/promises';
import type { Page } from '@playwright/test';

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
