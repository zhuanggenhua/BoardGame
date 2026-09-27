import { defineConfig } from '@playwright/test';
import baseConfig from './playwright.config';

export default defineConfig({
  ...baseConfig,
  outputDir: './test-results/video-capture/betrayal-small-robot-20260925',
  preserveOutput: 'always',
  globalSetup: undefined,
  globalTeardown: undefined,
  use: {
    ...baseConfig.use,
    video: 'on',
    trace: 'retain-on-failure',
  },
  projects: (Array.isArray(baseConfig.projects) ? baseConfig.projects : []).map((project) => ({
    ...project,
    use: {
      ...project.use,
      video: 'on',
    },
  })),
});
