#!/usr/bin/env node

console.error(
  'download-from-r2.js 已退役：当前线上素材源是服务器。'
  + ' 请使用 npm run assets:download 查看服务器素材同步说明。',
);
process.exitCode = 1;
