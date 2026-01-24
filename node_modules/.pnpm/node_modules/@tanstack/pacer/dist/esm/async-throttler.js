import { Store } from "@tanstack/store";
import { parseFunctionOrValue, createKey } from "./utils.js";
import { emitChange, pacerEventClient } from "./event-client.js";
function getDefaultAsyncThrottlerState() {
  return {
    errorCount: 0,
    isExecuting: false,
    isPending: false,
    lastArgs: void 0,
    lastExecutionTime: 0,
    lastResult: void 0,
    maybeExecuteCount: 0,
    nextExecutionTime: void 0,
    settleCount: 0,
    status: "idle",
    successCount: 0
  };
}
const defaultOptions = {
  enabled: true,
  leading: true,
  trailing: true,
  wait: 0
};
class AsyncThrottler {
  constructor(fn, initialOptions) {
    this.fn = fn;
    this.store = new Store(getDefaultAsyncThrottlerState());
    this.#abortController = null;
    this.#timeoutId = null;
    this.#resolvePreviousPromise = null;
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
        const { isPending, isExecuting, settleCount } = combinedState;
        return {
          ...combinedState,
          status: !this.#getEnabled() ? "disabled" : isPending ? "pending" : isExecuting ? "executing" : settleCount > 0 ? "settled" : "idle"
        };
      });
      emitChange("AsyncThrottler", this);
    };
    this.#getEnabled = () => {
      return !!parseFunctionOrValue(this.options.enabled, this);
    };
    this.#getWait = () => {
      return parseFunctionOrValue(this.options.wait, this);
    };
    this.maybeExecute = async (...args) => {
      if (!this.#getEnabled()) return void 0;
      const now = Date.now();
      const timeSinceLastExecution = now - this.store.state.lastExecutionTime;
      const wait = this.#getWait();
      this.#setState({
        lastArgs: args,
        maybeExecuteCount: this.store.state.maybeExecuteCount + 1
      });
      this.#resolvePreviousPromiseInternal();
      if (this.options.leading && timeSinceLastExecution >= wait) {
        await this.#execute(...args);
        return this.store.state.lastResult;
      } else {
        return new Promise((resolve, reject) => {
          this.#resolvePreviousPromise = resolve;
          this.#clearTimeout();
          if (this.options.trailing) {
            const _timeSinceLastExecution = this.store.state.lastExecutionTime ? now - this.store.state.lastExecutionTime : 0;
            const timeoutDuration = wait - _timeSinceLastExecution;
            this.#setState({ isPending: true });
            this.#timeoutId = setTimeout(async () => {
              if (this.store.state.lastArgs !== void 0) {
                try {
                  await this.#execute(...this.store.state.lastArgs);
                } catch (error) {
                  reject(error);
                }
              }
              this.#resolvePreviousPromise = null;
              resolve(this.store.state.lastResult);
            }, timeoutDuration);
          }
        });
      }
    };
    this.#execute = async (...args) => {
      if (!this.#getEnabled() || this.store.state.isExecuting) return void 0;
      this.#abortController = new AbortController();
      try {
        this.#setState({ isExecuting: true });
        const result = await this.fn(...args);
        this.#setState({
          lastResult: result,
          successCount: this.store.state.successCount + 1
        });
        this.options.onSuccess?.(result, args, this);
      } catch (error) {
        this.#setState({
          errorCount: this.store.state.errorCount + 1
        });
        this.options.onError?.(error, args, this);
        if (this.options.throwOnError) {
          throw error;
        }
      } finally {
        const lastExecutionTime = Date.now();
        const nextExecutionTime = lastExecutionTime + this.#getWait();
        this.#setState({
          isExecuting: false,
          isPending: false,
          settleCount: this.store.state.settleCount + 1,
          lastExecutionTime,
          nextExecutionTime
        });
        this.#abortController = null;
        this.options.onSettled?.(args, this);
        setTimeout(() => {
          if (!this.store.state.isPending) {
            this.#setState({ nextExecutionTime: void 0 });
          }
        }, this.#getWait());
      }
      return this.store.state.lastResult;
    };
    this.flush = async () => {
      if (this.store.state.isPending && this.store.state.lastArgs) {
        this.#abortExecution();
        this.#clearTimeout();
        const result = await this.#execute(...this.store.state.lastArgs);
        this.#resolvePreviousPromiseInternal();
        return result;
      }
      return void 0;
    };
    this.#resolvePreviousPromiseInternal = () => {
      if (this.#resolvePreviousPromise) {
        this.#resolvePreviousPromise(this.store.state.lastResult);
        this.#resolvePreviousPromise = null;
      }
    };
    this.#clearTimeout = () => {
      if (this.#timeoutId) {
        clearTimeout(this.#timeoutId);
        this.#timeoutId = null;
      }
    };
    this.#cancelPendingExecution = () => {
      this.#clearTimeout();
      if (this.#resolvePreviousPromise) {
        this.#resolvePreviousPromiseInternal();
        this.#resolvePreviousPromise = null;
      }
      this.#setState({
        isPending: false,
        isExecuting: false,
        lastArgs: void 0
      });
    };
    this.#abortExecution = () => {
      if (this.#abortController) {
        this.#abortController.abort();
        this.#abortController = null;
      }
    };
    this.cancel = () => {
      this.#cancelPendingExecution();
      this.#abortExecution();
    };
    this.reset = () => {
      this.#setState(getDefaultAsyncThrottlerState());
    };
    this.key = createKey(initialOptions.key);
    this.options = {
      ...defaultOptions,
      ...initialOptions,
      throwOnError: initialOptions.throwOnError ?? !initialOptions.onError
    };
    this.#setState(this.options.initialState ?? {});
    pacerEventClient.on("d-AsyncThrottler", (event) => {
      if (event.payload.key !== this.key) return;
      this.#setState(event.payload.store.state);
      this.setOptions(event.payload.options);
    });
  }
  #abortController;
  #timeoutId;
  #resolvePreviousPromise;
  #setState;
  #getEnabled;
  #getWait;
  #execute;
  #resolvePreviousPromiseInternal;
  #clearTimeout;
  #cancelPendingExecution;
  #abortExecution;
}
function asyncThrottle(fn, initialOptions) {
  const asyncThrottler = new AsyncThrottler(fn, initialOptions);
  return asyncThrottler.maybeExecute;
}
export {
  AsyncThrottler,
  asyncThrottle
};
//# sourceMappingURL=async-throttler.js.map
