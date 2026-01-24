import { decode } from "decode-formdata";
import { isGlobalFormValidationError, isStandardSchemaValidator, standardSchemaValidators } from "@tanstack/form-core";
import { ServerValidateError } from "./error.js";
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
  const values = decode(formData, info);
  const onServerError = await runValidator({
    value: values,
    validationSource: "form"
  });
  if (!onServerError) return values;
  const onServerErrorVal = isGlobalFormValidationError(onServerError) ? onServerError.form : onServerError;
  const formState = {
    errorMap: {
      onServer: onServerError
    },
    values,
    errors: onServerErrorVal ? [onServerErrorVal] : []
  };
  throw new ServerValidateError({
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
export {
  createServerValidate,
  initialFormState
};
//# sourceMappingURL=createServerValidate.js.map
