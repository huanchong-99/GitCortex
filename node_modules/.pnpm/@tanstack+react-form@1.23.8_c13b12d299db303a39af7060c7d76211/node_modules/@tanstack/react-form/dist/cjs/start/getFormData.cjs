"use strict";
Object.defineProperty(exports, Symbol.toStringTag, { value: "Module" });
const utils = require("./utils.cjs");
const initialFormState = {
  errorMap: {
    onServer: void 0
  },
  errors: []
};
const getFormData = async () => {
  const data = utils.getInternalTanStackCookie();
  utils.deleteInternalTanStackCookie();
  if (!data) return initialFormState;
  return data;
};
exports.getFormData = getFormData;
exports.initialFormState = initialFormState;
//# sourceMappingURL=getFormData.cjs.map
