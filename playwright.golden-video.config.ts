import { defineConfig } from '@playwright/test';
import baseConfig from './playwright.config';

const baseProjects = Array.isArray(baseConfig.projects) ? baseConfig.projects : [];

export default defineConfig({
    ...baseConfig,
    outputDir: './test-results/video-capture/golden-flow-20260924',
    preserveOutput: 'always',
    use: {
        ...baseConfig.use,
        video: {
            mode: 'on',
            size: { width: 1600, height: 900 },
        },
    },
    projects: baseProjects.map((project) => ({
        ...project,
        use: {
            ...project.use,
            viewport: { width: 1600, height: 900 },
            video: {
                mode: 'on',
                size: { width: 1600, height: 900 },
            },
        },
    })),
});
