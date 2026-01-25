"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.stringifyJSDocTagInfoText = void 0;
const ts = require("typescript");
/**
 * Stringifies the text within a JSDocTagInfo AST node with compatibility for
 * pre/post TypeScript 4.3 API changes.
 */
function stringifyJSDocTagInfoText(tag) {
    var _a;
    return isJSDocTagInfo4Point2AndBefore(tag)
        ? (_a = tag.text) !== null && _a !== void 0 ? _a : ''
        : ts.displayPartsToString(tag.text);
}
exports.stringifyJSDocTagInfoText = stringifyJSDocTagInfoText;
function isJSDocTagInfo4Point2AndBefore(tag) {
    return typeof tag.text === 'string';
}
//# sourceMappingURL=stringifyJSDocTagInfoText.js.map