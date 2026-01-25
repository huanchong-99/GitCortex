"use strict";
Object.defineProperty(exports, Symbol.toStringTag, { value: "Module" });
const jsxRuntime = require("react/jsx-runtime");
const react = require("react");
const useForm = require("./useForm.cjs");
const useFieldGroup = require("./useFieldGroup.cjs");
const fieldContext = react.createContext(null);
const formContext = react.createContext(null);
function createFormHookContexts() {
  function useFieldContext() {
    const field = react.useContext(fieldContext);
    if (!field) {
      throw new Error(
        "`fieldContext` only works when within a `fieldComponent` passed to `createFormHook`"
      );
    }
    return field;
  }
  function useFormContext() {
    const form = react.useContext(formContext);
    if (!form) {
      throw new Error(
        "`formContext` only works when within a `formComponent` passed to `createFormHook`"
      );
    }
    return form;
  }
  return { fieldContext, useFieldContext, useFormContext, formContext };
}
function createFormHook({
  fieldComponents,
  fieldContext: fieldContext2,
  formContext: formContext2,
  formComponents
}) {
  function useAppForm(props) {
    const form = useForm.useForm(props);
    const AppForm = react.useMemo(() => {
      const AppForm2 = (({ children }) => {
        return /* @__PURE__ */ jsxRuntime.jsx(formContext2.Provider, { value: form, children });
      });
      return AppForm2;
    }, [form]);
    const AppField = react.useMemo(() => {
      const AppField2 = (({ children, ...props2 }) => {
        return /* @__PURE__ */ jsxRuntime.jsx(form.Field, { ...props2, children: (field) => (
          // eslint-disable-next-line @eslint-react/no-context-provider
          /* @__PURE__ */ jsxRuntime.jsx(fieldContext2.Provider, { value: field, children: children(Object.assign(field, fieldComponents)) })
        ) });
      });
      return AppField2;
    }, [form]);
    const extendedForm = react.useMemo(() => {
      return Object.assign(form, {
        AppField,
        AppForm,
        ...formComponents
      });
    }, [form, AppField, AppForm]);
    return extendedForm;
  }
  function withForm({
    render,
    props
  }) {
    return (innerProps) => render({ ...props, ...innerProps });
  }
  function withFieldGroup({
    render,
    props,
    defaultValues
  }) {
    return function Render(innerProps) {
      const fieldGroupProps = react.useMemo(() => {
        return {
          form: innerProps.form,
          fields: innerProps.fields,
          defaultValues,
          formComponents
        };
      }, [innerProps.form, innerProps.fields]);
      const fieldGroupApi = useFieldGroup.useFieldGroup(fieldGroupProps);
      return render({ ...props, ...innerProps, group: fieldGroupApi });
    };
  }
  return {
    useAppForm,
    withForm,
    withFieldGroup
  };
}
exports.createFormHook = createFormHook;
exports.createFormHookContexts = createFormHookContexts;
//# sourceMappingURL=createFormHook.cjs.map
