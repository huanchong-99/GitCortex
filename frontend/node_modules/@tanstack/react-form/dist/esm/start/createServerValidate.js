import { isGlobalFormValidationError, isStandardSchemaValidator, standardSchemaValidators } from "@tanstack/form-core";
import { getHeader } from "@tanstack/react-start/server";
import { decode } from "decode-formdata";
import { ServerValidateError } from "./error.js";
import { setInternalTanStackCookie } from "./utils.js";
const createServerValidate = (defaultOpts) => async (formData, info) => {
  const { onServerValidate } = defaultOpts;
  const runValidator = async ({
    value,
    validationSource
  }) => {
    if (isStandardSchemaValidator(onServerValidate)) {
      return await standardSchemaValidators.validateAsync(
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
  const referer = getHeader("referer");
  const data = decode(formData, info);
  const onServerError = await runValidator({
    value: data,
    validationSource: "form"
  });
  if (!onServerError) return data;
  const onServerErrorVal = isGlobalFormValidationError(onServerError) ? onServerError.form : onServerError;
  const formState = {
    errorMap: {
      onServer: onServerError
    },
    values: data,
    errors: onServerErrorVal ? [onServerErrorVal] : []
  };
  setInternalTanStackCookie(formState);
  throw new ServerValidateError({
    response: new Response("ok", {
      headers: {
        Location: referer
      },
      status: 302
    }),
    formState
  });
};
export {
  createServerValidate
};
//# sourceMappingURL=createServerValidate.js.map
