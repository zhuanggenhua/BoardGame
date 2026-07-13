/**
 * 服务器素材源是线上真相源。本脚本保留 assets:download 入口，避免协作者命令断裂。
 * 当前不从服务器反向同步全量素材；本地缺素材时仍使用代码仓库内 public/assets 和线上域名访问。
 */

console.log('服务器素材源已接管线上访问；assets:download 当前无需从对象存储下载。');
console.log('如需补齐本地素材，请从项目约定的素材归档或服务器 release 执行一次性运维同步。');
