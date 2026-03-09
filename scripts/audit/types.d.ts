/**
 * 审计工具类型定义
 */

export interface Issue {
  // 基本信息
  id: string;              // 唯一标识符（格式：D{维度}-{序号}，如 "D46-001"）
  dimension: string;       // 审计维度（如 "D46"）
  priority: 'P0' | 'P1' | 'P2';
  
  // 问题描述
  title: string;           // 问题标题（简短描述）
  description: string;     // 详细描述（包含根因分析）
  
  // 位置信息
  location: {
    file: string;          // 文件路径（相对于项目根目录）
    line?: number;         // 行号（可选）
    code?: string;         // 相关代码片段（可选）
    cardId?: string;       // 相关卡牌 ID（可选）
    abilityId?: string;    // 相关能力 ID（可选）
  };
  
  // 修复信息
  suggestion: string;      // 修复建议（具体的代码修改方案）
  status: 'open' | 'fixing' | 'fixed' | 'verified';
  fixCommit?: string;      // 修复提交的 commit hash（可选）
  
  // 元数据
  discoveredBy: 'static' | 'unit-test' | 'integration-test' | 'e2e-test' | 'manual';
  discoveredAt: string;    // 发现时间（ISO 8601 格式）
  fixedAt?: string;        // 修复时间（可选）
  verifiedAt?: string;     // 验证时间（可选）
}

export interface ScanResult {
  toolName: string;
  timestamp: string;
  issues: Issue[];
  summary: {
    total: number;
    p0: number;
    p1: number;
    p2: number;
  };
}

export interface AuditConfig {
  // 审计范围
  scope: {
    gameId: 'cardia';
    cards: string[];       // 要审计的卡牌 ID 列表（空数组表示全部）
    dimensions: string[];  // 要检查的维度列表（空数组表示全部 D1-D49）
  };
  
  // 工具配置
  tools: {
    staticScanners: {
      enabled: boolean;
      tools: string[];     // 要运行的静态扫描工具列表
    };
    unitTests: {
      enabled: boolean;
      coverageThreshold: number; // 测试覆盖率阈值（0-100）
    };
    integrationTests: {
      enabled: boolean;
    };
    e2eTests: {
      enabled: boolean;
      headless: boolean;   // 是否无头模式运行
    };
  };
  
  // 输出配置
  output: {
    reportDir: string;     // 报告输出目录
    format: 'markdown' | 'json' | 'html';
    includeCodeSnippets: boolean;
  };
  
  // 修复配置
  fix: {
    autoFix: boolean;      // 是否自动修复（仅限静态扫描发现的问题）
    createIssues: boolean; // 是否创建 GitHub Issues
  };
}
