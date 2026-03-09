process.env.PW_WORKERS ??= '3';

const { default: config } = await import('./playwright.config');

export default config;
