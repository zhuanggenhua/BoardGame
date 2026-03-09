#!/usr/bin/env node
/**
 * 修复 Cardia 图片目录结构
 * 
 * 当前结构（错误）：
 *   cardia/cards/compressed/deck1/1.webp
 *   cardia/cards/compressed/deck2/1.webp
 * 
 * 目标结构（正确）：
 *   cardia/cards/deck1/compressed/1.webp
 *   cardia/cards/deck2/compressed/1.webp
 */

import { readdir, mkdir, copyFile, rm } from 'fs/promises';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import { existsSync } from 'fs';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const projectRoot = join(__dirname, '..');

const baseDir = join(projectRoot, 'public/assets/i18n/zh-CN/cardia/cards');
const oldCompressedDir = join(baseDir, 'compressed');

async function main() {
    console.log('开始修复 Cardia 图片目录结构...\n');
    
    // 检查旧目录是否存在
    if (!existsSync(oldCompressedDir)) {
        console.log('❌ 未找到 compressed 目录，无需修复');
        return;
    }
    
    // 读取 compressed 目录下的所有子目录（deck1, deck2, locations）
    const entries = await readdir(oldCompressedDir, { withFileTypes: true });
    
    for (const entry of entries) {
        if (!entry.isDirectory()) {
            // 跳过文件（如 helper1.webp, helper2.webp, title.webp）
            // 这些文件应该保留在 compressed/ 目录下
            console.log(`⏭️  跳过文件: ${entry.name}`);
            continue;
        }
        
        const deckName = entry.name; // deck1, deck2, locations
        const oldDeckDir = join(oldCompressedDir, deckName);
        const newDeckDir = join(baseDir, deckName);
        const newCompressedDir = join(newDeckDir, 'compressed');
        
        console.log(`\n处理目录: ${deckName}`);
        console.log(`  源目录: ${oldDeckDir}`);
        console.log(`  目标目录: ${newCompressedDir}`);
        
        // 创建新的目录结构
        await mkdir(newDeckDir, { recursive: true });
        await mkdir(newCompressedDir, { recursive: true });
        
        // 复制所有文件
        const files = await readdir(oldDeckDir);
        let copiedCount = 0;
        
        for (const file of files) {
            const oldPath = join(oldDeckDir, file);
            const newPath = join(newCompressedDir, file);
            
            await copyFile(oldPath, newPath);
            copiedCount++;
        }
        
        console.log(`  ✅ 已复制 ${copiedCount} 个文件`);
    }
    
    console.log('\n\n所有文件已复制完成！');
    console.log('\n⚠️  请手动验证新目录结构正确后，再删除旧的 compressed 目录：');
    console.log(`   rm -rf "${oldCompressedDir}"`);
    console.log('\n或者运行以下命令自动删除（请先确认文件已正确复制）：');
    console.log(`   node scripts/fix-cardia-image-structure.mjs --cleanup`);
}

// 如果传入 --cleanup 参数，删除旧目录
if (process.argv.includes('--cleanup')) {
    console.log('\n🗑️  清理旧目录...');
    const oldCompressedDir = join(projectRoot, 'public/assets/i18n/zh-CN/cardia/cards/compressed');
    
    // 只删除子目录（deck1, deck2, locations），保留根级别的文件
    const entries = await readdir(oldCompressedDir, { withFileTypes: true });
    for (const entry of entries) {
        if (entry.isDirectory()) {
            const dirPath = join(oldCompressedDir, entry.name);
            await rm(dirPath, { recursive: true, force: true });
            console.log(`  ✅ 已删除: ${entry.name}`);
        }
    }
    
    console.log('\n✅ 清理完成！');
} else {
    main().catch(console.error);
}
