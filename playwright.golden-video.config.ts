import { defineConfig } from '@playwright/test';
import baseConfig from './playwright.config';

const baseProjects = Array.isArray(baseConfig.projects) ? baseConfig.projects : [];

function resolveGoldenLaunchOptions(project: (typeof baseProjects)[number]) {
    const launchOptions = project.use?.launchOptions;
    const args = Array.isArray(launchOptions?.args)
        ? launchOptions.args.filter((arg) => arg !== '--disable-gpu')
        : undefined;
    return {
        ...launchOptions,
        ...(args ? { args } : {}),
    };
}

export default defineConfig({
    ...baseConfig,
    outputDir: './test-results/video-capture/golden-flow-20260924',
    preserveOutput: 'always',
    use: {
        ...baseConfig.use,
        // 黄金录屏必须使用真实 GPU 渲染；Windows 无头基线会注入
        // --disable-gpu，导致 WebGL 效果骰和攻击 FX 在录制时掉帧/丢失。
        headless: false,
        // 黄金录屏由 online-runtime.e2e.ts 显式创建的 host context 独占。
        // 关闭 Playwright fixture 录制，避免同一轮出现第二个编码器。
        video: 'off',
    },
    projects: baseProjects.map((project) => ({
        ...project,
        use: {
            ...project.use,
            headless: false,
            launchOptions: resolveGoldenLaunchOptions(project),
            viewport: { width: 1600, height: 900 },
            video: 'off',
        },
    })),
});
