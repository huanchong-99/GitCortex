import { jsx, Fragment } from "react/jsx-runtime";
import { useState, useMemo } from "react";
import { useStore } from "@tanstack/react-store";
import { FieldApi, functionalUpdate } from "@tanstack/form-core";
import { useIsomorphicLayoutEffect } from "./useIsomorphicLayoutEffect.js";
function useField(opts) {
  const [fieldApi] = useState(() => {
    const api = new FieldApi({
      ...opts,
      form: opts.form,
      name: opts.name
    });
    const extendedApi = api;
    extendedApi.Field = Field;
    return extendedApi;
  });
  useIsomorphicLayoutEffect(fieldApi.mount, [fieldApi]);
  useIsomorphicLayoutEffect(() => {
    fieldApi.update(opts);
  });
  useStore(
    fieldApi.store,
    opts.mode === "array" ? (state) => {
      return [
        state.meta,
        Object.keys(state.value ?? []).length
      ];
    } : void 0
  );
  return fieldApi;
}
const Field = (({
  children,
  ...fieldOptions
}) => {
  const fieldApi = useField(fieldOptions);
  const jsxToDisplay = useMemo(
    () => functionalUpdate(children, fieldApi),
    /**
     * The reason this exists is to fix an issue with the React Compiler.
     * Namely, functionalUpdate is memoized where it checks for `fieldApi`, which is a static type.
     * This means that when `state.value` changes, it does not trigger a re-render. The useMemo explicitly fixes this problem
     */
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [children, fieldApi, fieldApi.state.value, fieldApi.state.meta]
  );
  return /* @__PURE__ */ jsx(Fragment, { children: jsxToDisplay });
});
export {
  Field,
  useField
};
//# sourceMappingURL=useField.js.map
