import { getInternalTanStackCookie, deleteInternalTanStackCookie } from "./utils.js";
const initialFormState = {
  errorMap: {
    onServer: void 0
  },
  errors: []
};
const getFormData = async () => {
  const data = getInternalTanStackCookie();
  deleteInternalTanStackCookie();
  if (!data) return initialFormState;
  return data;
};
export {
  getFormData,
  initialFormState
};
//# sourceMappingURL=getFormData.js.map
