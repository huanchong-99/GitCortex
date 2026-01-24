import * as ts from 'typescript';
/**
 * Stringifies the text within a JSDocTagInfo AST node with compatibility for
 * pre/post TypeScript 4.3 API changes.
 */
export declare function stringifyJSDocTagInfoText(tag: ts.JSDocTagInfo | {
    text: ts.SymbolDisplayPart[];
}): string;
