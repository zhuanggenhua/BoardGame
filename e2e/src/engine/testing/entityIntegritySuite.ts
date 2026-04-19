/**
 * 引擎层 - 实体交互链完整性测试套件工厂
 *
 * 提供四个可复用的工厂函数，生成标准化的 describe/it 测试块：
 * 1. createRegistryIntegritySuite — 注册表完整性（无重复 ID、必填字段、数量阈值）
 * 2. createRefChainSuite — 引用链完整性（断链检测 + 孤儿 + 过时白名单）
 * 3. createTriggerPathSuite — 触发路径声明（CONFIRMED / TODO / INCOMPLETE_BRANCHES 三层）
 * 4. createEffectContractSuite — 效果数据契约验证（隐式契约自动化守卫）
 * 5. createI18nContractSuite — i18n 文案契约验证（key 格式 + key 存在性）
 *
 * 使用方：各游戏的 entity-chain-integrity.test.ts
 */

import { describe, expect, it } from 'vitest';
import { validateReferences, extractRefChains, type RefChain } from './referenceValidator';

// 重导出底层原语，让游戏层只需 import entityIntegritySuite 即可
export { extractRefChains, type RefChain } from './referenceValidator';

// ============================================================================
// 1. createRegistryIntegritySuite
// ============================================================================

export interface RegistryIntegrityConfig<TDef> {
  /** describe 块名称 */
  suiteName: string;
  /** 获取所有定义 */
  getDefs: () => TDef[];
  /** 从定义中提取唯一 ID */
  getId: (def: TDef) => string;
  /** 必填字段检查列表 */
  requiredFields: { name: string; check: (def: TDef) => boolean }[];
  /** 最低注册数量 */
  minCount: number;
}

/**
 * 生成注册表完整性测试：数量 ≥ 阈值、必填字段非空、无重复 ID
 */
export function createRegistryIntegritySuite<TDef>(config: RegistryIntegrityConfig<TDef>): void {
  describe(config.suiteName, () => {
    const defs = config.getDefs();

    it(`至少注册了 ${config.minCount} 个定义`, () => {
      expect(defs.length).toBeGreaterThanOrEqual(config.minCount);
    });

    for (const field of config.requiredFields) {
      it(`所有定义都有 ${field.name}`, () => {
        const missing = defs.filter(d => !field.check(d));
        expect(missing.map(d => config.getId(d))).toEqual([]);
      });
    }

    it('无重复 id', () => {
      const ids = defs.map(d => config.getId(d));
      expect(ids.length).toBe(new Set(ids).size);
    });
  });
}

// ============================================================================
// 2. createRefChainSuite
// ============================================================================

export interface RefChainSuiteConfig<TDef> {
  /** describe 块名称 */
  suiteName: string;
  /** 获取所有定义 */
  getDefs: () => TDef[];
  /** 从单个定义提取引用链 */
  extractChains: (def: TDef) => RefChain[];
  /** refType → 已注册 ID 集合 */
  registries: Record<string, Set<string>>;
  /** 最少引用链数量 */
  minChainCount: number;
  /** 可选：孤儿检查（registry 中有注册但无定义引用） */
  orphanCheck?: { label: string; registeredIds: Set<string> };
  /** 可选：过时白名单检查（白名单中有条目但无定义引用） */
  staleWhitelists?: { label: string; ids: Set<string> }[];
  /** 可选：覆盖率检查 */
  coverageCheck?: { isImplemented: (chain: RefChain) => boolean; minCoverage: number };
}

/**
 * 生成引用链完整性测试：断链检测、孤儿检查、白名单过时检查、覆盖率检查
 */
export function createRefChainSuite<TDef>(config: RefChainSuiteConfig<TDef>): void {
  describe(config.suiteName, () => {
    const chains = extractRefChains(config.getDefs(), config.extractChains);

    it(`存在引用链（≥ ${config.minChainCount}）`, () => {
      expect(chains.length).toBeGreaterThanOrEqual(config.minChainCount);
    });

    it('所有引用必须有对应处理器', () => {
      const errors = validateReferences({ chains, registries: config.registries });
      if (errors.length > 0) {
        const detail = errors.map(e => `  ${e.sourceId} → ${e.refId}`).join('\n');
        expect(errors).toEqual([]); // 使用 expect 而非 fail
      }
    });

    if (config.orphanCheck) {
      const oc = config.orphanCheck;
      it(`${oc.label} 中所有注册都被引用（无孤儿）`, () => {
        const referencedIds = new Set(chains.map(c => c.refId));
        const orphans = [...oc.registeredIds].filter(id => !referencedIds.has(id));
        expect(orphans).toEqual([]);
      });
    }

    if (config.staleWhitelists) {
      for (const wl of config.staleWhitelists) {
        it(`${wl.label} 白名单无过时条目`, () => {
          const referencedIds = new Set(chains.map(c => c.refId));
          const stale = [...wl.ids].filter(id => !referencedIds.has(id));
          if (stale.length > 0) {
            expect(stale).toEqual([]); // 使用 expect 而非 fail
          }
        });
      }
    }

    if (config.coverageCheck) {
      const cc = config.coverageCheck;
      it(`实现覆盖率 ≥ ${(cc.minCoverage * 100).toFixed(0)}%`, () => {
        const implemented = chains.filter(c => cc.isImplemented(c));
        const coverage = chains.length > 0 ? implemented.length / chains.length : 0;
        expect(coverage).toBeGreaterThanOrEqual(cc.minCoverage);
      });
    }
  });
}

// ============================================================================
// 3. createTriggerPathSuite
// ============================================================================

export interface TriggerPathSuiteConfig<TDef> {
  /** describe 块名称 */
  suiteName: string;
  /** 获取需要声明路径的定义列表 */
  getItems: () => TDef[];
  /** 提取 ID */
  getId: (item: TDef) => string;
  /** 提取显示标签（用于错误消息） */
  getLabel: (item: TDef) => string;
  /** 已确认实装的映射：ID → 路径描述 */
  confirmed: Map<string, string>;
  /** 待实装的映射：ID → 缺失描述 */
  todo: Map<string, string>;
  /** 可选：已确认项中的未完成分支 */
  incompleteBranches?: Map<string, string[]>;
  /** 最少定义数量 */
  minCount?: number;
  /** 严格模式：TODO 非空时失败（用于 release 门禁） */
  failOnTodo?: boolean;
  /** 严格模式：INCOMPLETE_BRANCHES 非空时失败（用于 release 门禁） */
  failOnIncompleteBranches?: boolean;
}

/**
 * 生成触发路径声明测试：所有定义必须在 CONFIRMED 或 TODO 中、无过时条目、警告打印
 */
export function createTriggerPathSuite<TDef>(config: TriggerPathSuiteConfig<TDef>): void {
  describe(config.suiteName, () => {
    const items = config.getItems();
    const failOnTodo = config.failOnTodo ?? false;
    const failOnIncompleteBranches = config.failOnIncompleteBranches ?? false;

    const minCount = config.minCount;
    if (minCount !== undefined) {
      it(`至少存在 ${minCount} 个定义`, () => {
        expect(items.length).toBeGreaterThanOrEqual(minCount);
      });
    }

    it('所有定义必须声明路径（CONFIRMED 或 TODO）', () => {
      const undeclared = items
        .filter(a => !config.confirmed.has(config.getId(a)) && !config.todo.has(config.getId(a)))
        .map(a => `  未声明: ${config.getId(a)}（${config.getLabel(a)}）`);
      if (undeclared.length > 0) {
        expect(undeclared).toEqual([]); // 使用 expect 而非 fail
      }
    });

    it('CONFIRMED 无过时条目', () => {
      const itemIds = new Set(items.map(a => config.getId(a)));
      const stale = [...config.confirmed.keys()].filter(id => !itemIds.has(id));
      expect(stale).toEqual([]);
    });

    it('TODO 无过时条目', () => {
      const itemIds = new Set(items.map(a => config.getId(a)));
      const stale = [...config.todo.keys()].filter(id => !itemIds.has(id));
      expect(stale).toEqual([]);
    });

    it(failOnTodo ? '待实装清单（严格模式：失败）' : '待实装清单警告（不失败）', () => {
      if (config.todo.size > 0) {
        const lines = [...config.todo.entries()].map(([id, desc]) => `  ${id}: ${desc}`);
        if (failOnTodo) {
          expect(lines, '严格模式下不允许 TODO 待实装项').toEqual([]);
          return;
        }
        console.warn(`\n⚠️ ${config.todo.size} 个待实装:\n${lines.join('\n')}`);
      }
    });

    if (config.incompleteBranches) {
      const ib = config.incompleteBranches;
      it(failOnIncompleteBranches ? '未完成分支（严格模式：失败）' : '未完成分支警告（不失败）', () => {
        if (ib.size > 0) {
          const lines = [...ib.entries()]
            .flatMap(([id, branches]) => branches.map(b => `  ${id}: ${b}`));
          if (failOnIncompleteBranches) {
            expect(lines, '严格模式下不允许 INCOMPLETE_BRANCHES').toEqual([]);
            return;
          }
          console.warn(`\n⚠️ ${ib.size} 个存在未完成分支:\n${lines.join('\n')}`);
        }
      });

      it('INCOMPLETE_BRANCHES 中所有 ID 都在 CONFIRMED 中', () => {
        const stale = [...ib.keys()].filter(id => !config.confirmed.has(id));
        if (stale.length > 0) {
          expect(stale).toEqual([]); // 使用 expect 而非 fail
        }
      });
    }
  });
}


// ============================================================================
// 4. createEffectContractSuite — 效果数据契约验证
// ============================================================================

/**
 * 单条契约规则
 *
 * 通用设计：每条规则定义一个"数据定义必须满足的不变量"。
 * 规则由游戏层注册，引擎层只提供遍历+报告框架。
 *
 * 典型用途：
 * - 需要 random 的 action type 必须有特定 timing
 * - custom action 的 customActionId 必须在注册表中
 * - 卡牌效果必须有 timing: 'immediate'
 * - 升级卡必须有 targetAbilityId
 * - rollDie 必须有 conditionalEffects
 */
export interface EffectContractRule<TEffect> {
    /** 规则名称（用于测试标题和错误消息） */
    name: string;
    /** 从效果中筛选需要检查的子集（返回 true 表示此规则适用于该效果） */
    appliesTo: (effect: TEffect) => boolean;
    /** 检查函数：返回 true 表示通过，false 表示违反契约 */
    check: (effect: TEffect) => boolean;
    /** 违反时的错误描述生成器 */
    describeViolation: (effect: TEffect) => string;
}

/**
 * 效果契约套件配置
 */
export interface EffectContractSuiteConfig<TSource, TEffect> {
    /** describe 块名称 */
    suiteName: string;
    /** 获取所有数据源（如英雄定义、卡牌数组等） */
    getSources: () => TSource[];
    /** 从数据源中提取 ID（用于错误消息定位） */
    getSourceId: (source: TSource) => string;
    /** 从数据源中提取所有效果定义 */
    extractEffects: (source: TSource) => TEffect[];
    /** 契约规则列表 */
    rules: EffectContractRule<TEffect>[];
    /** 最少数据源数量（防止空跑） */
    minSourceCount?: number;
}

/**
 * 生成效果数据契约验证测试
 *
 * 遍历所有数据源的所有效果，对每条契约规则检查是否满足。
 * 任何违反都会报告具体的数据源 ID + 违反描述。
 */
export function createEffectContractSuite<TSource, TEffect>(
    config: EffectContractSuiteConfig<TSource, TEffect>
): void {
    describe(config.suiteName, () => {
        const sources = config.getSources();

        if (config.minSourceCount !== undefined) {
            it(`至少存在 ${config.minSourceCount} 个数据源`, () => {
                expect(sources.length).toBeGreaterThanOrEqual(config.minSourceCount!);
            });
        }

        for (const rule of config.rules) {
            it(rule.name, () => {
                const violations: string[] = [];

                for (const source of sources) {
                    const sourceId = config.getSourceId(source);
                    const effects = config.extractEffects(source);

                    for (const effect of effects) {
                        if (!rule.appliesTo(effect)) continue;
                        if (!rule.check(effect)) {
                            violations.push(`  [${sourceId}] ${rule.describeViolation(effect)}`);
                        }
                    }
                }

                if (violations.length > 0) {
                    // 使用 expect 而非 fail，确保错误消息清晰
                    expect(violations).toEqual([]);
                }
            });
        }
    });
}


// ============================================================================
// 5. createI18nContractSuite — i18n 文案契约验证
// ============================================================================

/**
 * i18n key 提取规则
 *
 * 定义如何从数据源中提取需要验证的 i18n key。
 * 每条规则描述一个字段的 key 格式要求和存在性检查。
 */
export interface I18nKeyExtractor<TSource> {
    /** 字段名称（用于错误消息） */
    fieldName: string;
    /** 从数据源中提取 i18n key 值（返回 undefined 表示该字段不存在） */
    extract: (source: TSource) => string | undefined;
    /** key 格式正则（如 /^cards\.\S+\.(name|description)$/） */
    keyPattern: RegExp;
    /** 格式描述（用于错误消息，如 "cards.<id>.name"） */
    patternDescription: string;
}

/**
 * i18n 契约套件配置
 */
export interface I18nContractSuiteConfig<TSource> {
    /** describe 块名称 */
    suiteName: string;
    /** 获取所有数据源 */
    getSources: () => TSource[];
    /** 从数据源中提取 ID（用于错误消息定位） */
    getSourceId: (source: TSource) => string;
    /** i18n key 提取规则列表 */
    keyExtractors: I18nKeyExtractor<TSource>[];
    /** 各语言的 i18n 数据（key: 语言代码，value: 扁平化的 key→value 映射） */
    locales: Record<string, Record<string, string>>;
    /** 最少数据源数量（防止空跑） */
    minSourceCount?: number;
}

/**
 * 将嵌套 JSON 对象扁平化为 dot-separated key 映射
 *
 * 例：{ cards: { foo: { name: "bar" } } } → { "cards.foo.name": "bar" }
 */
export function flattenI18nKeys(obj: Record<string, unknown>, prefix = ''): Record<string, string> {
    const result: Record<string, string> = {};
    for (const [key, value] of Object.entries(obj)) {
        const fullKey = prefix ? `${prefix}.${key}` : key;
        if (typeof value === 'object' && value !== null && !Array.isArray(value)) {
            Object.assign(result, flattenI18nKeys(value as Record<string, unknown>, fullKey));
        } else {
            result[fullKey] = String(value);
        }
    }
    return result;
}

/**
 * 生成 i18n 文案契约验证测试
 *
 * 验证内容：
 * 1. key 格式：所有提取的 key 必须匹配指定的正则格式（防止硬编码字符串）
 * 2. key 存在性：所有提取的 key 必须在每个语言的 i18n 文件中存在（防止引用缺失）
 */
export function createI18nContractSuite<TSource>(
    config: I18nContractSuiteConfig<TSource>
): void {
    describe(config.suiteName, () => {
        const sources = config.getSources();

        if (config.minSourceCount !== undefined) {
            it(`至少存在 ${config.minSourceCount} 个数据源`, () => {
                expect(sources.length).toBeGreaterThanOrEqual(config.minSourceCount!);
            });
        }

        // key 格式验证
        for (const extractor of config.keyExtractors) {
            it(`${extractor.fieldName} 必须使用 i18n key 格式（${extractor.patternDescription}）`, () => {
                const violations: string[] = [];
                for (const source of sources) {
                    const sourceId = config.getSourceId(source);
                    const value = extractor.extract(source);
                    if (value === undefined) continue;
                    if (!extractor.keyPattern.test(value)) {
                        violations.push(
                            `  [${sourceId}] ${extractor.fieldName}="${value}" 不匹配格式 ${extractor.patternDescription}`
                        );
                    }
                }
                if (violations.length > 0) {
                    expect(violations).toEqual([]);
                }
            });
        }

        // key 存在性验证（每个语言单独检查）
        for (const [lang, flatKeys] of Object.entries(config.locales)) {
            it(`所有 i18n key 在 ${lang} 中存在`, () => {
                const violations: string[] = [];
                for (const source of sources) {
                    const sourceId = config.getSourceId(source);
                    for (const extractor of config.keyExtractors) {
                        const value = extractor.extract(source);
                        if (value === undefined) continue;
                        // 只检查符合 key 格式的值（非 key 格式的已被格式验证捕获）
                        if (!extractor.keyPattern.test(value)) continue;
                        if (!(value in flatKeys)) {
                            violations.push(
                                `  [${sourceId}] ${extractor.fieldName} key "${value}" 在 ${lang} 中不存在`
                            );
                        }
                    }
                }
                if (violations.length > 0) {
                    expect(violations).toEqual([]);
                }
            });
        }
    });
}
