"use strict";
Object.defineProperty(exports, Symbol.toStringTag, { value: "Module" });
const jsxRuntime = require("react/jsx-runtime");
const formCore = require("@tanstack/form-core");
const reactStore = require("@tanstack/react-store");
const react = require("react");
const useField = require("./useField.cjs");
const useIsomorphicLayoutEffect = require("./useIsomorphicLayoutEffect.cjs");
function LocalSubscribe({
  form,
  selector,
  children
}) {
  const data = reactStore.useStore(form.store, selector);
  return formCore.functionalUpdate(children, data);
}
function useForm(opts) {
  const formId = react.useId();
  const [formApi] = react.useState(() => {
    const api = new formCore.FormApi({ ...opts, formId });
    const extendedApi = api;
    extendedApi.Field = function APIField(props) {
      return /* @__PURE__ */ jsxRuntime.jsx(useField.Field, { ...props, form: api });
    };
    extendedApi.Subscribe = function Subscribe(props) {
      return /* @__PURE__ */ jsxRuntime.jsx(
        LocalSubscribe,
        {
          form: api,
          selector: props.selector,
          children: props.children
        }
      );
    };
    return extendedApi;
  });
  useIsomorphicLayoutEffect.useIsomorphicLayoutEffect(formApi.mount, []);
  useIsomorphicLayoutEffect.useIsomorphicLayoutEffect(() => {
    formApi.update(opts);
  });
  return formApi;
}
exports.useForm = useForm;
//# sourceMappingURL=useForm.cjs.map
