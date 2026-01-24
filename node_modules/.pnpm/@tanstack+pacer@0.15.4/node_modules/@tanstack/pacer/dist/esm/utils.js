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
export {
  createKey,
  isFunction,
  parseFunctionOrValue
};
//# sourceMappingURL=utils.js.map
