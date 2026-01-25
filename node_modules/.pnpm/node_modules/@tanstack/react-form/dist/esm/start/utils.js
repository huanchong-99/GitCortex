import { setCookie, getCookie, deleteCookie } from "@tanstack/react-start/server";
import { stringify, parse } from "devalue";
const _INTERNALS_COOKIE_NAME = "_tanstack_form_internals";
const setInternalTanStackCookie = (data) => {
  const cookie = stringify(data);
  setCookie(_INTERNALS_COOKIE_NAME, cookie);
};
const getInternalTanStackCookie = () => {
  const cookie = getCookie(_INTERNALS_COOKIE_NAME);
  if (!cookie) return void 0;
  return parse(cookie);
};
const deleteInternalTanStackCookie = () => {
  deleteCookie(_INTERNALS_COOKIE_NAME);
};
export {
  deleteInternalTanStackCookie,
  getInternalTanStackCookie,
  setInternalTanStackCookie
};
//# sourceMappingURL=utils.js.map
