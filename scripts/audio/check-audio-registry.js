#!/usr/bin/env node

console.error(
  'check-audio-registry.js 已退役：音频注册表不再通过对象存储直查验收。'
  + ' 请使用 npm run audio:verify，并通过 npm run assets:upload / npm run assets:check 走服务器资源主源。',
);
process.exitCode = 1;
