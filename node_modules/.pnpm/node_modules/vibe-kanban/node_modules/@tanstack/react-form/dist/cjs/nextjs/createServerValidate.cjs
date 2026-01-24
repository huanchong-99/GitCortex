"use strict";
Object.defineProperty(exports, Symbol.toStringTag, { value: "Module" });
const decodeFormdata = require("decode-formdata");
const formCore = require("@tanstack/form-core");
const error = require("./error.cjs");
const createServerValidate = (defaultOpts) => async (formData, info) => {
  const { onServerValidate } = defaultOpts;
  const runValidator = async ({
    value,
    validationSource
  }) => {
    if (formCore.isStandardSchemaValidator(onServerValidate)) {
      return await formCore.standardSchemaValidators.validateAsync(
        { value, validationSource },
        onServerValidate
      );
    }
    return onServerValidate({
      value,
      signal: void 0,
      formApi: void 0
    });
  };
  const values = decodeFormdata.decode(formData, info);
  const onServerError = await runValidator({
    value: values,
    validationSource: "form"
  });
  if (!onServerError) return values;
  const onServerErrorVal = formCore.isGlobalFormValidationError(onServerError) ? onServerError.form : onServerError;
  const formState = {
    errorMap: {
      onServer: onServerError
    },
    values,
    errors: onServerErrorVal ? [onServerErrorVal] : []
  };
  throw new error.ServerValidateError({
    formState
  });
};
const initialFormState = {
  errorMap: {
    onServer: void 0
  },
  values: void 0,
  errors: []
};
exports.createServerValidate = createServerValidate;
exports.initialFormState = initialFormState;
//# sourceMappingURL=createServerValidate.cjs.map
