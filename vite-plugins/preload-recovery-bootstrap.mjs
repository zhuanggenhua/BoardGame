import { readFileSync } from 'node:fs';

const bootstrapSource = readFileSync(new URL('../src/lib/preloadRecoveryBootstrap.js', import.meta.url), 'utf8');

export function preloadRecoveryBootstrapPlugin() {
    return {
        name: 'preload-recovery-bootstrap',
        transformIndexHtml: {
            order: 'pre',
            handler: () => [{ tag: 'script', children: bootstrapSource, injectTo: 'head-prepend' }],
        },
    };
}
