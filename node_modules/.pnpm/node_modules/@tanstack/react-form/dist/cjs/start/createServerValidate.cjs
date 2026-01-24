"use strict";
Object.defineProperty(exports, Symbol.toStringTag, { value: "Module" });
const formCore = require("@tanstack/form-core");
const server = require("@tanstack/react-start/server");
const decodeFormdata = require("decode-formdata");
const error = require("./error.cjs");
const utils = require("./utils.cjs");
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
  const referer = server.getHeader("referer");
  const data = decodeFormdata.decode(formData, info);
  const onServerError = await runValidator({
    value: data,
    validationSource: "form"
  });
  if (!onServerError) return data;
  const onServerErrorVal = formCore.isGlobalFormValidationError(onServerError) ? onServerError.form : onServerError;
  const formState = {
    errorMap: {
      onServer: onServerError
    },
    values: data,
    errors: onServerErrorVal ? [onServerErrorVal] : []
  };
  utils.setInternalTanStackCookie(formState);
  throw new error.ServerValidateError({
    response: new Response("ok", {
      headers: {
        Location: referer
      },
      status: 302
    }),
    formState
  });
};
exports.createServerValidate = createServerValidate;
//# sourceMappingURL=createServerValidate.cjs.map
