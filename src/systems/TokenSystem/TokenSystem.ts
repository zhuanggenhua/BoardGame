/**
 * TokenSystem - 可消耗道具系统实现
 */

import type { TokenDef, TokenState, ITokenSystem } from './types';

/**
 * Token 系统实现
 */
class TokenSystemImpl implements ITokenSystem {
    private definitions = new Map<string, TokenDef>();

    /**
     * 注册 Token 定义
     */
    registerDefinition(def: TokenDef): void {
        if (this.definitions.has(def.id)) {
            console.warn(`[TokenSystem] Token ${def.id} 已存在，将被覆盖`);
        }
        this.definitions.set(def.id, def);
    }

    /**
     * 批量注册 Token 定义
     */
    registerDefinitions(defs: TokenDef[]): void {
        defs.forEach(def => this.registerDefinition(def));
    }

    /**
     * 获取 Token 定义
     */
    getDefinition(id: string): TokenDef | undefined {
        return this.definitions.get(id);
    }

    /**
     * 获取所有 Token 定义
     */
    getAllDefinitions(): TokenDef[] {
        return Array.from(this.definitions.values());
    }

    /**
     * 授予 Token
     */
    grant(tokens: TokenState, tokenId: string, amount: number, def?: TokenDef): TokenState {
        const definition = def ?? this.definitions.get(tokenId);
        const currentAmount = tokens[tokenId] ?? 0;
        const maxStacks = definition?.stackLimit || Infinity;
        const newAmount = Math.min(currentAmount + amount, maxStacks);

        return {
            ...tokens,
            [tokenId]: newAmount,
        };
    }

    /**
     * 消耗 Token
     */
    consume(tokens: TokenState, tokenId: string, amount = 1): { tokens: TokenState; consumed: number } {
        const currentAmount = tokens[tokenId] ?? 0;
        const consumed = Math.min(currentAmount, amount);
        const newAmount = currentAmount - consumed;

        return {
            tokens: {
                ...tokens,
                [tokenId]: newAmount,
            },
            consumed,
        };
    }

    /**
     * 检查是否有足够的 Token
     */
    hasEnough(tokens: TokenState, tokenId: string, amount = 1): boolean {
        return (tokens[tokenId] ?? 0) >= amount;
    }
}

/** Token 系统单例 */
export const tokenSystem = new TokenSystemImpl();
