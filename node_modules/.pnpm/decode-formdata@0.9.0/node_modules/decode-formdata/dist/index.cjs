"use strict";
var __defProp = Object.defineProperty;
var __getOwnPropDesc = Object.getOwnPropertyDescriptor;
var __getOwnPropNames = Object.getOwnPropertyNames;
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
var __toCommonJS = (mod) => __copyProps(__defProp({}, "__esModule", { value: true }), mod);

// src/index.ts
var index_exports = {};
__export(index_exports, {
  decode: () => decode,
  getFieldDate: () => getFieldDate,
  getFieldValue: () => getFieldValue,
  getPathObject: () => getPathObject,
  getValuePaths: () => getValuePaths
});
module.exports = __toCommonJS(index_exports);

// src/regex.ts
var DIGIT_REGEX = /^\d+$/u;
var NUMBER_REGEX = /^-?\d*(?:\.\d+)?$/u;
var ISO_DATE_REGEX = /^\d{4}-(?:0[1-9]|1[0-2])-(?:[12]\d|0[1-9]|3[01])$/u;
var ISO_DATE_TIME_REGEX = /^\d{4}-(?:0[1-9]|1[0-2])-(?:[12]\d|0[1-9]|3[01])T(?:0\d|1\d|2[0-3]):[0-5]\d$/u;
var ISO_TIME_REGEX = /^(?:0\d|1\d|2[0-3]):[0-5]\d$/u;
var ISO_TIME_SECOND_REGEX = /^(?:0\d|1\d|2[0-3])(?::[0-5]\d){2}$/u;
var ISO_WEEK_REGEX = /^\d{4}-W(?:0[1-9]|[1-4]\d|5[0-3])$/u;

// src/utils/getFieldDate/getFieldDate.ts
function getFieldDate(value) {
  if (!value || value === "null") {
    return null;
  }
  if (value === "undefined") {
    return void 0;
  }
  if (ISO_DATE_REGEX.test(value)) {
    return /* @__PURE__ */ new Date(`${value}T00:00:00.000Z`);
  }
  if (ISO_DATE_TIME_REGEX.test(value)) {
    return /* @__PURE__ */ new Date(`${value}:00.000Z`);
  }
  if (ISO_WEEK_REGEX.test(value)) {
    const [year, week] = value.split("-W");
    const date = /* @__PURE__ */ new Date(`${year}-01-01T00:00:00.000Z`);
    date.setUTCDate((+week - 1) * 7 + 1);
    return date;
  }
  if (ISO_TIME_REGEX.test(value)) {
    return /* @__PURE__ */ new Date(`1970-01-01T${value}:00.000Z`);
  }
  if (ISO_TIME_SECOND_REGEX.test(value)) {
    return /* @__PURE__ */ new Date(`1970-01-01T${value}.000Z`);
  }
  if (DIGIT_REGEX.test(value)) {
    return /* @__PURE__ */ new Date(+value);
  }
  return new Date(value);
}

// src/utils/getFieldBoolean/getFieldBoolean.ts
function getFieldBoolean(value) {
  if (!value || value === "null") {
    return null;
  }
  if (value === "undefined") {
    return void 0;
  }
  return !(value === "false" || value === "off" || value === "0");
}

// src/utils/getFieldNumber/getFieldNumber.ts
function getFieldNumber(value) {
  if (!value || value === "null") {
    return null;
  }
  if (value === "undefined") {
    return void 0;
  }
  if (NUMBER_REGEX.test(value)) {
    return Number(value);
  }
  return getFieldDate(value).getTime();
}

// src/utils/getFieldValue/getFieldValue.ts
function getFieldValue(info, templateName, value) {
  if (info?.booleans?.includes(templateName)) {
    return getFieldBoolean(value);
  }
  if (typeof value === "string") {
    if (info?.dates?.includes(templateName)) {
      return getFieldDate(value);
    }
    if (info?.numbers?.includes(templateName)) {
      return getFieldNumber(value);
    }
  }
  return value;
}

// src/utils/getPathObject/getPathObject.ts
function getPathObject(pathKeys, templateKeys, values) {
  return pathKeys.reduce(
    (object, key, index) => object[key] = object[key] || (templateKeys[index + 1] === "$" ? [] : {}),
    values
  );
}

// src/utils/getValuePaths/getValuePaths.ts
function getValuePaths(templateName, values) {
  const paths = [];
  if (templateName.includes(".$.")) {
    const addArrayItemPaths = (templateName2, parentPath) => {
      const [pr\u00E4fixPath, ...suffixPaths] = templateName2.split(".$.");
      const arrayPath = parentPath ? `${parentPath}.${pr\u00E4fixPath}` : pr\u00E4fixPath;
      const array = getPathObject(
        arrayPath.split("."),
        templateName2.split("."),
        values
      );
      for (let index = 0; index < array.length; index++) {
        const indexPath = `${arrayPath}.${index}`;
        if (suffixPaths.length > 1) {
          addArrayItemPaths(suffixPaths.join(".$."), indexPath);
        } else {
          paths.push(`${indexPath}.${suffixPaths[0]}`);
        }
      }
    };
    addArrayItemPaths(templateName);
  } else {
    paths.push(templateName);
  }
  return paths;
}

// src/decode.ts
function decode(formData, arg2, arg3) {
  const [info, transform] = typeof arg2 === "function" ? [void 0, arg2] : [arg2, arg3];
  if (info) {
    for (const key of [
      "arrays",
      "booleans",
      "dates",
      "files",
      "numbers"
    ]) {
      if (info[key]?.length) {
        info[key] = info[key].map(
          (templateName) => templateName.replace(/\[\$\]/g, ".$")
        );
      }
    }
  }
  const values = {};
  for (const [path, input] of formData.entries()) {
    const normlizedPath = path.replace(/\[(\d+)\]/g, ".$1");
    const templateName = normlizedPath.replace(/\.\d+\./g, ".$.").replace(/\.\d+$/, ".$");
    const keys = normlizedPath.split(".");
    const templateKeys = templateName.split(".");
    let current = values;
    for (let index = 0; index < keys.length; index++) {
      const key = keys[index];
      if (key === "__proto__" || key === "prototype" || key === "constructor") {
        break;
      }
      if (index < keys.length - 1) {
        if (current[key]) {
          current = current[key];
        } else {
          const isArray = index < keys.length - 2 ? templateKeys[index + 1] === "$" : info?.arrays?.includes(templateKeys.slice(0, -1).join("."));
          current = current[key] = isArray ? [] : {};
        }
      } else if (!info?.files?.includes(templateName) || input && (typeof input === "string" || input.size)) {
        let output = getFieldValue(info, templateName, input);
        if (transform) {
          output = transform({ path, input, output });
        }
        if (info?.arrays?.includes(templateName)) {
          if (current[key]) {
            current[key].push(output);
          } else {
            current[key] = [output];
          }
        } else {
          current[key] = output;
        }
      }
    }
  }
  if (info?.arrays) {
    for (const templateName of info.arrays) {
      const paths = getValuePaths(templateName, values);
      for (const path of paths) {
        const valueKeys = path.split(".");
        const lastKey = valueKeys[valueKeys.length - 1];
        const parent = getPathObject(
          valueKeys.slice(0, -1),
          templateName.split("."),
          values
        );
        if (!parent[lastKey]) {
          parent[lastKey] = [];
        }
      }
    }
  }
  if (info?.booleans) {
    for (const templateName of info.booleans) {
      const paths = getValuePaths(templateName, values);
      for (const path of paths) {
        const valueKeys = path.split(".");
        const lastKey = valueKeys[valueKeys.length - 1];
        const parent = getPathObject(
          valueKeys.slice(0, -1),
          templateName.split("."),
          values
        );
        if (parent[lastKey] !== true) {
          parent[lastKey] = false;
        }
      }
    }
  }
  return values;
}
// Annotate the CommonJS export names for ESM import in node:
0 && (module.exports = {
  decode,
  getFieldDate,
  getFieldValue,
  getPathObject,
  getValuePaths
});
