import * as e from "react";
const w = e.forwardRef((l, s) => {
  const {
    alt: r,
    color: a = "currentColor",
    size: t = "1em",
    weight: o = "regular",
    mirrored: i = !1,
    children: n,
    weights: c,
    ...m
  } = l;
  return /* @__PURE__ */ e.createElement(
    "svg",
    {
      ref: s,
      xmlns: "http://www.w3.org/2000/svg",
      width: t,
      height: t,
      fill: a,
      viewBox: "0 0 256 256",
      transform: i ? "scale(-1, 1)" : void 0,
      ...m
    },
    !!r && /* @__PURE__ */ e.createElement("title", null, r),
    n,
    c.get(o)
  );
});
w.displayName = "SSRBase";
export {
  w as default
};
