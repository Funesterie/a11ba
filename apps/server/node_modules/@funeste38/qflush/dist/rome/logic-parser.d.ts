export type LogicRule = {
    name: string;
    when: string;
    do: string;
    version?: number;
    priority?: number;
    schedule?: string;
};
export declare function parseLogicFile(filePath: string): LogicRule[];
type ASTCmp = {
    type: 'cmp';
    left: string;
    op: '==';
    right: string;
};
type ASTId = {
    type: 'id';
    name: string;
};
type ASTNot = {
    type: 'not';
    expr: ASTNode;
};
type ASTAnd = {
    type: 'and';
    left: ASTNode;
    right: ASTNode;
};
type ASTOr = {
    type: 'or';
    left: ASTNode;
    right: ASTNode;
};
export type ASTNode = ASTCmp | ASTId | ASTNot | ASTAnd | ASTOr;
export declare function evaluateConditionExprAST(ast: ASTNode, ctx: any): boolean;
export declare function buildConditionAst(expr: string): ASTNode;
export declare function evaluateConditionExpr(expr: string, ctx: any): boolean;
export {};
