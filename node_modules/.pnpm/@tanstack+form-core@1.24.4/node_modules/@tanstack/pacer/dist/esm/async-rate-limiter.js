import { Store } from "@tanstack/store";
import { parseFunctionOrValue, createKey } from "./utils.js";
import { emitChange, pacerEventClient } from "./event-client.js";
function getDefaultAsyncRateLimiterState() {
  return {
    errorCount: 0,
    executionTimes: [],
    isExceeded: false,
    isExecuting: false,
    lastResult: void 0,
    maybeExecuteCount: 0,
    rejectionCount: 0,
    settleCount: 0,
    status: "idle",
    successCount: 0
  };
}
const defaultOptions = {
  enabled: true,
  limit: 1,
  window: 0,
  windowType: "fixed",
  throwOnError: true
};
class AsyncRateLimiter {
  constructor(fn, initialOptions) {
    this.fn = fn;
    this.store = new Store(getDefaultAsyncRateLimiterState());
    this.#timeoutIds = /* @__PURE__ */ new Set();
    this.setOptions = (newOptions) => {
      this.options = { ...this.options, ...newOptions };
    };
    this.#setState = (newState) => {
      this.store.setState((state) => {
        const combinedState = {
          ...state,
          ...newState
        };
        const isExceeded = combinedState.executionTimes.length >= this.#getLimit();
        const status = !this.#getEnabled() ? "disabled" : combinedState.isExecuting ? "executing" : isExceeded ? "exceeded" : "idle";
        return {
          ...combinedState,
          isExceeded,
          status
        };
      });
      emitChange("AsyncRateLimiter", this);
    };
    this.#getEnabled = () => {
      return !!parseFunctionOrValue(this.options.enabled, this);
    };
    this.#getLimit = () => {
      return parseFunctionOrValue(this.options.limit, this);
    };
    this.#getWindow = () => {
      return parseFunctionOrValue(this.options.window, this);
    };
    this.maybeExecute = async (...args) => {
      this.#setState({
        maybeExecuteCount: this.store.state.maybeExecuteCount + 1
      });
      this.#cleanupOldExecutions();
      const relevantExecutionTimes = this.#getExecutionTimesInWindow();
      if (relevantExecutionTimes.length < this.#getLimit()) {
        await this.#execute(...args);
        return this.store.state.lastResult;
      }
      this.#setState({
        rejectionCount: this.store.state.rejectionCount + 1
      });
      this.options.onReject?.(args, this);
      return void 0;
    };
    this.#execute = async (...args) => {
      if (!this.#getEnabled()) return;
      const now = Date.now();
      const executionTimes = [...this.store.state.executionTimes, now];
      this.#setState({
        isExecuting: true,
        executionTimes
      });
      try {
        const result = await this.fn(...args);
        this.#setCleanupTimeout(now);
        this.#setState({
          successCount: this.store.state.successCount + 1,
          lastResult: result
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
          settleCount: this.store.state.settleCount + 1
        });
        this.options.onSettled?.(args, this);
      }
      return this.store.state.lastResult;
    };
    this.#getExecutionTimesInWindow = () => {
      if (this.options.windowType === "sliding") {
        return this.store.state.executionTimes.filter(
          (time) => time > Date.now() - this.#getWindow()
        );
      } else {
        if (this.store.state.executionTimes.length === 0) {
          return [];
        }
        const oldestExecution = Math.min(...this.store.state.executionTimes);
        const windowStart = oldestExecution;
        const windowEnd = windowStart + this.#getWindow();
        const now = Date.now();
        if (now > windowEnd) {
          return [];
        }
        return this.store.state.executionTimes.filter(
          (time) => time >= windowStart && time <= windowEnd
        );
      }
    };
    this.#setCleanupTimeout = (executionTime) => {
      if (this.options.windowType === "sliding" || this.#timeoutIds.size === 0) {
        const now = Date.now();
        const timeUntilExpiration = executionTime - now + this.#getWindow() + 1;
        const timeoutId = setTimeout(() => {
          this.#cleanupOldExecutions();
          this.#clearTimeout(timeoutId);
        }, timeUntilExpiration);
        this.#timeoutIds.add(timeoutId);
      }
    };
    this.#clearTimeout = (timeoutId) => {
      clearTimeout(timeoutId);
      this.#timeoutIds.delete(timeoutId);
    };
    this.#clearTimeouts = () => {
      this.#timeoutIds.forEach((timeoutId) => clearTimeout(timeoutId));
      this.#timeoutIds.clear();
    };
    this.#cleanupOldExecutions = () => {
      this.#setState({
        executionTimes: this.#getExecutionTimesInWindow()
      });
    };
    this.getRemainingInWindow = () => {
      const relevantExecutionTimes = this.#getExecutionTimesInWindow();
      return Math.max(0, this.#getLimit() - relevantExecutionTimes.length);
    };
    this.getMsUntilNextWindow = () => {
      if (this.getRemainingInWindow() > 0) {
        return 0;
      }
      const oldestExecution = this.store.state.executionTimes[0] ?? Infinity;
      return oldestExecution + this.#getWindow() - Date.now();
    };
    this.reset = () => {
      this.#setState(getDefaultAsyncRateLimiterState());
      this.#clearTimeouts();
    };
    this.key = createKey(initialOptions.key);
    this.options = {
      ...defaultOptions,
      ...initialOptions,
      throwOnError: initialOptions.throwOnError ?? !initialOptions.onError
    };
    this.#setState(this.options.initialState ?? {});
    for (const executionTime of this.#getExecutionTimesInWindow()) {
      this.#setCleanupTimeout(executionTime);
    }
    pacerEventClient.on("d-AsyncRateLimiter", (event) => {
      if (event.payload.key !== this.key) return;
      this.#setState(event.payload.store.state);
      this.setOptions(event.payload.options);
    });
  }
  #timeoutIds;
  #setState;
  #getEnabled;
  #getLimit;
  #getWindow;
  #execute;
  #getExecutionTimesInWindow;
  #setCleanupTimeout;
  #clearTimeout;
  #clearTimeouts;
  #cleanupOldExecutions;
}
function asyncRateLimit(fn, initialOptions) {
  const rateLimiter = new AsyncRateLimiter(fn, initialOptions);
  return rateLimiter.maybeExecute;
}
export {
  AsyncRateLimiter,
  asyncRateLimit
};
//# sourceMappingURL=async-rate-limiter.js.map
