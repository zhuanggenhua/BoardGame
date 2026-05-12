import mongoose from 'mongoose';
import logger from '../../server/logger';

function requireMongoUri(): string {
    const mongoUri = process.env.MONGO_URI?.trim();
    if (!mongoUri) {
        throw new Error('[MongoDB] 缺少 MONGO_URI，禁止回退到本机 Mongo。请显式配置目标数据库连接串。');
    }
    return mongoUri;
}

/**
 * 连接到 MongoDB 数据库
 */
export async function connectDB(): Promise<void> {
    const mongoUri = requireMongoUri();
    try {
        await mongoose.connect(mongoUri, {
            // 连接池优化（生产环境标准配置）
            maxPoolSize: 10,              // 最大连接数（默认 100，降低以节省内存）
            minPoolSize: 2,               // 最小连接数（保持 2 个热连接）
            maxIdleTimeMS: 60000,         // 空闲连接 60 秒后关闭
            serverSelectionTimeoutMS: 5000, // 服务器选择超时 5 秒
            socketTimeoutMS: 45000,       // Socket 超时 45 秒
            connectTimeoutMS: 10000,      // 连接超时 10 秒
        });
        logger.info('✅ MongoDB 连接成功');
    } catch (error) {
        logger.error('❌ MongoDB 连接失败:', error);
        logger.error(
            `[MongoDB] 请确认 MongoDB 已启动且可访问。` +
            `\n- 当前 MONGO_URI: ${mongoUri}` +
            `\n- Docker: docker-compose up -d mongodb` +
            `\n- 或本机启动 MongoDB 并监听 27017`
        );
        process.exit(1);
    }
}

/**
 * 断开 MongoDB 连接
 */
export async function disconnectDB(): Promise<void> {
    await mongoose.disconnect();
    logger.info('MongoDB 已断开连接');
}

export default mongoose;
