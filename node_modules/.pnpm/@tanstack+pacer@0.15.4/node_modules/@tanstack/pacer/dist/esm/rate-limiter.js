import { Store } from "@tanstack/store";
import { parseFunctionOrValue, createKey } from "./utils.js";
import { emitChange, pacerEventClient } from "./event-client.js";
function getDefaultRateLimiterState() {
  return {
    executionCount: 0,
    executionTimes: [],
    isExceeded: false,
    rejectionCount: 0,
    status: "idle",
    maybeExecuteCount: 0
  };
}
const defaultOptions = {
  enabled: true,
  limit: 1,
  window: 0,
  windowType: "fixed"
};
class RateLimiter {
  constructor(fn, initialOptions) {
    this.fn = fn;
    this.store = new Store(getDefaultRateLimiterState());
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
        const status = !this.#getEnabled() ? "disabled" : isExceeded ? "exceeded" : "idle";
        return {
          ...combinedState,
          isExceeded,
          status
        };
      });
      emitChange("RateLimiter", this);
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
    this.maybeExecute = (...args) => {
      this.#setState({
        maybeExecuteCount: this.store.state.maybeExecuteCount + 1
      });
      this.#cleanupOldExecutions();
      const relevantExecutionTimes = this.#getExecutionTimesInWindow();
      if (relevantExecutionTimes.length < this.#getLimit()) {
        this.#execute(...args);
        return true;
      }
      this.#setState({
        rejectionCount: this.store.state.rejectionCount + 1
      });
      this.options.onReject?.(this);
      return false;
    };
    this.#execute = (...args) => {
      if (!this.#getEnabled()) return;
      const now = Date.now();
      this.fn(...args);
      this.store.state.executionTimes.push(now);
      this.#setCleanupTimeout(now);
      this.#setState({
        executionCount: this.store.state.executionCount + 1
      });
      this.options.onExecute?.(args, this);
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
      this.#setState(getDefaultRateLimiterState());
      this.#clearTimeouts();
    };
    this.key = createKey(initialOptions.key);
    this.options = {
      ...defaultOptions,
      ...initialOptions
    };
    this.#setState(this.options.initialState ?? {});
    for (const executionTime of this.#getExecutionTimesInWindow()) {
      this.#setCleanupTimeout(executionTime);
    }
    pacerEventClient.on("d-RateLimiter", (event) => {
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
function rateLimit(fn, initialOptions) {
  const rateLimiter = new RateLimiter(fn, initialOptions);
  return rateLimiter.maybeExecute;
}
export {
  RateLimiter,
  rateLimit
};
//# sourceMappingURL=rate-limiter.js.map
