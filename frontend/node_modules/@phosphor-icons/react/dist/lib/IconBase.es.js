import * as e from "react";
import { IconContext as h } from "./context.es.js";
const p = e.forwardRef(
  (s, a) => {
    const {
      alt: n,
      color: r,
      size: t,
      weight: o,
      mirrored: c,
      children: i,
      weights: m,
      ...x
    } = s, {
      color: d = "currentColor",
      size: l,
      weight: f = "regular",
      mirrored: g = !1,
      ...w
    } = e.useContext(h);
    return /* @__PURE__ */ e.createElement(
      "svg",
      {
        ref: a,
        xmlns: "http://www.w3.org/2000/svg",
        width: t != null ? t : l,
        height: t != null ? t : l,
        fill: r != null ? r : d,
        viewBox: "0 0 256 256",
        transform: c || g ? "scale(-1, 1)" : void 0,
        ...w,
        ...x
      },
      !!n && /* @__PURE__ */ e.createElement("title", null, n),
      i,
      m.get(o != null ? o : f)
    );
  }
);
p.displayName = "IconBase";
export {
  p as default
};
