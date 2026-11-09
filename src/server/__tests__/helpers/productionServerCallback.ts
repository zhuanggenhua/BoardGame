import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { runInNewContext } from 'node:vm';
import * as ts from 'typescript';

// Reuse actual production callback bodies without executing server startup or Mongo.
const source = ts.createSourceFile('server.ts', readFileSync(resolve(process.cwd(), 'server.ts'), 'utf8'), ts.ScriptTarget.Latest, true);
export function productionCallback<T = (ctx: Record<string, unknown>, next?: () => Promise<void>) => Promise<void>>(kind: 'create' | 'recovery' | 'errors' | 'cleanup' | 'detail' | 'successor' | 'rematchJoin' | 'rematchVote', environment: Record<string, unknown>) {
    let callback: ts.Expression | undefined;
    function visit(node: ts.Node) {
        if (ts.isCallExpression(node)) {
            const owner = node.expression.getText(source);
            if (kind === 'rematchJoin' && owner === 'socket.on' && node.arguments[0]?.getText(source) === 'REMATCH_EVENTS.JOIN_MATCH') callback = node.arguments[1];
            if (kind === 'rematchVote' && owner === 'socket.on' && node.arguments[0]?.getText(source) === 'REMATCH_EVENTS.VOTE') callback = node.arguments[1];
            if (kind === 'create' && owner === 'router.post' && node.arguments[0]
                && ts.isStringLiteral(node.arguments[0]) && node.arguments[0].text === '/games/:name/create') callback = node.arguments[1];
            if (kind === 'recovery' && owner === 'router.post' && node.arguments[0]
                && ts.isStringLiteral(node.arguments[0]) && node.arguments[0].text === '/games/:name/:matchID/rematch-recovery') callback = node.arguments[1];
            if (kind === 'detail' && owner === 'router.get' && node.arguments[0]
                && ts.isStringLiteral(node.arguments[0]) && node.arguments[0].text === '/games/:name/:matchID') callback = node.arguments[1];
            if (kind === 'errors' && owner === 'app.use' && node.arguments[0]
                && ts.isArrowFunction(node.arguments[0]) && node.arguments[0].getText(source).includes("'Internal Server Error'")) callback = node.arguments[0];
        }
        if (ts.isVariableDeclaration(node)
            && ((kind === 'cleanup' && node.name.getText(source) === 'cleanupReplacedMatchRuntime')
                || (kind === 'successor' && node.name.getText(source) === 'notifyRematchSuccessor'))) callback = node.initializer;
        ts.forEachChild(node, visit);
    }
    visit(source);
    if (!callback) throw new Error(`Production ${kind} callback missing`);
    const js = ts.transpileModule(`(${callback.getText(source)});`, { compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.None } });
    return runInNewContext(js.outputText, { ...environment, Error }) as T;
}
