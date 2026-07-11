#!/usr/bin/env node

console.error(
    'sync-active-r2-assets.mjs 已退役：当前线上素材源只允许服务器发布和服务器读取。'
    + ' 请使用 npm run assets:upload 或 scripts/assets/apply-server-asset-publish.mjs。',
);
process.exitCode = 1;
