import { Store } from "@tanstack/store";
import { parseFunctionOrValue, createKey } from "./utils.js";
import { emitChange, pacerEventClient } from "./event-client.js";
function getDefaultDebouncerState() {
  return {
    canLeadingExecute: true,
    executionCount: 0,
    isPending: false,
    lastArgs: void 0,
    status: "idle",
    maybeExecuteCount: 0
  };
}
const defaultOptions = {
  enabled: true,
  leading: false,
  trailing: true,
  wait: 0
};
class Debouncer {
  constructor(fn, initialOptions) {
    this.fn = fn;
    this.store = new Store(
      getDefaultDebouncerState()
    );
    this.setOptions = (newOptions) => {
      this.options = { ...this.options, ...newOptions };
      if (!this.#getEnabled()) {
        this.cancel();
      }
    };
    this.#setState = (newState) => {
      this.store.setState((state) => {
        const combinedState = {
          ...state,
          ...newState
        };
        const { isPending } = combinedState;
        return {
          ...combinedState,
          status: !this.#getEnabled() ? "disabled" : isPending ? "pending" : "idle"
        };
      });
      emitChange("Debouncer", this);
    };
    this.#getEnabled = () => {
      return !!parseFunctionOrValue(this.options.enabled, this);
    };
    this.#getWait = () => {
      return parseFunctionOrValue(this.options.wait, this);
    };
    this.maybeExecute = (...args) => {
      if (!this.#getEnabled()) return void 0;
      this.#setState({
        maybeExecuteCount: this.store.state.maybeExecuteCount + 1
      });
      let _didLeadingExecute = false;
      if (this.options.leading && this.store.state.canLeadingExecute) {
        this.#setState({ canLeadingExecute: false });
        _didLeadingExecute = true;
        this.#execute(...args);
      }
      if (this.options.trailing) {
        this.#setState({ isPending: true, lastArgs: args });
      }
      if (this.#timeoutId) clearTimeout(this.#timeoutId);
      this.#timeoutId = setTimeout(() => {
        this.#setState({ canLeadingExecute: true });
        if (this.options.trailing && !_didLeadingExecute) {
          this.#execute(...args);
        }
      }, this.#getWait());
    };
    this.#execute = (...args) => {
      if (!this.#getEnabled()) return void 0;
      this.fn(...args);
      this.#setState({
        executionCount: this.store.state.executionCount + 1,
        isPending: false,
        lastArgs: void 0
      });
      this.options.onExecute?.(args, this);
    };
    this.flush = () => {
      if (this.store.state.isPending && this.store.state.lastArgs) {
        this.#clearTimeout();
        this.#execute(...this.store.state.lastArgs);
      }
    };
    this.#clearTimeout = () => {
      if (this.#timeoutId) {
        clearTimeout(this.#timeoutId);
        this.#timeoutId = void 0;
      }
    };
    this.cancel = () => {
      this.#clearTimeout();
      this.#setState({
        canLeadingExecute: true,
        isPending: false
      });
    };
    this.reset = () => {
      this.#setState(getDefaultDebouncerState());
    };
    this.key = createKey(initialOptions.key);
    this.options = {
      ...defaultOptions,
      ...initialOptions
    };
    this.#setState(this.options.initialState ?? {});
    pacerEventClient.on("d-Debouncer", (event) => {
      if (event.payload.key !== this.key) return;
      this.#setState(event.payload.store.state);
      this.setOptions(event.payload.options);
    });
  }
  #timeoutId;
  #setState;
  #getEnabled;
  #getWait;
  #execute;
  #clearTimeout;
}
function debounce(fn, initialOptions) {
  const debouncer = new Debouncer(fn, initialOptions);
  return debouncer.maybeExecute;
}
export {
  Debouncer,
  debounce
};
//# sourceMappingURL=debouncer.js.map
