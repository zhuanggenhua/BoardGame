import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { mergeConfig } from 'vitest/config';
import baseConfig from './vitest.config.ts';

const root = fileURLToPath(new URL('.', import.meta.url));

export default mergeConfig(baseConfig, {
    cacheDir: path.join(root, '.isolated-vite-cache'),
    test: {
        include: [
            'security-red-tests/**/*.test.ts',
            'src/games/betrayal/__tests__/actionLogUndo.test.ts',
            'src/engine/ai/__tests__/playerView.test.ts',
        ],
        coverage: { enabled: false },
    },
});
