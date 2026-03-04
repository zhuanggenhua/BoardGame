/**
 * HybridStorage Provider for NestJS
 * 
 * 提供对游戏服务器 HybridStorage 的访问，使管理后台能够查询内存中的游客房间。
 */

import { Provider } from '@nestjs/common';
import { hybridStorage } from '../../../../../src/server/storage/HybridStorage';

export const HYBRID_STORAGE = 'HYBRID_STORAGE';

export const HybridStorageProvider: Provider = {
    provide: HYBRID_STORAGE,
    useValue: hybridStorage,
};
