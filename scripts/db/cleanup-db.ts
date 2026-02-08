/**
 * 数据库清理脚本
 * 
 * 用于手动清理 MongoDB 中的旧房间数据
 * 
 * 使用方法：
 *   npx tsx scripts/db/cleanup-db.ts
 */

import 'dotenv/config';
import { connectDB, disconnectDB } from '../src/server/db';
import { mongoStorage } from '../src/server/storage/MongoStorage';

async function main() {
    console.log('🧹 开始清理数据库...\n');

    // 连接数据库
    await connectDB();
    await mongoStorage.connect();

    // 1. 获取当前存储统计
    console.log('📊 获取存储统计...');
    const stats = await mongoStorage.getStorageStats();
    console.log(`   总房间数: ${stats.totalMatches}`);
    console.log(`   大型房间 (>1MB): ${stats.largeMatches.length}`);
    
    if (stats.largeMatches.length > 0) {
        console.log('\n   前 10 个最大的房间:');
        stats.largeMatches.slice(0, 10).forEach((match, index) => {
            console.log(`   ${index + 1}. ${match.matchID}: ${match.sizeMB.toFixed(2)} MB`);
        });
    }

    // 2. 清理空房间
    console.log('\n🗑️  清理空房间...');
    const emptyCount = await mongoStorage.cleanupEmptyMatches();
    console.log(`   已清理 ${emptyCount} 个空房间`);

    // 3. 清理 24 小时前的旧房间
    console.log('\n🗑️  清理 24 小时前的旧房间...');
    const oldCount = await mongoStorage.cleanupOldMatches(24);
    console.log(`   已清理 ${oldCount} 个旧房间`);

    // 4. 再次获取统计
    console.log('\n📊 清理后的存储统计...');
    const newStats = await mongoStorage.getStorageStats();
    console.log(`   总房间数: ${newStats.totalMatches}`);
    console.log(`   大型房间 (>1MB): ${newStats.largeMatches.length}`);

    // 断开连接
    await disconnectDB();
    
    console.log('\n✅ 清理完成！');
}

main().catch((error) => {
    console.error('❌ 清理失败:', error);
    process.exit(1);
});
