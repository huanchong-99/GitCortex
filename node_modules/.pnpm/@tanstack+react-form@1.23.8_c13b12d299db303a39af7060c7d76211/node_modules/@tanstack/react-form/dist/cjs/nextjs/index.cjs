"use strict";
Object.defineProperty(exports, Symbol.toStringTag, { value: "Module" });
const formCore = require("@tanstack/form-core");
const createServerValidate = require("./createServerValidate.cjs");
const error = require("./error.cjs");
exports.createServerValidate = createServerValidate.createServerValidate;
exports.initialFormState = createServerValidate.initialFormState;
exports.ServerValidateError = error.ServerValidateError;
Object.keys(formCore).forEach((k) => {
  if (k !== "default" && !Object.prototype.hasOwnProperty.call(exports, k)) Object.defineProperty(exports, k, {
    enumerable: true,
    get: () => formCore[k]
  });
});
//# sourceMappingURL=index.cjs.map
