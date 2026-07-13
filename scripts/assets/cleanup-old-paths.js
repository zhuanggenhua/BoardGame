console.error(
  'cleanup-old-paths.js 已退役：它曾直接清理对象存储旧路径，当前线上素材链路已彻底切到服务器。'
  + ' 如需清理服务器旧 release，请先列出 /home/admin/storage/assets/releases 并确认保留策略。',
);
process.exitCode = 1;
