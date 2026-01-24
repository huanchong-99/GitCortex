/**
 * Copyright (c) Meta Platforms, Inc. and affiliates.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 *
 * @lightSyntaxTransform
 * @noflow
 * @nolint
 * @preventMunge
 * @preserve-invariant-messages
 */

"use no memo";
"use strict";
var __create = Object.create;
var __defProp = Object.defineProperty;
var __getOwnPropDesc = Object.getOwnPropertyDescriptor;
var __getOwnPropNames = Object.getOwnPropertyNames;
var __getProtoOf = Object.getPrototypeOf;
var __hasOwnProp = Object.prototype.hasOwnProperty;
var __export = (target, all) => {
  for (var name in all)
    __defProp(target, name, { get: all[name], enumerable: true });
};
var __copyProps = (to, from, except, desc) => {
  if (from && typeof from === "object" || typeof from === "function") {
    for (let key of __getOwnPropNames(from))
      if (!__hasOwnProp.call(to, key) && key !== except)
        __defProp(to, key, { get: () => from[key], enumerable: !(desc = __getOwnPropDesc(from, key)) || desc.enumerable });
  }
  return to;
};
var __toESM = (mod, isNodeMode, target) => (target = mod != null ? __create(__getProtoOf(mod)) : {}, __copyProps(
  // If the importer is in node compatibility mode or this is not an ESM
  // file that has been converted to a CommonJS file using a Babel-
  // compatible transform (i.e. "__esModule" has not been set), then set
  // "default" to the CommonJS "module.exports" for node compatibility.
  isNodeMode || !mod || !mod.__esModule ? __defProp(target, "default", { value: mod, enumerable: true }) : target,
  mod
));
var __toCommonJS = (mod) => __copyProps(__defProp({}, "__esModule", { value: true }), mod);

// src/index.ts
var index_exports = {};
__export(index_exports, {
  $dispatcherGuard: () => $dispatcherGuard,
  $makeReadOnly: () => $makeReadOnly,
  $reset: () => $reset,
  $structuralCheck: () => $structuralCheck,
  c: () => c,
  clearRenderCounterRegistry: () => clearRenderCounterRegistry,
  renderCounterRegistry: () => renderCounterRegistry,
  useRenderCounter: () => useRenderCounter
});
module.exports = __toCommonJS(index_exports);
var React = __toESM(require("react"));
var { useRef, useEffect, isValidElement } = React;
var _a;
var ReactSecretInternals = (
  //@ts-ignore
  (_a = React.__CLIENT_INTERNALS_DO_NOT_USE_OR_WARN_USERS_THEY_CANNOT_UPGRADE) != null ? _a : React.__SECRET_INTERNALS_DO_NOT_USE_OR_YOU_WILL_BE_FIRED
);
var $empty = Symbol.for("react.memo_cache_sentinel");
var _a2;
var c = (
  // @ts-expect-error
  typeof ((_a2 = React.__COMPILER_RUNTIME) == null ? void 0 : _a2.c) === "function" ? (
    // @ts-expect-error
    React.__COMPILER_RUNTIME.c
  ) : function c2(size) {
    return React.useMemo(() => {
      const $ = new Array(size);
      for (let ii = 0; ii < size; ii++) {
        $[ii] = $empty;
      }
      $[$empty] = true;
      return $;
    }, []);
  }
);
var LazyGuardDispatcher = {};
[
  "readContext",
  "useCallback",
  "useContext",
  "useEffect",
  "useImperativeHandle",
  "useInsertionEffect",
  "useLayoutEffect",
  "useMemo",
  "useReducer",
  "useRef",
  "useState",
  "useDebugValue",
  "useDeferredValue",
  "useTransition",
  "useMutableSource",
  "useSyncExternalStore",
  "useId",
  "unstable_isNewReconciler",
  "getCacheSignal",
  "getCacheForType",
  "useCacheRefresh"
].forEach((name) => {
  LazyGuardDispatcher[name] = () => {
    throw new Error(
      `[React] Unexpected React hook call (${name}) from a React compiled function. Check that all hooks are called directly and named according to convention ('use[A-Z]') `
    );
  };
});
var originalDispatcher = null;
LazyGuardDispatcher["useMemoCache"] = (count) => {
  if (originalDispatcher == null) {
    throw new Error(
      "React Compiler internal invariant violation: unexpected null dispatcher"
    );
  } else {
    return originalDispatcher.useMemoCache(count);
  }
};
function setCurrent(newDispatcher) {
  ReactSecretInternals.ReactCurrentDispatcher.current = newDispatcher;
  return ReactSecretInternals.ReactCurrentDispatcher.current;
}
var guardFrames = [];
function $dispatcherGuard(kind) {
  const curr = ReactSecretInternals.ReactCurrentDispatcher.current;
  if (kind === 0 /* PushGuardContext */) {
    guardFrames.push(curr);
    if (guardFrames.length === 1) {
      originalDispatcher = curr;
    }
    if (curr === LazyGuardDispatcher) {
      throw new Error(
        `[React] Unexpected call to custom hook or component from a React compiled function. Check that (1) all hooks are called directly and named according to convention ('use[A-Z]') and (2) components are returned as JSX instead of being directly invoked.`
      );
    }
    setCurrent(LazyGuardDispatcher);
  } else if (kind === 1 /* PopGuardContext */) {
    const lastFrame = guardFrames.pop();
    if (lastFrame == null) {
      throw new Error(
        "React Compiler internal error: unexpected null in guard stack"
      );
    }
    if (guardFrames.length === 0) {
      originalDispatcher = null;
    }
    setCurrent(lastFrame);
  } else if (kind === 2 /* PushExpectHook */) {
    guardFrames.push(curr);
    setCurrent(originalDispatcher);
  } else if (kind === 3 /* PopExpectHook */) {
    const lastFrame = guardFrames.pop();
    if (lastFrame == null) {
      throw new Error(
        "React Compiler internal error: unexpected null in guard stack"
      );
    }
    setCurrent(lastFrame);
  } else {
    throw new Error("React Compiler internal error: unreachable block" + kind);
  }
}
function $reset($) {
  for (let ii = 0; ii < $.length; ii++) {
    $[ii] = $empty;
  }
}
function $makeReadOnly() {
  throw new Error("TODO: implement $makeReadOnly in react-compiler-runtime");
}
var renderCounterRegistry = /* @__PURE__ */ new Map();
function clearRenderCounterRegistry() {
  for (const counters of renderCounterRegistry.values()) {
    counters.forEach((counter) => {
      counter.count = 0;
    });
  }
}
function registerRenderCounter(name, val) {
  let counters = renderCounterRegistry.get(name);
  if (counters == null) {
    counters = /* @__PURE__ */ new Set();
    renderCounterRegistry.set(name, counters);
  }
  counters.add(val);
}
function removeRenderCounter(name, val) {
  const counters = renderCounterRegistry.get(name);
  if (counters == null) {
    return;
  }
  counters.delete(val);
}
function useRenderCounter(name) {
  const val = useRef(null);
  if (val.current != null) {
    val.current.count += 1;
  }
  useEffect(() => {
    if (val.current == null) {
      const counter = { count: 0 };
      registerRenderCounter(name, counter);
      val.current = counter;
    }
    return () => {
      if (val.current !== null) {
        removeRenderCounter(name, val.current);
      }
    };
  });
}
var seenErrors = /* @__PURE__ */ new Set();
function $structuralCheck(oldValue, newValue, variableName, fnName, kind, loc) {
  function error(l, r, path, depth) {
    const str = `${fnName}:${loc} [${kind}] ${variableName}${path} changed from ${l} to ${r} at depth ${depth}`;
    if (seenErrors.has(str)) {
      return;
    }
    seenErrors.add(str);
    console.error(str);
  }
  const depthLimit = 2;
  function recur(oldValue2, newValue2, path, depth) {
    if (depth > depthLimit) {
      return;
    } else if (oldValue2 === newValue2) {
      return;
    } else if (typeof oldValue2 !== typeof newValue2) {
      error(`type ${typeof oldValue2}`, `type ${typeof newValue2}`, path, depth);
    } else if (typeof oldValue2 === "object") {
      const oldArray = Array.isArray(oldValue2);
      const newArray = Array.isArray(newValue2);
      if (oldValue2 === null && newValue2 !== null) {
        error("null", `type ${typeof newValue2}`, path, depth);
      } else if (newValue2 === null) {
        error(`type ${typeof oldValue2}`, "null", path, depth);
      } else if (oldValue2 instanceof Map) {
        if (!(newValue2 instanceof Map)) {
          error(`Map instance`, `other value`, path, depth);
        } else if (oldValue2.size !== newValue2.size) {
          error(
            `Map instance with size ${oldValue2.size}`,
            `Map instance with size ${newValue2.size}`,
            path,
            depth
          );
        } else {
          for (const [k, v] of oldValue2) {
            if (!newValue2.has(k)) {
              error(
                `Map instance with key ${k}`,
                `Map instance without key ${k}`,
                path,
                depth
              );
            } else {
              recur(v, newValue2.get(k), `${path}.get(${k})`, depth + 1);
            }
          }
        }
      } else if (newValue2 instanceof Map) {
        error("other value", `Map instance`, path, depth);
      } else if (oldValue2 instanceof Set) {
        if (!(newValue2 instanceof Set)) {
          error(`Set instance`, `other value`, path, depth);
        } else if (oldValue2.size !== newValue2.size) {
          error(
            `Set instance with size ${oldValue2.size}`,
            `Set instance with size ${newValue2.size}`,
            path,
            depth
          );
        } else {
          for (const v of newValue2) {
            if (!oldValue2.has(v)) {
              error(
                `Set instance without element ${v}`,
                `Set instance with element ${v}`,
                path,
                depth
              );
            }
          }
        }
      } else if (newValue2 instanceof Set) {
        error("other value", `Set instance`, path, depth);
      } else if (oldArray || newArray) {
        if (oldArray !== newArray) {
          error(
            `type ${oldArray ? "array" : "object"}`,
            `type ${newArray ? "array" : "object"}`,
            path,
            depth
          );
        } else if (oldValue2.length !== newValue2.length) {
          error(
            `array with length ${oldValue2.length}`,
            `array with length ${newValue2.length}`,
            path,
            depth
          );
        } else {
          for (let ii = 0; ii < oldValue2.length; ii++) {
            recur(oldValue2[ii], newValue2[ii], `${path}[${ii}]`, depth + 1);
          }
        }
      } else if (isValidElement(oldValue2) || isValidElement(newValue2)) {
        if (isValidElement(oldValue2) !== isValidElement(newValue2)) {
          error(
            `type ${isValidElement(oldValue2) ? "React element" : "object"}`,
            `type ${isValidElement(newValue2) ? "React element" : "object"}`,
            path,
            depth
          );
        } else if (oldValue2.type !== newValue2.type) {
          error(
            `React element of type ${oldValue2.type}`,
            `React element of type ${newValue2.type}`,
            path,
            depth
          );
        } else {
          recur(
            oldValue2.props,
            newValue2.props,
            `[props of ${path}]`,
            depth + 1
          );
        }
      } else {
        for (const key in newValue2) {
          if (!(key in oldValue2)) {
            error(
              `object without key ${key}`,
              `object with key ${key}`,
              path,
              depth
            );
          }
        }
        for (const key in oldValue2) {
          if (!(key in newValue2)) {
            error(
              `object with key ${key}`,
              `object without key ${key}`,
              path,
              depth
            );
          } else {
            recur(oldValue2[key], newValue2[key], `${path}.${key}`, depth + 1);
          }
        }
      }
    } else if (typeof oldValue2 === "function") {
      return;
    } else if (isNaN(oldValue2) || isNaN(newValue2)) {
      if (isNaN(oldValue2) !== isNaN(newValue2)) {
        error(
          `${isNaN(oldValue2) ? "NaN" : "non-NaN value"}`,
          `${isNaN(newValue2) ? "NaN" : "non-NaN value"}`,
          path,
          depth
        );
      }
    } else if (oldValue2 !== newValue2) {
      error(oldValue2, newValue2, path, depth);
    }
  }
  recur(oldValue, newValue, "", 0);
}
// Annotate the CommonJS export names for ESM import in node:
0 && (module.exports = {
  $dispatcherGuard,
  $makeReadOnly,
  $reset,
  $structuralCheck,
  c,
  clearRenderCounterRegistry,
  renderCounterRegistry,
  useRenderCounter
});
//# sourceMappingURL=index.js.map