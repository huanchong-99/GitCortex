import { Store } from "@tanstack/store";
import { parseFunctionOrValue, createKey } from "./utils.js";
import { emitChange, pacerEventClient } from "./event-client.js";
function getDefaultThrottlerState() {
  return {
    executionCount: 0,
    isPending: false,
    lastArgs: void 0,
    lastExecutionTime: 0,
    nextExecutionTime: 0,
    status: "idle",
    maybeExecuteCount: 0
  };
}
const defaultOptions = {
  enabled: true,
  leading: true,
  trailing: true,
  wait: 0
};
class Throttler {
  constructor(fn, initialOptions) {
    this.fn = fn;
    this.store = new Store(
      getDefaultThrottlerState()
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
      emitChange("Throttler", this);
    };
    this.#getEnabled = () => {
      return !!parseFunctionOrValue(this.options.enabled, this);
    };
    this.#getWait = () => {
      return parseFunctionOrValue(this.options.wait, this);
    };
    this.maybeExecute = (...args) => {
      this.#setState({
        maybeExecuteCount: this.store.state.maybeExecuteCount + 1
      });
      const now = Date.now();
      const timeSinceLastExecution = now - this.store.state.lastExecutionTime;
      const wait = this.#getWait();
      if (this.options.leading && timeSinceLastExecution >= wait) {
        this.#execute(...args);
      } else {
        this.#setState({
          lastArgs: args
        });
        if (!this.#timeoutId && this.options.trailing) {
          const _timeSinceLastExecution = this.store.state.lastExecutionTime ? now - this.store.state.lastExecutionTime : 0;
          const timeoutDuration = wait - _timeSinceLastExecution;
          this.#setState({ isPending: true });
          this.#timeoutId = setTimeout(() => {
            const { lastArgs } = this.store.state;
            if (lastArgs !== void 0) {
              this.#execute(...lastArgs);
            }
          }, timeoutDuration);
        }
      }
    };
    this.#execute = (...args) => {
      if (!this.#getEnabled()) return;
      this.fn(...args);
      const lastExecutionTime = Date.now();
      const nextExecutionTime = lastExecutionTime + this.#getWait();
      this.#clearTimeout();
      this.#setState({
        executionCount: this.store.state.executionCount + 1,
        lastExecutionTime,
        nextExecutionTime,
        isPending: false,
        lastArgs: void 0
      });
      this.options.onExecute?.(args, this);
      setTimeout(() => {
        if (!this.store.state.isPending) {
          this.#setState({ nextExecutionTime: void 0 });
        }
      }, this.#getWait());
    };
    this.flush = () => {
      if (this.store.state.isPending && this.store.state.lastArgs) {
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
        lastArgs: void 0,
        isPending: false
      });
    };
    this.reset = () => {
      this.#setState(getDefaultThrottlerState());
    };
    this.key = createKey(initialOptions.key);
    this.options = {
      ...defaultOptions,
      ...initialOptions
    };
    this.#setState(this.options.initialState ?? {});
    pacerEventClient.on("d-Throttler", (event) => {
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
function throttle(fn, initialOptions) {
  const throttler = new Throttler(fn, initialOptions);
  return throttler.maybeExecute;
}
export {
  Throttler,
  throttle
};
//# sourceMappingURL=throttler.js.map
