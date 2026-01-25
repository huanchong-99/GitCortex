"use strict";
Object.defineProperty(exports, Symbol.toStringTag, { value: "Module" });
class ServerValidateError extends Error {
  constructor(options) {
    super("Your form has errors. Please check the fields and try again.");
    this.name = "ServerValidateError";
    this.response = options.response;
    this.formState = options.formState;
  }
}
exports.ServerValidateError = ServerValidateError;
//# sourceMappingURL=error.cjs.map
