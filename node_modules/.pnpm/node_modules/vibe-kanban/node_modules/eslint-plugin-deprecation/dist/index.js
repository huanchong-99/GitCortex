"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.rules = exports.meta = exports.configs = void 0;
const rules = require("./rules");
exports.rules = rules;
const configs = require("./configs");
exports.configs = configs;
const packageData = require('../package.json');
const meta = { name: packageData.name, version: packageData.version };
exports.meta = meta;
//# sourceMappingURL=index.js.map