import { EventClient } from "@tanstack/devtools-event-client";
class PacerEventClient extends EventClient {
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
export {
  emitChange,
  pacerEventClient
};
//# sourceMappingURL=event-client.js.map
