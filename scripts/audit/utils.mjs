/**
 * 审计工具通用函数
 */

import { readFileSync, readdirSync, existsSync, mkdirSync, writeFileSync } from 'fs';
import { join, relative } from 'path';

/**
 * 递归扫描目录，返回所有匹配的文件路径
 * @param {string} dir - 目录路径
 * @param {(file: string) => boolean} filter - 文件过滤函数
 * @returns {string[]} 文件路径列表
 */
export function scanDirectory(dir, filter) {
  const results = [];
  
  function scan(currentDir) {
    const entries = readdirSync(currentDir, { withFileTypes: true });
    
    for (const entry of entries) {
      const fullPath = join(currentDir, entry.name);
      
      if (entry.isDirectory()) {
        // 跳过 node_modules 和隐藏目录
        if (entry.name !== 'node_modules' && !entry.name.startsWith('.')) {
          scan(fullPath);
        }
      } else if (entry.isFile() && filter(fullPath)) {
        results.push(fullPath);
      }
    }
  }
  
  scan(dir);
  return results;
}

/**
 * 读取文件内容并按行分割
 * @param {string} filePath - 文件路径
 * @returns {{ lines: string[], content: string }} 文件内容
 */
export function readFileLines(filePath) {
  const content = readFileSync(filePath, 'utf-8');
  const lines = content.split('\n');
  return { lines, content };
}

/**
 * 创建问题对象
 * @param {object} params - 问题参数
 * @returns {object} Issue 对象
 */
export function createIssue({
  id,
  dimension,
  priority,
  title,
  description,
  location,
  suggestion,
  discoveredBy = 'static'
}) {
  return {
    id,
    dimension,
    priority,
    title,
    description,
    location,
    suggestion,
    status: 'open',
    discoveredBy,
    discoveredAt: new Date().toISOString()
  };
}

/**
 * 生成扫描结果对象
 * @param {string} toolName - 工具名称
 * @param {object[]} issues - 问题列表
 * @returns {object} ScanResult 对象
 */
export function createScanResult(toolName, issues) {
  return {
    toolName,
    timestamp: new Date().toISOString(),
    issues,
    summary: {
      total: issues.length,
      p0: issues.filter(i => i.priority === 'P0').length,
      p1: issues.filter(i => i.priority === 'P1').length,
      p2: issues.filter(i => i.priority === 'P2').length
    }
  };
}

/**
 * 输出扫描结果到控制台和文件
 * @param {object} result - ScanResult 对象
 * @param {string} [outputPath] - 输出文件路径（可选）
 */
export function outputScanResult(result, outputPath) {
  const json = JSON.stringify(result, null, 2);
  
  // 输出到控制台
  console.log(json);
  
  // 输出到文件（如果指定）
  if (outputPath) {
    const dir = join(process.cwd(), 'reports');
    if (!existsSync(dir)) {
      mkdirSync(dir, { recursive: true });
    }
    writeFileSync(join(dir, outputPath), json, 'utf-8');
    console.error(`\n报告已保存到: reports/${outputPath}`);
  }
}

/**
 * 检查代码行是否包含特定模式
 * @param {string} line - 代码行
 * @param {RegExp} pattern - 正则表达式
 * @returns {boolean} 是否匹配
 */
export function matchesPattern(line, pattern) {
  return pattern.test(line);
}

/**
 * 提取代码片段（去除前后空白）
 * @param {string} line - 代码行
 * @param {number} maxLength - 最大长度
 * @returns {string} 代码片段
 */
export function extractCodeSnippet(line, maxLength = 100) {
  const trimmed = line.trim();
  if (trimmed.length <= maxLength) {
    return trimmed;
  }
  return trimmed.substring(0, maxLength) + '...';
}

/**
 * 获取相对路径（相对于项目根目录）
 * @param {string} filePath - 绝对路径
 * @returns {string} 相对路径
 */
export function getRelativePath(filePath) {
  return relative(process.cwd(), filePath);
}

/**
 * 生成问题 ID
 * @param {string} dimension - 维度（如 "D46"）
 * @param {number} index - 序号（从 1 开始）
 * @returns {string} 问题 ID（如 "D46-001"）
 */
export function generateIssueId(dimension, index) {
  return `${dimension}-${String(index).padStart(3, '0')}`;
}

/**
 * 检查文件是否应该被忽略（根据注释）
 * @param {string} content - 文件内容
 * @param {string} dimension - 维度（如 "D46"）
 * @returns {boolean} 是否应该忽略
 */
export function shouldIgnoreFile(content, dimension) {
  // 检查文件级别的忽略注释
  const ignorePattern = new RegExp(`//\\s*audit-ignore:\\s*${dimension}`, 'i');
  return ignorePattern.test(content);
}

/**
 * 检查代码行是否应该被忽略（根据注释）
 * @param {string} line - 代码行
 * @param {string} dimension - 维度（如 "D46"）
 * @returns {boolean} 是否应该忽略
 */
export function shouldIgnoreLine(line, dimension) {
  // 检查行级别的忽略注释
  const ignorePattern = new RegExp(`//\\s*audit-ignore:\\s*${dimension}`, 'i');
  return ignorePattern.test(line);
}
