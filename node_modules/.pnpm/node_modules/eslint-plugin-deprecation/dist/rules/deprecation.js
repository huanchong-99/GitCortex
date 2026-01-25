"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
/**
 * This program is free software; you can redistribute it and/or
 * modify it under the terms of the GNU Lesser General Public
 * License as published by the Free Software Foundation; either
 * version 3 of the License, or (at your option) any later version.
 *
 * This program is distributed in the hope that it will be useful,
 * but WITHOUT ANY WARRANTY; without even the implied warranty of
 * MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the GNU
 * Lesser General Public License for more details.
 *
 * You should have received a copy of the GNU Lesser General Public License
 * along with this program; if not, write to the Free Software Foundation,
 * Inc., 51 Franklin Street, Fifth Floor, Boston, MA  02110-1301, USA.
 */
const utils_1 = require("@typescript-eslint/utils");
const ts_api_utils_1 = require("ts-api-utils");
const ts = require("typescript");
const stringifyJSDocTagInfoText_1 = require("../utils/stringifyJSDocTagInfoText");
const createRule = utils_1.ESLintUtils.RuleCreator(() => 'https://github.com/gund/eslint-plugin-deprecation');
exports.default = createRule({
    name: 'deprecation',
    meta: {
        type: 'problem',
        docs: {
            description: 'Do not use deprecated APIs.',
            requiresTypeChecking: true,
        },
        messages: {
            deprecated: `'{{name}}' is deprecated. {{reason}}`,
        },
        schema: [],
    },
    defaultOptions: [],
    create(context) {
        const services = utils_1.ESLintUtils.getParserServices(context);
        if (!services.program) {
            throw new Error('TypeScript is required for this rule: https://github.com/gund/eslint-plugin-deprecation#prerequisites');
        }
        const identifierRule = createRuleForIdentifier(context);
        return {
            Identifier: identifierRule,
            JSXIdentifier: identifierRule,
        };
    },
});
function createRuleForIdentifier(context) {
    return function identifierRule(id) {
        // Don't consider deprecations in certain cases:
        var _a;
        // - On JSX closing elements (only flag the opening element)
        const isClosingElement = id.type === 'JSXIdentifier' && ((_a = id.parent) === null || _a === void 0 ? void 0 : _a.type) === 'JSXClosingElement';
        if (isClosingElement) {
            return;
        }
        // - At the spot where something is declared
        const isIdDeclaration = (id.type === 'Identifier' || id.type === 'JSXIdentifier') &&
            isDeclaration(id, context);
        if (isIdDeclaration) {
            return;
        }
        // - Inside an import
        const isInsideImport = context
            .getAncestors()
            .some((anc) => anc.type.includes('Import'));
        if (isInsideImport) {
            return;
        }
        const services = utils_1.ESLintUtils.getParserServices(context);
        const deprecation = getDeprecation(id, services, context);
        if (deprecation) {
            context.report({
                node: id,
                messageId: 'deprecated',
                data: {
                    name: id.name,
                    reason: deprecation.reason,
                },
            });
        }
    };
}
function getParent(context) {
    const ancestors = context.getAncestors();
    return ancestors.length > 0 ? ancestors[ancestors.length - 1] : undefined;
}
// Unfortunately need to keep some state because identifiers like foo in
// `const { foo } = bar` will be processed twice.
let lastProcessedDuplicateName;
function isDeclaration(id, context) {
    var _a, _b;
    const parent = getParent(context);
    switch (parent === null || parent === void 0 ? void 0 : parent.type) {
        case 'TSEnumDeclaration':
        case 'TSInterfaceDeclaration':
        case 'TSTypeAliasDeclaration':
        case 'TSModuleDeclaration': // module or namespace
        case 'TSPropertySignature': // property in an interface
        case 'TSParameterProperty': // `constructor(public foo) {}`
        // Type parameter: constraint and default are not identifiers
        case 'TSTypeParameter': // T in `type Foo<T> = {}`
        // Function/method: only the name and param names are identifiers
        // (default values are assignment patterns or other types)
        case 'FunctionDeclaration': // `function foo(param) {}`
        case 'FunctionExpression': // `<something> = function foo(param) {}`
        case 'TSDeclareFunction': // `function foo(param);`  (no body)
        case 'MethodDefinition': // methods, getters, setters, constructor
        case 'TSEmptyBodyFunctionExpression': // method without implementation
        case 'TSMethodSignature': // method in an interface
        case 'ArrowFunctionExpression':
            return true;
        case 'ClassExpression': // `<something> = class Foo {}`
        case 'ClassDeclaration': // `class Foo {}`
        case 'VariableDeclarator': // `const foo` or `const foo = bar`
        case 'TSEnumMember': // enum member declaration
            // Prevent considering initializer, extends, or implements to be declaration
            return parent.id === id;
        //@ts-ignore
        case 'ClassProperty':
        //@ts-ignore
        case 'PropertyDefinition':
            // Prevent considering value to be a declaration
            return parent.key === id;
        case 'ArrayPattern': // `const [foo, bar] = baz`
            // Array destructuring is truly a declaration on the left side
            // (even if there's reassignment)
            return id.type === 'Identifier' && parent.elements.includes(id);
        case 'Property':
            // no for ObjectExpression: `const foo = { bar: baz }`
            if (((_a = parent.parent) === null || _a === void 0 ? void 0 : _a.type) === 'ObjectPattern') {
                if (isShortHandProperty(parent)) {
                    // foo in `const { foo } = bar` will be processed twice, as key and
                    // value. Consider the second to be a declaration and the first not.
                    if (lastProcessedDuplicateName === id.name) {
                        lastProcessedDuplicateName = undefined;
                        return true;
                    }
                    else {
                        lastProcessedDuplicateName = id.name;
                    }
                }
                else {
                    // yes for bar, no for foo in `const { foo: bar } = baz`
                    return parent.value === id;
                }
            }
            return false;
        case 'AssignmentPattern':
            if (((_b = parent.parent) === null || _b === void 0 ? void 0 : _b.type) === 'Property' &&
                isShortHandProperty(parent.parent)) {
                // Variant of the Property/ObjectPattern case above: foo in
                // `const { foo = 3 } = bar` will also show up twice, but the second
                // time will be as an AssignmentPattern left.
                if (lastProcessedDuplicateName === id.name) {
                    lastProcessedDuplicateName = undefined;
                    return true;
                }
            }
            // Yes: bar in `function foo(bar = 3) {}` and `const [bar = 3] = []`
            // No: bar in `const { bar = 3 }`
            return parent.left === id && !isShortHandProperty(parent.parent);
        default:
            return false;
    }
}
function getDeprecation(id, services, context) {
    const tc = services.program.getTypeChecker();
    const callExpression = getCallExpression(context, id);
    if (callExpression) {
        const tsCallExpression = services.esTreeNodeToTSNodeMap.get(callExpression);
        const signature = tc.getResolvedSignature(tsCallExpression);
        if (signature) {
            const deprecation = getJsDocDeprecation(signature.getJsDocTags());
            if (deprecation) {
                return deprecation;
            }
        }
    }
    const symbol = getSymbol(id, services, tc);
    if (!symbol) {
        return undefined;
    }
    if (callExpression && isFunction(symbol)) {
        return undefined;
    }
    return getJsDocDeprecation(symbol.getJsDocTags());
}
function getSymbol(id, services, tc) {
    let symbol;
    const tsId = services.esTreeNodeToTSNodeMap.get(id);
    const parent = tsId.parent;
    if (parent.kind === ts.SyntaxKind.BindingElement) {
        symbol = tc.getTypeAtLocation(parent.parent).getProperty(tsId.text);
    }
    else if ((isPropertyAssignment(parent) && parent.name === tsId) ||
        (isShorthandPropertyAssignment(parent) &&
            parent.name === tsId &&
            isReassignmentTarget(tsId))) {
        try {
            symbol = tc.getPropertySymbolOfDestructuringAssignment(tsId);
        }
        catch (e) {
            // we are in object literal, not destructuring
            // no obvious easy way to check that in advance
            symbol = tc.getSymbolAtLocation(tsId);
        }
    }
    else {
        symbol = tc.getSymbolAtLocation(tsId);
    }
    if (symbol && (symbol.flags & ts.SymbolFlags.Alias) !== 0) {
        symbol = tc.getAliasedSymbol(symbol);
    }
    return symbol;
}
function getCallExpression(context, id) {
    const ancestors = context.getAncestors();
    let callee = id;
    let parent = ancestors.length > 0 ? ancestors[ancestors.length - 1] : undefined;
    if (parent && parent.type === 'MemberExpression' && parent.property === id) {
        callee = parent;
        parent = ancestors.length > 1 ? ancestors[ancestors.length - 2] : undefined;
    }
    if (isCallExpression(parent, callee)) {
        return parent;
    }
}
function isCallExpression(node, callee) {
    if (node) {
        if (node.type === 'NewExpression' || node.type === 'CallExpression') {
            return node.callee === callee;
        }
        else if (node.type === 'TaggedTemplateExpression') {
            return node.tag === callee;
        }
        else if (node.type === 'JSXOpeningElement') {
            return node.name === callee;
        }
    }
    return false;
}
function getJsDocDeprecation(tags) {
    for (const tag of tags) {
        if (tag.name === 'deprecated') {
            return { reason: (0, stringifyJSDocTagInfoText_1.stringifyJSDocTagInfoText)(tag) };
        }
    }
    return undefined;
}
function isFunction(symbol) {
    const { declarations } = symbol;
    if (declarations === undefined || declarations.length === 0) {
        return false;
    }
    switch (declarations[0].kind) {
        case ts.SyntaxKind.MethodDeclaration:
        case ts.SyntaxKind.FunctionDeclaration:
        case ts.SyntaxKind.FunctionExpression:
        case ts.SyntaxKind.MethodSignature:
            return true;
        default:
            return false;
    }
}
function isReassignmentTarget(node) {
    return ((0, ts_api_utils_1.getAccessKind)(node) & ts_api_utils_1.AccessKind.Write) !== 0;
}
function isPropertyAssignment(node) {
    return node.kind === ts.SyntaxKind.PropertyAssignment;
}
function isShorthandPropertyAssignment(node) {
    return node.kind === ts.SyntaxKind.ShorthandPropertyAssignment;
}
function isShortHandProperty(parent) {
    return !!parent && parent.type === 'Property' && parent.shorthand;
}
//# sourceMappingURL=deprecation.js.map