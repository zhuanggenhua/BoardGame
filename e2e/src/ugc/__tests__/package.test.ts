/**
 * UGC 代码包校验测试 (2.3)
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { PackageValidator, createPackageValidator } from '../server/package';

describe('UGC 代码包校验', () => {
    describe('PackageValidator', () => {
        let validator: PackageValidator;

        beforeEach(() => {
            validator = createPackageValidator();
        });

        it('应创建包校验器', () => {
            expect(validator).toBeInstanceOf(PackageValidator);
        });

        it('应校验视图包结构', () => {
            const files = new Map<string, Buffer>([
                ['index.html', Buffer.from('<!DOCTYPE html><html></html>')],
                ['main.js', Buffer.from('console.log("hello")')],
            ]);

            const result = validator.validateStructure(files);
            expect(result.valid).toBe(true);
            expect(result.packageType).toBe('view');
            expect(result.entryPoints.view).toBe('index.html');
        });

        it('应校验规则包结构', () => {
            const files = new Map<string, Buffer>([
                ['domain.js', Buffer.from('const domain = { gameId: "test", setup(){}, validate(){}, execute(){}, reduce(){} }')],
            ]);

            const result = validator.validateStructure(files);
            expect(result.valid).toBe(true);
            expect(result.packageType).toBe('rules');
            expect(result.entryPoints.rules).toBe('domain.js');
        });

        it('应校验完整包结构', () => {
            const files = new Map<string, Buffer>([
                ['index.html', Buffer.from('<!DOCTYPE html>')],
                ['main.js', Buffer.from('postMessage()')],
                ['domain.js', Buffer.from('const domain = {}')],
            ]);

            const result = validator.validateStructure(files);
            expect(result.valid).toBe(true);
            expect(result.packageType).toBe('full');
        });

        it('应拒绝缺少入口文件的包', () => {
            const files = new Map<string, Buffer>([
                ['readme.md', Buffer.from('# Hello')],
            ]);

            const result = validator.validateStructure(files);
            expect(result.valid).toBe(false);
            expect(result.errors).toContain('缺少必需的入口文件');
        });

        it('应拒绝禁止的文件', () => {
            const files = new Map<string, Buffer>([
                ['index.html', Buffer.from('<!DOCTYPE html>')],
                ['main.js', Buffer.from('')],
                ['.env', Buffer.from('SECRET=xxx')],
            ]);

            const result = validator.validateStructure(files);
            expect(result.valid).toBe(false);
            expect(result.errors.some(e => e.includes('.env'))).toBe(true);
        });

        it('应拒绝 node_modules', () => {
            const files = new Map<string, Buffer>([
                ['index.html', Buffer.from('<!DOCTYPE html>')],
                ['main.js', Buffer.from('')],
                ['node_modules/pkg/index.js', Buffer.from('')],
            ]);

            const result = validator.validateStructure(files);
            expect(result.valid).toBe(false);
            expect(result.errors.some(e => e.includes('node_modules'))).toBe(true);
        });

        it('应校验清单文件', () => {
            const validManifest = Buffer.from(JSON.stringify({
                metadata: {
                    id: 'pkg-1',
                    name: 'Test Game',
                    version: '1.0.0',
                    type: 'view',
                    gameId: 'test',
                    author: 'Test Author',
                },
                files: ['index.html', 'main.js'],
            }));

            const result = validator.validateManifest(validManifest);
            expect(result.valid).toBe(true);
            expect(result.manifest).toBeDefined();
        });

        it('应拒绝无效的清单文件', () => {
            const invalidManifest = Buffer.from('{ invalid json }');
            const result = validator.validateManifest(invalidManifest);
            expect(result.valid).toBe(false);
            expect(result.errors.some(e => e.includes('格式错误'))).toBe(true);
        });

        it('应拒绝缺少必填字段的清单', () => {
            const incompleteManifest = Buffer.from(JSON.stringify({
                metadata: { id: 'pkg-1' },
                files: [],
            }));

            const result = validator.validateManifest(incompleteManifest);
            expect(result.valid).toBe(false);
            expect(result.errors.length).toBeGreaterThan(0);
        });

        it('应校验视图入口文件', () => {
            const validHtml = Buffer.from('<!DOCTYPE html><html><script>postMessage()</script></html>');
            const result1 = validator.validateEntryFile(validHtml, 'view');
            expect(result1.valid).toBe(true);

            const invalidHtml = Buffer.from('not html');
            const result2 = validator.validateEntryFile(invalidHtml, 'view');
            expect(result2.valid).toBe(false);
        });

        it('应校验规则入口文件', () => {
            const validRules = Buffer.from(`
                const domain = {
                    gameId: 'test',
                    setup() {},
                    validate() {},
                    execute() {},
                    reduce() {},
                };
            `);
            const result1 = validator.validateEntryFile(validRules, 'rules');
            expect(result1.valid).toBe(true);

            const invalidRules = Buffer.from('console.log("no domain")');
            const result2 = validator.validateEntryFile(invalidRules, 'rules');
            expect(result2.valid).toBe(false);
        });
    });
});
