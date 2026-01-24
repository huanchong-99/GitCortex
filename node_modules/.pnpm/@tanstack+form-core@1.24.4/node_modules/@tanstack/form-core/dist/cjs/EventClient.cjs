"use strict";
Object.defineProperty(exports, Symbol.toStringTag, { value: "Module" });
const devtoolsEventClient = require("@tanstack/devtools-event-client");
class FormEventClient extends devtoolsEventClient.EventClient {
  constructor() {
    super({
      pluginId: "form-devtools"
    });
  }
}
const formEventClient = new FormEventClient();
exports.formEventClient = formEventClient;
//# sourceMappingURL=EventClient.cjs.map
