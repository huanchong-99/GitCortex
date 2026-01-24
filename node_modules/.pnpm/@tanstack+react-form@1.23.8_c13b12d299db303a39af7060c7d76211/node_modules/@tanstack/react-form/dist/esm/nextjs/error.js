class ServerValidateError extends Error {
  constructor(options) {
    super("Your form has errors. Please check the fields and try again.");
    this.name = "ServerValidateError";
    this.formState = options.formState;
  }
}
export {
  ServerValidateError
};
//# sourceMappingURL=error.js.map
