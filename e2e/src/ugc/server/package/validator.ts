/**
 * UGC 代码包校验器
 * 
 * 校验上传的 UGC 代码包结构与入口文件
 */

// ============================================================================
// 类型定义
// ============================================================================

/** 代码包类型 */
export type PackageType = 'view' | 'rules' | 'full';

/** 包结构校验结果 */
export interface PackageValidationResult {
    valid: boolean;
    errors: string[];
    warnings: string[];
    packageType: PackageType | null;
    entryPoints: {
        view?: string;
        rules?: string;
    };
}

/** 包元数据 */
export interface PackageMetadata {
    /** 包 ID */
    id: string;
    /** 包名称 */
    name: string;
    /** 版本 */
    version: string;
    /** 包类型 */
    type: PackageType;
    /** 游戏 ID */
    gameId: string;
    /** 作者 */
    author: string;
    /** 描述 */
    description?: string;
    /** 视图入口 */
    viewEntry?: string;
    /** 规则入口 */
    rulesEntry?: string;
    /** 依赖 */
    dependencies?: Record<string, string>;
}

/** 包清单文件 */
export interface PackageManifest {
    /** 元数据 */
    metadata: PackageMetadata;
    /** 文件列表 */
    files: string[];
    /** 资产列表 */
    assets?: string[];
    /** 命令类型枚举（可选） */
    commandTypes?: string[];
}

// ============================================================================
// 必需文件
// ============================================================================

/** 视图包必需文件 */
const VIEW_REQUIRED_FILES = ['index.html', 'main.js'];

/** 规则包必需文件 */
const RULES_REQUIRED_FILES = ['domain.js'];

/** 禁止的文件模式 */
const FORBIDDEN_PATTERNS = [
    /node_modules\//,
    /\.env/,
    /\.git\//,
    /\.ssh\//,
    /private/i,
    /secret/i,
    /password/i,
    /credential/i,
];

/** 最大包大小（字节） */
const MAX_PACKAGE_SIZE = 10 * 1024 * 1024; // 10MB

/** 最大文件数量 */
const MAX_FILE_COUNT = 100;

// ============================================================================
// 包校验器
// ============================================================================

export class PackageValidator {
    /** 校验包结构 */
    validateStructure(
        files: Map<string, Buffer>,
        expectedType?: PackageType
    ): PackageValidationResult {
        const result: PackageValidationResult = {
            valid: true,
            errors: [],
            warnings: [],
            packageType: null,
            entryPoints: {},
        };

        // 检查文件数量
        if (files.size > MAX_FILE_COUNT) {
            result.valid = false;
            result.errors.push(`文件数量超过限制: ${files.size} > ${MAX_FILE_COUNT}`);
            return result;
        }

        // 检查总大小
        let totalSize = 0;
        for (const buffer of files.values()) {
            totalSize += buffer.length;
        }
        if (totalSize > MAX_PACKAGE_SIZE) {
            result.valid = false;
            result.errors.push(`包大小超过限制: ${totalSize} > ${MAX_PACKAGE_SIZE}`);
            return result;
        }

        // 检查禁止的文件
        const fileNames = Array.from(files.keys());
        for (const fileName of fileNames) {
            for (const pattern of FORBIDDEN_PATTERNS) {
                if (pattern.test(fileName)) {
                    result.valid = false;
                    result.errors.push(`禁止的文件: ${fileName}`);
                }
            }
        }

        // 检查清单文件
        const manifestBuffer = files.get('manifest.json');
        if (!manifestBuffer) {
            result.warnings.push('缺少 manifest.json 清单文件');
        } else {
            const manifestResult = this.validateManifest(manifestBuffer);
            if (!manifestResult.valid) {
                result.errors.push(...manifestResult.errors);
                result.valid = false;
            }
        }

        // 检测包类型
        const hasViewFiles = VIEW_REQUIRED_FILES.every((f) => files.has(f));
        const hasRulesFiles = RULES_REQUIRED_FILES.every((f) => files.has(f));

        if (hasViewFiles && hasRulesFiles) {
            result.packageType = 'full';
            result.entryPoints.view = 'index.html';
            result.entryPoints.rules = 'domain.js';
        } else if (hasViewFiles) {
            result.packageType = 'view';
            result.entryPoints.view = 'index.html';
        } else if (hasRulesFiles) {
            result.packageType = 'rules';
            result.entryPoints.rules = 'domain.js';
        } else {
            result.valid = false;
            result.errors.push('缺少必需的入口文件');
        }

        // 如果指定了期望类型，检查是否匹配
        if (expectedType && result.packageType !== expectedType) {
            result.valid = false;
            result.errors.push(`期望包类型 ${expectedType}，实际为 ${result.packageType}`);
        }

        return result;
    }

    /** 校验清单文件 */
    validateManifest(buffer: Buffer): { valid: boolean; errors: string[]; manifest?: PackageManifest } {
        const errors: string[] = [];

        try {
            const content = buffer.toString('utf-8');
            const manifest = JSON.parse(content) as PackageManifest;

            // 验证元数据
            if (!manifest.metadata) {
                errors.push('manifest.json 缺少 metadata 字段');
            } else {
                const meta = manifest.metadata;
                if (!meta.id) errors.push('metadata.id 必填');
                if (!meta.name) errors.push('metadata.name 必填');
                if (!meta.version) errors.push('metadata.version 必填');
                if (!meta.type) errors.push('metadata.type 必填');
                if (!meta.gameId) errors.push('metadata.gameId 必填');
                if (!meta.author) errors.push('metadata.author 必填');
            }

            // 验证文件列表
            if (!manifest.files || !Array.isArray(manifest.files)) {
                errors.push('manifest.json 缺少 files 数组');
            }

            if (manifest.commandTypes !== undefined) {
                if (!Array.isArray(manifest.commandTypes)) {
                    errors.push('manifest.json commandTypes 必须是字符串数组');
                } else {
                    const invalid = manifest.commandTypes.some((item) => typeof item !== 'string' || !item.trim());
                    if (invalid) {
                        errors.push('manifest.json commandTypes 必须是非空字符串数组');
                    }
                }
            }

            return {
                valid: errors.length === 0,
                errors,
                manifest: errors.length === 0 ? manifest : undefined,
            };
        } catch (e) {
            return {
                valid: false,
                errors: ['manifest.json 格式错误: ' + (e instanceof Error ? e.message : '解析失败')],
            };
        }
    }

    /** 校验入口文件内容 */
    validateEntryFile(buffer: Buffer, type: 'view' | 'rules'): { valid: boolean; errors: string[] } {
        const errors: string[] = [];
        const content = buffer.toString('utf-8');

        if (type === 'view') {
            // 检查 HTML 基本结构
            if (!content.includes('<!DOCTYPE html>') && !content.includes('<html')) {
                errors.push('index.html 必须是有效的 HTML 文件');
            }
            // 检查是否引用了 SDK
            if (!content.includes('ugc-sdk') && !content.includes('postMessage')) {
                errors.push('视图入口应引用 UGC SDK 或使用 postMessage 通信');
            }
        }

        if (type === 'rules') {
            // 检查是否导出 domain 对象
            if (!content.includes('domain') && !content.includes('DomainCore')) {
                errors.push('规则入口必须导出 domain 对象');
            }
            // 检查必需方法
            const requiredMethods = ['setup', 'validate', 'execute', 'reduce'];
            for (const method of requiredMethods) {
                if (!content.includes(method)) {
                    errors.push(`规则入口缺少必需方法: ${method}`);
                }
            }
        }

        return {
            valid: errors.length === 0,
            errors,
        };
    }
}

// ============================================================================
// 工厂函数
// ============================================================================

/** 创建包校验器 */
export function createPackageValidator(): PackageValidator {
    return new PackageValidator();
}
