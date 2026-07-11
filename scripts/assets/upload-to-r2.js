#!/usr/bin/env node

console.error(
  'upload-to-r2.js 已退役：当前素材发布只允许走服务器源。'
  + ' 请使用 npm run assets:upload，它会调用 scripts/assets/upload-to-server.js。',
);
process.exitCode = 1;
