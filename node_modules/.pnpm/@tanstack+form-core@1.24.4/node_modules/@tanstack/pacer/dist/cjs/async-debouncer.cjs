"use strict";
Object.defineProperty(exports, Symbol.toStringTag, { value: "Module" });
const store = require("@tanstack/store");
const utils = require("./utils.cjs");
const eventClient = require("./event-client.cjs");
function getDefaultAsyncDebouncerState() {
  return {
    canLeadingExecute: true,
    errorCount: 0,
    isExecuting: false,
    isPending: false,
    lastArgs: void 0,
    lastResult: void 0,
    maybeExecuteCount: 0,
    settleCount: 0,
    status: "idle",
    successCount: 0
  };
}
const defaultOptions = {
  enabled: true,
  leading: false,
  trailing: true,
  wait: 0
};
class AsyncDebouncer {
  constructor(fn, initialOptions) {
    this.fn = fn;
    this.store = new store.Store(getDefaultAsyncDebouncerState());
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
      eventClient.emitChange("AsyncDebouncer", this);
    };
    this.#getEnabled = () => {
      return !!utils.parseFunctionOrValue(this.options.enabled, this);
    };
    this.#getWait = () => {
      return utils.parseFunctionOrValue(this.options.wait, this);
    };
    this.maybeExecute = async (...args) => {
      if (!this.#getEnabled()) return void 0;
      this.#cancelPendingExecution();
      this.#setState({
        lastArgs: args,
        maybeExecuteCount: this.store.state.maybeExecuteCount + 1
      });
      if (this.options.leading && this.store.state.canLeadingExecute) {
        this.#setState({ canLeadingExecute: false });
        await this.#execute(...args);
        return this.store.state.lastResult;
      }
      if (this.options.trailing && this.#getEnabled()) {
        this.#setState({ isPending: true });
      }
      return new Promise((resolve, reject) => {
        this.#resolvePreviousPromise = resolve;
        this.#timeoutId = setTimeout(async () => {
          if (this.options.trailing && this.store.state.lastArgs) {
            try {
              await this.#execute(...this.store.state.lastArgs);
            } catch (error) {
              reject(error);
            }
          }
          this.#setState({ canLeadingExecute: true });
          this.#resolvePreviousPromise = null;
          resolve(this.store.state.lastResult);
        }, this.#getWait());
      });
    };
    this.#execute = async (...args) => {
      if (!this.#getEnabled()) return void 0;
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
        this.#setState({
          isExecuting: false,
          isPending: false,
          lastArgs: void 0,
          settleCount: this.store.state.settleCount + 1
        });
        this.#abortController = null;
        this.options.onSettled?.(args, this);
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
      this.#resolvePreviousPromiseInternal();
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
      this.#setState({ canLeadingExecute: true });
    };
    this.reset = () => {
      this.#setState(getDefaultAsyncDebouncerState());
    };
    this.key = utils.createKey(initialOptions.key);
    this.options = {
      ...defaultOptions,
      ...initialOptions,
      throwOnError: initialOptions.throwOnError ?? !initialOptions.onError
    };
    this.#setState(this.options.initialState ?? {});
    eventClient.pacerEventClient.on("d-AsyncDebouncer", (event) => {
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
function asyncDebounce(fn, initialOptions) {
  const asyncDebouncer = new AsyncDebouncer(fn, initialOptions);
  return asyncDebouncer.maybeExecute;
}
exports.AsyncDebouncer = AsyncDebouncer;
exports.asyncDebounce = asyncDebounce;
//# sourceMappingURL=async-debouncer.cjs.map
