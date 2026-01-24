"use strict";
Object.defineProperty(exports, Symbol.toStringTag, { value: "Module" });
function isFunction(value) {
  return typeof value === "function";
}
function parseFunctionOrValue(value, ...args) {
  return isFunction(value) ? value(...args) : value;
}
function createKey(key) {
  if (key) {
    return key;
  }
  if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
    return crypto.randomUUID();
  }
  return "";
}
exports.createKey = createKey;
exports.isFunction = isFunction;
exports.parseFunctionOrValue = parseFunctionOrValue;
//# sourceMappingURL=utils.cjs.map
