"use strict";
Object.defineProperty(exports, Symbol.toStringTag, { value: "Module" });
const devtoolsEventClient = require("@tanstack/devtools-event-client");
class PacerEventClient extends devtoolsEventClient.EventClient {
  constructor(props) {
    super({
      pluginId: "pacer",
      debug: props?.debug
    });
  }
}
const emitChange = (event, payload) => {
  pacerEventClient.emit(event, payload);
};
const pacerEventClient = new PacerEventClient();
exports.emitChange = emitChange;
exports.pacerEventClient = pacerEventClient;
//# sourceMappingURL=event-client.cjs.map
