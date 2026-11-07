import { writeFileSync } from 'node:fs';
import type { Page } from '@playwright/test';

/** 只记录对象地址的真实生命周期，不读取二进制或改变错误处理。 */
export async function trackQidahenBlobUrls(page: Page, outputPath: string) {
    const documents: unknown[] = [];
    const failures: unknown[] = [];
    await page.exposeFunction('__qidahenBlobDiagnostic', (entry: unknown) => { documents.push(entry); });
    await page.addInitScript(() => {
        const report = (entry: object) => {
            void (window as unknown as { __qidahenBlobDiagnostic: (value: object) => Promise<void> })
                .__qidahenBlobDiagnostic({ document: location.href, at: Date.now(), ...entry });
        };
        const create = URL.createObjectURL.bind(URL);
        const revoke = URL.revokeObjectURL.bind(URL);
        URL.createObjectURL = value => {
            const url = create(value);
            report({ event: 'create', url, type: value instanceof Blob ? value.type : 'MediaSource',
                size: value instanceof Blob ? value.size : null, stack: new Error().stack });
            return url;
        };
        URL.revokeObjectURL = url => {
            const consumers = [...document.images].filter(image => image.src === url || image.currentSrc === url)
                .map(image => ({ testId: image.closest('[data-testid]')?.getAttribute('data-testid'),
                    complete: image.complete, naturalWidth: image.naturalWidth }));
            report({ event: 'revoke', url, consumers, stack: new Error().stack });
            revoke(url);
        };
        addEventListener('error', event => {
            const image = event.target;
            if (image instanceof HTMLImageElement && (image.currentSrc || image.src).startsWith('blob:')) {
                report({ event: 'image-error', url: image.currentSrc || image.src,
                    testId: image.closest('[data-testid]')?.getAttribute('data-testid') });
            }
        }, true);
    });
    page.on('requestfailed', request => {
        if (request.url().startsWith('blob:')) failures.push({ at: Date.now(), url: request.url(), failure: request.failure() });
    });
    return () => writeFileSync(outputPath, JSON.stringify({ documents, failures }, null, 2));
}
