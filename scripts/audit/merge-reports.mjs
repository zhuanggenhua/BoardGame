#!/usr/bin/env node
/**
 * 汇总所有静态扫描报告
 */

import { readFileSync, writeFileSync, readdirSync } from 'fs';
import { join } from 'path';

function main() {
  const reportsDir = 'reports';
  const files = readdirSync(reportsDir).filter(f => f.startsWith('audit-phase1-') && f.endsWith('.json'));
  
  console.error(`找到 ${files.length} 个报告文件`);
  console.error('');
  
  // 读取所有报告
  const allIssues = [];
  const toolSummaries = [];
  
  files.forEach(file => {
    const content = readFileSync(join(reportsDir, file), 'utf-8');
    const report = JSON.parse(content);
    
    allIssues.push(...report.issues);
    toolSummaries.push({
      toolName: report.toolName,
      timestamp: report.timestamp,
      summary: report.summary
    });
    
    console.error(`${report.toolName}: ${report.summary.total} 个问题 (P0: ${report.summary.p0}, P1: ${report.summary.p1}, P2: ${report.summary.p2})`);
  });
  
  console.error('');
  
  // 按优先级排序
  const priorityOrder = { 'P0': 0, 'P1': 1, 'P2': 2 };
  allIssues.sort((a, b) => {
    const priorityDiff = priorityOrder[a.priority] - priorityOrder[b.priority];
    if (priorityDiff !== 0) return priorityDiff;
    return a.id.localeCompare(b.id);
  });
  
  // 生成汇总报告
  const mergedReport = {
    phase: 'phase1',
    timestamp: new Date().toISOString(),
    tools: toolSummaries,
    issues: allIssues,
    summary: {
      total: allIssues.length,
      p0: allIssues.filter(i => i.priority === 'P0').length,
      p1: allIssues.filter(i => i.priority === 'P1').length,
      p2: allIssues.filter(i => i.priority === 'P2').length
    }
  };
  
  // 输出到控制台
  console.log(JSON.stringify(mergedReport, null, 2));
  
  // 保存到文件
  writeFileSync(join(reportsDir, 'audit-phase1-issues.json'), JSON.stringify(mergedReport, null, 2), 'utf-8');
  console.error(`\n汇总报告已保存到: reports/audit-phase1-issues.json`);
  console.error(`\n总计: ${mergedReport.summary.total} 个问题 (P0: ${mergedReport.summary.p0}, P1: ${mergedReport.summary.p1}, P2: ${mergedReport.summary.p2})`);
  
  // 返回退出码
  const exitCode = mergedReport.summary.p0 > 0 ? 1 : 0;
  process.exit(exitCode);
}

main();
