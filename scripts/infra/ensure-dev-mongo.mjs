import { execSync } from 'node:child_process';

try {
  execSync('docker compose up -d mongodb', { stdio: 'inherit' });
} catch (error) {
  const message = error instanceof Error ? error.message : String(error);
  console.warn('[Dev] 跳过自动启动 MongoDB：Docker 不可用或无权限。');
  console.warn(`[Dev] 详细信息：${message}`);
  console.warn('[Dev] 如需本地数据库，请手动执行 `docker compose up -d mongodb` 或使用现有 MONGO_URI。');
}
