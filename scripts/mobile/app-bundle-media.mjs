// 软件包只保留首页必需的平台素材；游戏素材由独立资源链提供。
export const APP_HOME_MEDIA_PATHS = new Set([
  'logos/logo_1_grid.png',
  'logos/logo_1_grid.svg',
  'logos/weixin.jpg',
  'logos/zhifubao.jpg',
  'assets/common/images/home-v2/book-catalog-wide/compressed/1.webp',
]);

const MEDIA_EXTENSION = /\.(?:png|jpe?g|webp|gif|svg|avif|bmp|ico|apng|mp3|ogg|wav|m4a|aac|flac|mp4|webm|glb|gltf|fbx|obj|mtl|ktx2?|basis)$/i;

export function isExcludedAppMedia(relativePath) {
  const path = relativePath.replace(/\\/g, '/').replace(/^\/+/, '');
  return MEDIA_EXTENSION.test(path) && !APP_HOME_MEDIA_PATHS.has(path);
}
