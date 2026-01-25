import { Store } from "@tanstack/store";
import { parseFunctionOrValue, createKey } from "./utils.js";
import { emitChange, pacerEventClient } from "./event-client.js";
function getDefaultAsyncBatcherState() {
  return {
    errorCount: 0,
    failedItems: [],
    isEmpty: true,
    isExecuting: false,
    isPending: false,
    items: [],
    lastResult: void 0,
    settleCount: 0,
    size: 0,
    status: "idle",
    successCount: 0,
    totalItemsProcessed: 0,
    totalItemsFailed: 0
  };
}
const defaultOptions = {
  getShouldExecute: () => false,
  maxSize: Infinity,
  started: true,
  throwOnError: true,
  wait: Infinity
};
class AsyncBatcher {
  constructor(fn, initialOptions) {
    this.fn = fn;
    this.store = new Store(
      getDefaultAsyncBatcherState()
    );
    this.#timeoutId = null;
    this.setOptions = (newOptions) => {
      this.options = { ...this.options, ...newOptions };
    };
    this.#setState = (newState) => {
      this.store.setState((state) => {
        const combinedState = {
          ...state,
          ...newState
        };
        const { isExecuting, isPending, items } = combinedState;
        const size = items.length;
        const isEmpty = size === 0;
        return {
          ...combinedState,
          isEmpty,
          size,
          status: isExecuting ? "executing" : isPending ? "pending" : isEmpty ? "idle" : "populated"
        };
      });
      emitChange("AsyncBatcher", this);
    };
    this.#getWait = () => {
      return parseFunctionOrValue(this.options.wait, this);
    };
    this.addItem = (item) => {
      this.#setState({
        items: [...this.store.state.items, item],
        isPending: this.options.wait !== Infinity
      });
      this.options.onItemsChange?.(this);
      const shouldProcess = this.store.state.items.length >= this.options.maxSize || this.options.getShouldExecute(this.store.state.items, this);
      if (shouldProcess) {
        this.#execute();
      } else if (this.options.wait !== Infinity) {
        this.#clearTimeout();
        this.#timeoutId = setTimeout(() => this.#execute(), this.#getWait());
      }
    };
    this.#execute = async () => {
      if (this.store.state.items.length === 0) {
        return void 0;
      }
      const batch = this.peekAllItems();
      this.clear();
      this.options.onItemsChange?.(this);
      this.#setState({ isExecuting: true });
      try {
        const result = await this.fn(batch);
        this.#setState({
          totalItemsProcessed: this.store.state.totalItemsProcessed + batch.length,
          lastResult: result,
          successCount: this.store.state.successCount + 1
        });
        this.options.onSuccess?.(result, batch, this);
        return result;
      } catch (error) {
        this.#setState({
          errorCount: this.store.state.errorCount + 1,
          failedItems: [...this.store.state.failedItems, ...batch],
          totalItemsFailed: this.store.state.totalItemsFailed + batch.length
        });
        this.options.onError?.(error, batch, this);
        if (this.options.throwOnError) {
          throw error;
        }
        return void 0;
      } finally {
        this.#setState({
          isExecuting: false,
          settleCount: this.store.state.settleCount + 1
        });
        this.options.onSettled?.(batch, this);
      }
    };
    this.flush = async () => {
      this.#clearTimeout();
      return await this.#execute();
    };
    this.peekAllItems = () => {
      return [...this.store.state.items];
    };
    this.peekFailedItems = () => {
      return [...this.store.state.failedItems];
    };
    this.#clearTimeout = () => {
      if (this.#timeoutId) {
        clearTimeout(this.#timeoutId);
        this.#timeoutId = null;
      }
    };
    this.clear = () => {
      this.#setState({ items: [], failedItems: [], isPending: false });
    };
    this.reset = () => {
      this.#setState(getDefaultAsyncBatcherState());
      this.options.onItemsChange?.(this);
    };
    this.key = createKey(initialOptions.key);
    this.options = {
      ...defaultOptions,
      ...initialOptions,
      throwOnError: initialOptions.throwOnError ?? !initialOptions.onError
    };
    this.#setState(this.options.initialState ?? {});
    pacerEventClient.on("d-AsyncBatcher", (event) => {
      if (event.payload.key !== this.key) return;
      this.#setState(event.payload.store.state);
      this.setOptions(event.payload.options);
    });
  }
  #timeoutId;
  #setState;
  #getWait;
  #execute;
  #clearTimeout;
}
function asyncBatch(fn, options) {
  const batcher = new AsyncBatcher(fn, options);
  return batcher.addItem;
}
export {
  AsyncBatcher,
  asyncBatch
};
//# sourceMappingURL=async-batcher.js.map
