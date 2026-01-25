"use strict";
Object.defineProperty(exports, Symbol.toStringTag, { value: "Module" });
const jsxRuntime = require("react/jsx-runtime");
const react = require("react");
const reactStore = require("@tanstack/react-store");
const formCore = require("@tanstack/form-core");
const useIsomorphicLayoutEffect = require("./useIsomorphicLayoutEffect.cjs");
function useField(opts) {
  const [fieldApi] = react.useState(() => {
    const api = new formCore.FieldApi({
      ...opts,
      form: opts.form,
      name: opts.name
    });
    const extendedApi = api;
    extendedApi.Field = Field;
    return extendedApi;
  });
  useIsomorphicLayoutEffect.useIsomorphicLayoutEffect(fieldApi.mount, [fieldApi]);
  useIsomorphicLayoutEffect.useIsomorphicLayoutEffect(() => {
    fieldApi.update(opts);
  });
  reactStore.useStore(
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
  const jsxToDisplay = react.useMemo(
    () => formCore.functionalUpdate(children, fieldApi),
    /**
     * The reason this exists is to fix an issue with the React Compiler.
     * Namely, functionalUpdate is memoized where it checks for `fieldApi`, which is a static type.
     * This means that when `state.value` changes, it does not trigger a re-render. The useMemo explicitly fixes this problem
     */
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [children, fieldApi, fieldApi.state.value, fieldApi.state.meta]
  );
  return /* @__PURE__ */ jsxRuntime.jsx(jsxRuntime.Fragment, { children: jsxToDisplay });
});
exports.Field = Field;
exports.useField = useField;
//# sourceMappingURL=useField.cjs.map
