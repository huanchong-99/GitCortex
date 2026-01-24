"use strict";
Object.defineProperty(exports, Symbol.toStringTag, { value: "Module" });
const server = require("@tanstack/react-start/server");
const devalue = require("devalue");
const _INTERNALS_COOKIE_NAME = "_tanstack_form_internals";
const setInternalTanStackCookie = (data) => {
  const cookie = devalue.stringify(data);
  server.setCookie(_INTERNALS_COOKIE_NAME, cookie);
};
const getInternalTanStackCookie = () => {
  const cookie = server.getCookie(_INTERNALS_COOKIE_NAME);
  if (!cookie) return void 0;
  return devalue.parse(cookie);
};
const deleteInternalTanStackCookie = () => {
  server.deleteCookie(_INTERNALS_COOKIE_NAME);
};
exports.deleteInternalTanStackCookie = deleteInternalTanStackCookie;
exports.getInternalTanStackCookie = getInternalTanStackCookie;
exports.setInternalTanStackCookie = setInternalTanStackCookie;
//# sourceMappingURL=utils.cjs.map
