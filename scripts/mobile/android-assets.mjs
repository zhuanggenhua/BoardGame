import { existsSync, mkdirSync, writeFileSync } from 'node:fs';
import path from 'node:path';

const launcherIconSizes = {
    mdpi: 48,
    hdpi: 72,
    xhdpi: 96,
    xxhdpi: 144,
    xxxhdpi: 192,
};

const adaptiveForegroundSizes = {
    mdpi: 108,
    hdpi: 162,
    xhdpi: 216,
    xxhdpi: 324,
    xxxhdpi: 432,
};

const splashPortraitSizes = {
    mdpi: [320, 480],
    hdpi: [480, 800],
    xhdpi: [720, 1280],
    xxhdpi: [960, 1600],
    xxxhdpi: [1280, 1920],
};

const splashLandscapeSizes = {
    mdpi: [480, 320],
    hdpi: [800, 480],
    xhdpi: [1280, 720],
    xxhdpi: [1600, 960],
    xxxhdpi: [1920, 1280],
};

const defaultIconSource = 'public/logos/logo_1_grid.png';
const defaultSplashSource = 'public/logos/logo_1_grid.png';
const defaultIconBackground = '#FFFFFF';
const defaultSplashBackground = '#FFFFFF';
const defaultIconInsetRatio = 0.68;
const defaultAdaptiveInsetRatio = 0.72;
const defaultSplashLogoRatio = 0.34;

const ensureSharp = async () => {
    try {
        const module = await import('sharp');
        return module.default;
    } catch (error) {
        throw new Error(
            `未找到 sharp，无法生成 Android 图标和启动图。请先安装依赖后再重试。${error instanceof Error ? ` ${error.message}` : ''}`,
        );
    }
};

const clampRatio = (value, fallback) => {
    const parsed = Number(value);
    if (!Number.isFinite(parsed)) return fallback;
    if (parsed <= 0.1 || parsed >= 0.95) return fallback;
    return parsed;
};

const resolveSourcePath = (rootDir, inputPath, fallbackPath) => {
    const rawPath = inputPath?.trim() || fallbackPath;
    const fullPath = path.isAbsolute(rawPath) ? rawPath : path.join(rootDir, rawPath);
    if (!existsSync(fullPath)) {
        throw new Error(`未找到资源源文件: ${path.relative(rootDir, fullPath)}`);
    }
    return fullPath;
};

const writeBuffer = async (filePath, bufferPromise) => {
    mkdirSync(path.dirname(filePath), { recursive: true });
    writeFileSync(filePath, await bufferPromise);
};

const createTransparentLayer = async (sharp, sourcePath, canvasSize, insetRatio) => {
    const logoSize = Math.max(1, Math.round(canvasSize * insetRatio));
    const logoBuffer = await sharp(sourcePath)
        .resize(logoSize, logoSize, {
            fit: 'contain',
            background: { r: 0, g: 0, b: 0, alpha: 0 },
        })
        .png()
        .toBuffer();

    return sharp({
        create: {
            width: canvasSize,
            height: canvasSize,
            channels: 4,
            background: { r: 0, g: 0, b: 0, alpha: 0 },
        },
    })
        .composite([{ input: logoBuffer, gravity: 'center' }])
        .png()
        .toBuffer();
};

const createSquareIcon = async (sharp, sourcePath, size, insetRatio, background) => {
    const logoSize = Math.max(1, Math.round(size * insetRatio));
    const logoBuffer = await sharp(sourcePath)
        .resize(logoSize, logoSize, {
            fit: 'contain',
            background: { r: 0, g: 0, b: 0, alpha: 0 },
        })
        .png()
        .toBuffer();

    return sharp({
        create: {
            width: size,
            height: size,
            channels: 4,
            background,
        },
    })
        .composite([{ input: logoBuffer, gravity: 'center' }])
        .png()
        .toBuffer();
};

const createSplash = async (sharp, sourcePath, width, height, logoRatio, background) => {
    const logoSize = Math.max(1, Math.round(Math.min(width, height) * logoRatio));
    const logoBuffer = await sharp(sourcePath)
        .resize(logoSize, logoSize, {
            fit: 'contain',
            background: { r: 0, g: 0, b: 0, alpha: 0 },
        })
        .png()
        .toBuffer();

    return sharp({
        create: {
            width,
            height,
            channels: 4,
            background,
        },
    })
        .composite([{ input: logoBuffer, gravity: 'center' }])
        .png()
        .toBuffer();
};

export const getAndroidBrandAssetConfig = ({ rootDir, env = process.env }) => ({
    iconSourcePath: resolveSourcePath(rootDir, env.ANDROID_ICON_SOURCE, defaultIconSource),
    splashSourcePath: resolveSourcePath(rootDir, env.ANDROID_SPLASH_SOURCE, defaultSplashSource),
    iconBackground: env.ANDROID_ICON_BACKGROUND?.trim() || defaultIconBackground,
    splashBackground: env.ANDROID_SPLASH_BACKGROUND?.trim() || defaultSplashBackground,
    iconInsetRatio: clampRatio(env.ANDROID_ICON_INSET_RATIO, defaultIconInsetRatio),
    adaptiveInsetRatio: clampRatio(env.ANDROID_ADAPTIVE_ICON_INSET_RATIO, defaultAdaptiveInsetRatio),
    splashLogoRatio: clampRatio(env.ANDROID_SPLASH_LOGO_RATIO, defaultSplashLogoRatio),
});

export const generateAndroidBrandAssets = async ({
    rootDir,
    androidDir,
    env = process.env,
}) => {
    const sharp = await ensureSharp();
    const config = getAndroidBrandAssetConfig({ rootDir, env });
    const resDir = path.join(androidDir, 'app', 'src', 'main', 'res');

    for (const [density, size] of Object.entries(adaptiveForegroundSizes)) {
        const outputPath = path.join(resDir, `mipmap-${density}`, 'ic_launcher_foreground.png');
        await writeBuffer(
            outputPath,
            createTransparentLayer(sharp, config.iconSourcePath, size, config.adaptiveInsetRatio),
        );
    }

    for (const [density, size] of Object.entries(launcherIconSizes)) {
        const launcherPath = path.join(resDir, `mipmap-${density}`, 'ic_launcher.png');
        const roundPath = path.join(resDir, `mipmap-${density}`, 'ic_launcher_round.png');
        const iconBuffer = createSquareIcon(
            sharp,
            config.iconSourcePath,
            size,
            config.iconInsetRatio,
            config.iconBackground,
        );

        await writeBuffer(launcherPath, iconBuffer);
        await writeBuffer(
            roundPath,
            createSquareIcon(
                sharp,
                config.iconSourcePath,
                size,
                config.iconInsetRatio,
                config.iconBackground,
            ),
        );
    }

    writeFileSync(
        path.join(resDir, 'values', 'ic_launcher_background.xml'),
        `<?xml version="1.0" encoding="utf-8"?>
<resources>
    <color name="ic_launcher_background">${config.iconBackground}</color>
</resources>
`,
        'utf8',
    );

    await writeBuffer(
        path.join(resDir, 'drawable', 'splash.png'),
        createSplash(sharp, config.splashSourcePath, 480, 320, config.splashLogoRatio, config.splashBackground),
    );

    for (const [density, [width, height]] of Object.entries(splashPortraitSizes)) {
        const outputPath = path.join(resDir, `drawable-port-${density}`, 'splash.png');
        await writeBuffer(
            outputPath,
            createSplash(sharp, config.splashSourcePath, width, height, config.splashLogoRatio, config.splashBackground),
        );
    }

    for (const [density, [width, height]] of Object.entries(splashLandscapeSizes)) {
        const outputPath = path.join(resDir, `drawable-land-${density}`, 'splash.png');
        await writeBuffer(
            outputPath,
            createSplash(sharp, config.splashSourcePath, width, height, config.splashLogoRatio, config.splashBackground),
        );
    }

    return config;
};
