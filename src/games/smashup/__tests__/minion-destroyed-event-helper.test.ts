import * as fs from 'node:fs';
import * as path from 'node:path';
import ts from 'typescript';
import { describe, expect, it } from 'vitest';
import {
    makeBase,
    makeMatchState,
    makeMinion,
    makeMinionDestroyedEvent,
    makeState,
} from './helpers';
import { SU_EVENTS } from '../domain/types';

function listTestFiles(dir: string): string[] {
    return fs.readdirSync(dir, { withFileTypes: true }).flatMap(entry => {
        const filePath = path.join(dir, entry.name);
        if (entry.isDirectory()) return listTestFiles(filePath);
        return entry.isFile() && filePath.endsWith('.ts') ? [filePath] : [];
    });
}

function propertyName(property: ts.ObjectLiteralElementLike): string | undefined {
    if (!ts.isPropertyAssignment(property)) return undefined;
    if (ts.isIdentifier(property.name) || ts.isStringLiteral(property.name)) return property.name.text;
    return undefined;
}

function isMinionDestroyedTypeInitializer(initializer: ts.Expression): boolean {
    return ts.isPropertyAccessExpression(initializer)
        && initializer.name.text === 'MINION_DESTROYED'
        && ts.isIdentifier(initializer.expression)
        && initializer.expression.text === 'SU_EVENTS';
}

function isInsideObjectContaining(node: ts.Node): boolean {
    let current: ts.Node | undefined = node.parent;
    while (current) {
        if (
            ts.isCallExpression(current)
            && ts.isPropertyAccessExpression(current.expression)
            && current.expression.name.text === 'objectContaining'
        ) {
            return true;
        }
        current = current.parent;
    }
    return false;
}

function findRawMinionDestroyedEventObjects(rootDir: string): string[] {
    const hits: string[] = [];
    for (const file of listTestFiles(rootDir)) {
        const sourceText = fs.readFileSync(file, 'utf8');
        const sourceFile = ts.createSourceFile(file, sourceText, ts.ScriptTarget.Latest, true);
        const lines = sourceText.split(/\r?\n/u);

        const scan = (node: ts.Node): void => {
            if (
                ts.isObjectLiteralExpression(node)
                && !isInsideObjectContaining(node)
                && node.properties.some(property => (
                    ts.isPropertyAssignment(property)
                    && propertyName(property) === 'type'
                    && isMinionDestroyedTypeInitializer(property.initializer)
                ))
            ) {
                const position = sourceFile.getLineAndCharacterOfPosition(node.getStart(sourceFile));
                const relative = path.relative(rootDir, file).replace(/\\/g, '/');
                hits.push(`${relative}:${position.line + 1}: ${lines[position.line].trim()}`);
            }
            ts.forEachChild(node, scan);
        };

        scan(sourceFile);
    }
    return hits;
}

describe('MINION_DESTROYED 测试事件 helper', () => {
    it('从当前状态推导被消灭随从的定义、基地、拥有者和控制者', () => {
        const state = makeState({
            bases: [
                makeBase('base-a', []),
                makeBase('base-b', [
                    makeMinion('victim-a', 'robot_microbot_alpha', '1', 2, '0'),
                ]),
            ],
        });

        const event = makeMinionDestroyedEvent({
            minionUid: 'victim-a',
            destroyerId: '1',
            reason: 'helper_contract',
            timestamp: 77,
        }, state);

        expect(event).toEqual(expect.objectContaining({
            type: SU_EVENTS.MINION_DESTROYED,
            timestamp: 77,
            payload: expect.objectContaining({
                minionUid: 'victim-a',
                minionDefId: 'robot_microbot_alpha',
                fromBaseIndex: 1,
                ownerId: '0',
                controllerId: '1',
                destroyerId: '1',
                reason: 'helper_contract',
            }),
        }));
    });

    it('手写消灭事件字段和当前状态不一致时直接红灯', () => {
        const matchState = makeMatchState(makeState({
            bases: [
                makeBase('base-a', [
                    makeMinion('victim-a', 'robot_microbot_alpha', '1', 2, '0'),
                ]),
            ],
        }));

        expect(() => makeMinionDestroyedEvent({
            minionUid: 'victim-a',
            minionDefId: 'pirate_first_mate',
            destroyerId: '1',
            reason: 'stale_manual_fixture',
            timestamp: 88,
        }, matchState)).toThrow(/stale minionDefId/);
    });

    it('测试代码不得再手写 MINION_DESTROYED 原始事件对象', () => {
        const hits = findRawMinionDestroyedEventObjects(path.join(process.cwd(), 'src/games/smashup/__tests__'));

        expect(hits).toEqual([]);
    });
});
