/**
 * Convention-based Visual Resolution（约定式视觉解析）
 *
 * 设计原则：
 * - Convention over Configuration（参考 Unreal GameplayCue）
 * - Single Source of Truth：实体定义即视觉定义，不需要额外 META 映射表
 * - 引擎层通用，与具体游戏无关
 *
 * 约定规则：
 * 1. frameId 默认 = entityId（可显式覆盖）
 * 2. atlasId 默认 = 实体所属 group 的 atlas（可显式覆盖）
 * 3. 无 atlas/frame 时降级为 icon/emoji fallback
 */

// ============================================================================
// 类型定义
// ============================================================================

/**
 * 可嵌入任何游戏实体定义的视觉元数据
 *
 * 游戏实体（Token、Status、Ability 等）可在其定义中内嵌此类型，
 * 替代外部 META 映射表。
 */
export interface EntityVisualMeta {
    /** 图集帧 ID。省略时约定 = entity.id */
    frameId?: string;
    /** 图集 ID。省略时约定 = 实体所属 group 的默认图集 */
    atlasId?: string;
    /** Fallback 图标（emoji 或 SVG 路径） */
    icon?: string;
    /** Fallback 颜色主题（Tailwind gradient class 等） */
    colorTheme?: string;
}

/**
 * 解析后的视觉信息
 */
export interface ResolvedVisual {
    /** 最终使用的帧 ID */
    frameId: string;
    /** 最终使用的图集 ID */
    atlasId: string;
    /** 图集 JSON 路径 */
    atlasPath: string | undefined;
    /** 是否有完整的 atlas 信息（frameId + atlasId + atlasPath 全齐） */
    hasAtlas: boolean;
    /** Fallback 图标 */
    icon?: string;
    /** Fallback 颜色 */
    colorTheme?: string;
}

/**
 * 验证错误
 */
export interface VisualValidationError {
    entityId: string;
    groupId: string;
    message: string;
}

// ============================================================================
// VisualResolver
// ============================================================================

/**
 * 约定式视觉解析器
 *
 * 游戏初始化时注册图集路径和 group → atlas 映射，
 * 运行时通过 resolve() 解析实体视觉信息。
 *
 * 使用示例（DiceThrone）：
 * ```
 * const resolver = new VisualResolver();
 * resolver.registerAtlas('dicethrone:monk-status', 'dicethrone/images/monk/status-icons-atlas.json');
 * resolver.registerGroupAtlas('monk', 'dicethrone:monk-status');
 *
 * // 约定：tokenId 'taiji' 在 monk 的 atlas 中查找帧 'taiji'
 * // 但 taiji 的帧名实际是 'tai-chi'，所以需要 override
 * resolver.resolve('taiji', 'monk', { frameId: 'tai-chi' });
 * // → { frameId: 'tai-chi', atlasId: 'dicethrone:monk-status', atlasPath: '...', hasAtlas: true }
 *
 * // 约定：tokenId 'purify' 在 monk 的 atlas 中查找帧 'purify'（帧名 = tokenId）
 * resolver.resolve('purify', 'monk');
 * // → { frameId: 'purify', atlasId: 'dicethrone:monk-status', atlasPath: '...', hasAtlas: true }
 * ```
 */
export class VisualResolver {
    /** atlasId → JSON 文件路径 */
    private atlasPaths = new Map<string, string>();
    /** groupId → atlasId */
    private groupAtlasMap = new Map<string, string>();

    // ========== 注册 ==========

    /** 注册图集路径 */
    registerAtlas(atlasId: string, path: string): void {
        this.atlasPaths.set(atlasId, path);
    }

    /** 注册 group 的默认图集（如角色 → 角色状态图集） */
    registerGroupAtlas(groupId: string, atlasId: string): void {
        this.groupAtlasMap.set(groupId, atlasId);
    }

    // ========== 解析 ==========

    /**
     * 解析实体的视觉信息
     *
     * 优先级：
     * 1. override.frameId / override.atlasId（显式覆盖）
     * 2. entityId 作为 frameId、groupId 的 atlas 作为 atlasId（约定）
     * 3. fallback icon/colorTheme
     */
    resolve(
        entityId: string,
        groupId: string,
        override?: EntityVisualMeta,
    ): ResolvedVisual {
        const frameId = override?.frameId ?? entityId;
        const atlasId = override?.atlasId ?? this.groupAtlasMap.get(groupId);
        const atlasPath = atlasId ? this.atlasPaths.get(atlasId) : undefined;

        return {
            frameId,
            atlasId: atlasId ?? '',
            atlasPath,
            hasAtlas: Boolean(atlasId && atlasPath),
            icon: override?.icon,
            colorTheme: override?.colorTheme,
        };
    }

    // ========== 批量查询 ==========

    /** 获取所有已注册的图集路径（用于 UI 层加载） */
    getAtlasPaths(): Map<string, string> {
        return new Map(this.atlasPaths);
    }

    /** 获取所有已注册的图集路径（Record 形式，兼容旧代码） */
    getAtlasPathsRecord(): Record<string, string> {
        return Object.fromEntries(this.atlasPaths);
    }

    /** 获取所有已注册的 group → atlas 映射 */
    getGroupAtlasMap(): Map<string, string> {
        return new Map(this.groupAtlasMap);
    }

    // ========== 验证 ==========

    /**
     * 验证：所有 group 引用的 atlas 都有对应的路径注册
     */
    validate(): VisualValidationError[] {
        const errors: VisualValidationError[] = [];
        for (const [groupId, atlasId] of this.groupAtlasMap) {
            if (!this.atlasPaths.has(atlasId)) {
                errors.push({
                    entityId: '',
                    groupId,
                    message: `Group "${groupId}" references atlas "${atlasId}", but no path is registered for it`,
                });
            }
        }
        return errors;
    }

    /** 重置（测试用） */
    clear(): void {
        this.atlasPaths.clear();
        this.groupAtlasMap.clear();
    }
}
