const ts = require('typescript');

function moduleCounterWrites(source) {
    const counters = new Set();
    for (const statement of source.statements) {
        if (!ts.isVariableStatement(statement) || (statement.declarationList.flags & ts.NodeFlags.Const)) continue;
        for (const declaration of statement.declarationList.declarations) {
            if (ts.isIdentifier(declaration.name) && (declaration.type?.kind === ts.SyntaxKind.NumberKeyword
                || declaration.initializer && ts.isNumericLiteral(declaration.initializer))) counters.add(declaration.name.text);
        }
    }
    const writes = [];
    const visit = node => {
        let identifier;
        if ((ts.isPostfixUnaryExpression(node) || ts.isPrefixUnaryExpression(node))
            && [ts.SyntaxKind.PlusPlusToken, ts.SyntaxKind.MinusMinusToken].includes(node.operator)) identifier = node.operand;
        if (ts.isBinaryExpression(node) && node.operatorToken.kind >= ts.SyntaxKind.FirstAssignment
            && node.operatorToken.kind <= ts.SyntaxKind.LastAssignment) identifier = node.left;
        if (identifier && ts.isIdentifier(identifier) && counters.has(identifier.text)) writes.push(node);
        ts.forEachChild(node, visit);
    };
    visit(source);
    return writes;
}
module.exports = { moduleCounterWrites };
