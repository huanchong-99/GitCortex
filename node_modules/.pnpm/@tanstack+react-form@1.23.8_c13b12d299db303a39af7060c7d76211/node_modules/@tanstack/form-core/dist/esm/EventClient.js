import { EventClient } from "@tanstack/devtools-event-client";
class FormEventClient extends EventClient {
  constructor() {
    super({
      pluginId: "form-devtools"
    });
  }
}
const formEventClient = new FormEventClient();
export {
  formEventClient
};
//# sourceMappingURL=EventClient.js.map
